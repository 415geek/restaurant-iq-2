import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Chip, H2, cx, fmtDate, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getT } from "@/i18n";

export default async function SnapshotPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const [overview, run, { t, locale }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const p = overview.profile; const base = `/r/${id}`;
  const cats = Array.from(new Set(overview.menu.map((m) => m.category)));
  const withCost = overview.menu.filter((m) => m.price && m.foodCost);
  const avgFoodCostPct = withCost.length ? withCost.reduce((a, m) => a + Number(m.foodCost) / Number(m.price), 0) / withCost.length : null;
  const strengths = [overview.menu.some((m) => m.isSignature) ? t("snapshot.strengthSignature", { names: overview.menu.filter((m) => m.isSignature).map((m) => m.name).join(", ") }) : null, p.serviceFormats.includes("third_party_delivery") ? t("snapshot.strengthDelivery") : null, avgFoodCostPct !== null && avgFoodCostPct < 0.35 ? t("snapshot.strengthFoodCost", { pct: (avgFoodCostPct * 100).toFixed(0) }) : null].filter((x): x is string => !!x);
  const done = run?.status === "completed";
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act") };
  return (
    <div className="grid gap-5">
      <StepBar current="snapshot" labels={labels} hrefs={done ? { signals: `${base}/taste`, choose: `${base}/opportunities`, act: `${base}/actions` } : {}} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <H2 hint={t("snapshot.runHint")}>{t("snapshot.runT")}</H2>
          {run ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                <Chip tone={run.status === "completed" ? "good" : run.status === "failed" ? "bad" : "neutral"}>{run.status}</Chip>
                <span>{fmtDate(run.finishedAt ?? run.startedAt, locale)}</span>
                <span className="font-mono text-muted">{t("snapshot.trace")} {run.traceId.slice(0, 8)}</span>
                {run.errorClass ? <Chip tone="bad">{run.errorClass}</Chip> : null}
              </div>
              <ol className="mt-3 flex flex-wrap gap-1.5">
                {run.steps.map((s) => (
                  <li key={s.seq} className={cx("inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold", s.status === "succeeded" ? "border-border bg-surface text-good-ink" : s.status === "failed" ? "border-bad/30 bg-bad-soft text-bad" : "border-border text-muted")}>
                    {s.status === "succeeded" ? <Icon.check width={14} height={14} /> : <span className="font-mono text-[11px]">{s.seq}</span>}{t(`snapshot.agents.${s.agent}`)}{s.toolCalls ? <span className="font-normal text-muted">· {s.toolCalls}</span> : null}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {done ? <Button href={`${base}/opportunities`} variant="coral">{t("snapshot.viewOpps")}<Icon.arrowRight /></Button> : null}
                <RunAnalysisButton restaurantId={id} hasRun />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-ink-2">{t("snapshot.noRunB")}</p>
              <RunAnalysisButton restaurantId={id} hasRun={false} />
            </div>
          )}
        </Card>
        <Card>
          <H2>{t("snapshot.profile")}</H2>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-[14px]">
            <dt className="text-muted">{t("snapshot.formats")}</dt><dd className="flex flex-wrap gap-1">{p.serviceFormats.map((f) => <Chip key={f}>{t(`onboarding.formatLabel.${f}`)}</Chip>)}</dd>
            <dt className="text-muted">{t("snapshot.hours")}</dt><dd>{p.hoursSummary ?? t("common.unknown")}</dd>
            <dt className="text-muted">{t("snapshot.priceLevel")}</dt><dd>{p.priceLevel ? "$".repeat(p.priceLevel) : t("common.unknown")}</dd>
            <dt className="text-muted">{t("snapshot.avgTicket")}</dt><dd className="tabular">{p.costAssumptions.avg_ticket ? fmtUsd(p.costAssumptions.avg_ticket) : t("common.unknown")}</dd>
            <dt className="text-muted">{t("snapshot.pos")}</dt><dd>{p.posPreference && p.posPreference !== "none" ? t("snapshot.posPlanned", { pos: p.posPreference }) : t("snapshot.posNone")}</dd>
          </dl>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><H2 hint={t("snapshot.items", { n: overview.menu.length })}>{t("snapshot.menu")}</H2>{overview.menu.length ? <div className="flex flex-wrap gap-1.5">{cats.map((c) => <Chip key={c}>{c.replace(/_/g, " ")} · {overview.menu.filter((m) => m.category === c).length}</Chip>)}</div> : <p className="text-[13px] text-muted">{t("snapshot.noMenu")}</p>}</Card>
        <Card><H2>{t("snapshot.strengths")}</H2><ul className="space-y-1.5 text-[14px]">{strengths.map((s) => <li key={s} className="flex items-start gap-2"><Icon.check className="mt-0.5 shrink-0 text-good" width={16} height={16} />{s}</li>)}</ul></Card>
        <Card><H2>{t("snapshot.goal")}</H2><p className="text-[14px]">{p.objectives.primary ?? <span className="text-muted">{t("snapshot.noGoal")}</span>}</p><div className="mt-2 flex flex-wrap gap-1.5">{(p.objectives.constraints ?? []).map((c) => <Chip key={c} tone="warn">{c}</Chip>)}</div></Card>
      </div>
      {done ? <p className="text-[13px] text-muted"><Link href={`${base}/taste`} className="text-pos underline">{t("nav.taste")} →</Link></p> : null}
    </div>
  );
}
