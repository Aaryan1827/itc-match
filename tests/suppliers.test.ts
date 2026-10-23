import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  computeRunSignature,
  findRepeatOffenders,
  groupInvoicesBySupplier,
  mergeRunHistory,
  sortSuppliersByRisk,
  toCompactSupplierRecords,
} from "../src/lib/suppliers/grouping";
import type { SavedRun } from "../src/lib/suppliers/types";
import type { InvoiceResult } from "../src/lib/gst/types";

describe("Supplier Tracking - Grouping & Missing GSTIN", () => {
  it("groups invoices by supplier GSTIN when matchedTo has supplierGstin", () => {
    const invoices: InvoiceResult[] = [
      {
        fileName: "INV01.pdf",
        invoiceNumber: "INV-101",
        supplierName: "Acme Supplies",
        status: "clean",
        issues: [],
        taxAmount: 1000,
        itcAtRisk: 0,
        matchedTo: {
          supplierGstin: "27AAAPL1234C1ZV",
          supplierName: "Acme Supplies Ltd",
          invoiceNumber: "INV-101",
          invoiceDate: "2026-09-01",
          taxableValue: 5000,
          igst: 0,
          cgst: 500,
          sgst: 500,
          invoiceValue: 6000,
        },
      },
      {
        fileName: "INV02.pdf",
        invoiceNumber: "INV-102",
        supplierName: "Acme Supplies",
        status: "fixable",
        issues: [{ code: "VALUE_MISMATCH_2B", message: "Values differ" }],
        taxAmount: 2000,
        itcAtRisk: 0,
        matchedTo: {
          supplierGstin: "27AAAPL1234C1ZV",
          supplierName: "Acme Supplies Ltd",
          invoiceNumber: "INV-102",
          invoiceDate: "2026-09-05",
          taxableValue: 10000,
          igst: 0,
          cgst: 1000,
          sgst: 1000,
          invoiceValue: 12000,
        },
      },
    ];

    const followUps = [{ invoiceNumber: "INV-102", message: "Please check invoice 102 value." }];
    const groups = groupInvoicesBySupplier(invoices, followUps);

    assert.equal(groups.length, 1);
    const g = groups[0]!;
    assert.equal(g.key, "27AAAPL1234C1ZV");
    assert.equal(g.gstin, "27AAAPL1234C1ZV");
    assert.equal(g.invoicesChecked, 2);
    assert.equal(g.invoicesWithIssues, 1);
    assert.equal(g.notIn2bCount, 0);
    assert.equal(g.itcAtRisk, 0);
    assert.equal(g.followUpMessages.length, 1);
    assert.equal(g.followUpMessages[0], "Please check invoice 102 value.");
  });

  it("handles missing GSTIN by falling back to supplier name as group key", () => {
    const invoices: InvoiceResult[] = [
      {
        fileName: "INV03.pdf",
        invoiceNumber: "NAS-001",
        supplierName: "National Auto Spares",
        status: "itc_at_risk",
        issues: [{ code: "NOT_IN_2B", message: "Missing from GSTR-2B" }],
        taxAmount: 3500,
        itcAtRisk: 3500,
        matchedTo: null, // No GSTR-2B match -> no GSTIN
      },
      {
        fileName: "INV04.pdf",
        invoiceNumber: "NAS-002",
        supplierName: "National Auto Spares",
        status: "itc_at_risk",
        issues: [{ code: "NOT_IN_2B", message: "Missing from GSTR-2B" }],
        taxAmount: 1500,
        itcAtRisk: 1500,
        matchedTo: null,
      },
    ];

    const groups = groupInvoicesBySupplier(invoices);
    assert.equal(groups.length, 1);
    const g = groups[0]!;
    assert.equal(g.key, "National Auto Spares");
    assert.equal(g.name, "National Auto Spares");
    assert.equal(g.gstin, null);
    assert.equal(g.invoicesChecked, 2);
    assert.equal(g.invoicesWithIssues, 2);
    assert.equal(g.notIn2bCount, 2);
    assert.equal(g.itcAtRisk, 5000);
  });
});

describe("Supplier Tracking - Sorting", () => {
  it("sorts suppliers by ITC at risk descending", () => {
    const dummyGroups = [
      {
        key: "SUPP_LOW",
        name: "Low Risk Vendor",
        gstin: "27LOW0000A1Z1",
        invoicesChecked: 1,
        invoicesWithIssues: 1,
        notIn2bCount: 0,
        itcAtRisk: 200,
        followUpMessages: [],
        combinedFollowUp: "",
      },
      {
        key: "SUPP_HIGH",
        name: "High Risk Vendor",
        gstin: "27HIGH0000A1Z2",
        invoicesChecked: 2,
        invoicesWithIssues: 2,
        notIn2bCount: 2,
        itcAtRisk: 15000,
        followUpMessages: [],
        combinedFollowUp: "",
      },
      {
        key: "SUPP_MED",
        name: "Medium Risk Vendor",
        gstin: "27MED0000A1Z3",
        invoicesChecked: 3,
        invoicesWithIssues: 1,
        notIn2bCount: 1,
        itcAtRisk: 4500,
        followUpMessages: [],
        combinedFollowUp: "",
      },
    ];

    const sorted = sortSuppliersByRisk(dummyGroups);
    assert.equal(sorted[0]?.key, "SUPP_HIGH");
    assert.equal(sorted[1]?.key, "SUPP_MED");
    assert.equal(sorted[2]?.key, "SUPP_LOW");
  });
});

