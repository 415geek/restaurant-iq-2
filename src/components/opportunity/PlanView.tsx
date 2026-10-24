"use client";
import { Chip, fmtUsd } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { Playbook } from "@/lib/business/types";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border p-4"><h3 className="mb-2 text-[13px] font-bold">{title}</h3>{children}</section>;
}

/** Playbook rendered text-light: chips, short lists, drafts in quote boxes. */
export function PlanView({ pb, compact }: { pb: Playbook; compact?: boolean }) {
  const { t, lt } = useI18n();
  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
      <Block title={lt(pb.objective)}><p className="text-[13px] text-ink-2">{lt(pb.baseline)}</p></Block>
      <Block title={lt(pb.offering.description)}><div className="flex flex-wrap gap-1.5">{pb.offering.menuDependencies.map((m) => <Chip key={m}>{m}</Chip>)}</div><ul className="mt-2 grid gap-1 text-[13px]">{pb.offering.scenarios.map((s, i) => <li key={i} className="flex justify-between"><span>{lt(s.label)}</span><span className="tabular text-ink-2">{fmtUsd(Number(s.assumptions.salePrice), 2)} × {s.assumptions.incrementalUnits}{t("common.perWeek")}</span></li>)}</ul></Block>
      <Block title={t("opps.sheet.plan")}><ul className="space-y-1.5 text-[13px]">{pb.channels.map((c, i) => <li key={i} className="flex items-center justify-between gap-2"><span>{lt(c.name)}</span><Chip tone="warn">{t("opps.labels.requires_validation")}</Chip></li>)}</ul></Block>
      <Block title={t("actions.title")}><ul className="space-y-1.5 text-[13px]">{pb.capacityChecklist.map((c, i) => <li key={i} className="flex items-start justify-between gap-3"><span>{lt(c.item)}</span><span className="shrink-0 text-[12px] text-muted">{lt(c.owner)} · {c.dueInDays}d</span></li>)}</ul></Block>
      <Block title="Marketing"><p className="rounded-xl bg-surface-2 p-3 text-[13px]">{lt(pb.marketing.postingDraft)}</p>{!compact ? <p className="mt-2 text-[12px] text-muted">{lt(pb.marketing.creativeBrief)}</p> : null}</Block>
      <Block title={`${t("opps.sheet.avoid")} · ${fmtUsd(pb.budgetCapUsd)}`}><ul className="list-disc space-y-1 pl-4 text-[13px] text-ink-2">{pb.risks.slice(0, compact ? 3 : 6).map((r, i) => <li key={i}>{lt(r)}</li>)}</ul>{!compact ? <><div className="mt-2 text-[12px] font-bold uppercase tracking-wide text-muted">Stop</div><ul className="list-disc pl-4 text-[13px] text-ink-2">{pb.stopConditions.map((r, i) => <li key={i}>{lt(r)}</li>)}</ul></> : null}</Block>
      {!compact ? <Block title="✓"><ul className="list-disc pl-4 text-[13px]">{pb.successCriteria.map((r, i) => <li key={i}>{lt(r)}</li>)}</ul><p className="mt-2 text-[13px] text-ink-2">{lt(pb.measurement.method)}</p><ul className="mt-1 list-disc pl-4 text-[12px] text-muted">{pb.measurement.caveats.map((c, i) => <li key={i}>{lt(c)}</li>)}</ul><p className="mt-3 rounded-xl bg-coral-soft p-2.5 text-[13px] text-coral-ink">{lt(pb.approvalGate)}</p></Block> : null}
    </div>
  );
}
