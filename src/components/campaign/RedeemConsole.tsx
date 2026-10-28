"use client";
import { useState } from "react";
import { Button, Chip } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** Counter-side redemption. The server decides; this box only shows the outcome. */
export function RedeemConsole({ campaignId, disabled, demo }: { campaignId: string; disabled?: boolean; demo: boolean }) {
  const { t } = useI18n();
  const [token, setToken] = useState(""); const [sale, setSale] = useState("");
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<{ ok: boolean; reason?: string } | null>(null);
  async function redeem(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setRes(null);
    const r = await fetch(`/api/campaigns/${campaignId}/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, verifiedSale: sale === "" ? undefined : Number(sale) }) });
    const j = await r.json().catch(() => ({ ok: false, reason: "error" }));
    setBusy(false); setRes(j);
    if (j.ok) { setToken(""); setSale(""); window.dispatchEvent(new Event("tastepass:refresh")); }
  }
  const msg = res ? t(`pass.result.${res.ok ? "ok" : res.reason ?? "error"}`) : "";
  return (
    <form onSubmit={redeem} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <label className="grid gap-1"><span className="text-[12.5px] font-semibold text-ink-2">{t("pass.tokenLabel")}</span>
          <input aria-label={t("pass.tokenLabel")} data-testid="redeem-token" className="h-12 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 font-mono text-[20px] uppercase tracking-[0.2em] focus:border-coral focus:outline-none" value={token} maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(e) => setToken(e.target.value.toUpperCase())} placeholder="ABCD2345" />
        </label>
        <label className="grid gap-1"><span className="text-[12.5px] font-semibold text-ink-2">{t("pass.saleLabel")}</span>
          <input className="h-12 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[16px] tabular focus:border-coral focus:outline-none" type="number" min="0" step="0.01" inputMode="decimal" value={sale} onChange={(e) => setSale(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || disabled || token.replace(/[^A-Za-z0-9]/g, "").length < 8}>{t("pass.redeemBtn")}</Button>
        {res ? <span role="status" data-testid="redeem-result"><Chip tone={res.ok ? "good" : "bad"}>{msg}</Chip></span> : null}
      </div>
      {demo ? <p className="text-[12px] text-muted">{t("pass.demoMerchant")}</p> : null}
    </form>
  );
}
