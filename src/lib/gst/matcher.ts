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

  /** Map from exact key "GSTIN|NUMBER" to the row, for O(1) exact lookups. */
  private readonly exactMap = new Map<string, Gstr2bRow>();

  /** Map from normalized key "GSTIN|NORMALIZEDNUMBER" to the row, for O(1) normalized lookups. */
  private readonly looseMap = new Map<string, Gstr2bRow>();

  /** Map from supplier GSTIN to all rows from that supplier, for candidatesFor(). */
  private readonly bySupplier = new Map<string, Gstr2bRow[]>();

  constructor(rows: Gstr2bRow[]) {
    this.rows = rows;
    for (const r of rows) {
      const ek = exactKey(r.supplierGstin, r.invoiceNumber);
      if (!this.exactMap.has(ek)) this.exactMap.set(ek, r);

      const lk = looseKey(r.supplierGstin, r.invoiceNumber);
      if (!this.looseMap.has(lk)) this.looseMap.set(lk, r);

      const gstin = r.supplierGstin.trim().toUpperCase();
      const bucket = this.bySupplier.get(gstin);
      if (bucket) bucket.push(r);
      else this.bySupplier.set(gstin, [r]);
    }
  }

  match(inv: ExtractedInvoice): MatchResult {
    const ek = exactKey(inv.supplierGstin, inv.invoiceNumber);
    const exactRow = this.exactMap.get(ek);
    if (exactRow && !this.claimed.has(exactRow)) return this.claim(exactRow, "exact");

    const lk = looseKey(inv.supplierGstin, inv.invoiceNumber);
    const looseRow = this.looseMap.get(lk);
    if (looseRow && !this.claimed.has(looseRow)) return this.claim(looseRow, "normalized");

    return { kind: "none", row: null };
  }

  /**
   * Unclaimed rows from the same supplier with the same taxable value.
   * These are candidates for an LLM judgement when no deterministic match exists.
   */
  candidatesFor(inv: ExtractedInvoice): Gstr2bRow[] {
    const gstin = inv.supplierGstin.trim().toUpperCase();
    const bucket = this.bySupplier.get(gstin) ?? [];
    return bucket.filter(
      (r) =>
        !this.claimed.has(r) &&
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
