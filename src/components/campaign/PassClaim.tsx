"use client";
import { DISPLAY_TZ } from "@/lib/display-tz";
import { useEffect, useState } from "react";
import { Button, Chip } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** Guest side: consent → claim → one-time code. The code is shown once and never stored in the browser. */
export function PassClaim({ slug, active, closedReason }: { slug: string; active: boolean; closedReason?: string }) {
  const { t, locale } = useI18n();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; token?: string; expires_at?: string; reason?: string } | null>(null);
  useEffect(() => { fetch(`/api/pass/${slug}/view`, { method: "POST" }).catch(() => {}); }, [slug]);
  async function claim() {
    setBusy(true);
    const r = await fetch(`/api/pass/${slug}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent: true }) });
    setRes(await r.json().catch(() => ({ ok: false, reason: "error" }))); setBusy(false);
  }
  if (res?.ok && res.token) {
    return (
      <div className="grid gap-3 text-center" data-testid="claimed">
        <div className="text-[13px] font-semibold text-ink-2">{t("pass.pub.showCode")}</div>
        <div className="rounded-2xl border-2 border-dashed border-coral bg-coral-soft px-3 py-5 font-mono text-[34px] font-extrabold tracking-[0.18em] text-navy" data-testid="pass-token" aria-live="polite">{res.token.slice(0, 4)}<span className="text-coral">·</span>{res.token.slice(4)}</div>
        <div className="text-[13px] text-ink-2">{t("pass.pub.expires", { date: new Date(res.expires_at!).toLocaleString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })}</div>
        <Chip tone="warn" className="mx-auto">{t("pass.pub.save")}</Chip>
      </div>
    );
  }
  if (!active) return <p className="rounded-xl bg-surface-2 p-3 text-center text-[14px] font-semibold text-ink-2">{t(`pass.pub.reason.${closedReason ?? "ended"}`)}</p>;
  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--coral)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="consent" />
        <span>{t("pass.pub.consent")}</span>
      </label>
      <Button variant="coral" size="lg" className="w-full" disabled={!consent || busy} onClick={claim}>{busy ? t("pass.pub.claiming") : t("pass.pub.claim")}</Button>
      {res && !res.ok ? <p role="alert" className="text-center text-[13px] font-semibold text-bad">{t(`pass.pub.reason.${res.reason ?? "error"}`)}</p> : null}
    </div>
  );
}
