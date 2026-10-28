"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

/**
 * Press-and-hold confirm for actions that go live (Execute). Holding for `ms` fires `onConfirm`; letting go earlier cancels.
 * Works with pointer (mouse/touch) and keyboard (hold Enter or Space). The fill shows progress; the hint says what to do.
 */
export function HoldButton({ label, busyLabel, hint, onConfirm, disabled, busy, title, ms = 900 }: { label: string; busyLabel: string; hint: string; onConfirm: () => void; disabled?: boolean; busy?: boolean; title?: string; ms?: number }) {
  const [p, setP] = useState(0); const raf = useRef<number | null>(null); const t0 = useRef<number | null>(null);
  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; t0.current = null; setP(0); };
  const tick = (ts: number) => {
    if (t0.current === null) t0.current = ts;
    const k = Math.min(1, (ts - t0.current) / ms); setP(k);
    if (k >= 1) { raf.current = null; t0.current = null; setP(0); onConfirm(); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const start = () => { if (disabled || busy || raf.current) return; t0.current = null; raf.current = requestAnimationFrame(tick); };
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  const off = disabled || busy;
  return (
    <div className="grid gap-1.5">
      <button type="button" disabled={off} title={title} aria-describedby="hold-hint" data-testid="hold-confirm" data-progress={Math.round(p * 100)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); start(); }} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); start(); } }} onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") stop(); }}
        onContextMenu={(e) => e.preventDefault()}
        className={cx("relative h-12 select-none overflow-hidden rounded-[var(--radius-ctl)] bg-coral px-6 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 [touch-action:none]")}>
        <span aria-hidden className="absolute inset-y-0 left-0 bg-coral-ink" style={{ width: `${p * 100}%` }} />
        <span className="relative">{busy ? busyLabel : label}</span>
      </button>
      <span id="hold-hint" className="text-[12px] text-muted">{hint}</span>
    </div>
  );
}
