import { inr, formatIndianDate, type Invoice } from "@/data/demoData";
import { StatusBadge } from "./StatusBadge";

interface ResultsTableProps {
  invoices: Invoice[];
  onSelect: (id: string) => void;
}

export function ResultsTable({ invoices, onSelect }: ResultsTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[860px] text-left text-sm">
        <caption className="sr-only">
          Reconciliation results — one row per purchase invoice. Select a row for details.
        </caption>
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-semibold">Supplier</th>
            <th scope="col" className="px-4 py-3 font-semibold">Invoice no.</th>
            <th scope="col" className="px-4 py-3 font-semibold">Date</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Taxable value</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Tax</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/40"
              onClick={() => onSelect(invoice.id)}
            >
              <td className="px-4 py-3">
                <span className="font-medium">{invoice.supplier}</span>
                <span className="block text-xs text-muted-foreground">{invoice.gstin}</span>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(invoice.id);
                  }}
                  className="rounded font-medium text-primary underline-offset-4 hover:underline"
                  aria-label={`View details for invoice ${invoice.invoiceNumber} from ${invoice.supplier}`}
                >
                  {invoice.invoiceNumber}
                </button>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{formatIndianDate(invoice.date)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{inr.format(invoice.taxableValue)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{inr.format(invoice.taxAmount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{invoice.confidence}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
