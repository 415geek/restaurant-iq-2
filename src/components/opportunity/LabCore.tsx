"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeScenario, sensitivity, type ScenarioAssumptions } from "@/lib/business/margin";
import { Button, Stat, cx, fmtUsd } from "@/components/ui";
import { InfoTip } from "@/components/ui/InfoTip";
import { useI18n } from "@/i18n/client";
import { warnKey } from "@/lib/business/scoring";
import { StackedBar, Tornado } from "@/components/charts";

type Key = keyof ScenarioAssumptions;
const PRIMARY: Array<{ key: Key; step: number; min: number; max: number; pct?: boolean }> = [
  { key: "salePrice", step: 0.5, min: 0, max: 100 }, { key: "incrementalUnits", step: 5, min: 0, max: 500 }, { key: "cannibalizationPct", step: 0.05, min: 0, max: 1, pct: true },
];
const ADVANCED: Array<{ key: Key; step: number; min: number; max: number; pct?: boolean }> = [
  { key: "foodCostPerUnit", step: 0.25, min: 0, max: 100 }, { key: "packagingPerUnit", step: 0.05, min: 0, max: 10 }, { key: "incrementalLaborHours", step: 1, min: 0, max: 100 }, { key: "laborRatePerHour", step: 1, min: 0, max: 100 },
  { key: "deliveryShare", step: 0.05, min: 0, max: 1, pct: true }, { key: "deliveryCommissionPct", step: 0.01, min: 0, max: 0.5, pct: true }, { key: "cardFeePct", step: 0.001, min: 0, max: 0.1, pct: true }, { key: "discountPct", step: 0.05, min: 0, max: 0.9, pct: true },
  { key: "marketingCost", step: 10, min: 0, max: 5000 }, { key: "fixedTestCosts", step: 50, min: 0, max: 20000 }, { key: "cannibalizedOrderContribution", step: 0.5, min: 0, max: 100 },
];

function Slider({ f, value, onChange, label }: { f: { key: Key; step: number; min: number; max: number; pct?: boolean }; value: number; onChange: (v: number) => void; label: string }) {
  const shown = f.pct ? `${Math.round(value * 100)}%` : f.key === "incrementalUnits" || f.key === "incrementalLaborHours" ? String(value) : fmtUsd(value, 2);
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[13px]"><span className="font-medium">{label}</span><span className="tabular font-semibold">{shown}</span></span>
      <input type="range" min={f.min} max={f.max} step={f.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" aria-label={label} />
    </label>
  );
}

/** Deterministic economics UI. `compact` = 3 sliders + 2 numbers (side sheet); full = everything. */
export function LabCore({ hypothesisId, initial, compact, canSave = true }: { hypothesisId: string; initial: ScenarioAssumptions; compact?: boolean; canSave?: boolean }) {
  const { t, lt } = useI18n();
  const router = useRouter();
  const [a, setA] = useState<ScenarioAssumptions>(initial);
  const [adv, setAdv] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const r = useMemo(() => computeScenario(a), [a]);
  const sens = useMemo(() => sensitivity(a), [a]);
  const set = (k: Key, v: number) => setA((p) => ({ ...p, [k]: Number.isFinite(v) ? v : 0 }));
  const num = (k: Key) => Number(a[k] ?? 0);
  async function save() {
    setSaving("saving"); setMsg("");
    const res = await fetch("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hypothesisId, label: label || t("lab.scenarioLabel"), assumptions: a }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setSaving("error"); setMsg(j.error ?? t("common.error")); return; }
    setSaving("saved"); setMsg(t("lab.savedMsg")); router.refresh();
  }
  return (
    <div className={cx("grid gap-5", !compact && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
      <div className="grid gap-4">
        {PRIMARY.map((f) => <Slider key={f.key} f={f} value={num(f.key)} onChange={(v) => set(f.key, v)} label={t(`lab.primary.${f.key}`)} />)}
        <button type="button" onClick={() => setAdv((x) => !x)} className="text-left text-[13px] font-semibold text-pos">{adv ? "−" : "+"} {t("lab.advanced")}</button>
        {adv ? <div className="grid gap-4 sm:grid-cols-2">{ADVANCED.map((f) => <Slider key={f.key} f={f} value={num(f.key)} onChange={(v) => set(f.key, v)} label={t(`lab.fields.${f.key}`)} />)}</div> : null}
      </div>
      <div className="grid content-start gap-4">
        <div className={cx("grid gap-4 rounded-2xl bg-surface-2 p-4", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
          <Stat label={<>{t("lab.adjusted")}<InfoTip>{t("lab.disclaimer")}</InfoTip></>} value={fmtUsd(r.adjustedIncrementalProfit)} tone={r.adjustedIncrementalProfit >= 0 ? "pos" : "neg"} />
          <Stat label={t("lab.breakEven")} value={r.breakEvenUnits ?? "—"} hint={r.perUnitContribution > 0 ? t("lab.perUnit", { v: fmtUsd(r.perUnitContribution, 2), pct: r.contributionMarginPct ?? 0 }) : t("lab.perUnitNeg")} />
          {!compact ? (<><Stat label={t("lab.sales")} value={fmtUsd(r.incrementalSales)} /><Stat label={t("lab.costs")} value={fmtUsd(r.costs.total)} /><Stat label={t("lab.contrib")} value={fmtUsd(r.incrementalContributionProfit)} tone={r.incrementalContributionProfit >= 0 ? "pos" : "neg"} /><Stat label={t("lab.cannib")} value={`-${fmtUsd(r.contributionLostToCannibalization)}`} hint={`${r.cannibalizedOrders.toFixed(0)}`} /></>) : null}
        </div>
        {!compact ? (
          <>
            <div className="card p-4"><div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("lab.costMix")}</div><div className="mt-3"><StackedBar height={12} segments={([["ingredients", r.costs.ingredients, "var(--coral)"], ["packaging", r.costs.packaging, "#FF9F1C"], ["labor", r.costs.incrementalLabor, "#1B2A4A"], ["delivery", r.costs.deliveryFees, "#3B82F6"], ["card", r.costs.transactionFees, "#D4A843"], ["discounts", r.costs.discounts, "#9CA3AF"]] as const).filter(([, v]) => v > 0).map(([k, v, c]) => ({ label: t(`lab.${k}`), value: Math.round(v), color: c }))} /></div></div>
            <div className="card p-4"><div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("lab.sensitivity")}</div><div className="mt-3"><Tornado rows={sens.map((s) => ({ label: t(`lab.drivers.${s.driver}`), down: s.down, base: s.base, up: s.up }))} format={(v) => fmtUsd(v)} /></div></div>
          </>
        ) : null}
        {r.warnings.length ? <ul className="rounded-xl bg-warn-soft p-3 text-[13px] text-warn-ink">{r.warnings.map((w) => <li key={w}>{lt(warnKey(w))}</li>)}</ul> : null}
        {canSave ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("lab.scenarioLabel")} className="h-11 min-w-0 flex-1 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-sm" aria-label={t("lab.scenarioLabel")} />
            <Button onClick={save} disabled={saving === "saving"} variant="primary">{saving === "saving" ? t("common.saving") : t("lab.saveScenario")}</Button>
            {msg ? <span className={`text-[13px] ${saving === "error" ? "text-bad" : "text-good-ink"}`} role="status">{msg}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
