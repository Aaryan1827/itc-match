import type { FollowUp, InvoiceResult } from "@/lib/gst/types";

export const CSV_HEADERS = [
  "File name",
  "Invoice number",
  "Supplier name",
  "Status",
  "Issues",
  "Issue details",
  "Tax amount (INR)",
  "ITC at risk (INR)",
  "Suggested follow-up message",
] as const;

export const UTF8_BOM = "\uFEFF";

/**
 * Escapes a cell value according to RFC 4180 and protects against CSV/formula injection.
 * Any text cell starting with =, +, -, or @ is prefixed with a single quote (').
 * Fields with commas, quotes, or newlines are wrapped in double quotes, with quotes escaped as "".
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str: string;
  if (typeof value === "number") {
    str = Number.isFinite(value) ? value.toFixed(2) : "0.00";
    return str;
  } else {
    str = String(value);
    // Protect against formula injection for untrusted text cells starting with =, +, -, or @
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
  }

  // RFC 4180: If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string with a UTF-8 BOM.
 */
export function generateReconciliationCsv(
  invoices: InvoiceResult[],
  followUps: FollowUp[] | Record<string, string> = [],
): string {
  const followUpMap = new Map<string, string>();
  if (Array.isArray(followUps)) {
    for (const item of followUps) {
      if (item.invoiceNumber) {
        followUpMap.set(item.invoiceNumber, item.message);
      }
    }
  } else if (followUps && typeof followUps === "object") {
    for (const [invNum, msg] of Object.entries(followUps)) {
      followUpMap.set(invNum, msg);
    }
  }

  const headerLine = CSV_HEADERS.map(escapeCsvField).join(",");
  const rows: string[] = [headerLine];

  for (const inv of invoices) {
    const issues = (inv.issues ?? []).map((i) => i.code).join("; ");
    const issueDetails = (inv.issues ?? []).map((i) => i.message).join(" | ");
    const followUpMsg = followUpMap.get(inv.invoiceNumber) ?? "";

    const row = [
      escapeCsvField(inv.fileName),
      escapeCsvField(inv.invoiceNumber),
      escapeCsvField(inv.supplierName),
      escapeCsvField(inv.status),
      escapeCsvField(issues),
      escapeCsvField(issueDetails),
      escapeCsvField(inv.taxAmount),
      escapeCsvField(inv.itcAtRisk),
      escapeCsvField(followUpMsg),
    ].join(",");

    rows.push(row);
  }

  return UTF8_BOM + rows.join("\r\n") + "\r\n";
}

/**
 * Triggers browser download of the CSV using a temporary object URL.
 */
export function downloadCsv(csvContent: string, filename?: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const finalFilename = filename || `taxsure-itc-report-${dateStr}.csv`;

  try {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", finalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to download CSV:", error);
  }
}
