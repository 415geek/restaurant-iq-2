import "server-only";
import { classifyTheme } from "@/lib/business/moments";
import type { EventsResult, LocalEvent } from "./sf-open-data";

/**
 * Web-wide event discovery through SerpApi's Google Events engine (structured event cards, no LLM extraction).
 * Results are labeled "found on the web" and keep their source link so the owner can verify.
 * Quota is protected by the caller (one search per area per day, global daily cap).
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const clean = (s: unknown, max = 90) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max);

/** Google Events gives "Nov 7" without a year: pick the next occurrence on or after `today` (within a year). */
export function inferDate(startDate: string, today: string): string | null {
  const m = startDate.trim().toLowerCase().match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]); const d = Number(m[2]);
  if (mi < 0 || d < 1 || d > 31) return null;
  const y = Number(today.slice(0, 4));
  const iso = (yy: number) => `${yy}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return iso(y) >= today ? iso(y) : iso(y + 1);
}
function timeFrom(when: string): string | undefined {
  const m = when.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return undefined;
  let h = Number(m[1]) % 12; if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}
const httpsLink = (u: unknown) => { try { const x = new URL(String(u)); return x.protocol === "https:" ? x.toString().slice(0, 500) : undefined; } catch { return undefined; } };

export type WebEvent = LocalEvent & { link?: string };
export function normalizeGoogleEvents(rows: Array<Record<string, unknown>>, today: string): WebEvent[] {
  const out: WebEvent[] = [];
  for (const r of rows) {
    const name = clean(r.title); const dt = (r.date ?? {}) as { start_date?: string; when?: string };
    const date = dt.start_date ? inferDate(dt.start_date, today) : null;
    if (!name || !date) continue;
    const venue = clean((r.venue as { name?: string } | undefined)?.name, 60);
    const addr = Array.isArray(r.address) ? r.address.map((a) => clean(a, 60)).filter(Boolean).join(", ") : "";
    const ticket = Array.isArray(r.ticket_info) ? (r.ticket_info as Array<{ link?: string }>)[0]?.link : undefined;
    out.push({
      id: `web-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`, kind: "community", name, date, endDate: date,
      start: timeFrom(String(dt.when ?? "")), where: [venue, addr].filter(Boolean).join(" · ").slice(0, 150), theme: classifyTheme(name),
      link: httpsLink(r.link) ?? httpsLink(ticket),
    });
  }
  return out;
}

export async function getWebEvents(query: string, today: string, apiKey: string | undefined): Promise<EventsResult & { events: WebEvent[] }> {
  const retrievedAt = new Date().toISOString(); const meta = { source: "Web · Google Events via SerpApi", datasetId: "google_events" };
  if (!apiKey) return { state: "error", events: [], errorClass: "not_configured", retrievedAt, total: 0, ...meta };
  try {
    const url = `https://serpapi.com/search.json?${new URLSearchParams({ engine: "google_events", q: query, hl: "en", gl: "us", api_key: apiKey })}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; events_results?: Array<Record<string, unknown>> };
    if (j.error) return { state: "error", events: [], errorClass: /run out of searches|limit/i.test(j.error) ? "quota_exhausted" : /no results/i.test(j.error) ? "no_results" : "provider_error", retrievedAt, total: 0, ...meta };
    if (!res.ok) throw new Error(`http_${res.status}`);
    const events = normalizeGoogleEvents(j.events_results ?? [], today);
    return { state: "ok", events, retrievedAt, total: events.length, ...meta };
  } catch (e) {
    return { state: "error", events: [], errorClass: e instanceof Error ? (e.name === "TimeoutError" ? "timeout" : e.message.slice(0, 40)) : "error", retrievedAt, total: 0, ...meta };
  }
}
