import { useState } from "react";
import { AlertCircle, Check, Copy, History, Shield, Trash2, Users } from "lucide-react";
import { inr } from "@/lib/format";
import type { Language } from "@/lib/gst/types";
import { t } from "@/lib/i18n";
import type { RepeatOffender, SupplierChaseGroup } from "@/lib/suppliers/types";

interface SupplierTrackingProps {
  groups: SupplierChaseGroup[];
  repeatOffenders: RepeatOffender[];
  hasHistory: boolean;
  lang: Language;
  onClearHistory: () => void;
  onAnnounce: (msg: string) => void;
}

export function SupplierTracking({
  groups,
  repeatOffenders,
  hasHistory,
  lang,
  onClearHistory,
  onAnnounce,
}: SupplierTrackingProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleCopy(key: string, text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onAnnounce(t("copiedToClipboard", lang));
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2500);
    } catch {
      setCopiedKey(null);
    }
  }

  function handleConfirmClear() {
    onClearHistory();
    setConfirmClear(false);
    onAnnounce(t("historyCleared", lang));
  }

  return (
    <section aria-labelledby="suppliers-heading" className="mt-8 space-y-6">
      {/* 1. Suppliers to chase */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 id="suppliers-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Users aria-hidden className="size-5 text-primary" />
              <span>{t("suppliersToChase", lang)}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("suppliersToChaseDesc", lang)}</p>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{t("noSuppliersToChase", lang)}</p>
        ) : (
          <div className="mt-5 space-y-4">
            {groups.map((group) => {
              const hasFollowUp = Boolean(group.combinedFollowUp);
              const isCopied = copiedKey === group.key;

              return (
                <div
                  key={group.key}
                  className="rounded-xl border border-border bg-background p-4.5 transition-colors hover:border-primary/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{group.name}</h3>
                      {group.gstin && (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          GSTIN: <span className="text-foreground">{group.gstin}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">{t("itcAtRisk", lang)}</span>
                      <p className="text-base font-bold tabular-nums text-risk">
                        {group.itcAtRisk > 0 ? inr.format(group.itcAtRisk) : "₹0"}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-secondary/50 p-2.5 text-center text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t("invoicesChecked", lang)}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{group.invoicesChecked}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("invoicesWithIssues", lang)}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-warning">{group.invoicesWithIssues}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("notIn2b", lang)}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-risk">{group.notIn2bCount}</dd>
                    </div>
                  </dl>

                  {hasFollowUp && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Follow-up message:</p>
                      <div className="rounded-lg bg-secondary/60 p-3 text-xs leading-relaxed text-foreground">
                        {group.combinedFollowUp}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(group.key, group.combinedFollowUp)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          aria-label={`${t("copyMessage", lang)} for ${group.name}`}
                        >
                          {isCopied ? (
                            <Check aria-hidden className="size-3.5 text-success" />
                          ) : (
                            <Copy aria-hidden className="size-3.5 text-primary" />
                          )}
                          <span>{isCopied ? t("copied", lang) : t("copyMessage", lang)}</span>
                        </button>
                        <span aria-live="polite" className="sr-only">
                          {isCopied ? t("copiedToClipboard", lang) : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Across runs: Repeat offenders & History */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <History aria-hidden className="size-5 text-primary" />
              <span>{t("repeatOffenders", lang)}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("repeatOffendersDesc", lang)}</p>
          </div>

          {hasHistory && (
            <div>
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={t("clearHistory", lang)}
                >
                  <Trash2 aria-hidden className="size-3.5" />
                  <span>{t("clearHistory", lang)}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmClear}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span>{t("confirmClear", lang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span>{t("cancel", lang)}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          {repeatOffenders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRepeatOffenders", lang)}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {repeatOffenders.map((offender) => (
                <li key={offender.key} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{offender.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{offender.key}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-risk/30 bg-risk/10 px-2.5 py-1 text-xs font-medium text-risk">
                    <AlertCircle aria-hidden className="size-3.5" />
                    <span>{t("flaggedInRuns", lang, { count: offender.runCount })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Privacy notice */}
        <div className="mt-5 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Shield aria-hidden className="size-4 shrink-0 text-primary" />
          <span>{t("historyPrivacyNote", lang)}</span>
        </div>
      </div>
    </section>
  );
}
