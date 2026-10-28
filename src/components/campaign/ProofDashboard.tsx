"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chip, cx, fmtUsd } from "@/components/ui";
import { KpiTile } from "@/components/charts";
import { useI18n } from "@/i18n/client";
import type { CampaignStats } from "@/lib/campaigns";

/** Live counters. Polls every 3 s while the tab is visible; a changed value flashes once so the 0 → 1 moment is visible. */
export function ProofDashboard({ campaignId, initial, maxRedemptions }: { campaignId: string; initial: CampaignStats; maxRedemptions: number }) {
  const { t, locale } = useI18n();
  const [s, setS] = useState(initial);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const prev = useRef(initial);
  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    const res = await fetch(`/api/campaigns/${campaignId}/stats`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const next = (await res.json()) as CampaignStats;
    const changed: Record<string, boolean> = {};
    for (const k of ["views", "claims", "redeemed"] as const) if (next[k] !== prev.current[k]) changed[k] = true;
    prev.current = next; setS(next);
    if (Object.keys(changed).length) { setFlash(changed); setTimeout(() => setFlash({}), 1300); }
  }, [campaignId]);
  useEffect(() => {
    const id = setInterval(refresh, 3000);
    window.addEventListener("tastepass:refresh", refresh);
    return () => { clearInterval(id); window.removeEventListener("tastepass:refresh", refresh); };
  }, [refresh]);
  const fl = (k: string) => (flash[k] ? "kpi-flash" : undefined);
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile className={fl("views")} label={t("pass.views")} value={<span data-testid="stat-views">{s.views}</span>} />
        <KpiTile className={fl("claims")} label={t("pass.claims")} value={<span data-testid="stat-claims">{s.claims}</span>} sub={t("pass.ofCap", { max: maxRedemptions })} />
        <KpiTile className={fl("redeemed")} accent="coral" label={t("pass.redeemed")} value={<span data-testid="stat-redeemed">{s.redeemed}</span>} sub={s.verifiedSales ? `${fmtUsd(s.verifiedSales, 2)} ${t("pass.verifiedSales").toLowerCase()}` : undefined} />
        <KpiTile accent="navy" label={t("pass.conversion")} value={s.conversion === null ? "—" : `${Math.round(s.conversion * 100)}%`} sub={s.claims ? `${s.redeemed} / ${s.claims}` : undefined} />
      </div>
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-bold">{t("pass.recentT")}</span><span className="text-[11.5px] text-muted">{t("pass.proveHint")}</span></div>
        {s.recent.length ? (
          <ul className="divide-y divide-border text-[13px]" data-testid="recent">{s.recent.map((r, i) => <li key={i} className="flex items-center justify-between gap-2 py-1.5"><span className="font-mono tracking-wider">{r.tokenHint}</span><span className="flex items-center gap-2"><span className="text-muted">{new Date(r.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span><Chip tone={r.status === "redeemed" ? "good" : r.status === "expired" ? "neutral" : "warn"}>{t(`pass.status.${r.status}`)}</Chip></span></li>)}</ul>
        ) : <p className={cx("text-[13px] text-ink-2")}>{t("pass.recentEmpty")}</p>}
      </div>
    </div>
  );
}
