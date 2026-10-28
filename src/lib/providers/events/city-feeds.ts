import "server-only";
import { classifyTheme } from "@/lib/business/moments";
import type { EventsResult, LocalEvent } from "./sf-open-data";

/**
 * More city open-data feeds (Socrata, public, no key). Only event names, dates and venues are read;
 * personal fields that some datasets carry (for example permit requestor names in Chicago) are never selected.
 */
type Row = Record<string, unknown>;
const clean = (s: unknown, max = 90) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const day = (s: unknown) => String(s ?? "").slice(0, 10);
const hhmm = (s: unknown) => { const m = String(s ?? "").match(/T(\d{2}:\d{2})/); return m && m[1] !== "00:00" ? m[1] : undefined; };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function socrata(host: string, id: string, params: Record<string, string>): Promise<Row[]> {
  const res = await fetch(`https://${host}/resource/${id}.json?${new URLSearchParams(params)}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const j = await res.json();
  if (!Array.isArray(j)) throw new Error("malformed");
  return j as Row[];
}
const errClass = (e: unknown) => (e instanceof Error ? (e.name === "TimeoutError" ? "timeout" : e.message.slice(0, 40)) : "error");

export const NYC_TYPES = ["Street Event", "Farmers Market", "Open Street Partner Event", "Plaza Partner Event", "Parade", "Sidewalk Sale", "Block Party", "Plaza Event", "Religious Event", "Athletic Race / Tour", "Street Festival", "Single Block Festival", "Open Culture"];
const NYC_THEME: Record<string, ReturnType<typeof classifyTheme>> = { "Farmers Market": "farmers_market", "Parade": "festival", "Street Festival": "festival", "Single Block Festival": "festival", "Block Party": "family", "Athletic Race / Tour": "running", "Sidewalk Sale": "street_food" };

/** NYC Permitted Event Information (tvpp-9vvx): street fairs, block parties, markets, parades. Borough-level location, no coordinates. */
export function normalizeNycRows(rows: Row[]): LocalEvent[] {
  const seen = new Set<string>(); const out: LocalEvent[] = [];
  for (const r of rows) {
    const type = String(r.event_type ?? "");
    if (!NYC_TYPES.includes(type)) continue;
    const name = clean(r.event_name); const date = day(r.start_date_time);
    if (!name || !ISO.test(date) || /outreach|wellness|health|vaccin|blood drive|testing/i.test(name)) continue;
    const key = `${name}|${date}|${r.event_borough}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({
      id: `nyc-${clean(r.event_id, 20) || key}`, kind: "street", name, date, endDate: day(r.end_date_time) || date,
      start: hhmm(r.start_date_time), end: hhmm(r.end_date_time), where: [clean(r.event_location, 70), clean(r.event_borough, 20)].filter(Boolean).join(" · "),
      theme: NYC_THEME[type] ?? classifyTheme(name),
    });
  }
  return out;
}

/** Chicago Park District outdoor event permits (pk66-w54g). Only "Permit - Event…" and "Permit - Athletic…" rows; description + park only. */
export function normalizeChicagoRows(rows: Row[]): LocalEvent[] {
  const out: LocalEvent[] = []; const seen = new Set<string>();
  for (const r of rows) {
    const type = String(r.event_type ?? "");
    if (!/^Permit - (Event|Athletic)/.test(type)) continue;
    const raw = clean(r.event_description);
    if (/non-?exclusive|training|practice|program|class|wedding|photo|film/i.test(raw)) continue;
    const name = raw.replace(/\s*\([^)]*\)?\s*$/, "").trim(); const date = day(r.reservation_start_date);
    if (!name || !ISO.test(date)) continue;
    const key = `${name}|${date}|${r.park_facility_name}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({
      id: `chi-${clean(r.park_number, 10)}-${name.slice(0, 40)}`, kind: "street", name, date, endDate: day(r.reservation_end_date) || date,
      where: clean(r.park_facility_name, 80), theme: classifyTheme(name) ?? (/Athletic/.test(type) ? "running" : "festival"),
    });
  }
  return out;
}

export async function getNycEvents(from: string, to: string): Promise<EventsResult> {
  const retrievedAt = new Date().toISOString(); const meta = { source: "NYC Open Data · Permitted Event Information", datasetId: "tvpp-9vvx" };
  try {
    const types = NYC_TYPES.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
    const rows = await socrata("data.cityofnewyork.us", "tvpp-9vvx", {
      $where: `start_date_time between '${from}T00:00:00' and '${to}T23:59:59' AND event_type in (${types})`,
      $select: "event_id,event_name,start_date_time,end_date_time,event_type,event_borough,event_location", $order: "start_date_time", $limit: "3000",
    });
    const events = normalizeNycRows(rows);
    return { state: "ok", events, retrievedAt, total: events.length, ...meta };
  } catch (e) { return { state: "error", events: [], errorClass: errClass(e), retrievedAt, total: 0, ...meta }; }
}

export async function getChicagoEvents(from: string, to: string): Promise<EventsResult> {
  const retrievedAt = new Date().toISOString(); const meta = { source: "Chicago Park District · Outdoor Event Permits", datasetId: "pk66-w54g" };
  try {
    const rows = await socrata("data.cityofchicago.org", "pk66-w54g", {
      $where: `reservation_start_date between '${from}T00:00:00' and '${to}T23:59:59'`,
      $select: "park_number,park_facility_name,reservation_start_date,reservation_end_date,event_type,event_description", $order: "reservation_start_date", $limit: "3000",
    });
    const events = normalizeChicagoRows(rows);
    return { state: "ok", events, retrievedAt, total: events.length, ...meta };
  } catch (e) { return { state: "error", events: [], errorClass: errClass(e), retrievedAt, total: 0, ...meta }; }
}
