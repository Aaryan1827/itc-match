import { ChevronDown, Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { downloadCsv, generateReconciliationCsv } from "@/lib/export/csv";
import type { Language, ReconcileResponse } from "@/lib/gst/types";
import { t } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ExportControlsProps {
  response: ReconcileResponse;
  lang: Language;
  onAnnounce: (message: string) => void;
}

export function ExportControls({ response, lang, onAnnounce }: ExportControlsProps) {
  function handleDownloadCsv() {
    const csv = generateReconciliationCsv(response.summary.results, response.followUps);
    downloadCsv(csv);
    onAnnounce(t("csvDownloaded", lang));
  }

  function handlePrint() {
    onAnnounce(t("reportReadyToPrint", lang));
    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={t("export", lang)}
          >
            <Download aria-hidden className="size-4 text-primary" />
            <span>{t("export", lang)}</span>
            <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-1.5">
          <DropdownMenuItem
            onClick={handleDownloadCsv}
            className="cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <FileSpreadsheet aria-hidden className="size-4 text-primary" />
            <span>{t("downloadCsv", lang)}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDownloadCsv}
            className="cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <FileText aria-hidden className="size-4 text-primary" />
            <span>{t("downloadExcel", lang)}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handlePrint}
            className="cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Printer aria-hidden className="size-4 text-primary" />
            <span>{t("printReport", lang)}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
