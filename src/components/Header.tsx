import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck aria-hidden className="size-6" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight">TaxSure-AI</h1>
          <p className="text-sm text-muted-foreground">
            Find the input tax credit you&apos;re about to lose.
          </p>
        </div>
      </div>
    </header>
  );
}
