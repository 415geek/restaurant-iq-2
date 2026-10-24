"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Small "i" ring; tap/click opens a short explanation. Keeps the base UI text-light. */
export function InfoTip({ children, label = "info" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="ml-1 inline-grid h-4 w-4 place-items-center rounded-full text-muted hover:text-ink-2">
        <Icon.info width={16} height={16} />
      </button>
      {open ? <span role="tooltip" className="absolute left-1/2 top-6 z-40 w-64 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 text-left text-[12.5px] font-normal leading-5 text-ink shadow-lg">{children}</span> : null}
    </span>
  );
}
