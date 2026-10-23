import { Landmark, TrendingDown, SearchCheck } from "lucide-react";
import { inr, type Invoice } from "@/data/demoData";

interface SummaryCardsProps {
  invoices: Invoice[];
}

export function SummaryCards({ invoices }: SummaryCardsProps) {
  const itcAtRisk = invoices
    .filter((invoice) => invoice.status === "ITC at risk")
    .reduce((total, invoice) => total + invoice.taxAmount, 0);
  const issuesFound = invoices.reduce((total, invoice) => total + invoice.checks.length, 0);

  const cards = [
    {
      id: "summary-risk",
      icon: TrendingDown,
      label: "ITC at risk (₹)",
      value: inr.format(itcAtRisk),
      caption: "Input tax credit that cannot be claimed this period",
    },
    {
      id: "summary-checked",
      icon: Landmark,
      label: "Invoices checked",
      value: String(invoices.length),
      caption: "Purchase invoices matched against GSTR-2B",
    },
    {
      id: "summary-issues",
      icon: SearchCheck,
      label: "Issues found",
      value: String(issuesFound),
      caption: "Failed checks across all invoices",
    },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="mb-3 text-xl font-semibold tracking-tight">
        Reconciliation summary
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ id, icon: Icon, label, value, caption }) => (
          <div key={id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon aria-hidden className="size-4 text-primary" />
              <p id={id} className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight" aria-labelledby={`${id} summary-heading`}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
