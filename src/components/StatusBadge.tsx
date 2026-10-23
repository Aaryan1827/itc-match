import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { InvoiceStatus } from "@/data/demoData";

const STATUS_META: Record<InvoiceStatus, { icon: typeof CheckCircle2; className: string }> = {
  Clean: {
    icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
  },
  Fixable: {
    icon: AlertTriangle,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  "ITC at risk": {
    icon: XCircle,
    className: "border-risk/30 bg-risk/10 text-risk",
  },
  "Needs review": {
    icon: CircleHelp,
    className: "border-border bg-muted text-muted-foreground",
  },
};

/**
 * Status is never conveyed by colour alone: each badge pairs an icon
 * with the full status text.
 */
export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { icon: Icon, className } = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {status}
    </span>
  );
}
