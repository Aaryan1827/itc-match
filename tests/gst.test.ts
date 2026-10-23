import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { rateConfig, stateCodes } from "../src/lib/gst/config";
import { gstinCheckChar, validateGstin } from "../src/lib/gst/gstin";
import { normalizeInvoiceNumber } from "../src/lib/gst/matcher";
import { reconcile } from "../src/lib/gst/reconcile";
import { allowedRatesOn, checkArithmetic, checkRate, checkTaxType } from "../src/lib/gst/rules";
import type { ExtractedInvoice, Gstr2bRow } from "../src/lib/gst/types";

const load = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8")) as T;

const fixtures = load<ExtractedInvoice[]>("../samples/extracted-fixtures.json");
const gstr2b = load<Gstr2bRow[]>("../samples/gstr-2b.json");
const truth = load<{
  expectedItcAtRiskInr: number;
  gstr2bOnlyEntries: string[];
  invoices: { id: string; plantedIssue: string | null; expectedStatus: string }[];
}>("../samples/ground-truth.json");

const ctx = { rateConfig, stateCodes };
const byId = (id: string): ExtractedInvoice => {
  const found = fixtures.find((f) => f.fileName === `${id}.pdf`);
  assert.ok(found, `fixture ${id} missing`);
  return found;
};

describe("GSTIN validation", () => {
  it("accepts a GSTIN with a correct check character", () => {
    assert.equal(validateGstin("27AAKPK4821M1ZD", stateCodes), null);
  });
  it("rejects a wrong check character", () => {
    assert.equal(validateGstin("27AAKPK4821M1ZA", stateCodes), "checksum");
  });
  it("rejects a malformed GSTIN", () => {
    assert.equal(validateGstin("27AAKPK4821", stateCodes), "format");
  });
  it("rejects an unknown state code", () => {
    assert.equal(validateGstin("25AAKPK4821M1Z0", stateCodes), "state");
  });
  it("computes the check character deterministically", () => {
    assert.equal(gstinCheckChar("27AAKPK4821M1Z"), "D");
  });
});

describe("rules", () => {
  it("flags IGST on an intra-state sale", () => {
    assert.equal(checkTaxType(byId("INV04"), stateCodes)[0]?.code, "TAX_TYPE_MISMATCH");
  });
  it("passes correct CGST + SGST on an intra-state sale", () => {
    assert.deepEqual(checkTaxType(byId("INV01"), stateCodes), []);
  });
  it("flags tax that does not match the rate", () => {
    assert.equal(checkArithmetic(byId("INV05"), rateConfig)[0]?.code, "ARITHMETIC_MISMATCH");
  });
  it("passes a clean invoice", () => {
    assert.deepEqual(checkArithmetic(byId("INV03"), rateConfig), []);
  });
  it("applies rates by invoice date (12% valid before 22 Sep 2025, not after)", () => {
    assert.ok(allowedRatesOn("2025-09-01", rateConfig).includes(12));
    assert.ok(!allowedRatesOn("2026-09-18", rateConfig).includes(12));
    assert.equal(checkRate(byId("INV09"), rateConfig)[0]?.code, "RATE_NOT_ALLOWED");
  });
  it("normalises invoice numbers", () => {
    assert.equal(normalizeInvoiceNumber("ts/2026/0148"), normalizeInvoiceNumber("TS-2026-0148"));
  });
});

describe("benchmark on synthetic data", () => {
  const summary = reconcile(fixtures, gstr2b, ctx);

  it("assigns the expected status to every invoice", () => {
    for (const expected of truth.invoices) {
      const actual = summary.results.find((r) => r.fileName === `${expected.id}.pdf`);
      assert.equal(actual?.status, expected.expectedStatus, `${expected.id} (${expected.plantedIssue})`);
    }
  });

  it("surfaces each planted issue code", () => {
    for (const expected of truth.invoices.filter((i) => i.plantedIssue)) {
      const actual = summary.results.find((r) => r.fileName === `${expected.id}.pdf`);
      assert.ok(
        actual?.issues.some((i) => i.code === expected.plantedIssue),
        `${expected.id} should include ${expected.plantedIssue}`,
      );
    }
  });

  it("does not raise any issue on clean invoices", () => {
    for (const id of ["INV01", "INV02", "INV03"]) {
      assert.deepEqual(summary.results.find((r) => r.fileName === `${id}.pdf`)?.issues, []);
    }
  });

  it("computes the expected ITC at risk", () => {
    assert.equal(summary.itcAtRiskTotal, truth.expectedItcAtRiskInr);
  });

  it("reports GSTR-2B entries that have no uploaded invoice", () => {
    assert.deepEqual(summary.unmatchedGstr2b.map((r) => r.invoiceNumber), truth.gstr2bOnlyEntries);
  });
});
