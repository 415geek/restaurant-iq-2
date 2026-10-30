"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { Guardrails } from "@/lib/front/types";

/** HQ guardrails: which items stores may rename (by name, applied to every store's matching item ids), price band, banned terms, tone. */
export function GuardrailsForm({ brandId, guardrails, groups }: { brandId: string; guardrails: Guardrails; groups: Array<{ name: string; ids: string[] }> }) {
  const { t } = useI18n(); const router = useRouter();
  const allowed = new Set(guardrails.renamableItemIds);
  const [names, setNames] = useState<Set<string>>(new Set(groups.filter((g) => g.ids.some((id) => allowed.has(id))).map((g) => g.name)));
  const [band, setBand] = useState(String(guardrails.priceBandPct));
  const [banned, setBanned] = useState(guardrails.bannedTerms.join(", "));
  const [tone, setTone] = useState<Guardrails["tone"]>(guardrails.tone);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save() {
    setBusy(true); setMsg(null);
    const body = { renamableItemIds: groups.filter((g) => names.has(g.name)).flatMap((g) => g.ids).slice(0, 500), priceBandPct: Math.max(0, Math.min(100, Number(band) || 0)), bannedTerms: banned.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50), tone };
    try {
      const r = await fetch(`/api/front/brands/${brandId}/guardrails`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 429) setMsg({ ok: false, text: t("front.owner.rateLimited") });
      else if (!r.ok) setMsg({ ok: false, text: `${t("front.fleet.saveFailed")}: ${j.error ?? r.statusText}` });
      else { setMsg({ ok: true, text: t("front.fleet.saved") }); router.refresh(); }
    } catch { setMsg({ ok: false, text: t("common.networkError") }); }
    setBusy(false);
  }
  const toggle = (name: string) => setNames((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const field = "h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[14px]";
  return (
    <form data-testid="guardrails-form" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <fieldset className="grid gap-1">
        <legend className="text-[12px] font-semibold text-ink-2">{t("front.fleet.renamable")}</legend>
        <div className="max-h-36 overflow-y-auto rounded-[10px] border border-border p-2">
          {groups.map((g) => (
            <label key={g.name} className="flex items-center gap-2 py-1 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[var(--coral)]" checked={names.has(g.name)} onChange={() => toggle(g.name)} />{g.name}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-[12px] font-semibold text-ink-2">{t("front.fleet.priceBand")}<input type="number" min={0} max={100} className={field} value={band} onChange={(e) => setBand(e.target.value)} /></label>
        <label className="grid gap-1 text-[12px] font-semibold text-ink-2">{t("front.fleet.tone")}
          <select className={field} value={tone} onChange={(e) => setTone(e.target.value as Guardrails["tone"])}>{(["warm", "plain", "playful", "premium"] as const).map((k) => <option key={k} value={k}>{t(`front.fleet.tones.${k}`)}</option>)}</select>
        </label>
      </div>
      <label className="grid gap-1 text-[12px] font-semibold text-ink-2">{t("front.fleet.banned")}<input className={field} value={banned} onChange={(e) => setBanned(e.target.value)} /></label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? t("common.saving") : t("front.fleet.save")}</Button>
        {msg ? <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[12.5px] font-semibold text-good-ink" : "text-[12.5px] font-semibold text-bad"}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
