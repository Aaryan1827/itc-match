import { duplicateKey, Gstr2bIndex, valuesDiffer } from "./matcher";
import {
  checkArithmetic,
  checkConfidence,
  checkRate,
  checkSupplierGstin,
  checkTaxType,
  totalTax,
} from "./rules";
import type {
  ExtractedInvoice,
  Gstr2bRow,
  InvoiceResult,
  Issue,
  IssueCode,
  RateConfig,
  ReconcileSummary,
  StateCodes,
  Status,
} from "./types";

const AT_RISK: IssueCode[] = ["NOT_IN_2B", "GSTIN_CHECKSUM", "GSTIN_FORMAT"];
const NEEDS_REVIEW: IssueCode[] = ["RATE_NOT_ALLOWED", "DUPLICATE_INVOICE", "LOW_CONFIDENCE"];
const FIXABLE: IssueCode[] = ["TAX_TYPE_MISMATCH", "ARITHMETIC_MISMATCH", "VALUE_MISMATCH_2B", "FUZZY_MATCH"];

/** Highest-severity bucket wins: at risk, then needs review, then fixable, then clean. */
export function statusFor(issues: Issue[]): Status {
  const has = (codes: IssueCode[]) => issues.some((i) => codes.includes(i.code));
  if (has(AT_RISK)) return "itc_at_risk";
  if (has(NEEDS_REVIEW)) return "needs_review";
  if (has(FIXABLE)) return "fixable";
  return "clean";
}

export interface ReconcileContext {
  rateConfig: RateConfig;
  stateCodes: StateCodes;
}

/** Deterministic reconciliation. Gemini is only used afterwards for explanations and fuzzy leftovers. */
export function reconcile(
  invoices: ExtractedInvoice[],
  gstr2b: Gstr2bRow[],
  ctx: ReconcileContext,
): ReconcileSummary {
  const index = new Gstr2bIndex(gstr2b);
  const seen = new Set<string>();
  const results: InvoiceResult[] = [];

  for (const inv of invoices) {
    const issues: Issue[] = [
      ...checkSupplierGstin(inv, ctx.stateCodes),
      ...checkTaxType(inv, ctx.stateCodes),
      ...checkArithmetic(inv, ctx.rateConfig),
      ...checkRate(inv, ctx.rateConfig),
      ...checkConfidence(inv),
    ];

    let matchedTo: Gstr2bRow | null = null;
    const key = duplicateKey(inv);
    if (seen.has(key)) {
      issues.push({ code: "DUPLICATE_INVOICE", message: `Invoice ${inv.invoiceNumber} from this supplier appears more than once in your uploads. Claim its ITC only once.` });
    } else {
      seen.add(key);
      const match = index.match(inv);
      matchedTo = match.row;
      if (match.kind === "none") {
        issues.push({ code: "NOT_IN_2B", message: "This invoice is not in your GSTR-2B. The supplier may not have filed it, so you may not be able to claim this credit yet. Follow up with the supplier." });
      } else {
        if (match.kind === "normalized") {
          issues.push({ code: "FUZZY_MATCH", message: `Matched to GSTR-2B entry "${match.row?.invoiceNumber}" although the invoice number is written differently ("${inv.invoiceNumber}"). Ask the supplier to keep the format consistent.` });
        }
        if (match.row && valuesDiffer(inv, match.row, ctx.rateConfig.roundingToleranceInr)) {
          issues.push({ code: "VALUE_MISMATCH_2B", message: "The amounts on the invoice differ from what the supplier reported in GSTR-2B. Claim only the GSTR-2B amount until this is resolved." });
        }
      }
    }

    const status = statusFor(issues);
    const taxAmount = totalTax(inv);
    results.push({
      fileName: inv.fileName,
      invoiceNumber: inv.invoiceNumber,
      supplierName: inv.supplierName,
      status,
      issues,
      taxAmount,
      itcAtRisk: status === "itc_at_risk" ? taxAmount : 0,
      matchedTo,
    });
  }

  const counts: Record<Status, number> = { clean: 0, fixable: 0, itc_at_risk: 0, needs_review: 0 };
  for (const r of results) counts[r.status] += 1;
  const itcAtRiskTotal = Math.round(results.reduce((s, r) => s + r.itcAtRisk, 0) * 100) / 100;

  return { results, unmatchedGstr2b: index.unclaimed(), itcAtRiskTotal, counts };
}
