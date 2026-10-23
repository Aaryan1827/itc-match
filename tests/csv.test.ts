import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  escapeCsvField,
  generateReconciliationCsv,
  UTF8_BOM,
} from "../src/lib/export/csv";
import type { InvoiceResult } from "../src/lib/gst/types";

describe("CSV Helper - escapeCsvField", () => {
  it("quotes fields containing commas", () => {
    assert.equal(escapeCsvField("Acme, Inc."), '"Acme, Inc."');
  });

  it("quotes fields containing double quotes and escapes them as two double quotes", () => {
    assert.equal(escapeCsvField('Vendor "Best" Corp'), '"Vendor ""Best"" Corp"');
  });

  it("quotes fields containing newlines", () => {
    assert.equal(escapeCsvField("Line 1\nLine 2"), '"Line 1\nLine 2"');
    assert.equal(escapeCsvField("Line 1\r\nLine 2"), '"Line 1\r\nLine 2"');
  });

  it("prefixes untrusted text starting with formula characters (=, +, -, @) with a single quote", () => {
    assert.equal(escapeCsvField("=SUM(A1:B1)"), "'=SUM(A1:B1)");
    assert.equal(escapeCsvField("+919876543210"), "'+919876543210");
    assert.equal(escapeCsvField("-discount"), "'-discount");
    assert.equal(escapeCsvField("@malicious"), "'@malicious");
  });

  it("handles formula characters combined with commas and quotes", () => {
    assert.equal(escapeCsvField('=CMD("calc")'), `"'=CMD(""calc"")"`);
    assert.equal(escapeCsvField("+Acme, Limited"), `"'+Acme, Limited"`);
  });

  it("formats INR numeric amounts to two decimal places without formula prefixing", () => {
    assert.equal(escapeCsvField(1800), "1800.00");
    assert.equal(escapeCsvField(1234.5), "1234.50");
    assert.equal(escapeCsvField(0), "0.00");
  });
});

describe("CSV Helper - generateReconciliationCsv", () => {
  it("includes UTF-8 BOM at the beginning of output", () => {
    const csv = generateReconciliationCsv([]);
    assert.ok(csv.startsWith(UTF8_BOM), "CSV should start with UTF-8 BOM");
    assert.equal(csv.charCodeAt(0), 0xfeff);
  });

  it("generates header row for empty list", () => {
    const csv = generateReconciliationCsv([]);
    const lines = csv.replace(UTF8_BOM, "").trim().split("\r\n");
    assert.equal(lines.length, 1);
    assert.equal(
      lines[0],
      "File name,Invoice number,Supplier name,Status,Issues,Issue details,Tax amount (INR),ITC at risk (INR),Suggested follow-up message",
    );
  });

  it("formats INR amounts and issues for invoices correctly", () => {
    const dummyInvoices: InvoiceResult[] = [
      {
        fileName: "INV01.pdf",
        invoiceNumber: "KPW/26/0412",
        supplierName: "K.P. Works",
        status: "clean",
        issues: [],
        taxAmount: 3060,
        itcAtRisk: 0,
        matchedTo: null,
      },
      {
        fileName: "INV07.pdf",
        invoiceNumber: "KPW/26/0433",
        supplierName: "K.P. Works",
        status: "itc_at_risk",
        issues: [
          {
            code: "NOT_IN_2B",
            message: "This invoice is not in your GSTR-2B.",
          },
        ],
        taxAmount: 4446.75,
        itcAtRisk: 4446.75,
        matchedTo: null,
      },
    ];

    const followUps = [
      {
        invoiceNumber: "KPW/26/0433",
        message: "Please ensure this invoice is uploaded to GSTR-1.",
      },
    ];

    const csv = generateReconciliationCsv(dummyInvoices, followUps);
    const content = csv.replace(UTF8_BOM, "");
    const lines = content.trim().split("\r\n");

    assert.equal(lines.length, 3); // 1 header + 2 invoice rows

    // Check first invoice amounts
    assert.ok(lines[1]?.includes("3060.00,0.00"));

    // Check second invoice amounts and follow-up message
    assert.ok(lines[2]?.includes("4446.75,4446.75"));
    assert.ok(lines[2]?.includes("NOT_IN_2B"));
    assert.ok(lines[2]?.includes("Please ensure this invoice is uploaded to GSTR-1."));
  });

  it("protects against formula injection in supplier names and invoice numbers in full CSV", () => {
    const maliciousInvoice: InvoiceResult = {
      fileName: "=calc.pdf",
      invoiceNumber: "+INV/999",
      supplierName: "@Dangerous Corp",
      status: "fixable",
      issues: [{ code: "FUZZY_MATCH", message: "Fuzzy matched" }],
      taxAmount: 500,
      itcAtRisk: 0,
      matchedTo: null,
    };

    const csv = generateReconciliationCsv([maliciousInvoice]);
    const row = csv.replace(UTF8_BOM, "").trim().split("\r\n")[1];

    assert.ok(row?.includes("'=calc.pdf"));
    assert.ok(row?.includes("'+INV/999"));
    assert.ok(row?.includes("'@Dangerous Corp"));
  });
});
