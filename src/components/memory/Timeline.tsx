"use client";
import { Chip, fmtDate } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { EventView } from "@/lib/queries";
import type { LText } from "@/i18n/locales";

const TONE: Record<string, "neutral" | "coral" | "good" | "bad" | "gold" | "muted" | "pos"> = { restaurant_created: "neutral", analysis_completed: "pos", hypothesis_pursued: "gold", hypothesis_rejected: "bad", scenario_saved: "neutral", action_approved: "good", action_status_changed: "muted", outcome_recorded: "coral" };

export function Timeline({ events }: { events: EventView[] }) {
  const { t, lt, locale } = useI18n();
  return (
    <ol className="relative ml-2 border-l border-border pl-5">
      {events.map((e) => {
        const p = e.payload as { lt?: LText; top?: Array<{ slug: string; label: string }>; mode?: string; assumptions?: Record<string, unknown> };
        return (
          <li key={e.id} className="relative pb-5">
            <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-coral" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted"><Chip tone={TONE[e.kind] ?? "neutral"}>{t(`memory.kinds.${e.kind}`)}</Chip><time dateTime={e.createdAt}>{fmtDate(e.createdAt, locale)}</time><span>· {e.actor}</span></div>
            <p className="mt-1 text-[14px]">{p.lt ? lt(p.lt) : e.summary}</p>
            {e.kind === "analysis_completed" && Array.isArray(p.top) ? <div className="mt-1 flex flex-wrap gap-1">{p.top.map((x) => <Chip key={x.slug} tone="muted">{t(`hyp.${x.slug}.title`)}</Chip>)}</div> : null}
            {e.kind === "scenario_saved" && p.assumptions ? <p className="mt-0.5 text-[12px] text-muted">{t("memory.snapshot", { p: `$${p.assumptions.salePrice}`, u: String(p.assumptions.incrementalUnits), f: `$${p.assumptions.foodCostPerUnit}` })}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
