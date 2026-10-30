import type { MomentKind, ThemeKey } from "./moments";
import { addDays, nthWeekday } from "./moments";
import type { SalesRow } from "@/lib/ingest/analyze";

/**
 * Radar: the proactive layer. Pure functions that turn what is happening around the restaurant
 * (holidays, street and community events, the school calendar, the owner's own sales) into
 * (a) a plain-language outlook per moment, (b) the likely outside causes of a slow or busy week,
 * and (c) ranked "plays": a moment paired with the idea the agents already costed for it.
 * No Qloo numbers are produced here; crowd fit stays in /api/moments/fit and pass-evidence.ts.
 */
export type HolidayScope = "us" | "ca" | "cultural" | "retail";
export interface RadarMoment { id: string; kind: MomentKind; name: string; date: string; theme: ThemeKey | null; miles?: number; scope?: HolidayScope | null; end?: string; source: string; link?: string }
export type OutlookKey = "offices_closed" | "family_dinner" | "occasion" | "cultural_menu" | "foot_traffic" | "late_crowd" | "festival_crowd" | "nearby";
export interface Outlook { key: OutlookKey; direction: "up" | "down" | "mixed" }

/** 0 = Sunday … 6 = Saturday, for a plain calendar date. */
export function weekdayOf(date: string): number { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
const isWeekday = (date: string) => { const d = weekdayOf(date); return d >= 1 && d <= 5; };

export const NEAR_MILES = 1.5;

/** Deterministic rule set; the UI renders `radar.outlook.<key>`. */
export function outlookFor(m: RadarMoment): Outlook {
  if (m.kind === "holiday") {
    if (m.scope === "cultural") return { key: "cultural_menu", direction: "up" };
    if ((m.scope === "us" || m.scope === "ca") && isWeekday(m.date)) return { key: "offices_closed", direction: "mixed" };
    if (m.theme === "family") return { key: "family_dinner", direction: "up" };
    return { key: "occasion", direction: "up" };
  }
  if (m.end && m.end >= "20:00") return { key: "late_crowd", direction: "up" };
  if (m.theme === "festival" || m.theme === "night_market") return { key: "festival_crowd", direction: "up" };
  if (m.theme === "kids" || m.theme === "family") return { key: "family_dinner", direction: "up" };
  if (m.miles !== undefined && m.miles <= NEAR_MILES) return { key: "foot_traffic", direction: "up" };
  return { key: "nearby", direction: "up" };
}

// ---------- school calendar (heuristic) ----------
export type BreakKind = "winter" | "spring" | "summer" | "thanksgiving";
export interface SchoolBreak { kind: BreakKind; from: string; to: string }
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Typical Bay Area public-school calendar. Owners confirm against their local district; the UI labels it as a heuristic. */
export function schoolBreaksForYear(y: number): SchoolBreak[] {
  const tg = nthWeekday(y, 11, 4, 4);
  return [
    { kind: "winter", from: iso(y - 1, 12, 20), to: iso(y, 1, 4) },
    { kind: "spring", from: iso(y, 3, 28), to: iso(y, 4, 5) },
    { kind: "summer", from: iso(y, 6, 5), to: iso(y, 8, 15) },
    { kind: "thanksgiving", from: addDays(tg, -3), to: addDays(tg, 1) },
    { kind: "winter", from: iso(y, 12, 20), to: iso(y + 1, 1, 4) },
  ];
}
export function schoolBreakOn(date: string): SchoolBreak | null {
  const y = Number(date.slice(0, 4));
  return schoolBreaksForYear(y).find((b) => date >= b.from && date <= b.to) ?? null;
}
/** The break in progress today, or the next one starting within `days`. */
export function schoolBreakAhead(today: string, days = 21): { state: "in_break" | "upcoming"; brk: SchoolBreak } | null {
  const now = schoolBreakOn(today);
  if (now) return { state: "in_break", brk: now };
  const horizon = addDays(today, days);
  const y = Number(today.slice(0, 4));
  const next = [...schoolBreaksForYear(y), ...schoolBreaksForYear(y + 1)].filter((b) => b.from > today && b.from <= horizon).sort((a, b) => a.from.localeCompare(b.from))[0];
  return next ? { state: "upcoming", brk: next } : null;
}

// ---------- sales pulse ----------
export interface Pulse { status: "no_data" | "short_history" | "ready"; last7: number; prior: number[]; priorAvg: number | null; pct: number | null; verdict: "up" | "flat" | "down" | null; from: string; to: string }
const DEAD = new Set(["canceled", "cancelled", "refunded", "voided", "void"]);
function dayKey(iso: string, tz: string): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); } catch { return iso.slice(0, 10); }
}
/** Last 7 complete days of net sales vs the same 7-day window one to four weeks earlier. Deterministic; ignores canceled rows. */
export function weeklyPulse(rows: Array<Pick<SalesRow, "ordered_at" | "net_sales" | "status">>, today: string, tz: string): Pulse {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (!r.ordered_at || DEAD.has((r.status ?? "").toLowerCase())) continue;
    const k = dayKey(r.ordered_at, tz); byDay.set(k, (byDay.get(k) ?? 0) + (r.net_sales ?? 0));
  }
  const days = [...byDay.keys()].sort();
  const empty: Pulse = { status: "no_data", last7: 0, prior: [], priorAvg: null, pct: null, verdict: null, from: today, to: today };
  if (!days.length) return empty;
  const end = days[days.length - 1] < addDays(today, -1) ? days[days.length - 1] : addDays(today, -1);
  const sum = (from: string, to: string) => { let s = 0, seen = false; for (const [k, v] of byDay) if (k >= from && k <= to) { s += v; seen = true; } return seen ? s : null; };
  const from = addDays(end, -6);
  const last7 = sum(from, end);
  if (last7 === null) return { ...empty, from, to: end };
  const prior: number[] = [];
  for (let k = 1; k <= 4; k++) { const v = sum(addDays(from, -7 * k), addDays(end, -7 * k)); if (v !== null) prior.push(v); }
  if (prior.length < 2) return { status: "short_history", last7, prior, priorAvg: prior[0] ?? null, pct: null, verdict: null, from, to: end };
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
  const pct = priorAvg > 0 ? (last7 - priorAvg) / priorAvg : null;
  const verdict = pct === null ? null : pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  return { status: "ready", last7, prior, priorAvg, pct, verdict, from, to: end };
}

