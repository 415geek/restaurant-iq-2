/**
 * Local moments: holidays (computed here, no API), local events (SF Open Data) and owner-added events.
 * Everything in this file is deterministic and pure so it can be unit tested.
 */
import { AGE_BUCKETS, type AudienceAffinity } from "@/lib/providers/qloo/types";

export type MomentKind = "holiday" | "street" | "community" | "manual";
export type ThemeKey = "kids" | "halloween" | "family" | "farmers_market" | "night_market" | "street_food" | "running" | "festival";

/** Each theme maps to one Qloo tag that returned demographics in live testing (2026-10-28). */
/** placeSignal: only place-genre tags change which restaurants Qloo returns; keyword tags return a generic ranking, so we hide places for them. */
export const THEMES: Record<ThemeKey, { tagId: string; placeSignal?: boolean }> = {
  kids: { tagId: "urn:tag:keyword:qloo:kids" },
  halloween: { tagId: "urn:tag:keyword:qloo:halloween" },
  family: { tagId: "urn:tag:theme:qloo:family" },
  farmers_market: { tagId: "urn:tag:genre:place:farmers_market", placeSignal: true },
  night_market: { tagId: "urn:tag:genre:place:night_market", placeSignal: true },
  street_food: { tagId: "urn:tag:cuisine:qloo:street_food" },
  running: { tagId: "urn:tag:keyword:qloo:marathon" },
  festival: { tagId: "urn:tag:genre:music:festival" },
};
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

