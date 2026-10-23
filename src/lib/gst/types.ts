/** Shared domain types for TaxSure AI. Pure data, no side effects. */

export interface InvoiceLine {
  description: string;
  hsn: string;
  quantity: number;
  unitRate: number;
  amount: number;
}

/** What the extraction step (Gemini vision) must return for each invoice. */
export interface ExtractedInvoice {
  fileName: string;
  supplierName: string;
  supplierGstin: string;
  buyerGstin: string;
  invoiceNumber: string;
  /** ISO date, YYYY-MM-DD */
  invoiceDate: string;
  lines: InvoiceLine[];
  taxableValue: number;
  /** Combined GST rate: the IGST rate, or CGST + SGST rates added together. Null if not printed. */
  taxRatePercent: number | null;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
  /** Extraction confidence between 0 and 1. */
  confidence: number;
}

/** One row of the GSTR-2B statement. */
export interface Gstr2bRow {
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  invoiceValue: number;
}

export type IssueCode =
  | "GSTIN_FORMAT"
  | "GSTIN_CHECKSUM"
  | "TAX_TYPE_MISMATCH"
  | "ARITHMETIC_MISMATCH"
  | "RATE_NOT_ALLOWED"
  | "NOT_IN_2B"
  | "FUZZY_MATCH"
  | "VALUE_MISMATCH_2B"
  | "DUPLICATE_INVOICE"
  | "LOW_CONFIDENCE";

export type Status = "clean" | "fixable" | "itc_at_risk" | "needs_review";

export interface Issue {
  code: IssueCode;
  /** Plain-language explanation shown in the UI. */
  message: string;
}

export interface InvoiceResult {
  fileName: string;
  invoiceNumber: string;
  supplierName: string;
  status: Status;
  issues: Issue[];
  /** Total GST on the invoice (IGST + CGST + SGST). */
  taxAmount: number;
  /** Tax amount counted as at risk; zero unless status is itc_at_risk. */
  itcAtRisk: number;
  matchedTo: Gstr2bRow | null;
}

export interface ReconcileSummary {
  results: InvoiceResult[];
  /** GSTR-2B rows that no uploaded invoice matched. */
  unmatchedGstr2b: Gstr2bRow[];
  itcAtRiskTotal: number;
  counts: Record<Status, number>;
}

export interface RateConfig {
  periods: { from: string; to: string | null; allowedRates: number[] }[];
  roundingToleranceInr: number;
}

export type StateCodes = Record<string, string>;
