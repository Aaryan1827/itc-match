export type InvoiceStatus = "Clean" | "Fixable" | "ITC at risk" | "Needs review";

export interface FailedCheck {
  check: string;
  explanation: string;
}

export interface Invoice {
  id: string;
  supplier: string;
  gstin: string;
  invoiceNumber: string;
  date: string;
  taxableValue: number;
  taxAmount: number;
  status: InvoiceStatus;
  confidence: number;
  checks: FailedCheck[];
  followUp: string;
}

/**
 * Mock reconciliation data. No API calls yet — everything here is sample
 * data that stands in for the real extraction + GSTR-2B matching output.
 */
export const demoInvoices: Invoice[] = [
  {
    id: "inv-1041",
    supplier: "Vertex Steel Traders",
    gstin: "27AABCV1234F1Z5",
    invoiceNumber: "INV-2026-1041",
    date: "2026-09-12",
    taxableValue: 184500,
    taxAmount: 33210,
    status: "Clean",
    confidence: 98,
    checks: [],
    followUp:
      "No issues found for this invoice — no supplier follow-up is needed. The invoice matches GSTR-2B and full input tax credit can be claimed.",
  },
  {
    id: "inv-1057",
    supplier: "Shree Ganesh Enterprises",
    gstin: "27AACFS4321K1Z2",
    invoiceNumber: "INV-2026-1057",
    date: "2026-09-15",
    taxableValue: 62300,
    taxAmount: 11214,
    status: "Fixable",
    confidence: 91,
    checks: [
      {
        check: "Supplier GSTIN mismatch",
        explanation:
          "The GSTIN printed on the invoice (27AACFS4321K1Z2) does not match the GSTIN in your GSTR-2B (27AACFS4321K1Z3). The last character differs, which usually means a typo in the supplier's GSTR-1 filing.",
      },
      {
        check: "Supplier name variation",
        explanation:
          "GSTR-2B lists the supplier as 'SHREE GANESH ENTERPRISE' (singular). Minor name variation — confirm the registered legal name with the supplier.",
      },
    ],
    followUp:
      "Hello, we purchased goods against Invoice INV-2026-1057 dated 15-Sep-2026 (₹62,300 + ₹11,214 GST). The GSTIN on your invoice does not match the one reported in our GSTR-2B — the last character differs (…K1Z2 vs …K1Z3). Could you please verify and, if needed, refile your GSTR-1 with the correct GSTIN so we can claim input tax credit without a mismatch? Thank you.",
  },
  {
    id: "inv-1063",
    supplier: "Maruti Logistics",
    gstin: "29AAECM7654G1Z8",
    invoiceNumber: "INV-2026-1063",
    date: "2026-09-18",
    taxableValue: 45800,
    taxAmount: 8244,
    status: "ITC at risk",
    confidence: 96,
    checks: [
      {
        check: "Invoice missing from GSTR-2B",
        explanation:
          "This invoice was never reported in your GSTR-2B for the period. The supplier most likely has not filed their GSTR-1 yet, so the ₹8,244 input tax credit cannot be claimed this period.",
      },
    ],
    followUp:
      "Hello, we paid GST of ₹8,244 on Invoice INV-2026-1063 dated 18-Sep-2026, but the invoice does not appear in our GSTR-2B. It appears your GSTR-1 for the period has not been filed or the invoice was omitted. Please file or amend your GSTR-1 at the earliest so we can claim the input tax credit; otherwise the credit lapses for this tax period. Thank you.",
  },
  {
    id: "inv-1078",
    supplier: "Sunrise Polymers",
    gstin: "24AAKPS9876H1Z4",
    invoiceNumber: "INV-2026-1078",
    date: "2026-09-20",
    taxableValue: 98760,
    taxAmount: 17777,
    status: "Needs review",
    confidence: 64,
    checks: [
      {
        check: "Tax amount differs beyond tolerance",
        explanation:
          "Invoice tax is ₹17,777 but GSTR-2B reports ₹17,780. The ₹3 difference is within rounding distance of the tolerance limit, so the matcher could not classify it automatically.",
      },
      {
        check: "Filing period mismatch",
        explanation:
          "The invoice appears in GSTR-2B for a different period than the invoice date suggests. Verify which period the credit belongs to before claiming.",
      },
    ],
    followUp:
      "Hello, our system flagged Invoice INV-2026-1078 dated 20-Sep-2026 (tax ₹17,777 on our copy vs ₹17,780 in GSTR-2B) and it seems to have been reported in a different filing period. Could you confirm the tax amount and the period in which you reported this invoice, so we can claim the correct credit? Thank you.",
  },
  {
    id: "inv-1082",
    supplier: "Eastern Chemicals Co.",
    gstin: "33AABCE5566J1Z9",
    invoiceNumber: "INV-2026-1082",
    date: "2026-09-21",
    taxableValue: 240000,
    taxAmount: 43200,
    status: "Clean",
    confidence: 97,
    checks: [],
    followUp:
      "No issues found for this invoice — no supplier follow-up is needed. The invoice matches GSTR-2B and full input tax credit can be claimed.",
  },
  {
    id: "inv-1090",
    supplier: "Nimbus Office Supplies",
    gstin: "27AAJCN1122L1Z1",
    invoiceNumber: "INV-2026-1090",
    date: "2026-09-24",
    taxableValue: 18450,
    taxAmount: 3321,
    status: "Fixable",
    confidence: 88,
    checks: [
      {
        check: "Invoice date outside 2B period",
        explanation:
          "The invoice is dated 24-Sep-2026 but was reported by the supplier in the August filing period. The credit is claimable, but the period assignment should be corrected in your books before filing.",
      },
    ],
    followUp:
      "Hello, Invoice INV-2026-1090 dated 24-Sep-2026 appears in the August GSTR-2B period, which does not match the invoice date. Could you confirm the reporting period so we can align our input tax credit claim? Thank you.",
  },
  {
    id: "inv-1101",
    supplier: "Kaveri Textile Mills",
    gstin: "33AAFCK3344M1Z7",
    invoiceNumber: "INV-2026-1101",
    date: "2026-09-26",
    taxableValue: 112890,
    taxAmount: 20320,
    status: "ITC at risk",
    confidence: 94,
    checks: [
      {
        check: "Supplier filing status: not filed",
        explanation:
          "The supplier's GSTIN shows GSTR-1 as not filed for the period, so none of their invoices appear in GSTR-2B. ₹20,320 of input tax credit is at risk of reversal.",
      },
      {
        check: "Invoice missing from GSTR-2B",
        explanation:
          "As a direct consequence, this invoice cannot be matched to any 2B line and its credit cannot be claimed this period.",
      },
    ],
    followUp:
      "Hello, we hold Invoice INV-2026-1101 dated 26-Sep-2026 (₹1,12,890 + ₹20,320 GST). Your GSTR-1 for the period appears unfiled, so the invoice is missing from our GSTR-2B and we cannot claim the input tax credit. Please file your GSTR-1 immediately and share the confirmation so we can claim the credit before it reverses. Thank you.",
  },
  {
    id: "inv-1105",
    supplier: "Pioneer Packaging",
    gstin: "27AABCP7788N1Z3",
    invoiceNumber: "INV-2026-1105",
    date: "2026-09-28",
    taxableValue: 75600,
    taxAmount: 13608,
    status: "Needs review",
    confidence: 61,
    checks: [
      {
        check: "Possible duplicate invoice number",
        explanation:
          "The same invoice number appears twice in the purchase records with different amounts. One of them may be a revision or a data-entry duplicate.",
      },
      {
        check: "Taxable value differs beyond tolerance",
        explanation:
          "Invoice taxable value is ₹75,600 while GSTR-2B reports ₹74,900. The ₹700 difference exceeds the matching tolerance.",
      },
    ],
    followUp:
      "Hello, we found two records with invoice number INV-2026-1105 dated 28-Sep-2026 with different amounts, and the taxable value in GSTR-2B (₹74,900) differs from our copy (₹75,600). Could you confirm the final invoice value and whether a revised invoice was issued? Thank you.",
  },
];

export const demoPurchaseFiles = [
  "vertex-steel-inv-1041.pdf",
  "shree-ganesh-inv-1057.jpg",
  "maruti-logistics-inv-1063.pdf",
  "sunrise-polymers-inv-1078.pdf",
  "eastern-chemicals-inv-1082.jpg",
  "nimbus-office-inv-1090.pdf",
  "kaveri-textile-inv-1101.pdf",
  "pioneer-packaging-inv-1105.jpg",
];

export const demoGstr2BFile = "gstr-2b-sep-2026.csv";
