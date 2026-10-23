/** Minimal CSV reader (RFC 4180 quoting) and GSTR-2B row mapper. No dependencies. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text.charAt(i + 1) === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const normalizeHeader = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const toNumber = (raw: string | undefined): number => {
  const cleaned = (raw ?? "").replace(/[,\s₹]/g, "");
  if (cleaned === "") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY and DD-MM-YYYY; returns ISO or the original text. */
export function toIsoDate(raw: string): string {
  const value = raw.trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2]?.padStart(2, "0")}-${dmy[1]?.padStart(2, "0")}`;
  return value;
}

const REQUIRED = ["suppliergstin", "invoicenumber", "taxablevalue"] as const;

export type CsvResult = { ok: true; rows: Record<string, unknown>[] } | { ok: false; reason: string };

/** Maps CSV columns to the Gstr2bRow shape. Values are validated afterwards with Zod. */
export function gstr2bRowsFromCsv(text: string): CsvResult {
  const table = parseCsv(text);
  const header = table[0]?.map(normalizeHeader);
  if (!header) return { ok: false, reason: "The GSTR-2B file is empty." };
  const missing = REQUIRED.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return { ok: false, reason: "The GSTR-2B file needs columns: Supplier GSTIN, Invoice Number, Taxable Value." };
  }
  const col = (cells: string[], name: string): string | undefined => cells[header.indexOf(name)];

  const rows = table.slice(1).map((cells) => ({
    supplierGstin: (col(cells, "suppliergstin") ?? "").trim().toUpperCase(),
    supplierName: (col(cells, "suppliername") ?? "").trim(),
    invoiceNumber: (col(cells, "invoicenumber") ?? "").trim(),
    invoiceDate: toIsoDate(col(cells, "invoicedate") ?? ""),
    taxableValue: toNumber(col(cells, "taxablevalue")),
    igst: toNumber(col(cells, "igst")),
    cgst: toNumber(col(cells, "cgst")),
    sgst: toNumber(col(cells, "sgst")),
    invoiceValue: toNumber(col(cells, "invoicevalue")),
  }));
  return { ok: true, rows };
}
