import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(" "); }

type Tone = "neutral" | "coral" | "navy" | "good" | "warn" | "bad" | "pos" | "gold" | "muted";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  coral: "bg-coral-soft text-coral-ink",
  navy: "bg-navy-soft text-navy",
  good: "bg-good-soft text-good-ink",
  warn: "bg-warn-soft text-warn-ink",
  bad: "bg-bad-soft text-bad",
  pos: "bg-pos-soft text-pos",
  gold: "bg-gold-soft text-warn-ink",
  muted: "bg-transparent text-muted border border-border",
};

/** Pill chip. 12.5px/600. Optional affinity ring (0..1). */
export function Chip({ tone = "neutral", children, ring, className, title }: { tone?: Tone; children: ReactNode; ring?: number; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold leading-4", toneClass[tone], className)}>
      {ring !== undefined ? <i className="ring" style={{ ["--v" as string]: Math.max(0, Math.min(1, ring)) }} aria-hidden /> : null}
      {children}
    </span>
  );
}

export const LABEL_TONE: Record<string, Tone> = { high: "good", medium: "pos", low: "warn", requires_validation: "warn", not_recommended: "bad" };

export function Button({ children, href, variant = "primary", className, type = "button", disabled, onClick, title, size = "md", ariaLabel }: {
  children: ReactNode; href?: string; variant?: "primary" | "coral" | "secondary" | "ghost"; className?: string; type?: "button" | "submit"; disabled?: boolean; onClick?: () => void; title?: string; size?: "sm" | "md" | "lg"; ariaLabel?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctl)] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap";
  const sizes = { sm: "h-9 px-3 text-[13px]", md: "h-11 px-4 text-sm", lg: "h-12 px-6 text-base" }[size];
  const variants = {
    primary: "bg-navy text-white hover:bg-[#223659]",
    coral: "bg-coral text-white hover:bg-coral-ink",
    secondary: "bg-surface-2 text-ink hover:bg-border",
    ghost: "text-ink-2 hover:bg-surface-2",
  }[variant];
  const cls = cx(base, sizes, variants, className);
  if (href && !disabled) return <Link href={href} className={cls} title={title} aria-label={ariaLabel}>{children}</Link>;
  return <button type={type} className={cls} disabled={disabled} onClick={onClick} title={title} aria-label={ariaLabel}>{children}</button>;
}

export function Card({ children, className, as: Tag = "section", padded = true }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li"; padded?: boolean }) {
  return <Tag className={cx("card", padded && "p-4 sm:p-5", className)}>{children}</Tag>;
}

export function H2({ children, hint, right, className }: { children: ReactNode; hint?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold leading-6 tracking-[-0.01em]">{children}</h2>
        {hint ? <p className="mt-0.5 text-[13px] text-ink-2">{hint}</p> : null}
      </div>
      {right ? <div className="min-w-0 max-w-full shrink-0">{right}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "pos" | "neg" | "neutral" }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium text-ink-2">{label}</div>
      <div className={cx("tabular text-[22px] font-extrabold leading-tight tracking-[-0.02em]", tone === "pos" && "text-good-ink", tone === "neg" && "text-bad")}>{value}</div>
      {hint ? <div className="text-[12px] text-muted">{hint}</div> : null}
    </div>
  );
}

/** Single-series magnitude bar (sequential, coral). */
export function Bar({ value, label, right }: { value: number | undefined; label: ReactNode; right?: ReactNode }) {
  const pct = value === undefined ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-3 text-[13px]"><span className="truncate">{label}</span><span className="tabular text-ink-2">{right ?? (value === undefined ? "—" : value.toFixed(2))}</span></div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2"><div className="h-1.5 rounded-full bg-coral" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Diverging bar around zero: blue positive / coral negative, neutral midpoint. */
export function DivergingBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(-1, Math.min(1, value)); const w = Math.abs(v) * 50;
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)_3rem] items-center gap-2 py-1 text-[13px]">
      <span className="truncate text-ink-2">{label}</span>
      <div className="relative h-2 rounded-full bg-surface-2" role="img" aria-label={`${label} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`}>
        <div className="absolute left-1/2 top-0 h-2 w-px bg-border" />
        <div className={cx("absolute top-0 h-2 rounded-full", v >= 0 ? "bg-pos" : "bg-neg")} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
      </div>
      <span className={cx("tabular text-right text-[12px] font-semibold", v >= 0 ? "text-pos" : "text-coral-ink")}>{v >= 0 ? "+" : ""}{v.toFixed(2)}</span>
    </div>
  );
}

export function Empty({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 border-dashed p-6 text-sm">
      <div className="font-semibold">{title}</div>
      {body ? <p className="text-ink-2">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function fmtDate(iso: string | null | undefined, locale = "en") {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "zh" ? "zh-CN" : locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function fmtUsd(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
