import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Chip, H2, LABEL_TONE, cx, fmtUsd } from "@/components/ui";
import { Icon, HYP_ICON } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { KpiTile, MiniBars, Sparkline, StackedBar } from "@/components/charts";
import { computeScenario } from "@/lib/business/margin";
import { getActions, getHypotheses, getLatestEvidence, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getT, formatLText } from "@/i18n";

export default async function SnapshotPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const [overview, run, { t }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const p = overview.profile; const base = `/r/${id}`;
  const done = run?.status === "completed";
  const [evidence, hs, actions] = done ? await Promise.all([getLatestEvidence(id, run!.startedAt), getHypotheses(id, run!.id), getActions(id, run!.id)]) : [null, [], []];
  const viable = hs.filter((h) => h.evidenceLabel !== "not_recommended").slice(0, 3);
  const econ = viable.map((h) => ({ h, r: computeScenario(h.defaultScenario) }));
  const best = econ.reduce<typeof econ[number] | null>((a, b) => (!a || b.r.adjustedIncrementalProfit > a.r.adjustedIncrementalProfit ? b : a), null);
  const topTaste = viable.flatMap((h) => h.citations).filter((c) => c.kind !== "demographic" && c.affinity !== undefined).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))[0];
  const tags = (evidence?.tagAffinities ?? []).filter((x) => x.affinity !== undefined).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 7);
  const avg = tags.length ? tags.reduce((a, x) => a + (x.affinity ?? 0), 0) / tags.length : 0;
  const steps = run?.steps ?? []; const stepsOk = steps.filter((s) => s.status === "succeeded").length;
  const open = actions.filter((a) => a.status !== "completed" && a.status !== "canceled");
  const next = [...open.filter((a) => a.status === "needs_approval").slice(0, 1), ...open.filter((a) => a.status !== "needs_approval")].filter((a, i, arr) => arr.findIndex((x) => x.hypothesisSlug === a.hypothesisSlug) === i || i === 0).slice(0, 3);
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act"), prove: t("steps.prove") };
  const lt = (x: Parameters<typeof formatLText>[1]) => formatLText(t, x);
  // First screen answers: what to try this week, why (Qloo), what not to do and why, and one button.
  const rec = viable[0];
  const alt = hs.find((h) => h.evidenceLabel === "not_recommended" && (h.disqualifiers.length || h.reasonsToAvoid.length)) ?? viable[1];
  const altReason = alt ? (alt.disqualifiers[0] ?? alt.reasonsToAvoid[0]) : undefined;
  const scenarioPts = best ? best.h.playbook.offering.scenarios.map((s) => computeScenario(s.assumptions).adjustedIncrementalProfit) : [];

  return (
    <div className="grid gap-5">
      <StepBar current="snapshot" labels={labels} hrefs={done ? { signals: `${base}/taste`, choose: `${base}/opportunities`, act: `${base}/passes` } : {}} />
      {!done ? (
        <Card className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-[18px] font-bold">{t("snapshot.noRunT")}</div><p className="text-[13.5px] text-ink-2">{t("snapshot.noIdeasYet")}</p></div><RunAnalysisButton restaurantId={id} hasRun={!!run} /></Card>
      ) : (
        <>
          {rec ? (
            <section className="card border-2 border-coral p-5" data-testid="recommended-experiment">
              <div className="text-[12px] font-bold uppercase tracking-wide text-coral-ink">{t("snapshot.recT")}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-[22px] font-extrabold tracking-[-0.02em]">{t(`hyp.${rec.slug}.title`)}</h2><Chip tone={LABEL_TONE[rec.evidenceLabel]}>{t(`opps.labels.${rec.evidenceLabel}`)}</Chip></div>
              <div className="mt-3 grid gap-2 text-[13.5px] sm:grid-cols-2">
                <div className="rounded-xl bg-coral-soft p-3"><div className="text-[11.5px] font-bold uppercase tracking-wide text-coral-ink">{t("snapshot.recWhy")}</div><div className="mt-0.5">{rec.citations[0] ? <><span className="font-semibold">{rec.citations[0].name}</span>{rec.citations[0].affinity !== undefined ? ` (${rec.citations[0].affinity.toFixed(2)})` : ""} · {lt(rec.citations[0].note)}</> : t("opps.noSignal")}</div></div>
                {alt ? <div className="rounded-xl bg-surface-2 p-3"><div className="text-[11.5px] font-bold uppercase tracking-wide text-muted">{t("snapshot.recNot")}</div><div className="mt-0.5"><span className="font-semibold">{t(`hyp.${alt.slug}.title`)}</span>{altReason ? ` · ${lt(altReason)}` : ""}</div></div> : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="coral" size="lg" href={`${base}/passes/new?h=${rec.id}`}><Icon.ticket width={18} height={18} />{t("snapshot.recCta")}</Button>
                <Link href={`${base}/opportunities/${rec.id}`} className="px-2 text-[13.5px] font-semibold text-pos">{t("snapshot.recSee")}</Link>
                <span className="text-[12px] text-muted">{t("snapshot.recNote")}</span>
              </div>
            </section>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label={t("snapshot.kpiIdeas")} value={viable.length} sub={t("snapshot.ofScreened", { t: hs.length })} visual={<MiniBars height={64} data={hs.slice(0, 6).map((h) => ({ label: `#${h.rank}`, value: Math.round(h.score.composite * 100) }))} labelFormatter={(v) => `${v}`} />} />
            <KpiTile label={t("snapshot.kpiBest")} value={best ? fmtUsd(best.r.adjustedIncrementalProfit) : "—"} sub={best ? t(`hyp.${best.h.slug}.title`) : undefined} visual={scenarioPts.length ? <div><Sparkline points={scenarioPts} height={48} /><div className="mt-1 text-[11px] text-muted">{t("snapshot.scenarios")}</div></div> : null} />
            <KpiTile label={t("snapshot.kpiTaste")} value={topTaste ? topTaste.affinity!.toFixed(2) : "—"} sub={topTaste?.name} accent="coral" visual={topTaste ? <span className="block text-[12px] leading-4 text-white/80">{t("taste.attributesH")}</span> : null} />
            <KpiTile label={t("snapshot.kpiData")} value={t("snapshot.stepsDone", { d: stepsOk, n: steps.length })} sub={evidence?.mode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge")} accent="navy" visual={<div className="flex gap-1">{steps.map((s) => <span key={s.seq} className={cx("h-2 flex-1 rounded-full", s.status === "succeeded" ? "bg-good" : s.status === "failed" ? "bg-coral" : "bg-white/30")} title={t(`snapshot.agents.${s.agent}`)} />)}</div>} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <H2 hint={t("snapshot.chartH")} right={<Link href={`${base}/taste`} className="text-[13px] font-semibold text-pos">{t("snapshot.seeAll")} →</Link>}>{t("snapshot.chartT")}</H2>
              {tags.length ? <MiniBars height={180} data={tags.map((x) => ({ label: x.name, value: Math.round((x.affinity ?? 0) * 100) }))} refLine={Math.round(avg * 100)} refLabel={`${t("snapshot.avg")} ${avg.toFixed(2)}`} labelFormatter={(v) => (v / 100).toFixed(2)} /> : <p className="text-[13px] text-muted">{t("taste.noneReturned")}</p>}
              {evidence?.demographics[0] ? (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 text-[12.5px] font-semibold text-ink-2">{t("snapshot.audienceT")}</div>
                  <StackedBar height={10} segments={Object.entries(evidence.demographics[0].age).filter(([, v]) => (v ?? 0) > 0).map(([k, v], i) => ({ label: t(`taste.age.${k}`), value: Math.round((v ?? 0) * 100), color: ["var(--coral)", "#FF9F1C", "#D4A843", "#3B82F6", "#10B981", "#1B2A4A"][i % 6] }))} />
                </div>
              ) : null}
            </Card>
            <Card>
              <H2 right={<Link href={`${base}/actions`} className="text-[13px] font-semibold text-pos">{t("snapshot.seeAll")} →</Link>}>{t("snapshot.nextSteps")}</H2>
              <div className="grid gap-2.5">
                {next.map((a, i) => (
                  <div key={a.id} className={cx("rounded-2xl p-3.5", i === 0 ? "bg-coral text-white" : "border border-border bg-surface")}>
                    <div className="flex items-center justify-between gap-2 text-[11px]"><span className={i === 0 ? "text-white/80" : "text-muted"}>{a.dueDate ?? ""}</span>{i === 0 ? <Chip tone="neutral" className="!bg-white/20 !text-white">● {t("snapshot.now")}</Chip> : a.status === "needs_approval" ? <Chip tone="warn">{t("actions.cols.needs_approval")}</Chip> : null}</div>
                    <div className="mt-1 text-[14px] font-semibold leading-5">{lt(a.titleLt ?? a.title)}</div>
                    {a.hypothesisSlug ? <div className={cx("mt-1.5 inline-flex items-center gap-1.5 text-[12px]", i === 0 ? "text-white/85" : "text-ink-2")}>{(() => { const I = Icon[HYP_ICON[a.hypothesisSlug] ?? "ideas"]; return <I width={14} height={14} />; })()}{t(`hyp.${a.hypothesisSlug}.title`)}</div> : null}
                  </div>
                ))}
                {next.length === 0 ? <p className="text-[13px] text-muted">{t("actions.emptyT")}</p> : null}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {econ.map(({ h, r }) => { const I = Icon[HYP_ICON[h.slug] ?? "ideas"]; return (
              <Link key={h.id} href={`${base}/opportunities/${h.id}`} className="card flex items-center gap-3 p-4 hover:border-coral/50">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral-ink"><I width={22} height={22} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{t(`hyp.${h.slug}.title`)}</span><span className="mt-0.5 flex items-center gap-1.5"><Chip tone={LABEL_TONE[h.evidenceLabel]}>{t(`opps.labels.${h.evidenceLabel}`)}</Chip></span></span>
                <span className={cx("tabular text-[18px] font-extrabold", r.adjustedIncrementalProfit >= 0 ? "text-ink" : "text-bad")}>{fmtUsd(r.adjustedIncrementalProfit)}</span>
              </Link>); })}
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <Card><H2>{t("snapshot.profile")}</H2><dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-[13.5px]"><dt className="text-muted">{t("snapshot.formats")}</dt><dd className="flex flex-wrap gap-1">{p.serviceFormats.map((f) => <Chip key={f}>{t(`onboarding.formatLabel.${f}`)}</Chip>)}</dd><dt className="text-muted">{t("snapshot.hours")}</dt><dd>{p.hoursSummary ?? t("common.unknown")}</dd><dt className="text-muted">{t("snapshot.avgTicket")}</dt><dd className="tabular">{p.costAssumptions.avg_ticket ? fmtUsd(p.costAssumptions.avg_ticket) : t("common.unknown")}</dd><dt className="text-muted">{t("snapshot.pos")}</dt><dd>{p.posPreference && p.posPreference !== "none" ? t("snapshot.posPlanned", { pos: p.posPreference }) : t("snapshot.posNone")}</dd></dl></Card>
        <Card><H2>{t("snapshot.goal")}</H2><p className="text-[13.5px]">{p.objectives.primary ?? <span className="text-muted">{t("snapshot.noGoal")}</span>}</p><div className="mt-2 flex flex-wrap gap-1.5">{(p.objectives.constraints ?? []).map((c) => <Chip key={c} tone="warn">{c}</Chip>)}</div><div className="mt-2 flex flex-wrap gap-1.5">{Array.from(new Set(overview.menu.map((m) => m.category))).map((c) => <Chip key={c}>{c.replace(/_/g, " ")} · {overview.menu.filter((m) => m.category === c).length}</Chip>)}</div></Card>
        <Card className="flex flex-col justify-center gap-2"><div className="text-[12.5px] text-ink-2">{t("snapshot.runHint")}</div><RunAnalysisButton restaurantId={id} hasRun={!!run} />{done ? <Button href={`${base}/opportunities`} variant="secondary" size="sm">{t("snapshot.viewOpps")}</Button> : null}</Card>
      </div>
    </div>
  );
}
