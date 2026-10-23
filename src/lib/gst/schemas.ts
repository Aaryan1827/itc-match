import { z } from "zod";

/**
 * Runtime validation for everything that crosses a trust boundary:
 * model output from Gemini and the parsed GSTR-2B file. Never use unvalidated model output.
 */
const money = z.number().finite().min(0).max(1_000_000_000);

export const invoiceLineSchema = z.object({
  description: z.string().max(300),
  hsn: z.string().max(12),
  quantity: z.number().finite().min(0),
  unitRate: money,
  amount: money,
});

export const extractedInvoiceSchema = z.object({
  fileName: z.string().max(200),
  supplierName: z.string().max(200),
  supplierGstin: z.string().max(20),
  buyerGstin: z.string().max(20),
  invoiceNumber: z.string().min(1).max(40),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  lines: z.array(invoiceLineSchema).max(200),
  taxableValue: money,
  taxRatePercent: z.number().finite().min(0).max(100).nullable(),
  igst: money,
  cgst: money,
  sgst: money,
  total: money,
  confidence: z.number().min(0).max(1),
});

export const gstr2bRowSchema = z.object({
  supplierGstin: z.string().max(20),
  supplierName: z.string().max(200),
  invoiceNumber: z.string().min(1).max(40),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taxableValue: money,
  igst: money,
  cgst: money,
  sgst: money,
  invoiceValue: money,
});

export const extractedInvoiceListSchema = z.array(extractedInvoiceSchema).max(10);
export const gstr2bListSchema = z.array(gstr2bRowSchema).max(5000);
