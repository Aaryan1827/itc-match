import { Clock, Cpu, Lock } from "lucide-react";

interface PerformanceStripProps {
  timingsMs: { extract: number; reconcile: number; explain: number; total: number };
  model: string;
  invoiceCount: number;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function PerformanceStrip({ timingsMs, model, invoiceCount }: PerformanceStripProps) {
  return (
    <section
      aria-label="Performance and data handling"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <Clock aria-hidden className="size-4 text-primary" />
        <span>
          <strong className="font-semibold text-foreground">{seconds(timingsMs.total)}</strong> total for{" "}
          {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"}
          <span className="block text-xs">
            Extracting {seconds(timingsMs.extract)} · Matching {seconds(timingsMs.reconcile)} · Explaining{" "}
            {seconds(timingsMs.explain)}
          </span>
        </span>
      </span>
      <span className="inline-flex items-center gap-2">
        <Cpu aria-hidden className="size-4 text-primary" />
        Model: {model}
      </span>
      <span className="inline-flex items-center gap-2">
        <Lock aria-hidden className="size-4 text-primary" />
        Files are processed in memory and not stored.
      </span>
    </section>
  );
}