const RULES: Array<[RegExp, ThemeKey]> = [
  [/trick|treat|kidz|\bkids?\b|children|preschool|school|storytime|toddler|bab(y|ies)/i, "kids"],
  [/farmers'? ?market/i, "farmers_market"],
  [/night market|after dark/i, "night_market"],
  [/marathon|half|\b5k\b|\b10k\b|\brun\b|race|fun run|walk(athon)?\b/i, "running"],
  [/hallowe?en|haunt|spooky|crawl-?o-?ween|\bboo\b/i, "halloween"],
  [/festival|\bfest\b|\bfair\b|concert|music|jazz|parade|carnaval|pride|muertos/i, "festival"],
  [/block party|play street|community|neighbou?rs|family|dance party|picnic|potluck/i, "family"],
  [/market|food|\beats?\b|taste|bites|bbq/i, "street_food"],
];
/** Keyword classifier for event names. Returns null when no rule matches; the owner can pick a theme by hand. */
export function classifyTheme(name: string): ThemeKey | null {
  for (const [re, k] of RULES) if (re.test(name)) return k;
  return null;
}

// ---------- holidays ----------
export interface Holiday { id: string; date: string; theme: ThemeKey | null; scope: "us" | "ca" | "cultural" | "retail" }
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** n-th weekday (0=Sun) of a month; n = -1 means the last one. */
export function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return iso(y, m, lastDay - ((last - weekday + 7) % 7));
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Lunar and lunisolar dates from published calendars. Only 2026–2027 are listed; later years are omitted rather than guessed. */
const LUNAR: Record<string, Record<number, string>> = {
  lunar_new_year: { 2026: "2026-02-17", 2027: "2027-02-06" },
  lantern: { 2026: "2026-03-03", 2027: "2027-02-20" },
  dragon_boat: { 2026: "2026-06-19", 2027: "2027-06-09" },
  mid_autumn: { 2026: "2026-09-25", 2027: "2027-09-15" },
  diwali: { 2026: "2026-11-08", 2027: "2027-10-29" },
};

export function holidaysForYear(y: number): Holiday[] {
  const h: Holiday[] = [
    { id: "new_year", date: iso(y, 1, 1), theme: "family", scope: "us" },
    { id: "mlk", date: nthWeekday(y, 1, 1, 3), theme: null, scope: "us" },
    { id: "valentines", date: iso(y, 2, 14), theme: null, scope: "retail" },
    { id: "presidents", date: nthWeekday(y, 2, 1, 3), theme: null, scope: "us" },
    { id: "st_patricks", date: iso(y, 3, 17), theme: "festival", scope: "retail" },
    { id: "cesar_chavez", date: iso(y, 3, 31), theme: null, scope: "ca" },
    { id: "cinco_de_mayo", date: iso(y, 5, 5), theme: "festival", scope: "cultural" },
    { id: "mothers_day", date: nthWeekday(y, 5, 0, 2), theme: "family", scope: "retail" },
    { id: "harvey_milk", date: iso(y, 5, 22), theme: null, scope: "ca" },
    { id: "memorial", date: nthWeekday(y, 5, 1, -1), theme: null, scope: "us" },
    { id: "fathers_day", date: nthWeekday(y, 6, 0, 3), theme: "family", scope: "retail" },
    { id: "juneteenth", date: iso(y, 6, 19), theme: "festival", scope: "us" },
    { id: "independence", date: iso(y, 7, 4), theme: "family", scope: "us" },
    { id: "labor", date: nthWeekday(y, 9, 1, 1), theme: null, scope: "us" },
    { id: "indigenous", date: nthWeekday(y, 10, 1, 2), theme: null, scope: "ca" },
    { id: "halloween", date: iso(y, 10, 31), theme: "halloween", scope: "retail" },
    { id: "dia_de_muertos", date: iso(y, 11, 2), theme: "festival", scope: "cultural" },
    { id: "veterans", date: iso(y, 11, 11), theme: null, scope: "us" },
    { id: "thanksgiving", date: nthWeekday(y, 11, 4, 4), theme: "family", scope: "us" },
    { id: "small_business_saturday", date: addDays(nthWeekday(y, 11, 4, 4), 2), theme: null, scope: "retail" },
    { id: "christmas_eve", date: iso(y, 12, 24), theme: "family", scope: "retail" },
    { id: "christmas", date: iso(y, 12, 25), theme: "family", scope: "us" },
    { id: "new_years_eve", date: iso(y, 12, 31), theme: "festival", scope: "retail" },
  ];
  const lunarTheme: Record<string, ThemeKey> = { lunar_new_year: "family", lantern: "festival", dragon_boat: "festival", mid_autumn: "family", diwali: "festival" };
  for (const [id, byYear] of Object.entries(LUNAR)) if (byYear[y]) h.push({ id, date: byYear[y], theme: lunarTheme[id], scope: "cultural" });
  return h;
}

/** Holidays from `from` (inclusive) for `days` days, sorted by date. Dates are plain calendar dates (no time zone). */
export function upcomingHolidays(from: string, days: number): Holiday[] {
  const to = addDays(from, days);
  const y = Number(from.slice(0, 4));
  return [...holidaysForYear(y), ...holidaysForYear(y + 1)].filter((h) => h.date >= from && h.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

/** Today's calendar date in the restaurant's time zone. */
export function localToday(now = new Date(), timeZone = "America/Los_Angeles"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export { addDays };

/** Whole days a pass must run so it covers the moment's date (end of that day, Pacific), capped to the schema limit. */
export function daysToCover(momentDate: string, now = new Date(), cap = 120): number {
  const endOfDay = Date.parse(`${addDays(momentDate, 1)}T08:00:00Z`); // ~midnight Pacific (07:00 or 08:00 UTC)
  return Math.min(cap, Math.max(1, Math.ceil((endOfDay - now.getTime()) / 86400_000)));
}

// ---------- crowd fit ----------
function vec(a: Pick<AudienceAffinity, "age" | "gender">): number[] {
  const g = a.gender.female ?? (a.gender.male !== undefined ? -a.gender.male : 0);
  return [...AGE_BUCKETS.map((b) => a.age[b] ?? 0), g];
}
export type FitLevel = "strong" | "some" | "different";
/**
 * Cosine similarity between two Qloo age+gender skew vectors, in [-1, 1].
 * It compares who likes this kind of event with who likes your cuisine. It is not attendance and not a forecast.
 */
export function crowdFit(event: Pick<AudienceAffinity, "age" | "gender">, yours: Pick<AudienceAffinity, "age" | "gender">): { score: number; level: FitLevel } | null {
  const a = vec(event), b = vec(yours);
  const na = Math.hypot(...a), nb = Math.hypot(...b);
  if (na === 0 || nb === 0) return null;
  const score = Math.round((a.reduce((s, v, i) => s + v * b[i], 0) / (na * nb)) * 100) / 100;
  return { score, level: score >= 0.5 ? "strong" : score >= 0.1 ? "some" : "different" };
}

// ---------- geography ----------
/** Approximate neighborhood centers in San Francisco, used only to sort nearby events by distance. */
const SF_CENTERS: Record<string, [number, number]> = {
  "inner sunset": [37.7625, -122.466], "outer sunset": [37.755, -122.494], "sunset": [37.7535, -122.4835], "inner richmond": [37.78, -122.464],
  "outer richmond": [37.777, -122.495], "richmond": [37.779, -122.48], "mission": [37.7599, -122.4148], "castro": [37.7609, -122.435],
  "noe valley": [37.7502, -122.4337], "haight-ashbury": [37.7692, -122.4481], "haight": [37.7692, -122.4481], "hayes valley": [37.7759, -122.4245],
  "north beach": [37.8061, -122.4103], "chinatown": [37.7941, -122.4078], "japantown": [37.7854, -122.4294], "marina": [37.8037, -122.4368],
  "soma": [37.7785, -122.4056], "south of market": [37.7785, -122.4056], "financial district": [37.7946, -122.3999], "nob hill": [37.793, -122.4161],
  "pacific heights": [37.7925, -122.4382], "bernal heights": [37.7389, -122.4152], "potrero hill": [37.7585, -122.4007], "dogpatch": [37.7605, -122.388],
  "tenderloin": [37.7847, -122.4141], "excelsior": [37.7244, -122.4272], "glen park": [37.734, -122.433], "west portal": [37.7406, -122.466],
  "russian hill": [37.8011, -122.4194], "western addition": [37.78, -122.433], "fillmore": [37.7843, -122.4327], "bayview": [37.729, -122.392],
};
export const SF_CENTER: [number, number] = [37.7749, -122.4194];
export function isSanFrancisco(city?: string | null) { return /^san francisco$|^sf$/i.test((city ?? "").trim()); }
export function neighborhoodCenter(neighborhood?: string | null): [number, number] | null {
  const k = (neighborhood ?? "").trim().toLowerCase();
  return SF_CENTERS[k] ?? null;
}
export function milesBetween(a: [number, number], b: [number, number]): number {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
