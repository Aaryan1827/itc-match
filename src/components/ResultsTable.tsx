import { inr } from "@/lib/format";
import type { InvoiceResult } from "@/lib/gst/types";
import { StatusBadge } from "./StatusBadge";

interface ResultsTableProps {
  invoices: InvoiceResult[];
  onSelect: (fileName: string) => void;
}

export function ResultsTable({ invoices, onSelect }: ResultsTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">
          Reconciliation results — one row per purchase invoice. Select a row for details.
        </caption>
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-semibold">Supplier</th>
            <th scope="col" className="px-4 py-3 font-semibold">Invoice no.</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Tax</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Issues</th>
            <th scope="col" className="px-4 py-3 font-semibold">File</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={`${invoice.fileName}-${invoice.invoiceNumber}`}
              className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/40"
              onClick={() => onSelect(invoice.fileName)}
            >
              <td className="px-4 py-3 font-medium">{invoice.supplierName}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(invoice.fileName);
                  }}
                  className="rounded font-medium text-primary underline-offset-4 hover:underline"
                  aria-label={`View details for invoice ${invoice.invoiceNumber} from ${invoice.supplierName}`}
                >
                  {invoice.invoiceNumber}
                </button>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{inr.format(invoice.taxAmount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {invoice.issues.length === 0 ? "None" : String(invoice.issues.length)}
              </td>
              <td className="px-4 py-3">
                <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{invoice.fileName}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
