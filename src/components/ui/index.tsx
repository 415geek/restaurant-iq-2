import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "muted";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-border",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  good: "bg-good-soft text-good border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  muted: "bg-transparent text-muted border-border",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 tracking-wide", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export const LABEL_TONE: Record<string, Tone> = { high: "good", medium: "accent", low: "warn", requires_validation: "warn", not_recommended: "bad" };
export const LABEL_TEXT: Record<string, string> = { high: "High evidence", medium: "Medium evidence", low: "Low evidence", requires_validation: "Requires validation", not_recommended: "Not recommended" };

export function EvidenceBadge({ label }: { label: string }) {
  return <Badge tone={LABEL_TONE[label] ?? "neutral"}>{LABEL_TEXT[label] ?? label}</Badge>;
}

export function ModeBadge({ mode }: { mode: "live" | "sample" | null | undefined }) {
  if (mode === "live") return <Badge tone="good">● Live Qloo</Badge>;
  return <Badge tone="warn" title="Sample dataset — illustrative, not live Qloo data">◌ Sample data</Badge>;
}

export function Button({ children, href, variant = "primary", className, type = "button", disabled, onClick, title, size = "md" }: {
  children: ReactNode; href?: string; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; type?: "button" | "submit"; disabled?: boolean; onClick?: () => void; title?: string; size?: "sm" | "md" | "lg";
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-sm", lg: "h-12 px-6 text-base" }[size];
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-ink",
    secondary: "bg-surface border border-border text-ink hover:bg-surface-2",
    ghost: "text-ink-2 hover:bg-surface-2",
    danger: "bg-bad-soft text-bad hover:opacity-90",
  }[variant];
  const cls = cx(base, sizes, variants, className);
  if (href && !disabled) return <Link href={href} className={cls} title={title}>{children}</Link>;
  return <button type={type} className={cls} disabled={disabled} onClick={onClick} title={title}>{children}</button>;
}

export function Card({ children, className, as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={cx("card p-4 sm:p-5", className)}>{children}</Tag>;
}

export function CardTitle({ children, hint, right }: { children: ReactNode; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold leading-6">{children}</h2>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "pos" | "neg" | "neutral" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("tabular text-2xl font-semibold leading-tight", tone === "pos" && "text-good", tone === "neg" && "text-bad")}>{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/** Single-series magnitude bar (sequential: one hue). value 0..1 */
export function Bar({ value, label, right, tone = "accent" }: { value: number | undefined; label: ReactNode; right?: ReactNode; tone?: "accent" | "neg" | "muted" }) {
  const pct = value === undefined ? 0 : Math.max(0, Math.min(1, value)) * 100;
  const color = tone === "neg" ? "bg-neg" : tone === "muted" ? "bg-muted" : "bg-accent";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1.5">
      <div className="truncate text-sm">{label}</div>
      <div className="tabular text-xs text-ink-2">{right ?? (value === undefined ? "n/a" : value.toFixed(2))}</div>
      <div className="col-span-2 h-1.5 w-full rounded-full bg-surface-2" role="img" aria-label={`${typeof label === "string" ? label : "value"} ${value === undefined ? "unknown" : value.toFixed(2)}`}>
        <div className={cx("h-1.5 rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Diverging bar around zero (two hues + neutral midpoint). value -1..1 */
export function DivergingBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(-1, Math.min(1, value));
  const w = Math.abs(v) * 50;
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)_3rem] items-center gap-2 py-1 text-sm">
      <div className="truncate text-ink-2">{label}</div>
      <div className="relative h-2 rounded-full bg-surface-2" role="img" aria-label={`${label} ${v >= 0 ? "+" : ""}${v.toFixed(2)} vs average`}>
        <div className="absolute left-1/2 top-0 h-2 w-px bg-border" />
        <div className={cx("absolute top-0 h-2 rounded-full", v >= 0 ? "bg-pos" : "bg-neg")} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
      </div>
      <div className={cx("tabular text-right text-xs", v >= 0 ? "text-pos" : "text-neg")}>{v >= 0 ? "+" : ""}{v.toFixed(2)}</div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 border-dashed p-6 text-sm">
      <div className="font-medium">{title}</div>
      {body ? <p className="text-muted">{body}</p> : null}
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{children}</kbd>;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function fmtUsd(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
