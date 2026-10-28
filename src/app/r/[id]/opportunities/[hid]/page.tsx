import Link from "next/link";
import { notFound } from "next/navigation";
import { Bar, Card, Chip, H2, LABEL_TONE, fmtDate, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { LabCore } from "@/components/opportunity/LabCore";
import { DecideButtons } from "@/components/opportunity/DecideButtons";
import { PlanView } from "@/components/opportunity/PlanView";
import { getHypothesis } from "@/lib/queries";
import { getActiveCampaignForHypothesis } from "@/lib/campaigns";
import { Button } from "@/components/ui";
import { getT, formatLText } from "@/i18n";

export default async function HypothesisPage({ params }: PageProps<"/r/[id]/opportunities/[hid]">) {
  const { id, hid } = await params;
  const [data, campaign, { t, locale }] = await Promise.all([getHypothesis(hid), getActiveCampaignForHypothesis(hid), getT()]);
  if (!data || data.restaurantId !== id) notFound();
  const { hypothesis: h, scenarios } = data; const base = `/r/${id}`;
  const lt = (x: Parameters<typeof formatLText>[1]) => formatLText(t, x);
  const labels = { signals: t("steps.signals"), recommend: t("steps.recommend"), execute: t("steps.execute"), prove: t("steps.prove") };
  return (
    <div className="grid gap-5">
      <StepBar current="decide" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities`, act: `${base}/passes` }} />
      <div>
        <Link href={`${base}/opportunities`} className="inline-flex items-center gap-1 text-[13px] text-pos"><Icon.arrowLeft width={16} height={16} />{t("nav.opportunities")}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2"><h2 className="text-[26px] font-extrabold tracking-[-0.02em]">{t(`hyp.${h.slug}.title`)}</h2><Chip tone={LABEL_TONE[h.evidenceLabel]}>{t(`opps.labels.${h.evidenceLabel}`)}</Chip><Chip>#{h.rank} · {t("opps.sheet.baseline")} #{h.baselineRank}</Chip></div>
        <p className="mt-1 text-[14.5px] text-ink-2">{t(`hyp.${h.slug}.summary`)}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <H2>{t("opps.sheet.whyTitle")}</H2>
          <p className="text-[14px]">{lt(h.qlooDelta.explanation)}</p>
          <ul className="mt-3 grid gap-2">{h.citations.map((c) => <li key={c.id + c.kind} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-[13.5px]"><div><div className="font-semibold">{c.name}</div><div className="text-[12px] text-ink-2">{lt(c.note)}</div></div>{c.affinity !== undefined ? <Chip tone="coral" ring={c.kind === "demographic" ? undefined : c.affinity}>{c.affinity.toFixed(2)}</Chip> : null}</li>)}</ul>
        </Card>
        <Card>
          <H2>{t("opps.sheet.scoreT")}</H2>
          {(["tasteFit", "operationalFit", "feasibility", "economics", "evidenceQuality"] as const).map((k) => <Bar key={k} label={`${t(`opps.score.${k}`)} · ${h.score.weights[k]}`} value={h.score[k]} />)}
          <div className="mt-2 flex items-center justify-between text-[13px]"><span className="font-semibold">{t("opps.sheet.composite")}</span><span className="tabular">{h.score.composite.toFixed(3)} <span className="text-muted">({t("opps.sheet.baseline")} {h.baselineScore.composite.toFixed(3)})</span></span></div>
          {h.disqualifiers.length ? <p className="mt-3 rounded-xl bg-bad-soft p-2.5 text-[13px] text-bad">{h.disqualifiers.map(lt).join("; ")}</p> : null}
          {h.missingEvidence.length ? <p className="mt-2 text-[12.5px] text-ink-2"><strong>{t("opps.sheet.missing")}:</strong> {h.missingEvidence.map(lt).join("; ")}</p> : null}
        </Card>
      </div>
      <Card>
        <H2 hint={t("lab.hint")}>{t("lab.title")}</H2>
        <LabCore hypothesisId={h.id} initial={h.defaultScenario} />
        {scenarios.length ? <div className="mt-4"><div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("lab.savedList")}</div><ul className="mt-1 divide-y divide-border text-[13px]">{scenarios.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{s.label} <span className="text-muted">· {fmtDate(s.createdAt, locale)}</span></span><span className={`tabular ${s.results.adjustedIncrementalProfit >= 0 ? "text-good-ink" : "text-bad"}`}>{fmtUsd(s.results.adjustedIncrementalProfit)}{t("common.perWeek")} · {s.assumptions.incrementalUnits} × {fmtUsd(Number(s.assumptions.salePrice), 2)}</span></li>)}</ul></div> : null}
      </Card>
      <Card><H2>{t("steps.decide")}</H2><div className="flex flex-wrap items-center gap-3"><DecideButtons hypothesisId={h.id} status={h.status} />{h.status !== "rejected" ? (campaign ? <Button href={`${base}/passes/${campaign.id}`} variant="primary"><Icon.ticket width={18} height={18} />{t("pass.openPass")}</Button> : <Button href={`${base}/passes/new?h=${h.id}`} variant="primary"><Icon.ticket width={18} height={18} />{t("pass.createCta")}</Button>) : null}</div>{h.reasonsToAvoid.length ? <ul className="mt-3 list-disc pl-4 text-[13px] text-ink-2">{h.reasonsToAvoid.map((r, i) => <li key={i}>{lt(r)}</li>)}</ul> : null}</Card>
      <h3 className="text-[20px] font-extrabold tracking-[-0.02em]">{t("opps.sheet.plan")}</h3>
      <PlanView pb={h.playbook} />
      <p><Link href={`${base}/actions`} className="inline-flex items-center gap-1 text-[13px] text-pos">{t("nav.actions")} <Icon.arrowRight width={16} height={16} /></Link></p>
    </div>
  );
}
