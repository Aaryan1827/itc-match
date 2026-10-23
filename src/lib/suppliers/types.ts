/** Types for supplier chase grouping, history persistence, and repeat offender tracking. */

export interface SupplierChaseGroup {
  /** Supplier GSTIN if present on matched GSTR-2B row, otherwise supplier name. */
  key: string;
  name: string;
  gstin: string | null;
  invoicesChecked: number;
  invoicesWithIssues: number;
  notIn2bCount: number;
  itcAtRisk: number;
  followUpMessages: string[];
  combinedFollowUp: string;
}

/**
 * Compact supplier record stored in localStorage under taxsure.history.v1.
 * Strict shape containing ONLY aggregate counts and amounts, NO file contents or invoice numbers.
 */
export interface CompactSupplierRecord {
  key: string;
  name: string;
  invoices: number;
  notIn2b: number;
  issues: number;
  itcAtRisk: number;
}

export interface SavedRun {
  runDate: string;
  suppliers: CompactSupplierRecord[];
}

export interface RepeatOffender {
  key: string;
  name: string;
  runCount: number;
}
