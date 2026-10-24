"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, Chip, DivergingBar, H2, cx } from "@/components/ui";
import { MiniBars } from "@/components/charts";
import { Icon } from "@/components/ui/Icon";
import { InfoTip } from "@/components/ui/InfoTip";
import { useI18n } from "@/i18n/client";
import { AGE_BUCKETS, type AudienceAffinity, type CulturalSignal, type TagSignal } from "@/lib/providers/qloo/types";
import type { EvidenceSourceView, HypothesisView } from "@/lib/queries";

function Source({ s }: { s?: EvidenceSourceView }) {
  const { t } = useI18n();
  if (!s) return null;
  const params = Object.entries(s.requestParams).filter(([k]) => k !== "take" && k !== "feature.explainability").map(([k, v]) => `${k}=${v}`).join(" · ");
  return <details className="mt-3 text-[11.5px] text-muted"><summary className="cursor-pointer select-none">{t("common.source")} · {s.endpoint}</summary><p className="mt-1 break-all font-mono leading-4">{params}{s.citationUrl ? <> · <a className="underline" href={s.citationUrl} target="_blank" rel="noreferrer">{t("trust.docs")}</a></> : null}</p></details>;
}

export function AttributesTile({ tags, source }: { tags: TagSignal[]; source?: EvidenceSourceView }) {
  const { t } = useI18n();
  const sorted = [...tags].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 7);
  const avg = sorted.length ? sorted.reduce((a, x) => a + (x.affinity ?? 0), 0) / sorted.length : 0;
  return (<Card><H2 hint={<>{t("taste.attributesH")}<InfoTip>{t("trust.affinityNote")}</InfoTip></>}>{t("taste.attributesT")}</H2>{sorted.length ? <MiniBars height={170} data={sorted.map((x) => ({ label: x.name, value: Math.round((x.affinity ?? 0) * 100) }))} refLine={Math.round(avg * 100)} refLabel={avg.toFixed(2)} labelFormatter={(v) => (v / 100).toFixed(2)} /> : <p className="text-[13px] text-muted">{t("taste.noneReturned")}</p>}<Source s={source} /></Card>);
}

export function AudienceTile({ demo, source }: { demo: AudienceAffinity[]; source?: EvidenceSourceView }) {
  const { t } = useI18n(); const d = demo[0];
  return (<Card><H2 hint={t("taste.audienceH")}>{t("taste.audienceT")}</H2>{!d ? <p className="text-[13px] text-muted">{t("taste.noneReturned")}</p> : (<div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div>{AGE_BUCKETS.map((b) => (d.age[b] !== undefined ? <DivergingBar key={b} label={t(`taste.age.${b}`)} value={d.age[b]!} /> : null))}</div><div className="min-w-40">{(["male", "female"] as const).map((g) => (d.gender[g] !== undefined ? <DivergingBar key={g} label={t(`taste.gender.${g}`)} value={d.gender[g]!} /> : null))}</div></div>)}<Source s={source} /></Card>);
}

