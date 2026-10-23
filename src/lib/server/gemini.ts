import { APICallError, generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";

import { explanationSchema, modelInvoiceSchema } from "../gst/schemas";
import type { ExtractedInvoice, FollowUp, InvoiceResult, Language } from "../gst/types";
import { createLovableAiGatewayProvider, LOVABLE_GATEWAY_BASE_URL } from "./gateway";
import { EXTRACTION_SYSTEM, explainSystem } from "./prompts";

const TIMEOUT_MS = 60_000;

export interface GeminiDeps {
  fetch: typeof fetch;
}

export interface ModelCreds {
  apiKey: string;
  model: string;
  deps: GeminiDeps;
}

/** Provider-level failure (configuration, credits, access) with a safe, user-facing message. */
export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const SAFE_STATUS_MESSAGES: Record<number, string> = {
  401: "The AI service is not configured correctly.",
  404: "The AI model is currently unavailable.",
};

/** Map account/credit/access failures to a GatewayError; other failures are ordinary errors. */
function toGatewayError(error: unknown): GatewayError | null {
  if (!(error instanceof APICallError)) return null;
  const status = error.statusCode ?? 0;
  if (status !== 401 && status !== 402 && status !== 403 && status !== 404) return null;
  let message = SAFE_STATUS_MESSAGES[status] ?? "The AI service is temporarily unavailable.";
  try {
    const body = JSON.parse(String(error.responseBody ?? "{}")) as {
      error?: { message?: string };
      message?: string;
    };
    const detailed = body.error?.message ?? body.message;
    if (detailed && detailed.length <= 300) message = detailed;
  } catch {
    // keep the safe default
  }
  return new GatewayError(status, message);
}

/**
 * Loose output schemas for the model: no bounds or patterns (constrained decoding
 * rejects large ranges). The strict domain schemas re-validate everything in code.
 */
const looseInvoiceSchema = z.object({
  supplierName: z.string(),
  supplierGstin: z.string(),
  buyerGstin: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  lines: z.array(
    z.object({
      description: z.string(),
      hsn: z.string(),
      quantity: z.number(),
      unitRate: z.number(),
      amount: z.number(),
    }),
  ),
  taxableValue: z.number(),
  taxRatePercent: z.number().nullable(),
  igst: z.number(),
  cgst: z.number(),
  sgst: z.number(),
  total: z.number(),
  confidence: z.number(),
});

const looseExplanationSchema = z.object({
  summary: z.string(),
  followUps: z.array(z.object({ invoiceNumber: z.string(), message: z.string() })),
});

const nonNegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

/** Clamp model output into the range the strict schemas accept, then validate strictly. */
function toStrictInvoice(raw: z.infer<typeof looseInvoiceSchema>): ExtractedInvoice {
  const candidate = {
    ...raw,
    lines: raw.lines.map((line) => ({ ...line, quantity: nonNegative(line.quantity) })),
    taxableValue: nonNegative(raw.taxableValue),
    taxRatePercent: raw.taxRatePercent === null ? null : nonNegative(raw.taxRatePercent),
    igst: nonNegative(raw.igst),
    cgst: nonNegative(raw.cgst),
    sgst: nonNegative(raw.sgst),
    total: nonNegative(raw.total),
    confidence: raw.confidence > 1 ? raw.confidence / 100 : nonNegative(raw.confidence),
  };
  return modelInvoiceSchema.parse(candidate);
}

interface CallArgs<T> {
  apiKey: string;
  model: string;
  system: string;
  messages: ModelMessage[];
  schema: z.ZodType<T>;
  deps: GeminiDeps;
}

/** One structured-output call through the built-in AI route. Errors carry no request content. */
async function callModel<T>({ apiKey, model, system, messages, schema, deps }: CallArgs<T>): Promise<T> {
  const provider = createLovableAiGatewayProvider(apiKey, undefined, {
    baseURL: LOVABLE_GATEWAY_BASE_URL,
    structuredOutputs: true,
    fetch: deps.fetch,
  });
  try {
    const { output } = await generateText({
      model: provider(model),
      output: Output.object({ schema }),
      system,
      messages,
      temperature: 0,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return output;
  } catch (error) {
    const gatewayError = toGatewayError(error);
    if (gatewayError) throw gatewayError;
    throw error;
  }
}

/** Vision extraction for one invoice. Output is schema-validated before it is trusted. */
export async function extractInvoice(creds: ModelCreds, mimeType: string, base64: string): Promise<ExtractedInvoice> {
  const raw = await callModel({
    ...creds,
    system: EXTRACTION_SYSTEM,
    schema: looseInvoiceSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data: base64, mediaType: mimeType },
          { type: "text", text: "Extract the invoice fields as JSON." },
        ],
      },
    ],
  });
  return toStrictInvoice(raw);
}

/** Plain-language summary and supplier messages, written from already-computed findings. */
export async function explainFindings(
  creds: ModelCreds,
  lang: Language,
  findings: { itcAtRiskTotal: number; invoices: InvoiceResult[] },
): Promise<{ summary: string; followUps: FollowUp[] }> {
  const payload = {
    itcAtRiskTotalInr: findings.itcAtRiskTotal,
    invoices: findings.invoices.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      supplier: r.supplierName,
      status: r.status,
      taxAmountInr: r.taxAmount,
      problems: r.issues.map((i) => i.message),
    })),
  };
  const raw = await callModel({
    ...creds,
    system: explainSystem(lang),
    schema: looseExplanationSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Findings (data):\n${JSON.stringify(payload, null, 2)}\n\nRespond with the JSON object described in your instructions.`,
          },
        ],
      },
    ],
  });
  return explanationSchema.parse(raw);
}
