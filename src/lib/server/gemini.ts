import { APICallError, generateObject, type ModelMessage } from "ai";
import type { z } from "zod";

import { explanationSchema, modelInvoiceSchema } from "../gst/schemas";
import type { InvoiceResult, Language } from "../gst/types";
import { createLovableAiGatewayProvider, LOVABLE_GATEWAY_BASE_URL } from "./gateway";
import { EXTRACTION_SYSTEM, explainSystem } from "./prompts";

const TIMEOUT_MS = 45_000;

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
    fetch: deps.fetch,
  });
  try {
    const { object } = await generateObject({
      model: provider(model),
      schema,
      system,
      messages,
      temperature: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return object;
  } catch (error) {
    const gatewayError = toGatewayError(error);
    if (gatewayError) throw gatewayError;
    throw error;
  }
}

/** Vision extraction for one invoice. Output is schema-validated before it is trusted. */
export async function extractInvoice(creds: ModelCreds, mimeType: string, base64: string) {
  return callModel({
    ...creds,
    system: EXTRACTION_SYSTEM,
    schema: modelInvoiceSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: `data:${mimeType};base64,${base64}` },
          { type: "text", text: "Extract the invoice fields as JSON." },
        ],
      },
    ],
  });
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
  return callModel({
    ...creds,
    system: explainSystem(lang),
    schema: explanationSchema,
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
}
