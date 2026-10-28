import "server-only";
import { classifyTheme, milesBetween, type ThemeKey } from "@/lib/business/moments";

/**
 * San Francisco Open Data (Socrata, public, no key):
 *  - v9cz-kk5i "Current and Upcoming Events based on Temporary Street Closures" (street fairs, block parties, markets, races)
 *  - 8i3s-ih2a "Our415 Events and Activities" (city agencies and community organizations)
 * Rows are treated as untrusted text: names are trimmed, URLs and HTML are never rendered.
 */
const BASE = "https://data.sfgov.org/resource";
export const SF_SOURCES = {
  street: { id: "v9cz-kk5i", label: "DataSF · Temporary Street Closures (events)" },
  community: { id: "8i3s-ih2a", label: "DataSF · Our415 Events and Activities" },
} as const;

export interface LocalEvent {
  id: string; kind: "street" | "community"; name: string; org?: string; date: string; endDate: string;
  start?: string; end?: string; where: string; lat?: number; lng?: number; miles?: number; theme: ThemeKey | null;
}
export interface EventsResult { state: "ok" | "error"; events: LocalEvent[]; errorClass?: string; retrievedAt: string; source: string; datasetId: string; total: number }

const clean = (s: unknown, max = 90) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const hhmm = (t: unknown) => (typeof t === "string" && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : undefined);

type Row = Record<string, unknown>;
async function socrata(id: string, params: Record<string, string>): Promise<Row[]> {
  const url = `${BASE}/${id}.json?${new URLSearchParams(params)}`;
  const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const j = await res.json();
  if (!Array.isArray(j)) throw new Error("malformed");
  return j as Row[];
}
const errClass = (e: unknown) => (e instanceof Error ? (e.name === "TimeoutError" ? "timeout" : e.message.slice(0, 40)) : "error");

/** Street-closure permits of type "Special Event", grouped per case and day (one event spans many street segments). Film shoots are dropped. */
export function normalizeStreetRows(rows: Row[], center: [number, number] | null): LocalEvent[] {
  const byKey = new Map<string, LocalEvent>();
  for (const r of rows) {
    if (r.type !== "Special Event") continue;
    const name = clean(r.case_name).replace(/\s+20\d\d(-\d\d)?\b/g, "").replace(/\s*\(20\d\d(-\d\d)?\)/g, "").trim();
    if (!name || /film|filming|shoot|photo/i.test(name)) continue;
    const date = String(r.start_date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const key = `${r.case_num ?? name}|${date}`;
    const coords = (r.shape as { coordinates?: number[][] } | undefined)?.coordinates?.[0];
    const lat = coords ? Number(coords[1]) : undefined, lng = coords ? Number(coords[0]) : undefined;
    const miles = center && lat && lng ? milesBetween(center, [lat, lng]) : undefined;
    const prev = byKey.get(key);
    if (prev) { if (miles !== undefined && (prev.miles === undefined || miles < prev.miles)) Object.assign(prev, { miles, lat, lng }); continue; }
    byKey.set(key, {
      id: `st-${clean(r.case_num, 20) || name}-${date}`, kind: "street", name, date, endDate: String(r.end_date ?? date).slice(0, 10),
      start: hhmm(r.start_time), end: hhmm(r.end_time), where: titleCase(clean(r.loc_desc, 80)), lat, lng, miles, theme: classifyTheme(name),
    });
  }
  return [...byKey.values()];
}

/** Recurring programs (story times, clubs, classes, tutoring) are not moments a restaurant can plan around. */
const ROUTINE = /^(tutorial|services?|workshop|class)\b|tutoring|homework|tech help|librarian|story ?time|lapsit|chess|crochet|knit|quilt|book club|tai chi|yoga|drop-in/i;
/** One-day Our415 events whose name maps to a theme; routine programs are dropped. */
export function normalizeCommunityRows(rows: Row[], center: [number, number] | null): LocalEvent[] {
  const seen = new Set<string>(); const out: LocalEvent[] = [];
  for (const r of rows) {
    const name = clean(r.event_name);
    if (!name || ROUTINE.test(name)) continue;
    const theme = classifyTheme(name);
    if (!theme) continue;
    const date = String(r.event_start_date ?? "").slice(0, 10);
    const where = clean(r.site_location_name, 60) || clean(r.analysis_neighborhood, 40);
    const key = `${name}|${date}|${where}`;
    if (seen.has(key) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    seen.add(key);
    const lat = Number(r.latitude), lng = Number(r.longitude);
    const ok = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0;
    out.push({
      id: `c-${clean(r.id, 30)}-${date}`, kind: "community", name, org: clean(r.org_name, 50) || undefined, date, endDate: date,
      start: hhmm(r.start_time), end: hhmm(r.end_time), where: titleCase(where), lat: ok ? lat : undefined, lng: ok ? lng : undefined,
      miles: ok && center ? milesBetween(center, [lat, lng]) : undefined, theme,
    });
  }
  return out;
}

export async function getStreetEvents(from: string, to: string, center: [number, number] | null): Promise<EventsResult> {
  const retrievedAt = new Date().toISOString();
  try {
    const rows = await socrata(SF_SOURCES.street.id, {
      $where: `type='Special Event' AND start_date between '${from}T00:00:00' and '${to}T23:59:59'`,
      $select: "case_num,case_name,type,start_date,end_date,start_time,end_time,loc_desc,shape", $order: "start_date", $limit: "2000",
    });
    const events = normalizeStreetRows(rows, center);
    return { state: "ok", events, retrievedAt, source: SF_SOURCES.street.label, datasetId: SF_SOURCES.street.id, total: events.length };
  } catch (e) {
    return { state: "error", events: [], errorClass: errClass(e), retrievedAt, source: SF_SOURCES.street.label, datasetId: SF_SOURCES.street.id, total: 0 };
  }
}

export async function getCommunityEvents(from: string, to: string, center: [number, number] | null): Promise<EventsResult> {
  const retrievedAt = new Date().toISOString();
  try {
    const rows = await socrata(SF_SOURCES.community.id, {
      $where: `event_start_date between '${from}T00:00:00' and '${to}T23:59:59' AND event_end_date = event_start_date`,
      $select: "id,org_name,event_name,event_start_date,start_time,end_time,site_location_name,analysis_neighborhood,latitude,longitude", $order: "event_start_date", $limit: "3000",
    });
    const events = normalizeCommunityRows(rows, center);
    return { state: "ok", events, retrievedAt, source: SF_SOURCES.community.label, datasetId: SF_SOURCES.community.id, total: events.length };
  } catch (e) {
    return { state: "error", events: [], errorClass: errClass(e), retrievedAt, source: SF_SOURCES.community.label, datasetId: SF_SOURCES.community.id, total: 0 };
  }
}
