import { rateConfig, stateCodes } from "../gst/config";
import { reconcile } from "../gst/reconcile";
import { gstr2bListSchema } from "../gst/schemas";
import type { ExtractedInvoice, FollowUp, Language, ReconcileResponse } from "../gst/types";
import { readConfig } from "./config";
import { gstr2bRowsFromCsv } from "./csv";
import { explainFindings, extractInvoice, GatewayError, type GeminiDeps } from "./gemini";
import { clientIp, FixedWindowLimiter } from "./rate-limit";
import { checkInvoiceFile, safeFileName, toBase64 } from "./upload";

const SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...extra } });

const fail = (status: number, error: string, extra?: Record<string, string>): Response =>
  json({ error }, status, extra);

const parseLanguage = (value: FormDataEntryValue | null): Language =>
  value === "hi" || value === "mr" ? value : "en";

const CONCURRENCY = 4;
const EXTRACT_ERROR = "This document could not be read. Try a clearer scan or photo.";

let limiter: { limit: number; instance: FixedWindowLimiter } | null = null;

async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const fallbackNarrative = (itc: number, count: number): string =>
  `Checked ${count} invoice${count === 1 ? "" : "s"}. Estimated input tax credit at risk: ₹${itc.toLocaleString("en-IN")}. ` +
  "Review the flagged invoices and contact the suppliers listed.";

export interface HandlerDeps extends GeminiDeps {
  now?: () => number;
}

/** POST /api/reconcile: validate uploads, extract with Gemini, reconcile in code, explain. */
export async function handleReconcile(
  request: Request,
  env: Record<string, string | undefined>,
  deps: HandlerDeps = { fetch: globalThis.fetch.bind(globalThis) },
): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const config = readConfig(env);

  if (!config.apiKey) return fail(503, "The service is not configured. Please try again later.");

  if (limiter?.limit !== config.rateLimitPerMin) {
    limiter = { limit: config.rateLimitPerMin, instance: new FixedWindowLimiter(config.rateLimitPerMin, 60_000) };
  }
  if (!limiter.instance.allow(clientIp(request))) {
    return fail(429, "Too many requests. Please wait a minute and try again.", { "Retry-After": "60" });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  const maxBody = config.maxFiles * config.maxFileBytes + config.maxCsvBytes + 1024 * 1024;
  if (declaredLength > maxBody) return fail(413, "The upload is too large.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Send the files as multipart form data.");
  }

  const invoiceFiles = form.getAll("invoices").filter((v): v is File => typeof v !== "string");
  const csvEntry = form.get("gstr2b");
  if (invoiceFiles.length === 0 || invoiceFiles.length > config.maxFiles) {
    return fail(400, `Upload between 1 and ${config.maxFiles} invoices.`);
  }
  if (csvEntry === null || typeof csvEntry === "string") return fail(400, "Upload your GSTR-2B CSV file.");
  if (csvEntry.size > config.maxCsvBytes) return fail(413, "The GSTR-2B file is too large (1 MB max).");

  const csv = gstr2bRowsFromCsv(await csvEntry.text());
  if (!csv.ok) return fail(400, csv.reason);
  const parsed2b = gstr2bListSchema.safeParse(csv.rows);
  if (!parsed2b.success) return fail(400, "The GSTR-2B file has invalid or missing values. Check the amounts and dates.");

  const lang = parseLanguage(form.get("lang"));
  const creds = { apiKey: config.apiKey, model: config.model, deps };
  const failed: ReconcileResponse["failed"] = [];
  let gatewayError: GatewayError | null = null;

  // 1. Extraction (vision model), a few files at a time
  const extractStart = now();
  const extracted = await mapPool(invoiceFiles, CONCURRENCY, async (file): Promise<ExtractedInvoice | null> => {
    const fileName = safeFileName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkInvoiceFile(bytes, config.maxFileBytes);
    if (!check.ok) {
      failed.push({ fileName, reason: check.reason });
      return null;
    }
    try {
      const data = await extractInvoice(creds, check.mimeType, toBase64(bytes));
      return {
        ...data,
        fileName,
        supplierGstin: data.supplierGstin.trim().toUpperCase(),
        buyerGstin: data.buyerGstin.trim().toUpperCase(),
      };
    } catch (error) {
      if (error instanceof GatewayError) {
        // Account, credit or access problem: stop the whole batch with the provider's safe message.
        gatewayError = error;
        return null;
      }
      console.error("extraction failed", error instanceof Error ? error.message : "unknown");
      failed.push({ fileName, reason: EXTRACT_ERROR });
      return null;
    }
  });
  const invoices = extracted.filter((inv): inv is ExtractedInvoice => inv !== null);
  const extractMs = now() - extractStart;
  if (gatewayError) return fail(gatewayError.status, gatewayError.message);
  if (invoices.length === 0) return json({ error: "No invoice could be read.", failed }, 422);

  // 2. Reconciliation: pure code, no model involved
  const reconcileStart = now();
  const summary = reconcile(invoices, parsed2b.data, { rateConfig, stateCodes });
  const reconcileMs = now() - reconcileStart;

  // 3. Explanation (Gemini), with a template fallback so the result never depends on it
  const explainStart = now();
  let narrative = fallbackNarrative(summary.itcAtRiskTotal, summary.results.length);
  let followUps: FollowUp[] = [];
  const flagged = summary.results.filter((r) => r.status !== "clean");
  if (flagged.length > 0) {
    try {
      const explanation = await explainFindings(creds, lang, { itcAtRiskTotal: summary.itcAtRiskTotal, invoices: flagged });
      narrative = explanation.summary;
      followUps = explanation.followUps;
    } catch (error) {
      console.error("explanation failed", error instanceof Error ? error.message : "unknown");
    }
  }
  const explainMs = now() - explainStart;

  const body: ReconcileResponse = {
    summary,
    narrative,
    followUps,
    failed,
    timingsMs: { extract: extractMs, reconcile: reconcileMs, explain: explainMs, total: now() - started },
    model: config.model,
  };
  return json(body);
}
