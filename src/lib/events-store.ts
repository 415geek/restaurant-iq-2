import "server-only";
import { getServiceClient } from "@/lib/db/server";
import { addDays, localToday, SF_CENTER, type ThemeKey } from "@/lib/business/moments";
import { getCommunityEvents, getStreetEvents, type EventsResult, type LocalEvent } from "@/lib/providers/events/sf-open-data";
import { getChicagoEvents, getNycEvents } from "@/lib/providers/events/city-feeds";
import { getWebEvents, type WebEvent } from "@/lib/providers/events/web-events";

/**
 * Rolling snapshot of local events per city. A daily cron (and a lazy refresh when a page finds the snapshot stale)
 * pulls the next 45 days from each source, upserts, and removes rows that are past or no longer listed.
 */
export type SourceKey = "sf_street" | "sf_our415" | "nyc_permits" | "chicago_parks" | "web_google_events";
export const WINDOW_DAYS = 45;
export const STALE_HOURS = 24;
const WEB_MIN_HOURS = 20;     // at most one web search per area per day
const WEB_DAILY_CAP = 8;      // across all areas, to stay inside a 250/month free plan

export const areaKey = (city: string) => city.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80) || "unknown";
const NYC = /^(new york( city)?|nyc|manhattan|brooklyn|queens|the bronx|bronx|staten island)$/i;

interface Feed { source: SourceKey; label: string; datasetId: string; run: (from: string, to: string) => Promise<EventsResult> }
export function feedsForCity(city: string): Feed[] {
  const c = city.trim();
  if (/^(san francisco|sf)$/i.test(c)) return [
    { source: "sf_street", label: "DataSF · Temporary Street Closures (events)", datasetId: "v9cz-kk5i", run: (f, t) => getStreetEvents(f, t, SF_CENTER) },
    { source: "sf_our415", label: "DataSF · Our415 Events and Activities", datasetId: "8i3s-ih2a", run: (f, t) => getCommunityEvents(f, t, SF_CENTER) },
  ];
  if (NYC.test(c)) return [{ source: "nyc_permits", label: "NYC Open Data · Permitted Event Information", datasetId: "tvpp-9vvx", run: getNycEvents }];
  if (/^chicago$/i.test(c)) return [{ source: "chicago_parks", label: "Chicago Park District · Outdoor Event Permits", datasetId: "pk66-w54g", run: getChicagoEvents }];
  return [];
}
export const SOURCE_LABEL: Record<SourceKey, string> = {
  sf_street: "DataSF · Temporary Street Closures (events)", sf_our415: "DataSF · Our415 Events and Activities",
  nyc_permits: "NYC Open Data · Permitted Event Information", chicago_parks: "Chicago Park District · Outdoor Event Permits",
  web_google_events: "Web · Google Events via SerpApi",
};

const norm = (s: string) => s.toLowerCase().replace(/\b20\d\d\b/g, "").replace(/[^a-z0-9]+/g, "");
function toRows(area: string, source: SourceKey, events: Array<LocalEvent | WebEvent>, at: string) {
  const seen = new Set<string>();
  return events.flatMap((e) => {
    const k = `${e.id}|${e.date}`; if (seen.has(k)) return []; seen.add(k);
    return [{
      area_key: area, source, external_id: e.id.slice(0, 200), name: e.name.slice(0, 120), date: e.date, end_date: e.endDate || null,
      start_time: e.start ?? null, end_time: e.end ?? null, where_text: e.where?.slice(0, 160) || null, org: e.org?.slice(0, 80) || null,
      lat: e.lat ?? null, lng: e.lng ?? null, theme: e.theme, link: "link" in e && e.link ? e.link : null, fetched_at: at,
    }];
  });
}