export function CrossTile({ items, source, failedDomains }: { items: CulturalSignal[]; source?: EvidenceSourceView; failedDomains?: string[] }) {
  const { t } = useI18n();
  const sorted = [...items].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 6);
  return (<Card><H2 hint={t("taste.crossH")}>{t("taste.crossT")}</H2>{sorted.length ? (<ul className="grid gap-2 sm:grid-cols-2">{sorted.map((c) => (<li key={c.entityId} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"><div className="min-w-0"><div className="truncate text-[14px] font-semibold">{c.name}</div><div className="text-[12px] text-muted">{t(`taste.domain.${c.domain}`)}</div></div><Chip tone="coral" ring={c.affinity ?? 0}>{c.affinity !== undefined ? c.affinity.toFixed(2) : "—"}</Chip></li>))}</ul>) : <p className="text-[13px] text-muted">{t("taste.noneReturned")}</p>}{failedDomains?.length ? <p className="mt-2 text-[12px] text-muted">{t("taste.unavailable", { domains: failedDomains.join(", ") })}</p> : null}<Source s={source} /></Card>);
}

export function PlacesTile({ places, source }: { places: CulturalSignal[]; source?: EvidenceSourceView }) {
  const { t } = useI18n();
  const sorted = [...places].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 6);
  return (<Card><H2 hint={t("taste.placesH")}>{t("taste.placesT")}</H2>{sorted.length ? (<ul className="divide-y divide-border">{sorted.map((p) => (<li key={p.entityId} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><div className="truncate text-[14px] font-semibold">{p.name}</div><div className="mt-0.5 flex flex-wrap gap-1">{p.tags.slice(0, 2).map((x) => <Chip key={x.id}>{x.name}</Chip>)}{p.properties.priceLevel ? <Chip tone="muted">{"$".repeat(p.properties.priceLevel)}</Chip> : null}</div></div><Chip tone="coral" ring={p.affinity ?? 0}>{p.affinity !== undefined ? p.affinity.toFixed(2) : "—"}</Chip></li>))}</ul>) : <p className="text-[13px] text-muted">{t("taste.noneReturned")}</p>}<Source s={source} /></Card>);
}

/** With Qloo / Without Qloo: the same cards re-order; each row names the signal that moved it. */
export function CompareRanking({ hypotheses, base, mode }: { hypotheses: HypothesisView[]; base: string; mode: "live" | "sample" | null }) {
  const { t } = useI18n();
  const [withQloo, setWithQloo] = useState(true);
  const list = withQloo ? [...hypotheses].sort((a, b) => a.rank - b.rank) : [...hypotheses].sort((a, b) => a.baselineRank - b.baselineRank);
  return (
    <Card>
      <H2 hint={t("taste.compareH")} right={
        <div role="group" className="grid w-full grid-cols-2 rounded-[var(--radius-ctl)] bg-surface-2 p-1 sm:inline-flex sm:w-auto">
          <button type="button" onClick={() => setWithQloo(false)} aria-pressed={!withQloo} className={cx("h-9 rounded-lg px-3 text-[13px] font-semibold", !withQloo ? "bg-surface shadow-sm" : "text-muted")}>{t("taste.withoutQloo")}</button>
          <button type="button" onClick={() => setWithQloo(true)} aria-pressed={withQloo} className={cx("h-9 rounded-lg px-3 text-[13px] font-semibold", withQloo ? "bg-coral text-white" : "text-muted")}>{t("taste.withQloo")}</button>
        </div>
      }>{t("taste.compareT")}</H2>
      <p className="mb-2 text-[12px] text-muted">{withQloo ? (mode === "live" ? t("taste.withNote") : t("taste.withSampleNote")) : t("taste.withoutNote")}</p>
      <ol className="grid gap-1.5">
        {list.map((h) => {
          const rank = withQloo ? h.rank : h.baselineRank; const d = h.qlooDelta.rankChange;
          return (
            <li key={h.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 transition-transform">
              <span className="tabular w-6 text-center text-[14px] font-extrabold text-muted">{rank}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><Link href={`${base}/opportunities/${h.id}`} className="truncate text-[14px] font-semibold hover:underline">{t(`hyp.${h.slug}.title`)}</Link>{withQloo && d !== 0 ? <Chip tone={d > 0 ? "good" : "bad"}>{d > 0 ? t("taste.movedUp", { n: d }) : t("taste.movedDown", { n: -d })}</Chip> : null}{!withQloo ? <Chip tone="muted">{t("taste.generic")}</Chip> : null}</div>
                <div className="truncate text-[12px] text-muted">{withQloo ? (h.qlooDelta.changedBy.length ? `${t("taste.changedBy")}: ${h.qlooDelta.changedBy.map((c) => `${c.name}${c.affinity !== undefined ? ` ${c.affinity.toFixed(2)}` : ""}`).join(", ")}` : t(`hyp.${h.slug}.segment`)) : t("taste.noSegment")}</div>
              </div>
              {withQloo ? <Icon.arrowRight className="text-muted" /> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
