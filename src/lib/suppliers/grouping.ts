import type { FollowUp, InvoiceResult } from "@/lib/gst/types";
import type {
  CompactSupplierRecord,
  RepeatOffender,
  SavedRun,
  SupplierChaseGroup,
} from "./types";

export const HISTORY_STORAGE_KEY = "taxsure.history.v1";
export const MAX_HISTORY_RUNS = 12;

/**
 * Groups invoice results by supplier GSTIN, falling back to supplier name if GSTIN is missing.
 */
export function groupInvoicesBySupplier(
  invoices: InvoiceResult[],
  followUps: FollowUp[] | Record<string, string> = [],
): SupplierChaseGroup[] {
  const followUpMap = new Map<string, string>();
  if (Array.isArray(followUps)) {
    for (const f of followUps) {
      if (f.invoiceNumber && f.message) {
        followUpMap.set(f.invoiceNumber, f.message);
      }
    }
  } else if (followUps && typeof followUps === "object") {
    for (const [invNum, msg] of Object.entries(followUps)) {
      if (msg) followUpMap.set(invNum, msg);
    }
  }

  const groupMap = new Map<string, SupplierChaseGroup>();

  for (const inv of invoices) {
    const rawGstin = inv.matchedTo?.supplierGstin?.trim();
    const gstin = rawGstin && rawGstin.length > 0 ? rawGstin : null;
    const name = inv.supplierName?.trim() || inv.matchedTo?.supplierName?.trim() || "Unknown Supplier";
    const key = gstin || name;

    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        name,
        gstin,
        invoicesChecked: 0,
        invoicesWithIssues: 0,
        notIn2bCount: 0,
        itcAtRisk: 0,
        followUpMessages: [],
        combinedFollowUp: "",
      };
      groupMap.set(key, group);
    }

    group.invoicesChecked += 1;
    const hasIssues = Boolean(inv.issues && inv.issues.length > 0);
    if (hasIssues) {
      group.invoicesWithIssues += 1;
    }
    const hasNotIn2b = Boolean(inv.issues?.some((i) => i.code === "NOT_IN_2B"));
    if (hasNotIn2b) {
      group.notIn2bCount += 1;
    }

    group.itcAtRisk += inv.itcAtRisk || 0;

    const followUpMsg = followUpMap.get(inv.invoiceNumber);
    if (followUpMsg && !group.followUpMessages.includes(followUpMsg)) {
      group.followUpMessages.push(followUpMsg);
    }
  }

  const groups = Array.from(groupMap.values());
  for (const g of groups) {
    g.itcAtRisk = Math.round(g.itcAtRisk * 100) / 100;
    g.combinedFollowUp = g.followUpMessages.join("\n\n");
  }

  return groups;
}

/**
 * Sorts supplier chase groups by ITC at risk descending, then NOT_IN_2B count descending.
 */
export function sortSuppliersByRisk(groups: SupplierChaseGroup[]): SupplierChaseGroup[] {
  return [...groups].sort((a, b) => {
    if (b.itcAtRisk !== a.itcAtRisk) {
      return b.itcAtRisk - a.itcAtRisk;
    }
    if (b.notIn2bCount !== a.notIn2bCount) {
      return b.notIn2bCount - a.notIn2bCount;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Maps chase groups into the compact history record structure containing NOTHING else.
 */
export function toCompactSupplierRecords(groups: SupplierChaseGroup[]): CompactSupplierRecord[] {
  return groups.map((g) => ({
    key: g.key,
    name: g.name,
    invoices: g.invoicesChecked,
    notIn2b: g.notIn2bCount,
    issues: g.invoicesWithIssues,
    itcAtRisk: g.itcAtRisk,
  }));
}

/**
 * Computes a fingerprint to dedupe identical reconciliation runs on the same date/files.
 */
export function computeRunSignature(run: SavedRun): string {
  const dateKey = run.runDate.slice(0, 10);
  const suppliersKey = [...run.suppliers]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((s) => `${s.key}:${s.invoices}:${s.notIn2b}:${s.issues}:${s.itcAtRisk}`)
    .join("|");
  return `${dateKey}#${suppliersKey}`;
}

/**
 * Merges a new run into existing history, deduplicating runs and trimming to maxRuns (default 12).
 */
export function mergeRunHistory(
  existingRuns: SavedRun[],
  newRun: SavedRun,
  maxRuns: number = MAX_HISTORY_RUNS,
): SavedRun[] {
  const newSig = computeRunSignature(newRun);
  const isDuplicate = existingRuns.some((run) => computeRunSignature(run) === newSig);
  if (isDuplicate) {
    return existingRuns;
  }
  return [newRun, ...existingRuns].slice(0, maxRuns);
}

/**
 * Finds suppliers flagged NOT_IN_2B in 2 or more saved runs across history.
 */
export function findRepeatOffenders(history: SavedRun[]): RepeatOffender[] {
  const tracker = new Map<string, { name: string; runCount: number }>();

  for (const run of history) {
    for (const supplier of run.suppliers) {
      if (supplier.notIn2b > 0) {
        const item = tracker.get(supplier.key);
        if (item) {
          item.runCount += 1;
          if (supplier.name && !item.name) {
            item.name = supplier.name;
          }
        } else {
          tracker.set(supplier.key, {
            name: supplier.name || supplier.key,
            runCount: 1,
          });
        }
      }
    }
  }

  const offenders: RepeatOffender[] = [];
  for (const [key, data] of tracker.entries()) {
    if (data.runCount >= 2) {
      offenders.push({
        key,
        name: data.name,
        runCount: data.runCount,
      });
    }
  }

  return offenders.sort((a, b) => {
    if (b.runCount !== a.runCount) {
      return b.runCount - a.runCount;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Safe localStorage loader with SSR guard and try/catch.
 */
export function loadHistory(): SavedRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedRun[];
  } catch {
    return [];
  }
}

/**
 * Safe localStorage writer with SSR guard and try/catch.
 */
export function saveHistory(runs: SavedRun[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(runs));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe localStorage clearer with SSR guard and try/catch.
 */
export function clearHistoryStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
