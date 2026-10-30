"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Chip, cx, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";
import type { Outlook, RadarMoment } from "@/lib/business/radar";
import type { FitLevel } from "@/lib/business/moments";

export interface PlayCard {
  id: string; hypothesisId: string; slug: string; title: string; moment: RadarMoment | null; outlook: Outlook | null; matched: boolean;
  menuItem: string | null; contribution: number | null; audience: { name: string; affinity?: number } | null; href: string; ideaHref: string;
}
type Fit = { mode: "live" | "sample"; fit: { score: number; level: FitLevel } | null; places: Array<{ name: string }>; error?: string };

const DIR: Record<Outlook["direction"], string> = { up: "bg-good-soft text-good-ink", down: "bg-bad-soft text-bad", mixed: "bg-warn-soft text-warn-ink" };
const ARROW: Record<Outlook["direction"], string> = { up: "↑", down: "↓", mixed: "↕" };

/** The proactive feed: one card per moment, paired with the costed idea. "Launch" opens the pass form prefilled with the moment. */
export function RadarPlays({ restaurantId, plays, days }: { restaurantId: string; plays: PlayCard[]; days: number }) {
  const { t, locale } = useI18n();
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  async function ask(p: PlayCard) {
    if (!p.moment?.theme) return;
    setBusy(p.id);
    const r = await fetch("/api/moments/fit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId, theme: p.moment.theme, moment: p.moment.name.slice(0, 90) }) });
    const j = (await r.json().catch(() => ({ error: "network" }))) as Fit;
    setBusy(null);
    setFits((s) => ({ ...s, [p.id]: r.ok ? j : { mode: "sample", fit: null, places: [], error: r.status === 429 ? "rate_limited" : (j.error ?? String(r.status)) } }));
  }
  return (
    <section className="grid gap-3" data-testid="radar-plays">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{t("radar.playsT", { days })}</h2><p className="mt-0.5 max-w-3xl text-[13.5px] text-ink-2">{t("radar.playsHint")}</p></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {plays.slice(0, 2).map((p, i) => card(p, i))}
      </div>
      {plays.length > 2 ? (<>
        <details className="group sm:hidden"><summary className="cursor-pointer list-none rounded-2xl border border-border bg-surface px-4 py-3 text-center text-[14px] font-semibold text-pos group-open:hidden">{t("radar.morePlays", { n: plays.length - 2 })}</summary><div className="grid gap-3">{plays.slice(2).map((p, i) => card(p, i + 2))}</div></details>
        <div className="hidden gap-3 sm:grid lg:grid-cols-2">{plays.slice(2).map((p, i) => card(p, i + 2))}</div>
      </>) : null}
    </section>
  );

  function card(p: PlayCard, i: number) {
    {
          const f = fits[p.id];
          return (
            <article key={p.id} className={cx("card grid content-start gap-3 p-4 sm:p-5", i === 0 && "border-2 border-coral")} data-testid={i === 0 ? "recommended-experiment" : undefined}>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                {p.moment ? <><Chip tone="coral"><Icon.calendar width={13} height={13} />{date(p.moment.date)}</Chip><span className="font-semibold text-ink">{p.moment.name}</span>{p.moment.miles !== undefined ? <span className="text-muted">· {p.moment.miles.toFixed(1)} mi</span> : null}</> : <Chip>{t("radar.evergreen")}</Chip>}
              </div>
              {p.outlook ? <div className={cx("flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]", DIR[p.outlook.direction])}><span className="font-extrabold">{ARROW[p.outlook.direction]}</span><span>{t(`radar.outlook.${p.outlook.key}`)}</span></div> : null}
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-[18px] font-extrabold tracking-[-0.01em]">{p.title}</h3><Chip tone={p.matched ? "good" : "neutral"} className="hidden sm:inline-flex">{p.matched ? t("radar.matched") : t("radar.generic")}</Chip></div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
                  {p.menuItem ? <span><Icon.bowl width={14} height={14} className="mr-1 inline" />{p.menuItem}</span> : null}
                  {p.contribution !== null ? <span className={cx("tabular font-semibold", p.contribution >= 0 ? "text-ink" : "text-bad")}>{fmtUsd(p.contribution)}/wk</span> : null}
                  {p.audience ? <span className="hidden sm:inline"><Icon.group width={14} height={14} className="mr-1 inline" />{p.audience.name}{p.audience.affinity !== undefined ? ` (${p.audience.affinity.toFixed(2)})` : ""}</span> : null}
                </div>
              </div>
              {f ? (
                <div className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]" data-testid="play-fit">
                  {f.error ? <span className="text-bad">{t("radar.fitErr", { e: f.error })}</span> : f.fit ? <><span className="font-semibold">{t(`radar.fit.${f.fit.level}`)}</span> <span className="text-muted">· {Math.round(f.fit.score * 100)}% · {f.mode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge")}</span>{f.places.length ? <div className="mt-1 text-[12px] text-ink-2">{f.places.slice(0, 3).map((x) => x.name).join(" · ")}</div> : null}</> : <span className="text-muted">{t("radar.fitNone")}</span>}
                </div>
              ) : null}
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button variant="coral" href={p.href} className="w-full sm:w-auto"><Icon.ticket width={16} height={16} />{t("radar.launch")}</Button>
                <div className="flex items-center justify-between gap-3 sm:contents">
                  {p.moment?.theme ? <button type="button" onClick={() => ask(p)} disabled={busy === p.id} className="text-[13px] font-semibold text-pos disabled:opacity-50 sm:inline-flex sm:h-11 sm:items-center sm:rounded-[var(--radius-ctl)] sm:bg-surface-2 sm:px-4 sm:text-sm sm:text-ink">{busy === p.id ? t("radar.fitBusy") : t("radar.fitBtn")}</button> : <span />}
                  <Link href={p.ideaHref} className="text-[13px] font-semibold text-pos sm:px-1">{t("radar.details")}</Link>
                </div>
              </div>
            </article>
          );
    }
  }
}