export interface RefreshReport { source: SourceKey; state: "ok" | "error" | "skipped"; count: number; errorClass?: string }
export async function refreshArea(input: { city: string; neighborhood?: string | null }, opts: { web: boolean; force?: boolean } = { web: false }): Promise<RefreshReport[]> {
  const db = getServiceClient(); const area = areaKey(input.city);
  const today = localToday(); const to = addDays(today, WINDOW_DAYS); const at = new Date().toISOString();
  const reports: RefreshReport[] = [];
  const log = (r: RefreshReport) => { reports.push(r); return db.from("local_event_refreshes").insert({ area_key: area, source: r.source, state: r.state, error_class: r.errorClass ?? null, count: r.count }); };

  const freeNames = new Set<string>();
  await Promise.all(feedsForCity(input.city).map(async (f) => {
    const res = await f.run(today, to);
    if (res.state !== "ok") { await log({ source: f.source, state: "error", count: 0, errorClass: res.errorClass }); return; }
    const rows = toRows(area, f.source, res.events, at);
    for (const r of rows) freeNames.add(`${norm(r.name)}|${r.date}`);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("local_events").upsert(rows.slice(i, i + 500), { onConflict: "source,external_id,date" });
      if (error) { await log({ source: f.source, state: "error", count: 0, errorClass: "db_write" }); return; }
    }
    await db.from("local_events").delete().eq("area_key", area).eq("source", f.source).lt("fetched_at", at);
    await log({ source: f.source, state: "ok", count: rows.length });
  }));

  if (opts.web) {
    const since = new Date(Date.now() - WEB_MIN_HOURS * 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [{ count: recentHere }, { count: recentAll }] = await Promise.all([
      db.from("local_event_refreshes").select("id", { count: "exact", head: true }).eq("area_key", area).eq("source", "web_google_events").neq("state", "skipped").gte("ran_at", since),
      db.from("local_event_refreshes").select("id", { count: "exact", head: true }).eq("source", "web_google_events").neq("state", "skipped").gte("ran_at", dayAgo),
    ]);
    if (!opts.force && (recentHere ?? 0) > 0) reports.push({ source: "web_google_events", state: "skipped", count: 0, errorClass: "fresh" });
    else if ((recentAll ?? 0) >= WEB_DAILY_CAP) await log({ source: "web_google_events", state: "skipped", count: 0, errorClass: "daily_cap" });
    else {
      const q = `Events in ${[input.neighborhood, input.city].filter(Boolean).join(", ")}`;
      const res = await getWebEvents(q, today, process.env.SERPAPI_API_KEY);
      if (res.state !== "ok") await log({ source: "web_google_events", state: "error", count: 0, errorClass: res.errorClass });
      else {
        const fresh = res.events.filter((e) => e.date <= to && !freeNames.has(`${norm(e.name)}|${e.date}`));
        const rows = toRows(area, "web_google_events", fresh, at);
        if (rows.length) await db.from("local_events").upsert(rows, { onConflict: "source,external_id,date" });
        await db.from("local_events").delete().eq("area_key", area).eq("source", "web_google_events").lt("fetched_at", at);
        await log({ source: "web_google_events", state: "ok", count: rows.length });
      }
    }
  }
  await db.from("local_events").delete().eq("area_key", area).lt("date", today);
  return reports;
}

export interface StoredEvent { id: string; source: SourceKey; name: string; date: string; start?: string; end?: string; where?: string; org?: string; lat?: number; lng?: number; theme: ThemeKey | null; link?: string }
export async function readAreaEvents(city: string, from: string, to: string): Promise<StoredEvent[]> {
  const db = getServiceClient();
  const { data } = await db.from("local_events").select("id, source, name, date, start_time, end_time, where_text, org, lat, lng, theme, link")
    .eq("area_key", areaKey(city)).gte("date", from).lte("date", to).order("date").limit(2000);
  return (data ?? []).map((r) => ({
    id: r.id as string, source: r.source as SourceKey, name: r.name as string, date: String(r.date), start: (r.start_time as string) ?? undefined, end: (r.end_time as string) ?? undefined,
    where: (r.where_text as string) ?? undefined, org: (r.org as string) ?? undefined, lat: (r.lat as number) ?? undefined, lng: (r.lng as number) ?? undefined,
    theme: (r.theme as ThemeKey) ?? null, link: (r.link as string) ?? undefined,
  }));
}

export interface SourceStatus { source: SourceKey; state: "ok" | "error" | "skipped" | "never"; count: number; errorClass?: string; ranAt?: string; lastOkAt?: string }
export async function areaStatus(city: string): Promise<SourceStatus[]> {
  const db = getServiceClient();
  const { data } = await db.from("local_event_refreshes").select("source, state, error_class, count, ran_at").eq("area_key", areaKey(city)).order("ran_at", { ascending: false }).limit(60);
  const sources: SourceKey[] = [...feedsForCity(city).map((f) => f.source), "web_google_events"];
  return sources.map((s) => {
    const rows = (data ?? []).filter((r) => r.source === s);
    const last = rows.find((r) => r.state !== "skipped") ?? rows[0];
    const ok = rows.find((r) => r.state === "ok");
    return last ? { source: s, state: last.state as SourceStatus["state"], count: Number(ok?.count ?? 0), errorClass: (last.error_class as string) ?? undefined, ranAt: last.ran_at as string, lastOkAt: (ok?.ran_at as string) ?? undefined } : { source: s, state: "never", count: 0 };
  });
}
export const isStale = (s: SourceStatus) => !s.ranAt || Date.now() - Date.parse(s.ranAt) > STALE_HOURS * 3600_000;
