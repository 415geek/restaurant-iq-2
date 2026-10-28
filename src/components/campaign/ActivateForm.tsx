"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, cx, fmtUsd } from "@/components/ui";
import { KpiTile } from "@/components/charts";
import { computePassEconomics } from "@/lib/business/tastepass";
import { useI18n } from "@/i18n/client";
import type { MomentInput } from "@/lib/validation/schemas";
import { Icon } from "@/components/ui/Icon";

export interface ActivateDefaults { offerName: string; menuItem: string; regularPrice: number; offerPrice: number; variableCost: number; feePct: number; fixedSpend: number; maxRedemptions: number; days: number; terms: string; moment?: MomentInput }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="grid gap-1"><span className="text-[12.5px] font-semibold text-ink-2">{label}</span>{children}{hint ? <span className="text-[11.5px] text-muted">{hint}</span> : null}</label>;
}
const inputCls = "h-11 w-full rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[15px] tabular focus:border-coral focus:outline-none";

/** Merchant activation: numbers recompute on every keystroke with the same pure function the server uses. */
export function ActivateForm({ restaurantId, hypothesisId, defaults }: { restaurantId: string; hypothesisId: string; defaults: ActivateDefaults }) {
  const { t, locale } = useI18n(); const router = useRouter();
  const [v, setV] = useState(defaults);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const num = (k: keyof ActivateDefaults) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value === "" ? 0 : Number(e.target.value) }));
  const str = (k: keyof ActivateDefaults) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const e = useMemo(() => computePassEconomics({ ...v, feePct: v.feePct / 100 }), [v]);
  const noGo = e.decision === "no_go";

  async function approve() {
    setBusy(true); setErr("");
    const res = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hypothesisId, ...v, feePct: v.feePct / 100, approve: true }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); setErr(j.error ?? t("pass.failed")); return; }
    router.push(`/r/${restaurantId}/passes/${j.id}`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="grid content-start gap-3">
        {v.moment ? <div data-testid="pass-moment" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft px-3 py-2 text-[13px] text-coral-ink"><Icon.calendar width={16} height={16} /><span className="font-semibold">{t("moments.timedTo")}</span><span>{v.moment.name} · {new Date(`${v.moment.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</span><span className="text-[12px] opacity-80">{t("moments.claimsUntilEnd")}</span></div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("pass.offerName")}><input className={inputCls} value={v.offerName} maxLength={80} onChange={str("offerName")} /></Field>
          <Field label={t("pass.menuItem")}><input className={inputCls} value={v.menuItem} maxLength={80} onChange={str("menuItem")} /></Field>
          <Field label={t("pass.regularPrice")}><input className={inputCls} type="number" step="0.5" min="0" inputMode="decimal" value={v.regularPrice} onChange={num("regularPrice")} /></Field>
          <Field label={t("pass.offerPrice")}><input className={inputCls} type="number" step="0.5" min="0" inputMode="decimal" value={v.offerPrice} onChange={num("offerPrice")} data-testid="offer-price" /></Field>
          <Field label={t("pass.variableCost")}><input className={inputCls} type="number" step="0.1" min="0" inputMode="decimal" value={v.variableCost} onChange={num("variableCost")} /></Field>
          <Field label={t("pass.feePct")}><input className={inputCls} type="number" step="0.1" min="0" max="50" inputMode="decimal" value={v.feePct} onChange={num("feePct")} /></Field>
          <Field label={t("pass.fixedSpend")} hint={t("pass.fixedSpendHint")}><input className={inputCls} type="number" step="5" min="0" inputMode="decimal" value={v.fixedSpend} onChange={num("fixedSpend")} /></Field>
          <Field label={t("pass.maxRedemptions")}><input className={inputCls} type="number" step="5" min="1" max="10000" inputMode="numeric" value={v.maxRedemptions} onChange={num("maxRedemptions")} /></Field>
          <Field label={t("pass.days")}><input className={inputCls} type="number" min="1" max="120" inputMode="numeric" value={v.days} onChange={num("days")} /></Field>
        </div>
        <Field label={t("pass.terms")}><textarea className={cx(inputCls, "h-20 py-2 text-[14px]")} maxLength={400} value={v.terms} onChange={str("terms")} /></Field>
      </div>
      <div className={cx("grid content-start gap-3 transition-opacity", noGo && "opacity-95")}>
        <div className="grid grid-cols-2 gap-3">
          <KpiTile accent={noGo ? "white" : "coral"} label={t("pass.contribution")} value={<span className={noGo ? "text-bad" : undefined} data-testid="contribution">{fmtUsd(e.contributionPerRedemption, 2)}</span>} visual={<span className={cx("block text-[11.5px] leading-4", noGo ? "text-muted" : "text-white/80")}>{t("pass.contributionHint")}</span>} />
          <KpiTile accent="navy" label={t("pass.breakEven")} value={e.breakEvenRedemptions === null ? t("pass.breakEvenNone") : e.breakEvenRedemptions} sub={e.breakEvenRedemptions === null ? undefined : t("pass.ofCap", { max: v.maxRedemptions })} />
          <KpiTile label={t("pass.bestCase")} value={<span className={e.bestCaseContribution >= 0 ? "text-good-ink" : "text-bad"}>{fmtUsd(e.bestCaseContribution)}</span>} />
          <KpiTile label={t("pass.exposure")} value={fmtUsd(e.maxExposure)} />
        </div>
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2"><Chip tone={noGo ? "bad" : e.reasons.length ? "warn" : "good"} className="text-[13px]">{noGo ? t("pass.noGo") : e.reasons.length ? t("pass.goCaution") : t("pass.go")}</Chip>{e.reasons.map((r) => <span key={r} className={cx("text-[13px]", r === "negative_contribution" ? "font-semibold text-bad" : "text-warn-ink")}>{t(`pass.reasons.${r}`)}</span>)}</div>
          <div className="mt-3 text-[12px] font-bold uppercase tracking-wide text-muted">{t("pass.unknownsT")}</div>
          <ul className="mt-1 list-disc pl-4 text-[13px] text-ink-2">{e.unknowns.map((u) => <li key={u}>{t(`pass.unknowns.${u}`)}</li>)}</ul>
        </div>
        <Button variant="coral" size="lg" onClick={approve} disabled={busy || noGo || v.offerName.trim().length < 2 || !v.menuItem.trim()} title={noGo ? t("pass.reasons.negative_contribution") : undefined}>{busy ? t("pass.approving") : t("pass.approve")}</Button>
        <p className="text-[12px] text-muted">{t("pass.approveNote")}</p>
        {err ? <p role="alert" className="text-[13px] text-bad">{err}</p> : null}
      </div>
    </div>
  );
}
