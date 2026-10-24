"use client";
import { useState } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";
import type { ReactNode } from "react";

/** "Sample data · 5 sources" pill. Click → slide-over with the full Trust & data panel. */
export function DataPill({ mode, sourceCount, children }: { mode: "live" | "sample" | null; sourceCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-2" aria-haspopup="dialog">
        <i className={cx("h-2 w-2 rounded-full", mode === "live" ? "bg-good" : "bg-warn")} aria-hidden />
        {mode === "live" ? t("common.liveQloo") : t("common.sampleData")} · {t("common.sources", { n: sourceCount })}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("trust.title")}>
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="sheet anim-sheet absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-surface p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{t("trust.title")}</h2><button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"><Icon.x /></button></div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
