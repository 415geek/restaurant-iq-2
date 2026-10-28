"use client";
import { useMemo, useState } from "react";
import { Button, Card, Chip, DivergingBar, H2, cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";
import type { ThemeKey, FitLevel, MomentKind } from "@/lib/business/moments";

export interface MomentItem { id: string; kind: MomentKind; name: string; date: string; start?: string; end?: string; where?: string; org?: string; miles?: number; theme: ThemeKey | null; source: string }
type Demo = { age: Record<string, number>; gender: Record<string, number> };
type Fit = { mode: "live" | "sample"; crowd: Demo | null; yours: Demo | null; fit: { score: number; level: FitLevel } | null; cuisine: string; places: Array<{ entityId: string; name: string; affinity?: number }>; provenance?: { endpoint: string; retrievedAt: string }; error?: string };

const THEMES: ThemeKey[] = ["kids", "halloween", "family", "farmers_market", "night_market", "street_food", "running", "festival"];
const AGE: Array<[string, string]> = [["24_and_younger", "≤24"], ["25_to_29", "25–29"], ["30_to_34", "30–34"], ["35_to_44", "35–44"], ["45_to_54", "45–54"], ["55_and_older", "55+"]];
const DOT: Record<MomentKind, string> = { holiday: "bg-coral", street: "bg-navy", community: "bg-good", manual: "bg-warn" };
const NEAR_MILES = 1.5;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export function MomentsBoard({ restaurantId, base, hid, today, items, neighborhood, hasGeo }: { restaurantId: string; base: string; hid: string | null; today: string; items: MomentItem[]; neighborhood: string; hasGeo: boolean }) {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<"all" | MomentKind>("all");
  const [near, setNear] = useState(hasGeo);
  const [day, setDay] = useState<string | null>(null);
  const [manual, setManual] = useState<MomentItem[]>([]);
  const [themes, setThemes] = useState<Record<string, ThemeKey | null>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);
  const [form, setForm] = useState({ name: "", date: addDays(today, 7), theme: "family" as ThemeKey });

  const all = useMemo(() => [...manual, ...items].map((m) => ({ ...m, theme: m.id in themes ? themes[m.id] : m.theme })), [items, manual, themes]);
  const inScope = useMemo(() => all.filter((m) => !near || m.kind === "holiday" || m.kind === "manual" || m.miles === undefined || m.miles <= NEAR_MILES), [all, near]);
  const shown = useMemo(() => inScope.filter((m) => (kind === "all" || m.kind === kind) && (!day || m.date === day)).sort((a, b) => a.date.localeCompare(b.date) || (a.miles ?? 0) - (b.miles ?? 0)), [inScope, kind, day]);
  const byDay = useMemo(() => { const m = new Map<string, Set<MomentKind>>(); for (const x of inScope) { if (!m.has(x.date)) m.set(x.date, new Set()); m.get(x.date)!.add(x.kind); } return m; }, [inScope]);

  const start = useMemo(() => { const d = new Date(`${today}T00:00:00Z`); return addDays(today, -d.getUTCDay()); }, [today]);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { ...o, timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays(start, i), { weekday: "narrow" }));

  async function check(m: MomentItem) {
    const theme = m.theme; if (!theme) return;
    setOpen(m.id); setBusy(m.id);
    const r = await fetch("/api/moments/fit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId, theme, moment: m.name }) });
    const j = (await r.json().catch(() => ({ error: "network" }))) as Fit;
    setBusy(null);
    setFits((s) => ({ ...s, [m.id]: r.ok ? j : { ...j, error: r.status === 429 ? "rate_limited" : (j.error ?? String(r.status)) } }));
  }
  const passHref = (m: MomentItem) => hid ? `${base}/passes/new?h=${hid}&mk=${m.kind}&mn=${encodeURIComponent(m.name.slice(0, 90))}&md=${m.date}${m.theme ? `&mt=${m.theme}` : ""}&ms=${encodeURIComponent(m.source.slice(0, 80))}` : null;
  function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2 || form.date < today) return;
    const m: MomentItem = { id: `m-${Date.now()}`, kind: "manual", name: form.name.trim().slice(0, 90), date: form.date, theme: form.theme, source: "owner" };
    setManual((s) => [m, ...s]); setKind("manual"); setDay(null); setForm((f) => ({ ...f, name: "" })); void check(m);
  }

  const kinds: Array<"all" | MomentKind> = ["all", "holiday", "street", "community", "manual"];
  return (
    <div className="grid gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("moments.filter")}>{kinds.map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold", kind === k ? "bg-navy text-white" : "bg-surface-2 text-ink-2 hover:bg-border")}>{k !== "all" ? <span className={cx("h-2 w-2 rounded-full", DOT[k])} /> : null}{t(`moments.kinds.${k}`)}</button>)}</div>
          {hasGeo ? <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={near} onChange={(e) => setNear(e.target.checked)} className="h-4 w-4 accent-[var(--color-coral)]" data-testid="near-toggle" />{t("moments.nearOnly", { mi: NEAR_MILES, n: neighborhood })}</label> : null}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center" data-testid="moments-calendar">
          {weekdays.map((w, i) => <div key={i} className="pb-1 text-[11px] font-bold uppercase text-muted">{w}</div>)}
          {cells.map((d) => {
            const ks = byDay.get(d); const past = d < today; const sel = day === d;
            return (
              <button key={d} type="button" disabled={past} onClick={() => setDay(sel ? null : d)} aria-pressed={sel} aria-label={fmt(d, { weekday: "long", month: "long", day: "numeric" })}
                className={cx("flex h-14 flex-col items-center justify-start gap-1 rounded-lg border pt-1.5 text-[13px] tabular", sel ? "border-navy bg-navy text-white" : d === today ? "border-coral bg-coral-soft" : "border-border bg-surface hover:bg-surface-2", past && "opacity-40")}>
                <span className="font-semibold leading-none">{d.endsWith("-01") ? fmt(d, { month: "short", day: "numeric" }) : Number(d.slice(8))}</span>
                <span className="flex flex-wrap justify-center gap-0.5">{ks ? [...ks].map((k) => <span key={k} className={cx("h-1.5 w-1.5 rounded-full", sel ? "bg-white" : DOT[k])} />) : null}</span>
              </button>
            );
          })}
        </div>
        {day ? <div className="mt-2 flex items-center gap-2 text-[13px]"><span className="font-semibold">{fmt(day, { weekday: "long", month: "long", day: "numeric" })}</span><button type="button" onClick={() => setDay(null)} className="text-pos underline-offset-2 hover:underline">{t("moments.allDays")}</button></div> : null}
      </Card>

      <Card>
        <H2 hint={t("moments.listHint")}>{t("moments.listT", { n: shown.length })}</H2>
        {shown.length === 0 ? <p className="text-[13.5px] text-ink-2">{t("moments.none")}</p> : (
          <ul className="divide-y divide-border" data-testid="moments-list">
            {shown.slice(0, limit).map((m) => {
              const f = fits[m.id]; const href = passHref(m); const isOpen = open === m.id;
              return (
                <li key={m.id} className="py-3" data-testid="moment-row" data-kind={m.kind}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="grid w-12 shrink-0 place-items-center rounded-xl border border-border py-1.5 text-center leading-none">
                      <span className="text-[10.5px] font-bold uppercase text-muted">{fmt(m.date, { month: "short" })}</span>
                      <span className="text-[19px] font-extrabold tabular">{Number(m.date.slice(8))}</span>
                      <span className="text-[10.5px] text-muted">{fmt(m.date, { weekday: "short" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5"><span className={cx("h-2 w-2 shrink-0 rounded-full", DOT[m.kind])} /><span className="text-[15px] font-semibold">{m.name}</span></div>
                      <div className="mt-0.5 text-[12.5px] text-ink-2">{[m.start ? `${m.start}${m.end ? `–${m.end}` : ""}` : null, m.where, m.org, m.miles !== undefined ? t("moments.miles", { mi: m.miles }) : null].filter(Boolean).join(" · ") || t(`moments.kinds.${m.kind}`)}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1 text-[12px] text-muted">{t("moments.theme")}
                          <select value={m.theme ?? ""} onChange={(e) => setThemes((s) => ({ ...s, [m.id]: (e.target.value || null) as ThemeKey | null }))} className="h-8 rounded-lg border border-border bg-surface px-2 text-[12.5px] text-ink">
                            <option value="">{t("moments.themeNone")}</option>
                            {THEMES.map((k) => <option key={k} value={k}>{t(`moments.themes.${k}`)}</option>)}
                          </select>
                        </label>
                        <Button size="sm" variant="secondary" onClick={() => check(m)} disabled={!m.theme || busy === m.id} title={!m.theme ? t("moments.pickTheme") : undefined}>{busy === m.id ? t("anchor.finding") : t("moments.whoComes")}</Button>
                        {href ? <Button size="sm" variant="coral" href={href}><Icon.ticket width={16} height={16} />{t("moments.plan")}</Button> : <Button size="sm" variant="coral" disabled title={t("moments.needAnalysis")}>{t("moments.plan")}</Button>}
                      </div>
                    </div>
                  </div>
                  {isOpen && f ? <FitPanel f={f} m={m} href={href} /> : null}
                </li>
              );
            })}
          </ul>
        )}
        {shown.length > limit ? <div className="mt-2"><Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 25)}>{t("moments.more", { n: shown.length - limit })}</Button></div> : null}
      </Card>

      <Card>
        <H2 hint={t("moments.addHint")}>{t("moments.addT")}</H2>
        <form onSubmit={addManual} className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.9fr_auto]">
          <input aria-label={t("moments.addName")} data-testid="manual-name" className="h-11 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[15px] focus:border-coral focus:outline-none" placeholder={t("moments.addName")} value={form.name} maxLength={90} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input aria-label={t("moments.addDate")} data-testid="manual-date" type="date" min={today} className="h-11 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[15px]" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <select aria-label={t("moments.theme")} data-testid="manual-theme" className="h-11 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[15px]" value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value as ThemeKey }))}>{THEMES.map((k) => <option key={k} value={k}>{t(`moments.themes.${k}`)}</option>)}</select>
          <Button type="submit" variant="primary" disabled={form.name.trim().length < 2 || form.date < today}>{t("moments.add")}</Button>
        </form>
      </Card>
    </div>
  );
}

