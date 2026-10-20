import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Verdict } from "@/lib/m18/health";

export function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-11 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="6" className="fill-raised" />
      <rect x="5" y="9" width="3" height="14" className="fill-fg" />
      <rect x="10" y="7" width="3" height="18" className="fill-fg" />
      <rect x="15" y="5" width="3" height="22" className="fill-primary" />
      <rect x="20" y="7" width="3" height="18" className="fill-fg" />
      <rect x="25" y="9" width="3" height="14" className="fill-fg" />
    </svg>
  );
}

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${base} bg-primary text-primary-fg ${className}`} {...props} />;
}

export function QuietButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${base} border border-line bg-surface text-fg ${className}`} {...props} />;
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl leading-none">{value}</p>
      {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
    </div>
  );
}

export function verdictClass(verdict: Verdict): string {
  if (verdict === "retire") return "rounded-lg bg-primary p-4 text-primary-fg";
  if (verdict === "watch") return "rounded-lg border border-primary bg-surface p-4 text-fg";
  return "rounded-lg border border-line bg-surface p-4 text-fg";
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs tracking-widest text-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
