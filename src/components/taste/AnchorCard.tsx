"use client";
import { useState } from "react";
import { Button, Card, Chip, DivergingBar, H2, cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";

type Place = { entityId: string; name: string; affinity?: number; explain?: number; neighborhood?: string; tags: string[] };
type Ref = { entityId: string; name: string; subtype?: string; disambiguation?: string };
type Result = { mode: "live" | "sample"; city: string; anchor: Ref | null; candidates: Ref[]; places: Place[]; demographics: { age: Record<string, number>; gender: Record<string, number> } | null; provenance?: { endpoint: string; params: Record<string, string>; retrievedAt: string; cacheHit: boolean }; error?: string };

const PRESETS = ["Jay Chou", "Everything Everywhere All at Once", "Mitski"];
const AGE: Array<[string, string]> = [["24_and_younger", "≤24"], ["25_to_29", "25–29"], ["30_to_34", "30–34"], ["35_to_44", "35–44"], ["45_to_54", "45–54"], ["55_and_older", "55+"]];
const typeKey = (s?: string) => (s?.match(/urn:entity:([a-z_]+)/)?.[1] ?? "unknown");

/** Owner picks a taste anchor; Qloo answers where its fans eat locally and who they are. */
export function AnchorCard({ restaurantId, city, passHref }: { restaurantId: string; city: string; passHref: string | null }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null); const [err, setErr] = useState("");
  async function ask(body: { query?: string; entityId?: string }) {
    setBusy(true); setErr("");
    const r = await fetch("/api/anchors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId, ...body }) });
    const j = (await r.json().catch(() => ({ error: "network" }))) as Result & { error?: string };
    setBusy(false);
    if (r.status === 429) { setErr(t("anchor.rateLimited")); return; }
    if (!r.ok) { setErr(t("anchor.error", { e: j.error ?? r.status })); return; }
    if (!j.anchor) { setRes(null); setErr(t("anchor.noMatch")); return; }
    setRes(j);
  }
  const a = res?.anchor;
  return (
    <Card>
      <H2 hint={t("anchor.hint", { city })} right={res ? <Chip tone={res.mode === "live" ? "good" : "warn"}>{res.mode === "live" ? t("common.liveQloo") : t("common.sampleData")}</Chip> : undefined}>{t("anchor.title")}</H2>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) ask({ query: q.trim() }); }}>
        <input aria-label={t("anchor.title")} data-testid="anchor-input" className="h-11 min-w-0 flex-1 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[15px] focus:border-coral focus:outline-none" placeholder={t("anchor.placeholder")} value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="primary" disabled={busy || q.trim().length < 2}>{busy ? t("anchor.finding") : t("anchor.find")}</Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">{t("anchor.try")}:{PRESETS.map((p) => <button key={p} type="button" disabled={busy} onClick={() => { setQ(p); ask({ query: p }); }} className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-2 hover:bg-border">{p}</button>)}</div>
      {err ? <p role="alert" className="mt-3 text-[13px] text-bad">{err}</p> : null}
      {a && res ? (
        <div className="mt-4 grid gap-4" data-testid="anchor-result">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral-soft text-coral"><Icon.tag width={20} height={20} /></span>
            <div className="min-w-0"><div className="text-[17px] font-bold leading-5">{a.name}</div><div className="text-[12px] text-ink-2">{t(`anchor.types.${typeKey(a.subtype)}`)}</div></div>
            {res.candidates.length > 1 ? <div className="ml-auto flex flex-wrap items-center gap-1 text-[11.5px] text-muted">{t("anchor.others")}:{res.candidates.filter((c) => c.entityId !== a.entityId).slice(0, 3).map((c) => <button key={c.entityId} type="button" disabled={busy} onClick={() => ask({ query: q || a.name, entityId: c.entityId })} className="max-w-[160px] truncate rounded-full border border-border px-2 py-0.5 hover:bg-surface-2">{c.name}</button>)}</div> : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="mb-2 text-[13px] font-bold">{t("anchor.whereT", { name: a.name, city: res.city })}</div>
              {res.places.length ? (
                <ul className="divide-y divide-border">{res.places.slice(0, 6).map((p) => (
                  <li key={p.entityId} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{p.name}</div><div className="flex flex-wrap gap-1 pt-0.5">{p.tags.map((tg) => <span key={tg} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">{tg}</span>)}{p.explain !== undefined ? <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold text-coral-ink">{t("anchor.linked", { name: a.name })}</span> : null}</div></div>
                    {p.affinity !== undefined ? <Chip tone="coral" ring={p.affinity}>{p.affinity.toFixed(2)}</Chip> : null}
                  </li>))}</ul>
              ) : <p className="text-[13px] text-ink-2">{t("anchor.noPlaces")}</p>}
            </div>
            <div>
              <div className="mb-2 text-[13px] font-bold">{t("anchor.whoT", { name: a.name })}</div>
              {res.demographics ? (
                <div className="grid gap-1.5">{AGE.filter(([k]) => res.demographics!.age[k] !== undefined).map(([k, l]) => <DivergingBar key={k} label={l} value={res.demographics!.age[k]} />)}
                  <div className="mt-1 flex gap-3 text-[12.5px] text-ink-2">{(["female", "male"] as const).filter((g) => res.demographics!.gender[g] !== undefined).map((g) => <span key={g}>{t(g === "female" ? "anchor.women" : "anchor.men")} <strong className={cx("tabular", res.demographics!.gender[g] >= 0 ? "text-pos" : "text-bad")}>{res.demographics!.gender[g] > 0 ? "+" : ""}{res.demographics!.gender[g].toFixed(2)}</strong></span>)}</div>
                </div>
              ) : <p className="text-[13px] text-ink-2">—</p>}
            </div>
          </div>
          <p className="rounded-xl bg-surface-2 p-2.5 text-[12.5px] text-ink-2">{t("anchor.honesty")}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {res.provenance ? <span className="text-[11.5px] text-muted">{t("common.source")} · {res.provenance.endpoint} · signal.interests.entities · {new Date(res.provenance.retrievedAt).toLocaleString(locale, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</span> : <span />}
            {passHref ? <Button href={`${passHref}&anchor=${encodeURIComponent(a.name)}&aid=${encodeURIComponent(a.entityId)}`} variant="coral"><Icon.ticket width={18} height={18} />{t("anchor.cta", { name: a.name })}</Button> : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
