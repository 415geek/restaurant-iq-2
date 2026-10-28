import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip, H2, fmtDate, fmtUsd, Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { ProofDashboard } from "@/components/campaign/ProofDashboard";
import { RedeemConsole } from "@/components/campaign/RedeemConsole";
import { CopyLink } from "@/components/campaign/CopyLink";
import { EndButton } from "@/components/campaign/EndButton";
import { getCampaign, getCampaignStats } from "@/lib/campaigns";
import { getRestaurantOverview } from "@/lib/queries";
import { requestOrigin, qrSvg } from "@/lib/origin";
import { getT, formatLText } from "@/i18n";
import { DecisionBasisView } from "@/components/campaign/DecisionBasisView";
import { ExperimentReviewCard } from "@/components/campaign/ExperimentReviewCard";
import { reviewExperiment } from "@/lib/business/experiment";
import { loadSales, RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { getSsrClient } from "@/lib/db/ssr";

export default async function CampaignPage({ params }: PageProps<"/r/[id]/passes/[cid]">) {
  const { id, cid } = await params; const base = `/r/${id}`;
  const [c, overview, { t, locale }] = await Promise.all([getCampaign(cid), getRestaurantOverview(id), getT()]);
  if (!c || c.restaurantId !== id || !overview) notFound();
  const [stats, origin, sales] = await Promise.all([getCampaignStats(c.id), requestOrigin(), getSsrClient().then((db) => loadSales(db, id))]);
  const review = reviewExperiment({ rows: sales, startsAt: c.startsAt, endsAt: c.endsAt, menuItem: c.menuItem, redeemed: stats.redeemed, tz: RESTAURANT_TZ });
  const url = `${origin}/p/${c.slug}`;
  const svg = c.status === "draft" ? "" : await qrSvg(url);
  const lt = (x: Parameters<typeof formatLText>[1]) => formatLText(t, x);
  const e = c.economics;
  const labels = { signals: t("steps.signals"), recommend: t("steps.recommend"), execute: t("steps.execute"), prove: t("steps.prove") };
  return (
    <div className="grid gap-5">
      <StepBar current="prove" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities`, ...(c.hypothesisId ? { decide: `${base}/opportunities/${c.hypothesisId}` } : {}), act: `${base}/passes` }} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href={`${base}/passes`} className="inline-flex items-center gap-1 text-[13px] text-pos"><Icon.arrowLeft width={16} height={16} />{t("pass.title")}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2"><h2 className="text-[26px] font-extrabold tracking-[-0.02em]">{c.offerName}</h2><Chip tone={c.status === "active" ? "good" : c.status === "draft" ? "warn" : "neutral"}>{t(`pass.status.${c.status}`)}</Chip><Chip tone="warn">{t(`pass.mode.${c.mode}`)}</Chip>{overview.isDemo ? <Chip tone="warn">{t("pass.mode.fictional")}</Chip> : null}{c.moment ? <Chip tone="coral">{t("moments.forMoment", { name: c.moment.name, date: new Date(`${c.moment.date}T12:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" }) })}</Chip> : null}</div>
          <p className="mt-1 text-[14px] text-ink-2">{c.menuItem} · {fmtUsd(c.offerPrice, 2)} <span className="text-muted line-through">{fmtUsd(c.regularPrice, 2)}</span> · {fmtDate(c.startsAt, locale)} – {fmtDate(c.endsAt, locale)}</p>
        </div>
        {c.status === "active" ? <div className="grid justify-items-end gap-1"><EndButton campaignId={c.id} /><span className="max-w-64 text-right text-[11.5px] text-muted">{t("pass.endHint")}</span></div> : null}
      </div>

      <section aria-label={t("pass.proveT")}>
        <H2 hint={t("pass.proveHint")}>{t("pass.proveT")}</H2>
        <ProofDashboard campaignId={c.id} initial={stats} maxRedemptions={c.maxRedemptions} />
      </section>

      <ExperimentReviewCard r={review} t={t} locale={locale} dataHref={`${base}/data`} synthetic={overview.isDemo} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <H2 hint={t("pass.scanHint")}>{t("pass.liveT")}</H2>
          {svg ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="w-44 shrink-0 rounded-2xl border border-border bg-white p-2" aria-label="QR code" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="grid min-w-0 gap-2">
                <div className="text-[12px] font-semibold text-ink-2">{t("pass.publicLink")}</div>
                <a href={url} target="_blank" rel="noreferrer" data-testid="public-link" className="break-all font-mono text-[13px] text-pos">{url}</a>
                <div className="flex flex-wrap gap-2"><CopyLink url={url} /><Button size="sm" variant="coral" href={`/p/${c.slug}`}>{t("pass.openPublic")}</Button></div>
              </div>
            </div>
          ) : <p className="text-[13px] text-ink-2">{t("pass.status.draft")}</p>}
        </Card>
        <Card>
          <H2>{t("pass.redeemT")}</H2>
          <p className="-mt-2 mb-3 text-[13px] text-ink-2">{t("pass.redeemHint")}</p>
          <RedeemConsole campaignId={c.id} disabled={c.status !== "active"} demo={overview.isDemo} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <H2>{t("pass.contribution")}</H2>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><div className="text-ink-2">{t("pass.contribution")}</div><div className="tabular text-[20px] font-extrabold">{fmtUsd(e.contributionPerRedemption, 2)}</div></div>
            <div><div className="text-ink-2">{t("pass.breakEven")}</div><div className="tabular text-[20px] font-extrabold">{e.breakEvenRedemptions ?? t("pass.breakEvenNone")}</div></div>
            <div><div className="text-ink-2">{t("pass.fixedSpend")}</div><div className="tabular font-bold">{fmtUsd(c.fixedSpend, 0)}</div></div>
            <div><div className="text-ink-2">{t("pass.bestCase")}</div><div className="tabular font-bold">{fmtUsd(e.bestCaseContribution, 0)}</div></div>
          </div>
          {e.reasons.length ? <ul className="mt-3 list-disc pl-4 text-[12.5px] text-warn-ink">{e.reasons.map((r) => <li key={r}>{t(`pass.reasons.${r}`)}</li>)}</ul> : null}
        </Card>
        <Card>
          <H2 hint={t("pass.whyHint")}>{t("pass.whyT")}</H2>
          <DecisionBasisView basis={c.decisionBasis} citations={c.evidence} t={t} lt={lt} locale={locale} />
          {c.hypothesisId ? <Link href={`${base}/opportunities/${c.hypothesisId}`} className="mt-3 inline-flex items-center gap-1 text-[13px] text-pos">{t("pass.fromIdea")} <Icon.arrowRight width={14} height={14} /></Link> : null}
        </Card>
        <Card>
          <H2>{t("pass.notProveT")}</H2>
          <ul className="list-disc pl-4 text-[13px] text-ink-2"><li>{t("pass.notProve1")}</li><li>{t("pass.notProve2")}</li><li>{t("pass.notProve3")}</li></ul>
          <div className="mt-3 text-[12px] font-bold uppercase tracking-wide text-muted">{t("pass.unknownsT")}</div>
          <ul className="list-disc pl-4 text-[12.5px] text-ink-2">{e.unknowns.map((u) => <li key={u}>{t(`pass.unknowns.${u}`)}</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
