import { stateOf, validateGstin } from "./gstin";
import type { ExtractedInvoice, Issue, RateConfig, StateCodes } from "./types";

const RATE_MATCH_EPSILON = 0.05;

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const totalTax = (inv: Pick<ExtractedInvoice, "igst" | "cgst" | "sgst">): number =>
  round2(inv.igst + inv.cgst + inv.sgst);

/** Allowed GST rates for a given invoice date, from the dated config. */
export function allowedRatesOn(date: string, config: RateConfig): number[] {
  const period = config.periods.find((p) => date >= p.from && (p.to === null || date <= p.to));
  return period ? period.allowedRates : [];
}

/** Supplier GSTIN must be well formed, known, and pass the check digit. */
export function checkSupplierGstin(inv: ExtractedInvoice, stateCodes: StateCodes): Issue[] {
  const problem = validateGstin(inv.supplierGstin, stateCodes);
  if (problem === "checksum") {
    return [{ code: "GSTIN_CHECKSUM", message: `Supplier GSTIN ${inv.supplierGstin} fails the check-digit test, so it is probably mistyped or invalid. ITC cannot be claimed against an invalid GSTIN.` }];
  }
  if (problem) {
    return [{ code: "GSTIN_FORMAT", message: `Supplier GSTIN ${inv.supplierGstin} is not in a valid GSTIN format.` }];
  }
  return [];
}

/** Same-state sales carry CGST + SGST; inter-state sales carry IGST only. */
export function checkTaxType(inv: ExtractedInvoice, stateCodes: StateCodes): Issue[] {
  if (validateGstin(inv.supplierGstin, stateCodes) === "format" || validateGstin(inv.buyerGstin, stateCodes) === "format") {
    return [];
  }
  const intraState = stateOf(inv.supplierGstin) === stateOf(inv.buyerGstin);
  if (intraState && inv.igst > 0) {
    return [{ code: "TAX_TYPE_MISMATCH", message: "Supplier and buyer are in the same state, so CGST + SGST should apply, but IGST was charged. Ask the supplier for a corrected invoice." }];
  }
  if (!intraState && (inv.cgst > 0 || inv.sgst > 0)) {
    return [{ code: "TAX_TYPE_MISMATCH", message: "Supplier and buyer are in different states, so IGST should apply, but CGST/SGST was charged. Ask the supplier for a corrected invoice." }];
  }
  return [];
}

/** Line items, tax at the printed rate, and the invoice total must all reconcile. */
export function checkArithmetic(inv: ExtractedInvoice, config: RateConfig): Issue[] {
  const tolerance = config.roundingToleranceInr;
  const issues: string[] = [];
  const linesSum = round2(inv.lines.reduce((sum, l) => sum + l.amount, 0));
  if (inv.lines.length > 0 && Math.abs(linesSum - inv.taxableValue) > tolerance) {
    issues.push(`line items add up to ${linesSum} but taxable value is ${inv.taxableValue}`);
  }
  const printedTax = totalTax(inv);
  if (inv.taxRatePercent !== null) {
    const expectedTax = round2((inv.taxableValue * inv.taxRatePercent) / 100);
    if (Math.abs(expectedTax - printedTax) > tolerance) {
      issues.push(`tax at ${inv.taxRatePercent}% should be ${expectedTax} but the invoice shows ${printedTax}`);
    }
  }
  const expectedTotal = round2(inv.taxableValue + printedTax);
  if (Math.abs(expectedTotal - inv.total) > tolerance) {
    issues.push(`taxable value plus tax is ${expectedTotal} but the invoice total is ${inv.total}`);
  }
  return issues.length > 0
    ? [{ code: "ARITHMETIC_MISMATCH", message: `Amounts do not reconcile: ${issues.join("; ")}.` }]
    : [];
}

/** The printed rate must be one of the rates valid on the invoice date. */
export function checkRate(inv: ExtractedInvoice, config: RateConfig): Issue[] {
  const rate = inv.taxRatePercent;
  if (rate === null) return [];
  const allowed = allowedRatesOn(inv.invoiceDate, config);
  if (allowed.some((r) => Math.abs(r - rate) < RATE_MATCH_EPSILON)) return [];
  return [{ code: "RATE_NOT_ALLOWED", message: `${rate}% is not a GST rate in force on ${inv.invoiceDate} (valid: ${allowed.join(", ")}%). Check the item's HSN code and ask the supplier to confirm.` }];
}

/** Minimum confidence score below which a human review is recommended. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Low extraction confidence means a human should look at the document. */
export function checkConfidence(inv: ExtractedInvoice, threshold = LOW_CONFIDENCE_THRESHOLD): Issue[] {
  return inv.confidence < threshold
    ? [{ code: "LOW_CONFIDENCE", message: `The document was hard to read (confidence ${Math.round(inv.confidence * 100)}%). Please verify the extracted fields.` }]
    : [];
}
