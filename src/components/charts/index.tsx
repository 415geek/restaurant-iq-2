/**
 * Small inline chart set (SVG/CSS). Rules: one hue for magnitude (coral ramp), highlight = full coral,
 * rest = coral-soft; thin marks; rounded ends; selective direct labels; legend when ≥2 series; tabular numbers.
 */
import { cx } from "@/components/ui";

const C = { coral: "var(--coral)", soft: "#FFD9C7", softer: "var(--coral-soft)", navy: "var(--navy)", pos: "var(--pos)", good: "var(--good)", warn: "var(--warn)", border: "var(--border)", muted: "var(--muted)" };

/** Vertical bars with one highlighted bar and a dashed reference line (Mondly-style activity chart). */
export function MiniBars({ data, highlight, height = 120, refLine, refLabel, labelFormatter, showLabels = true }: { data: Array<{ label: string; value: number }>; highlight?: number; height?: number; refLine?: number; refLabel?: string; labelFormatter?: (v: number) => string; showLabels?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value), refLine ?? 0);
  const hi = highlight ?? data.reduce((bi, d, i, a) => (d.value > a[bi].value ? i : bi), 0);
  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {refLine !== undefined ? <div className="absolute inset-x-0 flex items-center gap-1" style={{ bottom: `${(refLine / max) * 100}%` }}><span className="rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">{refLabel ?? (labelFormatter ? labelFormatter(refLine) : refLine)}</span><span className="h-px flex-1 border-t border-dashed border-navy/40" /></div> : null}
        {data.map((d, i) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${labelFormatter ? labelFormatter(d.value) : d.value}`}>
            <div className="w-full rounded-md transition-opacity" style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: i === hi ? C.coral : C.soft }} />
          </div>
        ))}
      </div>
      {showLabels ? <div className="mt-1.5 flex gap-1.5 sm:gap-2">{data.map((d, i) => <div key={d.label} className={cx("flex-1 truncate text-center text-[11px]", i === hi ? "font-semibold text-ink" : "text-muted")}>{d.label}</div>)}</div> : null}
    </div>
  );
}

/** Donut ring with a center value (single value 0..1). */
export function Donut({ value, size = 96, stroke = 10, label, sub, color = C.coral }: { value: number; size?: number; stroke?: number; label: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c * (1 - v)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="absolute text-center"><div className="tabular text-[18px] font-extrabold leading-none tracking-[-0.02em]">{label}</div>{sub ? <div className="mt-0.5 text-[10px] text-muted">{sub}</div> : null}</div>
    </div>
  );
}

/** Horizontal stacked progress bar with legend (e.g. 24% · 35% · 41%). */
export function StackedBar({ segments, height = 8 }: { segments: Array<{ label: string; value: number; color: string }>; height?: number }) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  return (
    <div>
      <div className="flex w-full gap-0.5 overflow-hidden rounded-full" style={{ height }}>{segments.map((s) => <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label} ${s.value}`} />)}</div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-2">{segments.map((s) => <li key={s.label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label} <span className="tabular font-semibold text-ink">{s.value}</span></li>)}</ul>
    </div>
  );
}

/** Area sparkline (one series). */
export function Sparkline({ points, height = 56, color = C.coral, fill = true }: { points: number[]; height?: number; color?: string; fill?: boolean }) {
  const w = 160; const h = height; const max = Math.max(...points, 1); const min = Math.min(...points, 0);
  const xs = points.map((_, i) => (i / Math.max(1, points.length - 1)) * w); const ys = points.map((p) => h - 4 - ((p - min) / Math.max(1e-9, max - min)) * (h - 8));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id="sp" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill ? <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#sp)" /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

/** Horizontal bars (ranked list), top bar highlighted, direct labels. */
export function HBars({ data, max: maxIn, format }: { data: Array<{ label: string; value: number }>; max?: number; format?: (v: number) => string }) {
  const max = maxIn ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="grid gap-2">{data.map((d, i) => (
      <li key={d.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-[13px]">
        <span className={cx("truncate", i === 0 ? "font-semibold" : "text-ink-2")}>{d.label}</span>
        <div className="h-2.5 rounded-full bg-surface-2"><div className="h-2.5 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: i === 0 ? C.coral : C.soft }} /></div>
        <span className="tabular w-10 text-right text-[12px] font-semibold">{format ? format(d.value) : d.value.toFixed(2)}</span>
      </li>))}</ul>
  );
}

/** Tornado (sensitivity) chart: down/up deltas around a base. */
export function Tornado({ rows, format }: { rows: Array<{ label: string; down: number; base: number; up: number }>; format: (v: number) => string }) {
  const span = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.up - r.base), Math.abs(r.down - r.base)]));
  const w = (v: number, base: number) => `${Math.min(50, (Math.abs(v - base) / span) * 50)}%`;
  return (
    <ul className="grid gap-2">{rows.map((r) => (
      <li key={r.label} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-[12px]">
        <span className="truncate text-ink-2">{r.label}</span>
        <div className="relative h-3 rounded-full bg-surface-2" role="img" aria-label={`${r.label}: ${format(r.down)} → ${format(r.up)}`}>
          <div className="absolute left-1/2 top-0 h-3 w-px bg-border" />
          <div className="absolute top-0 h-3 rounded-full" style={{ background: r.up >= r.base ? C.pos : C.coral, ...(r.up >= r.base ? { left: "50%", width: w(r.up, r.base) } : { right: "50%", width: w(r.up, r.base) }) }} />
          <div className="absolute top-0 h-3 rounded-full opacity-45" style={{ background: r.down >= r.base ? C.pos : C.coral, ...(r.down >= r.base ? { left: "50%", width: w(r.down, r.base) } : { right: "50%", width: w(r.down, r.base) }) }} />
        </div>
      </li>))}</ul>
  );
}

/** KPI stat tile: label, big value, optional delta chip and a visual slot (sparkline/bars/donut). */
export function KpiTile({ label, value, sub, visual, className, accent }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; visual?: React.ReactNode; className?: string; accent?: "coral" | "navy" | "white" }) {
  const dark = accent === "navy"; const coral = accent === "coral";
  return (
    <div className={cx("card flex flex-col p-4 sm:p-5", (dark || coral) && "text-white", className)} style={dark ? { background: "var(--navy)" } : coral ? { background: "var(--coral)" } : undefined}>
      <div className={cx("text-[12.5px] font-medium", dark || coral ? "text-white/80" : "text-ink-2")}>{label}</div>
      <div className="mt-1 flex items-baseline gap-2"><span className="tabular text-[30px] font-extrabold leading-none tracking-[-0.03em]">{value}</span>{sub ? <span className={cx("text-[12px]", dark || coral ? "text-white/70" : "text-muted")}>{sub}</span> : null}</div>
      {visual ? <div className="mt-3">{visual}</div> : null}
    </div>
  );
}
