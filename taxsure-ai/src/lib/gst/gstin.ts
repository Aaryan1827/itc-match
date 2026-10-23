import type { StateCodes } from "./types";

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Compute the GSTIN check character from its first 14 characters (mod 36, weights 1 and 2). */
export function gstinCheckChar(first14: string): string {
  let total = 0;
  for (let i = 0; i < first14.length; i += 1) {
    const product = CHARSET.indexOf(first14.charAt(i)) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET.charAt((36 - (total % 36)) % 36);
}

export type GstinProblem = "format" | "state" | "checksum";

/** Returns null when the GSTIN is valid, otherwise the first problem found. */
export function validateGstin(raw: string, stateCodes: StateCodes): GstinProblem | null {
  const gstin = raw.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) return "format";
  if (!(gstin.slice(0, 2) in stateCodes)) return "state";
  return gstin.charAt(14) === gstinCheckChar(gstin.slice(0, 14)) ? null : "checksum";
}

/** The two-digit state code at the start of a GSTIN. */
export function stateOf(gstin: string): string {
  return gstin.trim().slice(0, 2);
}
