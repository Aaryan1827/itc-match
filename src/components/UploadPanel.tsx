import { FileCheck2, Upload } from "lucide-react";

interface UploadPanelProps {
  id: string;
  title: string;
  description: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  isDemo: boolean;
  selectedFiles: string[];
  error: string | null;
  onSelect: (files: File[]) => void;
}

export function UploadPanel({
  id,
  title,
  description,
  hint,
  accept,
  multiple = false,
  isDemo,
  selectedFiles,
  error,
  onSelect,
}: UploadPanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby={`${id}-title`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="text-base font-semibold">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <FileCheck2 aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      </div>

      <label
        htmlFor={id}
        className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input bg-secondary/40 px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-secondary/70 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
      >
        <Upload aria-hidden className="size-6 text-primary" />
        <span className="text-sm font-medium">Choose files</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        <input
          id={id}
          name={id}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            onSelect(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {selectedFiles.length > 0 && (
        <>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            {isDemo ? "Demo data loaded:" : "Selected files:"}
          </p>
          <ul className="mt-1 space-y-1">
            {selectedFiles.map((file, index) => (
              <li key={`${file}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileCheck2 aria-hidden className="size-3.5 shrink-0 text-success" />
                <span className="truncate">{file}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
