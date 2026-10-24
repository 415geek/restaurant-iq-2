"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { computeScenario } from "@/lib/business/margin";
import { Button, Card, Chip, LABEL_TONE, cx, fmtUsd } from "@/components/ui";
import { Icon, HYP_ICON } from "@/components/ui/Icon";
import { InfoTip } from "@/components/ui/InfoTip";
import { useI18n } from "@/i18n/client";
import type { HypothesisView } from "@/lib/queries";
import { LabCore } from "./LabCore";
import { DecideButtons } from "./DecideButtons";
import { PlanView } from "./PlanView";

function effortKey(h: HypothesisView) { const c = h.score.operationalFit; return c >= 0.8 ? "opps.lowEffort" : c >= 0.5 ? "opps.mediumEffort" : "opps.highEffort"; }

export function OpportunityCard({ h, onOpen, base }: { h: HypothesisView; onOpen: () => void; base: string }) {
  const { t, lt } = useI18n();
  const econ = computeScenario(h.defaultScenario);
  const I = Icon[HYP_ICON[h.slug] ?? "ideas"];
  const rejected = h.evidenceLabel === "not_recommended";
  const top = h.citations[0];
  return (
    <Card as="article" className={cx("relative flex flex-col", rejected && "bg-surface-2/60 shadow-none")}>
      <span className="absolute right-4 top-4 text-[12px] font-extrabold text-muted">#{h.rank}</span>
      <div className={cx("mb-3 grid h-11 w-11 place-items-center rounded-xl", rejected ? "bg-border text-ink-2" : "bg-coral-soft text-coral-ink")}><I width={22} height={22} /></div>
      <h3 className="pr-8 text-[18px] font-bold leading-tight tracking-[-0.01em]">{t(`hyp.${h.slug}.title`)}</h3>
      <p className="mt-1 text-[13.5px] text-ink-2">{t(`hyp.${h.slug}.segment`)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {top?.affinity !== undefined ? <Chip ring={top.affinity}>{t("opps.taste", { v: top.affinity.toFixed(2) })}</Chip> : null}
        {h.qlooDelta.rankChange !== 0 ? <Chip tone={h.qlooDelta.rankChange > 0 ? "coral" : "neutral"}>{h.qlooDelta.rankChange > 0 ? t("taste.movedUp", { n: h.qlooDelta.rankChange }) : t("taste.movedDown", { n: -h.qlooDelta.rankChange })}</Chip> : !rejected ? <Chip tone="good">{t(effortKey(h))}</Chip> : null}
        <Chip tone={LABEL_TONE[h.evidenceLabel]}>{t(`opps.labels.${h.evidenceLabel}`)}</Chip>
        {h.status !== "proposed" ? <Chip tone={h.status === "pursued" ? "gold" : "muted"}>{t(`opps.status.${h.status}`)}</Chip> : null}
      </div>
      {rejected ? (
        <p className="mt-3 text-[13px] text-ink-2">{[...h.disqualifiers, ...h.reasonsToAvoid].slice(0, 1).map(lt).join("") || t("opps.noSignal")}</p>
      ) : (
        <div className="mt-4 flex items-baseline gap-1.5"><span className={cx("tabular text-[28px] font-extrabold tracking-[-0.02em]", econ.adjustedIncrementalProfit >= 0 ? "text-ink" : "text-bad")}>{fmtUsd(econ.adjustedIncrementalProfit)}</span><span className="text-[13px] text-muted">{t("common.perWeek")}<InfoTip>{t("lab.disclaimer")}</InfoTip></span></div>
      )}
      <div className="mt-auto flex gap-2 pt-4">
        <Button onClick={onOpen} variant="primary" size="sm">{t("opps.seeWhy")}</Button>
        <Button href={`${base}/opportunities/${h.id}`} variant="secondary" size="sm">{t("opps.open")}</Button>
      </div>
    </Card>
  );
}

/** Slide-over (desktop) / bottom drawer (mobile) with Why · Numbers · Plan. */
export function Sheet({ h, base, onClose }: { h: HypothesisView; base: string; onClose: () => void }) {
  const { t, lt } = useI18n();
  const [tab, setTab] = useState<"why" | "numbers" | "plan">("why");
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const kindIcon = { tag: "tag", entity: "pin", demographic: "user" } as const;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t(`hyp.${h.slug}.title`)}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="sheet anim-drawer absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-surface sm:anim-sheet sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-lg sm:rounded-none">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div><Chip tone="coral">#{h.rank} · {t(`hyp.${h.slug}.title`)}</Chip><h2 className="mt-2 text-[22px] font-extrabold tracking-[-0.02em]">{t("opps.sheet.whyTitle")}</h2></div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2"><Icon.x /></button>
        </div>
        <div role="tablist" className="mx-5 mt-4 grid grid-cols-3 rounded-[var(--radius-ctl)] bg-surface-2 p-1 sm:mx-6">
          {(["why", "numbers", "plan"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("h-9 rounded-lg text-[13.5px] font-semibold", tab === k ? "bg-surface shadow-sm" : "text-muted")}>{t(`opps.sheet.${k}`)}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {tab === "why" ? (
            <div className="grid gap-2.5">
              {h.citations.length === 0 ? <p className="text-[13px] text-muted">{t("opps.noSignal")}</p> : h.citations.map((c) => { const I = Icon[kindIcon[c.kind]]; return (
                <div key={c.id + c.kind} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border border-border p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-ink-2"><I /></span>
                  <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{c.name}</div><div className="text-[12px] text-ink-2">{lt(c.note)}</div></div>
                  {c.affinity !== undefined ? <div className="text-right"><div className="tabular text-[17px] font-extrabold text-coral-ink">{c.kind === "demographic" ? `${c.affinity > 0 ? "+" : ""}${c.affinity.toFixed(2)}` : c.affinity.toFixed(2)}</div><div className="text-[10px] uppercase tracking-wide text-muted">{t(`opps.whyChips.${c.kind}`)}</div></div> : null}
                </div>); })}
              {h.playbook.offering.menuDependencies.length ? <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border border-border p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icon.bowl /></span><div className="min-w-0"><div className="text-[14px] font-semibold">{t("opps.sheet.menuHas", { n: h.playbook.offering.menuDependencies.length })}</div><div className="truncate text-[12px] text-ink-2">{h.playbook.offering.menuDependencies.join(" · ")}</div></div><Icon.check className="text-good" /></div> : null}
              <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-surface-2 p-4">
                <div><div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t("opps.sheet.withoutQloo")}</div><div className="tabular text-[28px] font-extrabold">#{h.baselineRank}</div></div>
                <Icon.arrowRight className="text-coral" />
                <div><div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t("opps.sheet.withQloo")}</div><div className="tabular text-[28px] font-extrabold text-coral-ink">#{h.rank}</div><div className="text-[11px] text-ink-2">{h.qlooDelta.rankChange === 0 ? t("opps.sheet.sameRank") : lt(h.qlooDelta.explanation)}</div></div>
              </div>
              {h.disqualifiers.length || h.missingEvidence.length ? <div className="text-[12.5px] text-ink-2">{h.disqualifiers.length ? <p><strong className="text-bad">{t("opps.whyNot")}:</strong> {h.disqualifiers.map(lt).join("; ")}</p> : null}{h.missingEvidence.length ? <p className="mt-1"><strong>{t("opps.sheet.missing")}:</strong> {h.missingEvidence.map(lt).join("; ")}</p> : null}</div> : null}
            </div>
          ) : tab === "numbers" ? (
            <LabCore hypothesisId={h.id} initial={h.defaultScenario} compact canSave={false} />
          ) : (
            <PlanView pb={h.playbook} compact />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4 sm:px-6" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <DecideButtons hypothesisId={h.id} status={h.status} onDone={onClose} />
          <Link href={`${base}/opportunities/${h.id}`} className="ml-auto inline-flex h-11 items-center rounded-[var(--radius-ctl)] bg-surface-2 px-4 text-sm font-semibold">{t("opps.sheet.fullLab")}</Link>
        </div>
      </div>
    </div>
  );
}

export function Deck({ viable, rest, base, noViable, total }: { viable: HypothesisView[]; rest: HypothesisView[]; base: string; noViable: boolean; total: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<HypothesisView | null>(null);
  const [showRest, setShowRest] = useState(noViable);
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[32px]">{noViable ? t("opps.titleNone") : t("opps.title", { n: viable.length })}</h2>
        <p className="mt-1 text-[14.5px] text-ink-2">{noViable ? t("opps.noneBody") : t("opps.subtitle", { viable: viable.length, total })}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {viable.map((h) => <OpportunityCard key={h.id} h={h} base={base} onOpen={() => setOpen(h)} />)}
        <Card className="flex flex-col border-dashed bg-surface-2/50 shadow-none">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-border text-ink-2"><Icon.ban width={22} height={22} /></div>
          <h3 className="text-[18px] font-bold">{t("opps.screenedOut")}</h3>
          <p className="mt-1 text-[13.5px] text-ink-2">{t("opps.screenedOutN", { n: rest.length })}</p>
          <div className="mt-auto pt-4"><Button variant="secondary" size="sm" onClick={() => setShowRest((s) => !s)}>{showRest ? t("opps.hideReasons") : t("opps.showReasons")}</Button></div>
        </Card>
        <Card className="flex flex-col border-dashed bg-surface-2/50 shadow-none">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-border text-ink-2"><Icon.swap width={22} height={22} /></div>
          <h3 className="text-[18px] font-bold">{t("opps.compareCardT")}</h3>
          <p className="mt-1 text-[13.5px] text-ink-2">{t("opps.compareCardB")}</p>
          <div className="mt-auto pt-4"><Button href={`${base}/taste#compare`} variant="secondary" size="sm">{t("opps.compare")}</Button></div>
        </Card>
      </div>
      {showRest && rest.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rest.map((h) => <OpportunityCard key={h.id} h={h} base={base} onOpen={() => setOpen(h)} />)}</div> : null}
      {open ? <Sheet h={open} base={base} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
