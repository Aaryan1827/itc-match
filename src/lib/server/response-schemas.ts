/** Gemini responseSchema definitions (OpenAPI subset). Output is still re-validated with Zod. */
const text = { type: "STRING" } as const;
const amount = { type: "NUMBER" } as const;

export const INVOICE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    supplierName: text,
    supplierGstin: text,
    buyerGstin: text,
    invoiceNumber: text,
    invoiceDate: text,
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { description: text, hsn: text, quantity: amount, unitRate: amount, amount },
        required: ["description", "hsn", "quantity", "unitRate", "amount"],
      },
    },
    taxableValue: amount,
    taxRatePercent: { type: "NUMBER", nullable: true },
    igst: amount,
    cgst: amount,
    sgst: amount,
    total: amount,
    confidence: amount,
  },
  required: [
    "supplierName", "supplierGstin", "buyerGstin", "invoiceNumber", "invoiceDate", "lines",
    "taxableValue", "taxRatePercent", "igst", "cgst", "sgst", "total", "confidence",
  ],
} as const;

export const EXPLANATION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: text,
    followUps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { invoiceNumber: text, message: text },
        required: ["invoiceNumber", "message"],
      },
    },
  },
  required: ["summary", "followUps"],
} as const;
