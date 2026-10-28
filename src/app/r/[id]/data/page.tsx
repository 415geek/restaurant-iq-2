import { notFound } from "next/navigation";
import { DISPLAY_TZ } from "@/lib/display-tz";
import { Button, Card, Chip, H2, cx, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { KpiTile } from "@/components/charts";
import { DataUploader } from "@/components/data/DataUploader";
import { DeleteUpload } from "@/components/data/DeleteUpload";
import { getHypotheses, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getSsrClient } from "@/lib/db/ssr";
import { listMemories } from "@/lib/brain";
import { loadSales, RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { analyzeSales, suggestActions, type SuggestedAction } from "@/lib/ingest/analyze";
import { addDays, localToday } from "@/lib/business/moments";
import { aiConfigured } from "@/lib/ingest/ai";
import { getT } from "@/i18n";

const BRAIN_KINDS = ["data_analyzed", "data_imported", "data_deleted", "brain_learned", "insight_generated"];
const CONNECTORS = [["square", "oauth"], ["clover", "oauth"], ["toast", "partner"], ["doordash", "partner"], ["ubereats", "partner"], ["grubhub", "partner"]] as const;

function nextWeekday(today: string, weekday: number) { const d = new Date(`${today}T12:00:00Z`).getUTCDay(); return addDays(today, ((weekday - d + 7) % 7) || 7); }

export default async function DataPage({ params }: PageProps<"/r/[id]/data">) {
  const { id } = await params; const base = `/r/${id}`;
  const [overview, run, { t, locale }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const db = await getSsrClient();
  const [sales, uploadsRes, memories, eventsRes, hyps] = await Promise.all([
    loadSales(db, id),
    db.from("data_uploads").select("id, file_name, platform, status, row_count, imported_count, rejected_count, mapping_method, created_at").eq("restaurant_id", id).eq("status", "imported").order("created_at", { ascending: false }).limit(20),
    listMemories(id, 40),
    db.from("decision_events").select("id, kind, summary, payload, created_at").eq("restaurant_id", id).in("kind", BRAIN_KINDS).order("created_at", { ascending: false }).limit(10),
    run && run.status === "completed" ? getHypotheses(id, run.id) : Promise.resolve([]),
  ]);
  const uploads = uploadsRes.data ?? []; const events = eventsRes.data ?? [];
  const a = analyzeSales(sales, RESTAURANT_TZ); const actions = suggestActions(a);
  const hid = (hyps.filter((h) => h.status !== "rejected")[0])?.id ?? null;
  const today = localToday();
  const wd = (n: number) => new Date(Date.UTC(2026, 9, 25 + n)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }); // 2026-10-25 is a Sunday
  const hr = (h: number) => new Date(Date.UTC(2026, 0, 1, h)).toLocaleTimeString(locale, { hour: "numeric", timeZone: "UTC" });
  const lt = (x: unknown) => { const v = x as { key?: string; params?: Record<string, string | number> } | undefined; return v?.key ? t(v.key, v.params) : ""; };
  const passLink = (a: SuggestedAction) => {
    if (!hid) return null;
    const q = new URLSearchParams({ h: hid, mk: "manual" });
    if (a.kind === "fill_slow_window") { q.set("mn", t("data.act.slowMoment", { day: wd(Number(a.params.weekday)), hour: hr(Number(a.params.hour)) }).slice(0, 90)); q.set("md", nextWeekday(today, Number(a.params.weekday))); }
    if (a.kind === "shift_from_delivery") { q.set("mn", t("data.act.pickupMoment").slice(0, 90)); q.set("md", addDays(today, 7)); }
    if (a.kind === "feature_top_item") { q.set("mn", t("data.act.itemMoment", { item: String(a.params.item) }).slice(0, 90)); q.set("md", addDays(today, 7)); q.set("item", String(a.params.item)); }
    q.set("ms", "sales data"); return `${base}/passes/new?${q}`;
  };
  const maxHeat = Math.max(0.01, ...a.heat.flat());
  const slowSet = new Set(a.slow.map((s) => `${s.weekday}-${s.hour}`));
  const memGroups = (["insight", "action", "mapping", "dataset"] as const).map((k) => [k, memories.filter((m) => m.kind === k)] as const).filter(([, l]) => l.length);

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-[26px] font-extrabold tracking-[-0.02em]"><Icon.database width={26} height={26} className="text-coral" />{t("data.title")}</h2>
        <p className="mt-1 max-w-3xl text-[14.5px] text-ink-2">{t("data.hint")}</p>
      </div>
      {overview.isDemo ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] font-semibold text-warn-ink">{t("data.demoNote")}</p> : null}

      <Card>
        <H2 hint={t("data.connectHint")}>{t("data.connectT")}</H2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <div className="rounded-xl border-2 border-coral bg-coral-soft p-3"><div className="flex items-center gap-1.5 text-[13.5px] font-bold text-coral-ink"><Icon.upload width={16} height={16} />{t("data.fileUpload")}</div><div className="mt-1 text-[11.5px] text-coral-ink">{t("data.available")}</div></div>
          {CONNECTORS.map(([k, why]) => <div key={k} className="rounded-xl border border-border p-3 opacity-70" title={t(`data.why.${why}`)}><div className="text-[13.5px] font-bold">{t(`data.platforms.${k}`)}</div><div className="mt-1 text-[11.5px] text-muted">{t(`data.why.${why}`)}</div></div>)}
        </div>
        <div className="mt-3 text-[12px] text-muted">{aiConfigured() ? t("data.aiOn") : t("data.aiOffLong")}</div>
      </Card>

      <DataUploader restaurantId={id} />

      {a.orders === 0 ? <Card><p className="text-[14px] text-ink-2" data-testid="no-sales">{t("data.empty")}</p></Card> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="sales-kpis">
            <KpiTile accent="navy" label={t("data.kpi.orders")} value={a.orders.toLocaleString(locale)} sub={a.lineLevel ? t("data.kpi.lines", { n: a.rows.toLocaleString(locale) }) : undefined} />
            <KpiTile label={t("data.kpi.net")} value={fmtUsd(a.netSales)} />
            <KpiTile label={t("data.kpi.ticket")} value={a.avgTicket === null ? "—" : fmtUsd(a.avgTicket, 2)} />
            <KpiTile label={t("data.kpi.period")} value={<span className="text-[17px]">{a.from ? new Date(a.from).toLocaleDateString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric" }) : "—"} – {a.to ? new Date(a.to).toLocaleDateString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric" }) : "—"}</span>} sub={t("data.kpi.weeks", { n: a.weeks })} />
          </div>

          {actions.length ? (
            <Card>
              <H2 hint={t("data.actHint")}>{t("data.actT")}</H2>
              <ul className="grid gap-2" data-testid="sales-actions">
                {actions.map((x) => { const href = passLink(x); const p = x.params; return (
                  <li key={x.kind} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0 text-[13.5px]"><div className="font-semibold">{t(`data.act.${x.kind}.t`, x.kind === "fill_slow_window" ? { day: wd(Number(p.weekday)), hour: hr(Number(p.hour)) } : x.kind === "shift_from_delivery" ? { platform: t(`data.platforms.${p.platform}`), pct: Math.round(Number(p.feeRate) * 100) } : { item: String(p.item) })}</div>
                      <div className="text-[12.5px] text-ink-2">{t(`data.act.${x.kind}.${x.kind === "fill_slow_window" && Number(p.avg) < 0.05 ? "bZero" : "b"}`, x.kind === "fill_slow_window" ? { avg: p.avg, x: p.vsMedian, weeks: a.weeks } : x.kind === "shift_from_delivery" ? { fees: fmtUsd(Number(p.fees)), n: p.orders } : { qty: p.qty })}</div></div>
                    {href ? <Button variant="coral" size="sm" href={href}><Icon.ticket width={16} height={16} />{t("data.act.cta")}</Button> : <Button size="sm" variant="coral" disabled title={t("moments.needAnalysis")}>{t("data.act.cta")}</Button>}
                  </li>); })}
              </ul>
            </Card>
          ) : null}

          <Card>
            <H2 hint={t("data.heatHint")}>{t("data.heatT")}</H2>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0.5 text-[11px] tabular" data-testid="heatmap">
                <thead><tr><th />{a.openHours.map((h) => <th key={h} className="px-0.5 font-semibold text-muted">{hr(h)}</th>)}</tr></thead>
                <tbody>{a.heat.map((row, w) => <tr key={w}><th className="pr-2 text-left font-semibold text-ink-2">{wd(w)}</th>{a.openHours.map((h) => { const v = row[h]; const pct = Math.round((v / maxHeat) * 85) + (v > 0 ? 8 : 0); return <td key={h} title={`${wd(w)} ${hr(h)}: ${v} ${t("data.perWeek")}`} className={cx("h-7 w-9 min-w-9 rounded text-center", slowSet.has(`${w}-${h}`) && "outline outline-2 outline-navy")} style={{ background: `color-mix(in oklab, var(--coral) ${pct}%, var(--surface-2))`, color: pct > 55 ? "white" : "var(--ink-2)" }}>{v >= 0.5 ? Math.round(v) : ""}</td>; })}</tr>)}</tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-muted">{t("data.heatLegend")}</p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <H2 hint={t("data.platHint")}>{t("data.platT")}</H2>
              <table className="w-full text-[13px] tabular" data-testid="platform-table">
                <thead className="text-left text-[11.5px] uppercase text-muted"><tr><th className="py-1">{t("data.platform")}</th><th className="text-right">{t("data.kpi.orders")}</th><th className="text-right">{t("data.kpi.net")}</th><th className="text-right">{t("data.feeRate")}</th></tr></thead>
                <tbody>{a.byPlatform.map((p) => <tr key={p.platform} className="border-t border-border"><td className="py-1.5 font-semibold">{t(`data.platforms.${p.platform}`)}</td><td className="text-right">{p.orders} <span className="text-muted">({Math.round(p.share * 100)}%)</span></td><td className="text-right">{fmtUsd(p.netSales)}</td><td className="text-right">{p.feeRate === null ? "—" : <span className={p.feeRate >= 0.2 ? "font-semibold text-bad" : ""}>{Math.round(p.feeRate * 100)}%</span>}</td></tr>)}</tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-1.5">{a.byChannel.map((c) => <Chip key={c.channel}>{t(`data.channels.${c.channel}`)} · {Math.round(c.share * 100)}%</Chip>)}</div>
            </Card>
            <Card>
              <H2>{t("data.itemsT")}</H2>
              {a.topItems.length ? <ul className="divide-y divide-border text-[13px] tabular">{a.topItems.map((it) => <li key={it.name} className="flex justify-between gap-3 py-1.5"><span className="truncate font-semibold">{it.name}</span><span className="text-ink-2">{it.qty} · {fmtUsd(it.netSales)}</span></li>)}</ul> : <p className="text-[13px] text-ink-2">{t("data.noItems")}</p>}
            </Card>
          </div>
        </>
      )}

      {uploads.length ? (
        <Card>
          <H2>{t("data.uploadsT")}</H2>
          <ul className="divide-y divide-border text-[13px]" data-testid="uploads-list">{uploads.map((u) => <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><div className="min-w-0"><div className="truncate font-semibold">{u.file_name}</div><div className="text-[12px] text-ink-2">{t(`data.platforms.${u.platform}`)} · {t("data.done", { n: u.imported_count, r: u.rejected_count })} · {t(`data.method.${u.mapping_method === "ai_document" ? "ai" : u.mapping_method}`)} · {new Date(u.created_at).toLocaleString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div><DeleteUpload id={u.id} /></li>)}</ul>
        </Card>
      ) : null}

      <Card>
        <H2 hint={t("data.brainHint")} right={<Button href={`${base}/memory`} variant="ghost" size="sm">{t("data.brainAll")}</Button>}><span className="inline-flex items-center gap-2"><Icon.brain width={20} height={20} className="text-coral" />{t("data.brainT")}</span></H2>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]" data-testid="brain-panel">
          <div className="grid content-start gap-3">
            {memGroups.length ? memGroups.map(([k, list]) => (
              <div key={k}><div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-muted">{t(`data.brainKinds.${k}`)}</div>
                <ul className="grid gap-1">{list.slice(0, 5).map((m) => <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12.5px]"><span className="truncate">{k === "action" ? t(`data.act.${m.key}.short`) : m.title}</span><span className="shrink-0 text-[11px] text-muted">{t("data.uses", { n: m.uses })} · {new Date(m.updatedAt).toLocaleDateString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric" })}</span></li>)}</ul></div>
            )) : <p className="text-[13px] text-ink-2">{t("data.brainEmpty")}</p>}
          </div>
          <div><div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-muted">{t("data.brainLog")}</div>
            <ol className="grid gap-1.5 border-l-2 border-border pl-3 text-[12.5px]">{events.map((e) => <li key={e.id}><span className="text-[11px] text-muted">{new Date(e.created_at as string).toLocaleString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> · {lt((e.payload as { lt?: unknown })?.lt) || (e.summary as string)}</li>)}</ol>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-muted">{t("data.brainNote")}</p>
      </Card>
    </div>
  );
}