// ---------- plays ----------
export interface PlayHypothesis { id: string; slug: string; rank: number; evidenceLabel: string; status?: string }
export interface Play { id: string; moment: RadarMoment | null; hypothesisId: string; slug: string; outlook: Outlook | null; matched: boolean }
const THEME_TO_SLUGS: Record<ThemeKey, string[]> = {
  family: ["group-bundle", "weekend-brunch"], kids: ["group-bundle", "boba-study-pairing"], festival: ["late-night-window", "cross-domain-partnership"],
  night_market: ["late-night-window", "cross-domain-partnership"], street_food: ["late-night-window", "group-bundle"], running: ["weekend-brunch", "vegetarian-line"],
  farmers_market: ["vegetarian-line", "weekend-brunch"], halloween: ["cross-domain-partnership", "late-night-window"],
};
/** Pair the next moments with the costed idea that fits them; close one evergreen play with the top idea. */
export function buildPlays(moments: RadarMoment[], hyps: PlayHypothesis[], today: string, days = 21, max = 4): Play[] {
  const viable = hyps.filter((h) => h.evidenceLabel !== "not_recommended" && h.status !== "rejected").sort((a, b) => a.rank - b.rank);
  if (!viable.length) return [];
  const horizon = addDays(today, days);
  const soon = moments.filter((m) => m.date >= today && m.date <= horizon && (m.kind === "holiday" || m.kind === "manual" || m.miles === undefined || m.miles <= NEAR_MILES)).sort((a, b) => a.date.localeCompare(b.date) || (a.miles ?? 0) - (b.miles ?? 0));
  const out: Play[] = []; const seen = new Set<string>();
  for (const m of soon) {
    if (out.length >= max - 1) break;
    const wanted = m.theme ? THEME_TO_SLUGS[m.theme] : [];
    const h = viable.find((x) => wanted.includes(x.slug)) ?? viable[0];
    const key = `${h.id}:${m.date}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ id: `p-${m.id}`, moment: m, hypothesisId: h.id, slug: h.slug, outlook: outlookFor(m), matched: wanted.includes(h.slug) });
  }
  out.sort((a, b) => Number(b.matched) - Number(a.matched) || (a.moment?.date ?? "").localeCompare(b.moment?.date ?? ""));
  out.push({ id: `p-evergreen-${viable[0].id}`, moment: null, hypothesisId: viable[0].id, slug: viable[0].slug, outlook: null, matched: false });
  return out.slice(0, max);
}

/** Outside causes worth naming on the home screen, ordered: break in progress, weekday closures, nearby crowds. */
export type CauseKey = "school_break" | "school_break_soon" | "holiday_weekday" | "events_near" | "late_events";
export interface Cause { key: CauseKey; direction: "up" | "down" | "mixed"; detail: string; date?: string; n?: number }
export function outsideCauses(moments: RadarMoment[], brk: ReturnType<typeof schoolBreakAhead>, today: string, days = 14): Cause[] {
  const horizon = addDays(today, days); const out: Cause[] = [];
  if (brk?.state === "in_break") out.push({ key: "school_break", direction: "down", detail: brk.brk.kind, date: brk.brk.to });
  else if (brk?.state === "upcoming") out.push({ key: "school_break_soon", direction: "down", detail: brk.brk.kind, date: brk.brk.from });
  const hol = moments.find((m) => m.kind === "holiday" && (m.scope === "us" || m.scope === "ca") && m.date >= today && m.date <= horizon && isWeekday(m.date));
  if (hol) out.push({ key: "holiday_weekday", direction: "mixed", detail: hol.name, date: hol.date });
  const near = moments.filter((m) => m.kind !== "holiday" && m.date >= today && m.date <= horizon && m.miles !== undefined && m.miles <= NEAR_MILES);
  if (near.length) out.push({ key: "events_near", direction: "up", detail: near[0].name, date: near[0].date, n: near.length });
  const late = near.filter((m) => m.end && m.end >= "20:00");
  if (late.length) out.push({ key: "late_events", direction: "up", detail: late[0].name, date: late[0].date, n: late.length });
  return out;
}
