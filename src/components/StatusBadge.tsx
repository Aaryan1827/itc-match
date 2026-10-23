import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { Status } from "@/lib/gst/types";

const STATUS_META: Record<Status, { label: string; icon: typeof CheckCircle2; className: string }> = {
  clean: {
    label: "Clean",
    icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
  },
  fixable: {
    label: "Fixable",
    icon: AlertTriangle,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  itc_at_risk: {
    label: "ITC at risk",
    icon: XCircle,
    className: "border-risk/30 bg-risk/10 text-risk",
  },
  needs_review: {
    label: "Needs review",
    icon: CircleHelp,
    className: "border-border bg-muted text-muted-foreground",
  },
};

/**
 * Status is never conveyed by colour alone: each badge pairs an icon
 * with the full status text.
 */
export function StatusBadge({ status }: { status: Status }) {
  const { label, icon: Icon, className } = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
