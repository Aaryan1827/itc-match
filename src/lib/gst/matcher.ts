import { round2, totalTax } from "./rules";
import type { ExtractedInvoice, Gstr2bRow } from "./types";

/** Uppercase and strip everything except letters and digits: "TS/2026/0148" -> "TS20260148". */
export const normalizeInvoiceNumber = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const exactKey = (gstin: string, number: string): string =>
  `${gstin.trim().toUpperCase()}|${number.trim().toUpperCase()}`;

const looseKey = (gstin: string, number: string): string =>
  `${gstin.trim().toUpperCase()}|${normalizeInvoiceNumber(number)}`;

export type MatchKind = "exact" | "normalized" | "none";

export interface MatchResult {
  kind: MatchKind;
  row: Gstr2bRow | null;
}

/** Tracks which GSTR-2B rows are still unclaimed, so one row is never matched twice. */
export class Gstr2bIndex {
  private readonly rows: Gstr2bRow[];
  private readonly claimed = new Set<Gstr2bRow>();

  constructor(rows: Gstr2bRow[]) {
    this.rows = rows;
  }

  match(inv: ExtractedInvoice): MatchResult {
    const exact = this.rows.find(
      (r) => !this.claimed.has(r) && exactKey(r.supplierGstin, r.invoiceNumber) === exactKey(inv.supplierGstin, inv.invoiceNumber),
    );
    if (exact) return this.claim(exact, "exact");
    const loose = this.rows.find(
      (r) => !this.claimed.has(r) && looseKey(r.supplierGstin, r.invoiceNumber) === looseKey(inv.supplierGstin, inv.invoiceNumber),
    );
    return loose ? this.claim(loose, "normalized") : { kind: "none", row: null };
  }

  /**
   * Unclaimed rows from the same supplier with the same taxable value.
   * These are candidates for an LLM judgement when no deterministic match exists.
   */
  candidatesFor(inv: ExtractedInvoice): Gstr2bRow[] {
    return this.rows.filter(
      (r) =>
        !this.claimed.has(r) &&
        r.supplierGstin.trim().toUpperCase() === inv.supplierGstin.trim().toUpperCase() &&
        Math.abs(r.taxableValue - inv.taxableValue) < 1,
    );
  }

  unclaimed(): Gstr2bRow[] {
    return this.rows.filter((r) => !this.claimed.has(r));
  }

  private claim(row: Gstr2bRow, kind: MatchKind): MatchResult {
    this.claimed.add(row);
    return { kind, row };
  }
}

/** True when the invoice's amounts disagree with its GSTR-2B row beyond the tolerance. */
export function valuesDiffer(inv: ExtractedInvoice, row: Gstr2bRow, tolerance: number): boolean {
  const rowTax = round2(row.igst + row.cgst + row.sgst);
  return Math.abs(inv.taxableValue - row.taxableValue) > tolerance || Math.abs(totalTax(inv) - rowTax) > tolerance;
}

/** Key used to spot the same invoice uploaded twice. */
export const duplicateKey = (inv: ExtractedInvoice): string => looseKey(inv.supplierGstin, inv.invoiceNumber);
