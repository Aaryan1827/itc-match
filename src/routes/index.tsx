import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed, Loader2, SearchCheck, Sparkles } from "lucide-react";

import { Header } from "@/components/Header";
import { UploadPanel } from "@/components/UploadPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { ResultsTable } from "@/components/ResultsTable";
import { DetailPanel } from "@/components/DetailPanel";
import { PerformanceStrip } from "@/components/PerformanceStrip";
import type { Language, ReconcileResponse } from "@/lib/gst/types";

const STEPS = ["Extracting", "Validating", "Matching", "Classifying"] as const;
const MAX_FILES = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Demo files fetched from /samples (served from public/samples). */
const DEMO_INVOICE_FILES = [
  "INV01.pdf", "INV02.pdf", "INV03.pdf", "INV04.pdf", "INV05.pdf",
  "INV06.pdf", "INV07.pdf", "INV08.pdf", "INV09.pdf", "INV10.pdf",
] as const;

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "mr", label: "मराठी" },
];

const NO_FOLLOW_UP = "No issues found for this invoice — no supplier follow-up is needed.";
const NETWORK_ERROR = "We could not reach the server. Check your connection and try again.";
const GENERIC_ERROR = "Something went wrong while reconciling. Please try again.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaxSure-AI — GSTR-2B purchase invoice reconciliation" },
      {
        name: "description",
        content:
          "Match purchase invoices against GSTR-2B, spot input tax credit at risk before you file, and get ready-to-send supplier follow-up messages.",
      },
      { property: "og:title", content: "TaxSure-AI" },
      { property: "og:description", content: "Find the input tax credit you're about to lose." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "TaxSure-AI" },
      {
        name: "twitter:description",
        content: "Find the input tax credit you're about to lose.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [purchaseFiles, setPurchaseFiles] = useState<File[]>([]);
  const [gstrFile, setGstrFile] = useState<File | null>(null);
  const [purchaseDemo, setPurchaseDemo] = useState(false);
  const [gstrDemo, setGstrDemo] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("en");

  const [stage, setStage] = useState<"idle" | "running" | "done">("idle");
  const [stepIndex, setStepIndex] = useState(-1);
  const [liveMessage, setLiveMessage] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [response, setResponse] = useState<ReconcileResponse | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const hasPurchases = purchaseFiles.length > 0;
  const hasGstr = gstrFile !== null;
  const ready = hasPurchases && hasGstr && stage !== "running";

  const selectedInvoice =
    response?.summary.results.find((result) => result.fileName === selectedFileName) ?? null;
  const selectedFollowUp = selectedInvoice
    ? (response?.followUps.find((f) => f.invoiceNumber === selectedInvoice.invoiceNumber)?.message ?? NO_FOLLOW_UP)
    : "";

  function resetResults() {
    setStage("idle");
    setStepIndex(-1);
    setResponse(null);
    setSelectedFileName(null);
    setRunError(null);
  }

  function handlePurchaseSelect(files: File[]) {
    setPurchaseDemo(false);
    setPurchaseError(null);
    resetResults();
    if (files.length === 0) return;

    if (files.length > MAX_FILES) {
      setPurchaseError(`Choose up to ${MAX_FILES} files at a time.`);
      return;
    }
    const tooLarge = files.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) {
      setPurchaseError(`"${tooLarge.name}" is larger than 5 MB. Please choose smaller files.`);
      return;
    }
    setPurchaseFiles(files);
  }

  function handleGstrSelect(files: File[]) {
    setGstrDemo(false);
    resetResults();
    setGstrFile(files[0] ?? null);
  }

  async function loadDemo() {
    setDemoLoading(true);
    setPurchaseError(null);
    setRunError(null);
    resetResults();
    setLiveMessage("Loading demo data…");

    try {
      const [invoices, gstr] = await Promise.all([
        Promise.all(
          DEMO_INVOICE_FILES.map(async (name) => {
            const res = await fetch(`/samples/invoices/${name}`);
            if (!res.ok) throw new Error(`demo invoice ${name}`);
            return new File([await res.blob()], name, { type: "application/pdf" });
          }),
        ),
        (async () => {
          const res = await fetch("/samples/gstr-2b.csv");
          if (!res.ok) throw new Error("demo GSTR-2B file");
          return new File([await res.blob()], "gstr-2b.csv", { type: "text/csv" });
        })(),
      ]);

      setPurchaseFiles(invoices);
      setGstrFile(gstr);
      setPurchaseDemo(true);
      setGstrDemo(true);
      setLiveMessage("Demo data loaded for both purchase invoices and GSTR-2B.");
    } catch {
      setPurchaseFiles([]);
      setGstrFile(null);
      setPurchaseDemo(false);
      setGstrDemo(false);
      setRunError("The demo files could not be loaded. Please try again.");
      setLiveMessage("Loading demo data failed.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function runReconcile() {
    if (!ready || !gstrFile) return;

    setStage("running");
    setStepIndex(0);
    setRunError(null);

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepDelayMs = reducedMotion ? 150 : 900;
    const stepTimer = window.setInterval(
      () => setStepIndex((index) => Math.min(index + 1, STEPS.length - 1)),
      stepDelayMs,
    );

    const form = new FormData();
    for (const file of purchaseFiles) form.append("invoices", file);
    form.append("gstr2b", gstrFile);
    form.append("lang", lang);

    try {
      const res = await fetch("/api/reconcile", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | (ReconcileResponse & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(
          (data?.error as string | undefined) || GENERIC_ERROR,
        );
      }
      if (!data) throw new Error(GENERIC_ERROR);

      window.clearInterval(stepTimer);
      setResponse(data);
      setStage("done");

      const issues = data.summary.results.reduce((total, result) => total + result.issues.length, 0);
      const checked = data.summary.results.length;
      setLiveMessage(
        `Reconciliation complete. ${issues} issue${issues === 1 ? "" : "s"} found across ${checked} ` +
          `invoice${checked === 1 ? "" : "s"}. Input tax credit at risk: ₹${data.summary.itcAtRiskTotal.toLocaleString("en-IN")}.`,
      );

      resultsRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    } catch (error) {
      window.clearInterval(stepTimer);
      const message =
        error instanceof TypeError
          ? NETWORK_ERROR
          : error instanceof Error && error.message
            ? error.message
            : GENERIC_ERROR;
      setRunError(message);
      setLiveMessage(`Reconciliation failed: ${message}`);
      setStage("idle");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {/* Upload */}
        <section aria-labelledby="upload-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="upload-heading" className="text-xl font-semibold tracking-tight">
                Upload your records
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add purchase invoices and this period&apos;s GSTR-2B to start reconciling.
              </p>
            </div>
            <button
              type="button"
              onClick={loadDemo}
              disabled={demoLoading}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {demoLoading ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden className="size-4" />
              )}
              {demoLoading ? "Loading demo…" : "Load demo data"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <UploadPanel
              id="purchase-invoices"
              title="Purchase invoices"
              description="Supplier invoices to reconcile against GSTR-2B."
              hint="Up to 10 files · images or PDF · max 5 MB each"
              accept="image/*,application/pdf"
              multiple
              isDemo={purchaseDemo}
              selectedFiles={purchaseFiles.map((file) => file.name)}
              error={purchaseError}
              onSelect={handlePurchaseSelect}
            />
            <UploadPanel
              id="gstr-2b"
              title="GSTR-2B file"
              description="The CSV downloaded from the GST portal."
              hint="One CSV file exported from the GST portal"
              accept=".csv,text/csv"
              isDemo={gstrDemo}
              selectedFiles={gstrFile ? [gstrFile.name] : []}
              error={null}
              onSelect={handleGstrSelect}
            />
          </div>
        </section>

        {/* Reconcile */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="reconcile-language" className="text-sm font-medium">
                Language
              </label>
              <select
                id="reconcile-language"
                value={lang}
                onChange={(event) => setLang(event.target.value as Language)}
                disabled={stage === "running"}
                className="min-h-11 rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={runReconcile}
              disabled={!ready}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stage === "running" ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : (
                <SearchCheck aria-hidden className="size-5" />
              )}
              {stage === "running" ? `${STEPS[Math.max(stepIndex, 0)]}…` : "Reconcile"}
            </button>
          </div>

          {runError && stage === "idle" && (
            <p role="alert" className="text-sm text-destructive">
              {runError}
            </p>
          )}

          {stage === "running" && (
            <ol className="flex flex-wrap justify-center gap-2" aria-label="Reconciliation progress">
              {STEPS.map((step, index) => {
                const isDone = index < stepIndex;
                const isCurrent = index === stepIndex;
                return (
                  <li
                    key={step}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      isCurrent
                        ? "border-primary/40 bg-accent text-primary"
                        : isDone
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 aria-hidden className="size-3.5" />
                    ) : isCurrent ? (
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    ) : (
                      <CircleDashed aria-hidden className="size-3.5" />
                    )}
                    {step}
                  </li>
                );
              })}
            </ol>
          )}

          <p aria-live="polite" className="sr-only">
            {liveMessage}
          </p>

          {stage === "idle" && !runError && (
            <p className="text-sm text-muted-foreground">
              {ready
                ? "Ready to reconcile — press the button above."
                : "Add files to both sides, or load the demo data, to begin."}
            </p>
          )}
        </div>

        {/* Results */}
        <div ref={resultsRef} className="scroll-mt-6">
          {stage === "done" && response && (
            <>
              <SummaryCards summary={response.summary} />

              <section
                aria-labelledby="narrative-heading"
                className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <h2
                  id="narrative-heading"
                  className="flex items-center gap-2 text-xl font-semibold tracking-tight"
                >
                  <Sparkles aria-hidden className="size-5 text-primary" />
                  Overview
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{response.narrative}</p>
              </section>

              <section aria-labelledby="table-heading" className="mt-8">
                <h2 id="table-heading" className="mb-3 text-xl font-semibold tracking-tight">
                  Invoice results
                </h2>
                <ResultsTable invoices={response.summary.results} onSelect={setSelectedFileName} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Select a row to see its issues and a ready-to-copy supplier follow-up message.
                </p>
              </section>

              {response.failed.length > 0 && (
                <section
                  aria-labelledby="failed-heading"
                  className="mt-6 rounded-2xl border border-warning/30 bg-warning/10 p-5"
                >
                  <h2 id="failed-heading" className="text-base font-semibold text-warning">
                    Could not read ({response.failed.length} file{response.failed.length === 1 ? "" : "s"})
                  </h2>
                  <ul className="mt-2 space-y-1.5">
                    {response.failed.map((item) => (
                      <li key={item.fileName} className="text-sm text-foreground">
                        <span className="font-medium">{item.fileName}</span>
                        <span className="text-muted-foreground"> — {item.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-6">
                <PerformanceStrip
                  timingsMs={response.timingsMs}
                  model={response.model}
                  invoiceCount={response.summary.results.length}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <DetailPanel
        invoice={selectedInvoice}
        followUp={selectedFollowUp}
        onClose={() => setSelectedFileName(null)}
      />
    </div>
  );
}