function FitPanel({ f, m, href }: { f: Fit; m: MomentItem; href: string | null }) {
  const { t, locale } = useI18n();
  if (f.error) return <p role="alert" className="mt-3 rounded-xl bg-bad/10 p-3 text-[13px] text-bad">{f.error === "rate_limited" ? t("anchor.rateLimited") : t("anchor.error", { e: f.error })}</p>;
  const lvl = f.fit?.level;
  const theme = m.theme ?? "family";
  return (
    <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-surface-2/50 p-4" data-testid="fit-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={f.mode === "live" ? "good" : "warn"}>{f.mode === "live" ? t("common.liveQloo") : t("common.sampleData")}</Chip>
        {f.fit ? <Chip tone={lvl === "strong" ? "good" : lvl === "some" ? "warn" : "bad"} className="text-[13px]"><span data-testid="fit-level">{t(`moments.levels.${lvl}`)}</span> · {f.fit.score.toFixed(2)}</Chip> : <Chip>{t("moments.fitUnknown")}</Chip>}
        <span className="text-[12.5px] text-ink-2">{t("moments.fitExplain", { theme: t(`moments.themes.${theme}`), cuisine: f.cuisine })}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([["crowd", t("moments.crowdT", { theme: t(`moments.themes.${theme}`) })], ["yours", t("moments.yoursT", { cuisine: f.cuisine })]] as const).map(([k, label]) => {
          const d = f[k];
          return <div key={k}><div className="mb-1.5 text-[13px] font-bold">{label}</div>{d ? <div className="grid gap-1">{AGE.filter(([a]) => d.age[a] !== undefined).map(([a, l]) => <DivergingBar key={a} label={l} value={d.age[a]} />)}{d.gender.female !== undefined ? <div className="pt-1 text-[12.5px] text-ink-2">{t("anchor.women")} <strong className={cx("tabular", d.gender.female >= 0 ? "text-pos" : "text-bad")}>{d.gender.female > 0 ? "+" : ""}{d.gender.female.toFixed(2)}</strong></div> : null}</div> : <p className="text-[13px] text-ink-2">—</p>}</div>;
        })}
      </div>
      <div className="rounded-xl bg-surface p-3 text-[13.5px]"><span className="font-bold">{t("moments.playT")}: </span>{t(`moments.plays.${theme}`)} {lvl ? t(`moments.advice.${lvl}`) : ""}</div>
      {f.places.length ? <div className="text-[12.5px] text-ink-2"><span className="font-semibold text-ink">{t("moments.placesT")}: </span>{f.places.map((p) => p.name).join(" · ")}</div> : null}
      <p className="text-[12px] text-muted">{t("moments.honesty")}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {f.provenance ? <span className="text-[11.5px] text-muted">{t("common.source")} · {f.provenance.endpoint} · signal.interests.tags · {new Date(f.provenance.retrievedAt).toLocaleString(locale, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</span> : <span />}
        {href ? <Button variant="coral" href={href} size="sm"><Icon.ticket width={16} height={16} />{t("moments.planFor", { name: m.name.slice(0, 40) })}</Button> : null}
      </div>
    </div>
  );
}
