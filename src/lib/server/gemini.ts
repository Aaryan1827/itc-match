import { z } from "zod";

import { explanationSchema, modelInvoiceSchema } from "../gst/schemas";
import type { FollowUp, InvoiceResult, Language } from "../gst/types";
import { EXTRACTION_SYSTEM, explainSystem } from "./prompts";

/** Maximum time to wait for a single model call before aborting. */
const TIMEOUT_MS = 45_000;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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
  403: "The AI service is not configured correctly.",
  404: "The AI model is currently unavailable.",
  429: "Too many requests to the AI service. Please wait a moment and try again.",
  402: "The AI service is temporarily unavailable.",
};

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
function toStrictInvoice(raw: z.infer<typeof looseInvoiceSchema>): z.infer<typeof modelInvoiceSchema> {
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

/** A single content part sent to Gemini. */
type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface CallArgs<T> {
  apiKey: string;
  model: string;
  system: string;
  parts: GeminiPart[];
  schema: z.ZodType<T>;
  deps: GeminiDeps;
}

/** POST to Gemini generateContent and return the parsed, schema-validated JSON output. */
async function callModel<T>({ apiKey, model, system, parts, schema, deps }: CallArgs<T>): Promise<T> {
  const cleanModel = (model || "gemini-2.5-flash").replace(/^models\//, "").replace(/^google\//, "");
  const url = `${GEMINI_BASE}/${encodeURIComponent(cleanModel)}:generateContent`;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });

  const res = await deps.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const status = res.status;
    let message = SAFE_STATUS_MESSAGES[status] ?? "The AI service is temporarily unavailable.";
    try {
      const errBody = (await res.json()) as { error?: { message?: string }; message?: string };
      const detailed = errBody.error?.message ?? errBody.message;
      if (detailed && detailed.length <= 300) message = detailed;
    } catch {
      // keep safe default
    }
    if (status === 401 || status === 402 || status === 403 || status === 404 || status === 429) {
      throw new GatewayError(status, message);
    }
    throw new Error(`Gemini error ${status}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return schema.parse(JSON.parse(stripped));
}

/** Vision extraction for one invoice. Output is schema-validated before it is trusted. */
export async function extractInvoice(
  creds: ModelCreds,
  mimeType: string,
  base64: string,
): Promise<z.infer<typeof modelInvoiceSchema>> {
  const raw = await callModel({
    ...creds,
    system: EXTRACTION_SYSTEM,
    schema: looseInvoiceSchema,
    parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: "Extract the invoice fields as JSON." },
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
    parts: [
      {
        text: `Findings (data):\n${JSON.stringify(payload, null, 2)}\n\nRespond with the JSON object described in your instructions.`,
      },
    ],
  });
  return explanationSchema.parse(raw);
}
