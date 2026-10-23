import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Copy, X } from "lucide-react";
import { inr } from "@/lib/format";
import type { InvoiceResult, IssueCode } from "@/lib/gst/types";
import { StatusBadge } from "./StatusBadge";

/** Friendly short label for each machine issue code. */
const ISSUE_LABELS: Record<IssueCode, string> = {
  GSTIN_FORMAT: "GSTIN format",
  GSTIN_CHECKSUM: "GSTIN checksum",
  TAX_TYPE_MISMATCH: "Tax type mismatch",
  ARITHMETIC_MISMATCH: "Arithmetic mismatch",
  RATE_NOT_ALLOWED: "GST rate not allowed",
  NOT_IN_2B: "Missing from GSTR-2B",
  FUZZY_MATCH: "Uncertain match",
  VALUE_MISMATCH_2B: "Value differs from GSTR-2B",
  DUPLICATE_INVOICE: "Possible duplicate",
  LOW_CONFIDENCE: "Low extraction confidence",
};

interface DetailPanelProps {
  invoice: InvoiceResult | null;
  followUp: string;
  onClose: () => void;
}

export function DetailPanel({ invoice, followUp, onClose }: DetailPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!invoice) return;

    setCopied(false);
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [invoice, onClose]);

  if (!invoice) return null;

  const hasIssues = invoice.issues.length > 0;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(followUp);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="detail-panel-title"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice detail</p>
          <h2 id="detail-panel-title" className="mt-1 text-lg font-semibold">
            {invoice.invoiceNumber}
          </h2>
          <p className="text-sm text-muted-foreground">{invoice.supplierName}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close details panel"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X aria-hidden className="size-5" />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={invoice.status} />
          <span className="text-xs text-muted-foreground">{invoice.fileName}</span>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Tax amount</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{inr.format(invoice.taxAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">ITC at risk</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {invoice.itcAtRisk > 0 ? inr.format(invoice.itcAtRisk) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Issues</dt>
            <dd className="mt-0.5 font-medium">{invoice.issues.length}</dd>
          </div>
        </dl>

        <section aria-labelledby="issues-heading">
          <h3 id="issues-heading" className="text-sm font-semibold">
            Issues ({invoice.issues.length})
          </h3>
          {!hasIssues ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              All checks passed. This invoice matches GSTR-2B and its input tax credit can be claimed in full.
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {invoice.issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-3"
                >
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{ISSUE_LABELS[issue.code]}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{issue.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="followup-heading">
          <h3 id="followup-heading" className="text-sm font-semibold">
            Supplier follow-up message
          </h3>
          <p className="mt-2 rounded-xl bg-secondary/50 p-4 text-sm leading-relaxed">{followUp}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={copyMessage}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Copy aria-hidden className="size-4" />
              {copied ? "Copied!" : "Copy message"}
            </button>
            <span aria-live="polite" className="sr-only">
              {copied ? "Follow-up message copied to clipboard" : ""}
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
