import { explanationSchema, modelInvoiceSchema } from "../gst/schemas";
import type { InvoiceResult, Language } from "../gst/types";
import { EXPLANATION_RESPONSE_SCHEMA, INVOICE_RESPONSE_SCHEMA } from "./response-schemas";
import { EXTRACTION_SYSTEM, explainSystem } from "./prompts";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 45_000;

export interface GeminiDeps {
  fetch: typeof fetch;
}

interface GenerateArgs {
  apiKey: string;
  model: string;
  system: string;
  parts: Record<string, unknown>[];
  schema: object;
  deps: GeminiDeps;
}

/** One structured-output call. Errors carry no request content so they are safe to log. */
async function generateJson({ apiKey, model, system, parts, schema, deps }: GenerateArgs): Promise<unknown> {
  const response = await deps.fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!raw) throw new Error("Gemini returned no content");
  return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}

export interface ModelCreds {
  apiKey: string;
  model: string;
  deps: GeminiDeps;
}

/** Vision extraction for one invoice. Output is schema-validated before it is trusted. */
export async function extractInvoice(creds: ModelCreds, mimeType: string, base64: string) {
  const json = await generateJson({
    ...creds,
    system: EXTRACTION_SYSTEM,
    schema: INVOICE_RESPONSE_SCHEMA,
    parts: [{ inlineData: { mimeType, data: base64 } }, { text: "Extract the invoice fields." }],
  });
  return modelInvoiceSchema.parse(json);
}

/** Plain-language summary and supplier messages, written from already-computed findings. */
export async function explainFindings(
  creds: ModelCreds,
  lang: Language,
  findings: { itcAtRiskTotal: number; invoices: InvoiceResult[] },
) {
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
  const json = await generateJson({
    ...creds,
    system: explainSystem(lang),
    schema: EXPLANATION_RESPONSE_SCHEMA,
    parts: [{ text: JSON.stringify(payload) }],
  });
  return explanationSchema.parse(json);
}
