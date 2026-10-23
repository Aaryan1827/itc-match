import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed, Loader2, SearchCheck, Sparkles } from "lucide-react";

import { Header } from "@/components/Header";
import { UploadPanel } from "@/components/UploadPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { ResultsTable } from "@/components/ResultsTable";
import { DetailPanel } from "@/components/DetailPanel";
import { PerformanceStrip } from "@/components/PerformanceStrip";
import { demoGstr2BFile, demoInvoices, demoPurchaseFiles, type Invoice } from "@/data/demoData";

const STEPS = ["Extracting", "Validating", "Matching", "Classifying"] as const;
const MAX_FILES = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

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
  const [purchaseFiles, setPurchaseFiles] = useState<string[]>([]);
  const [gstrFiles, setGstrFiles] = useState<string[]>([]);
  const [purchaseDemo, setPurchaseDemo] = useState(false);
  const [gstrDemo, setGstrDemo] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [gstrError, setGstrError] = useState<string | null>(null);

  const [stage, setStage] = useState<"idle" | "running" | "done">("idle");
  const [stepIndex, setStepIndex] = useState(-1);
  const [liveMessage, setLiveMessage] = useState("");
  const [result, setResult] = useState<Invoice[] | null>(null);
  const [secondsPerInvoice, setSecondsPerInvoice] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const hasPurchases = purchaseDemo || purchaseFiles.length > 0;
  const hasGstr = gstrDemo || gstrFiles.length > 0;
  const ready = hasPurchases && hasGstr && stage !== "running";

  const selectedInvoice = result?.find((invoice) => invoice.id === selectedId) ?? null;

  function resetResults() {
    setStage("idle");
    setStepIndex(-1);
    setResult(null);
    setSelectedId(null);
    setSecondsPerInvoice(0);
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
    setPurchaseFiles(files.map((file) => file.name));
  }

  function handleGstrSelect(files: File[]) {
    setGstrDemo(false);
    setGstrError(null);
    resetResults();
    if (files.length === 0) return;
    setGstrFiles(files.map((file) => file.name));
  }

  function loadDemo() {
    setPurchaseFiles([]);
    setGstrFiles([]);
    setPurchaseError(null);
    setGstrError(null);
    setPurchaseDemo(true);
    setGstrDemo(true);
    resetResults();
    setLiveMessage("Demo data loaded for both purchase invoices and GSTR-2B.");
  }

  async function runReconcile() {
    if (!ready) return;

    setStage("running");
    setStepIndex(0);

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepDelayMs = reducedMotion ? 150 : 900;
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const startedAt = Date.now();
    for (let i = 0; i < STEPS.length; i++) {
      setStepIndex(i);
      setLiveMessage(`Step ${i + 1} of ${STEPS.length}: ${STEPS[i]}…`);
      await delay(stepDelayMs);
    }

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    setSecondsPerInvoice(elapsedSeconds / demoInvoices.length);
    setResult(demoInvoices);
    setStage("done");

    const issues = demoInvoices.reduce((total, invoice) => total + invoice.checks.length, 0);
    const atRisk = demoInvoices
      .filter((invoice) => invoice.status === "ITC at risk")
      .reduce((total, invoice) => total + invoice.taxAmount, 0);
    setLiveMessage(
      `Reconciliation complete. ${issues} issues found across ${demoInvoices.length} invoices. Input tax credit at risk: ₹${atRisk.toLocaleString("en-IN")}.`,
    );

    resultsRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
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
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/70"
            >
              <Sparkles aria-hidden className="size-4" />
              Load demo data
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
              demoFiles={demoPurchaseFiles}
              selectedFiles={purchaseFiles}
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
              demoFiles={[demoGstr2BFile]}
              selectedFiles={gstrFiles}
              error={gstrError}
              onSelect={handleGstrSelect}
            />
          </div>
        </section>

        {/* Reconcile */}
        <div className="mt-8 flex flex-col items-center gap-4">
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
            {stage === "running" ? `${STEPS[stepIndex]}…` : "Reconcile"}
          </button>

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

          {stage === "idle" && (
            <p className="text-sm text-muted-foreground">
              {ready
                ? "Ready to reconcile — press the button above."
                : "Add files to both sides, or load the demo data, to begin."}
            </p>
          )}
        </div>

        {/* Results */}
        <div ref={resultsRef} className="scroll-mt-6">
          {stage === "done" && result && (
            <>
              <SummaryCards invoices={result} />
              <section aria-labelledby="table-heading" className="mt-8">
                <h2 id="table-heading" className="mb-3 text-xl font-semibold tracking-tight">
                  Invoice results
                </h2>
                <ResultsTable invoices={result} onSelect={setSelectedId} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Select a row to see failed checks and a ready-to-copy supplier follow-up message.
                </p>
              </section>
              <div className="mt-6">
                <PerformanceStrip
                  secondsPerInvoice={secondsPerInvoice}
                  invoiceCount={result.length}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <DetailPanel invoice={selectedInvoice} onClose={() => setSelectedId(null)} />
    </div>
  );
}
