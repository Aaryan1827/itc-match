import { Clock, Lock } from "lucide-react";

interface PerformanceStripProps {
  secondsPerInvoice: number;
  invoiceCount: number;
}

export function PerformanceStrip({ secondsPerInvoice, invoiceCount }: PerformanceStripProps) {
  return (
    <section
      aria-label="Performance and data handling"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <Clock aria-hidden className="size-4 text-primary" />
        <span>
          <strong className="font-semibold text-foreground">{secondsPerInvoice.toFixed(1)} s</strong> per
          invoice ({invoiceCount} invoices)
        </span>
      </span>
      <span className="inline-flex items-center gap-2">
        <Lock aria-hidden className="size-4 text-primary" />
        Files are processed in memory and not stored.
      </span>
    </section>
  );
}
