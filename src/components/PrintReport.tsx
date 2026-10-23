import { inr } from "@/lib/format";
import type { Language, ReconcileResponse } from "@/lib/gst/types";
import { t } from "@/lib/i18n";
import type { SupplierChaseGroup } from "@/lib/suppliers/types";

interface PrintReportProps {
  response: ReconcileResponse;
  supplierGroups: SupplierChaseGroup[];
  lang: Language;
}

export function PrintReport({ response, supplierGroups, lang }: PrintReportProps) {
  const { summary } = response;
  const issuesFound = summary.results.reduce((total, r) => total + r.issues.length, 0);

  const formattedDate = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN", {
    dateStyle: "long",
  }).format(new Date());

  return (
    <div className="hidden print:block print:space-y-6 print:text-black">
      {/* Header with Title and Date */}
      <div className="border-b-2 border-neutral-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{t("reportTitle", lang)}</h1>
        <p className="mt-1 text-xs text-neutral-600">
          {t("date", lang)}: <span className="font-semibold">{formattedDate}</span>
        </p>
      </div>

      {/* Summary figures */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-neutral-300 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">ITC at risk</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{inr.format(summary.itcAtRiskTotal)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">Invoices checked</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{summary.results.length}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">Issues found</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{issuesFound}</p>
        </div>
      </div>

      {/* Overview Narrative */}
      {response.narrative && (
        <div className="rounded-xl border border-neutral-300 p-4 print-avoid-break">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">Executive Summary</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-800">{response.narrative}</p>
        </div>
      )}

      {/* Supplier Summary from Part B */}
      <div className="print-avoid-break">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-neutral-800">
          Supplier Summary ({supplierGroups.length})
        </h2>
        <table className="w-full border-collapse border border-neutral-300 text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 font-semibold text-neutral-800">
              <th className="border-r border-neutral-300 p-2">Supplier</th>
              <th className="border-r border-neutral-300 p-2">GSTIN</th>
              <th className="border-r border-neutral-300 p-2 text-right">Invoices</th>
              <th className="border-r border-neutral-300 p-2 text-right">With Issues</th>
              <th className="border-r border-neutral-300 p-2 text-right">Not in 2B</th>
              <th className="p-2 text-right">ITC at Risk</th>
            </tr>
          </thead>
          <tbody>
            {supplierGroups.map((group) => (
              <tr key={group.key} className="border-b border-neutral-300">
                <td className="border-r border-neutral-300 p-2 font-medium">{group.name}</td>
                <td className="border-r border-neutral-300 p-2 font-mono text-[11px]">{group.gstin || "—"}</td>
                <td className="border-r border-neutral-300 p-2 text-right tabular-nums">{group.invoicesChecked}</td>
                <td className="border-r border-neutral-300 p-2 text-right tabular-nums">{group.invoicesWithIssues}</td>
                <td className="border-r border-neutral-300 p-2 text-right tabular-nums">{group.notIn2bCount}</td>
                <td className="p-2 text-right font-medium tabular-nums">
                  {group.itcAtRisk > 0 ? inr.format(group.itcAtRisk) : "₹0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Invoice Results Table */}
      <div className="print-avoid-break">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-neutral-800">
          Invoice Results ({summary.results.length})
        </h2>
        <table className="w-full border-collapse border border-neutral-300 text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 font-semibold text-neutral-800">
              <th className="border-r border-neutral-300 p-2">Supplier</th>
              <th className="border-r border-neutral-300 p-2">Invoice No</th>
              <th className="border-r border-neutral-300 p-2 text-right">Tax (INR)</th>
              <th className="border-r border-neutral-300 p-2">Status</th>
              <th className="border-r border-neutral-300 p-2">Issues</th>
              <th className="p-2 text-right">ITC at Risk</th>
            </tr>
          </thead>
          <tbody>
            {summary.results.map((inv) => (
              <tr key={`${inv.fileName}-${inv.invoiceNumber}`} className="border-b border-neutral-300 print-avoid-break">
                <td className="border-r border-neutral-300 p-2 font-medium">{inv.supplierName}</td>
                <td className="border-r border-neutral-300 p-2 font-mono">{inv.invoiceNumber}</td>
                <td className="border-r border-neutral-300 p-2 text-right tabular-nums">{inr.format(inv.taxAmount)}</td>
                <td className="border-r border-neutral-300 p-2">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">{inv.status.replace(/_/g, " ")}</span>
                </td>
                <td className="border-r border-neutral-300 p-2 text-[11px]">
                  {inv.issues.length === 0 ? "None" : inv.issues.map((i) => i.code).join(", ")}
                </td>
                <td className="p-2 text-right tabular-nums font-medium">
                  {inv.itcAtRisk > 0 ? inr.format(inv.itcAtRisk) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Accountant-friendly Disclaimer */}
      <div className="border-t border-neutral-300 pt-3 text-center text-[10px] text-neutral-600 print-avoid-break">
        <p>{t("disclaimer", lang)}</p>
      </div>
    </div>
  );
}
