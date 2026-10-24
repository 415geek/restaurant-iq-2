"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeScenario, sensitivity, type ScenarioAssumptions } from "@/lib/business/margin";
import { Button, Stat, cx, fmtUsd } from "@/components/ui";

const FIELDS: Array<{ key: keyof ScenarioAssumptions; label: string; step: number; min: number; max: number; pct?: boolean; hint?: string }> = [
  { key: "salePrice", label: "Sell price ($)", step: 0.5, min: 0, max: 200 },
  { key: "incrementalUnits", label: "Incremental units / week", step: 5, min: 0, max: 2000 },
  { key: "foodCostPerUnit", label: "Food cost / unit ($)", step: 0.25, min: 0, max: 200 },
  { key: "packagingPerUnit", label: "Packaging / unit ($)", step: 0.05, min: 0, max: 20 },
  { key: "incrementalLaborHours", label: "Extra labor hours / week", step: 1, min: 0, max: 200 },
  { key: "laborRatePerHour", label: "Labor rate ($/h)", step: 1, min: 0, max: 200 },
  { key: "deliveryShare", label: "Share via delivery apps", step: 0.05, min: 0, max: 1, pct: true },
  { key: "deliveryCommissionPct", label: "Delivery commission", step: 0.01, min: 0, max: 0.5, pct: true },
  { key: "cardFeePct", label: "Card fee", step: 0.001, min: 0, max: 0.1, pct: true },
  { key: "discountPct", label: "Promo discount", step: 0.05, min: 0, max: 0.9, pct: true },
  { key: "marketingCost", label: "Marketing spend / week ($)", step: 10, min: 0, max: 10000 },
  { key: "fixedTestCosts", label: "One-time setup cost ($)", step: 50, min: 0, max: 50000 },
  { key: "cannibalizationPct", label: "Cannibalization of existing orders", step: 0.05, min: 0, max: 1, pct: true, hint: "Share of incremental units that replace an order you would have had anyway" },
  { key: "cannibalizedOrderContribution", label: "Lost contribution / cannibalized order ($)", step: 0.5, min: 0, max: 200 },
];

export function DecisionLab({ hypothesisId, initial, canSave }: { hypothesisId: string; initial: ScenarioAssumptions; canSave: boolean }) {
  const [a, setA] = useState<ScenarioAssumptions>(initial);
  const [label, setLabel] = useState("My scenario");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const r = useMemo(() => computeScenario(a), [a]);
  const sens = useMemo(() => sensitivity(a), [a]);
  const set = (k: keyof ScenarioAssumptions, v: number) => setA((p) => ({ ...p, [k]: Number.isFinite(v) ? v : 0 }));

  async function save() {
    setSaving("saving"); setMsg("");
    const res = await fetch("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hypothesisId, label, assumptions: a }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setSaving("error"); setMsg(j.error ?? "Save failed"); return; }
    setSaving("saved"); setMsg("Scenario saved to business memory."); router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const v = Number(a[f.key] ?? 0);
            return (
              <label key={String(f.key)} className="block text-sm">
                <span className="flex items-center justify-between gap-2"><span>{f.label}</span><span className="tabular text-xs text-muted">{f.pct ? `${Math.round(v * 100)}%` : v}</span></span>
                <input type="range" min={f.min} max={f.max} step={f.step} value={v} onChange={(e) => set(f.key, Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" aria-label={f.label} />
                <input type="number" min={f.min} max={f.max} step={f.step} value={f.pct ? Math.round(v * 1000) / 10 : v} onChange={(e) => set(f.key, f.pct ? Number(e.target.value) / 100 : Number(e.target.value))} className="tabular mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm" aria-label={`${f.label} value`} />
                {f.hint ? <span className="text-xs text-muted">{f.hint}</span> : null}
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid content-start gap-4">
        <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
          <Stat label="Incremental sales / wk" value={fmtUsd(r.incrementalSales)} hint="after discounts" />
          <Stat label="Variable costs / wk" value={fmtUsd(r.costs.total)} />
          <Stat label="Contribution profit" value={fmtUsd(r.incrementalContributionProfit)} hint="after marketing" tone={r.incrementalContributionProfit >= 0 ? "pos" : "neg"} />
          <Stat label="Cannibalization" value={`-${fmtUsd(r.contributionLostToCannibalization)}`} hint={`${r.cannibalizedOrders.toFixed(0)} orders`} />
          <Stat label="Adjusted profit / wk" value={fmtUsd(r.adjustedIncrementalProfit)} tone={r.adjustedIncrementalProfit >= 0 ? "pos" : "neg"} />
          <Stat label="Break-even units" value={r.breakEvenUnits ?? "n/a"} hint={r.perUnitContribution > 0 ? `${fmtUsd(r.perUnitContribution, 2)} contribution / unit (${r.contributionMarginPct}%)` : "per-unit contribution ≤ 0"} />
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Cost breakdown / week</div>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {([["Ingredients", r.costs.ingredients], ["Packaging", r.costs.packaging], ["Labor", r.costs.incrementalLabor], ["Delivery fees", r.costs.deliveryFees], ["Card fees", r.costs.transactionFees], ["Discounts given", r.costs.discounts]] as const).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2"><span className="text-ink-2">{k}</span><span className="tabular">{fmtUsd(v)}</span></li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Sensitivity (±20% on one driver)</div>
          <ul className="mt-2 space-y-1.5">
            {sens.map((s) => {
              const span = Math.max(1, ...sens.flatMap((x) => [Math.abs(x.up - x.base), Math.abs(x.down - x.base)]));
              const w = (v: number) => `${Math.min(50, (Math.abs(v - s.base) / span) * 50)}%`;
              return (
                <li key={s.driver} className="grid grid-cols-[9rem_1fr] items-center gap-2 text-xs">
                  <span className="truncate text-ink-2">{s.driver}</span>
                  <div className="relative h-2 rounded-full bg-surface-2" role="img" aria-label={`${s.driver}: ${fmtUsd(s.down)} to ${fmtUsd(s.up)}`}>
                    <div className="absolute left-1/2 top-0 h-2 w-px bg-border" />
                    <div className={cx("absolute top-0 h-2 rounded-full", s.up >= s.base ? "bg-pos" : "bg-neg")} style={s.up >= s.base ? { left: "50%", width: w(s.up) } : { right: "50%", width: w(s.up) }} />
                    <div className={cx("absolute top-0 h-2 rounded-full opacity-60", s.down >= s.base ? "bg-pos" : "bg-neg")} style={s.down >= s.base ? { left: "50%", width: w(s.down) } : { right: "50%", width: w(s.down) }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {r.warnings.length ? <ul className="rounded-lg bg-warn-soft/60 p-3 text-sm text-ink-2">{r.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : null}
        <div className="flex flex-wrap items-center gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" aria-label="Scenario label" />
          <Button onClick={save} disabled={!canSave || saving === "saving"} title={canSave ? undefined : "Read-only"}>{saving === "saving" ? "Saving…" : "Save scenario"}</Button>
        </div>
        {msg ? <p className={`text-sm ${saving === "error" ? "text-bad" : "text-good"}`} role="status">{msg}</p> : null}
        <p className="text-xs text-muted">Contribution profit, not accounting net profit: rent, salaried labor and overhead are excluded. Deterministic arithmetic, no model estimates.</p>
      </div>
    </div>
  );
}