describe("Supplier Tracking - Repeat Offenders Detection", () => {
  it("detects suppliers flagged NOT_IN_2B in 2 or more saved runs", () => {
    const history: SavedRun[] = [
      {
        runDate: "2026-09-01T10:00:00Z",
        suppliers: [
          { key: "OFFENDER_A", name: "Offender Alpha", invoices: 2, notIn2b: 1, issues: 1, itcAtRisk: 1000 },
          { key: "INNOCENT_B", name: "Innocent Beta", invoices: 1, notIn2b: 0, issues: 0, itcAtRisk: 0 },
        ],
      },
      {
        runDate: "2026-09-15T10:00:00Z",
        suppliers: [
          { key: "OFFENDER_A", name: "Offender Alpha", invoices: 3, notIn2b: 2, issues: 2, itcAtRisk: 2000 },
          { key: "ONE_TIMER_C", name: "One Timer Gamma", invoices: 1, notIn2b: 1, issues: 1, itcAtRisk: 500 },
        ],
      },
      {
        runDate: "2026-10-01T10:00:00Z",
        suppliers: [
          { key: "OFFENDER_A", name: "Offender Alpha", invoices: 1, notIn2b: 1, issues: 1, itcAtRisk: 1200 },
          { key: "ONE_TIMER_C", name: "One Timer Gamma", invoices: 2, notIn2b: 0, issues: 0, itcAtRisk: 0 },
        ],
      },
    ];

    const repeatOffenders = findRepeatOffenders(history);

    assert.equal(repeatOffenders.length, 1);
    assert.equal(repeatOffenders[0]?.key, "OFFENDER_A");
    assert.equal(repeatOffenders[0]?.runCount, 3);
  });

  it("returns empty array if no supplier is flagged NOT_IN_2B in >= 2 runs", () => {
    const history: SavedRun[] = [
      {
        runDate: "2026-09-01T10:00:00Z",
        suppliers: [{ key: "SUPP_1", name: "Supp 1", invoices: 1, notIn2b: 1, issues: 1, itcAtRisk: 100 }],
      },
      {
        runDate: "2026-09-10T10:00:00Z",
        suppliers: [{ key: "SUPP_2", name: "Supp 2", invoices: 1, notIn2b: 1, issues: 1, itcAtRisk: 200 }],
      },
    ];

    const repeatOffenders = findRepeatOffenders(history);
    assert.equal(repeatOffenders.length, 0);
  });
});

describe("Supplier Tracking - History Trimming & Deduplication", () => {
  it("trims history to the maximum of 12 runs", () => {
    let existingRuns: SavedRun[] = [];

    for (let i = 1; i <= 15; i += 1) {
      const run: SavedRun = {
        runDate: `2026-01-${String(i).padStart(2, "0")}T00:00:00Z`,
        suppliers: [
          {
            key: `SUPP_${i}`,
            name: `Supplier ${i}`,
            invoices: 1,
            notIn2b: 0,
            issues: 0,
            itcAtRisk: 100 * i,
          },
        ],
      };
      existingRuns = mergeRunHistory(existingRuns, run, 12);
    }

    assert.equal(existingRuns.length, 12);
    // Newest run (SUPP_15) should be at index 0
    assert.equal(existingRuns[0]?.suppliers[0]?.key, "SUPP_15");
  });

  it("deduplicates identical reconciliation runs on the same date with same counts", () => {
    const run1: SavedRun = {
      runDate: "2026-09-20T12:00:00.000Z",
      suppliers: [
        { key: "KEY_1", name: "Vendor 1", invoices: 2, notIn2b: 1, issues: 1, itcAtRisk: 1500 },
      ],
    };

    const initialHistory = mergeRunHistory([], run1);
    assert.equal(initialHistory.length, 1);

    // Clicking reconcile again on the same files 2 minutes later
    const runDuplicate: SavedRun = {
      runDate: "2026-09-20T12:02:00.000Z",
      suppliers: [
        { key: "KEY_1", name: "Vendor 1", invoices: 2, notIn2b: 1, issues: 1, itcAtRisk: 1500 },
      ],
    };

    const afterReconcileAgain = mergeRunHistory(initialHistory, runDuplicate);
    assert.equal(afterReconcileAgain.length, 1, "Should not add duplicate run");
  });

  it("compact record creation contains NOTHING other than specified fields", () => {
    const groups = [
      {
        key: "KEY_TEST",
        name: "Test Name",
        gstin: "27TEST0000Z1",
        invoicesChecked: 3,
        invoicesWithIssues: 2,
        notIn2bCount: 1,
        itcAtRisk: 500,
        followUpMessages: ["Message 1"],
        combinedFollowUp: "Message 1",
      },
    ];

    const compact = toCompactSupplierRecords(groups);
    assert.equal(compact.length, 1);
    const rec = compact[0]!;
    const keys = Object.keys(rec).sort();
    assert.deepEqual(keys, ["invoices", "issues", "itcAtRisk", "key", "name", "notIn2b"]);
  });
});
