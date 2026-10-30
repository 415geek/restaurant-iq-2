import { analyzeSales, type SalesRow } from "@/lib/ingest/analyze";

/**
 * Pass experiment review: compare the pass window with the same local weekdays and hours in the 4 weeks before it.
 * Pure arithmetic over the owner's uploaded sales. It never claims the pass caused a change; it only says whether
 * the window sits inside or outside what the prior weeks looked like.
 */
export type MetricKey = "orders" | "netSales" | "itemUnits";
export interface WindowStats { start: string; end: string; orders: number; netSales: number; itemUnits: number | null }
export interface MetricRow { key: MetricKey; pass: number; mean: number; min: number; max: number; delta: number | null; position: "above" | "below" | "within" }
export type ReviewStatus = "not_started" | "awaiting_sales" | "short_history" | "ready";
export interface ExperimentReview {
  status: ReviewStatus;
  /** the window actually compared (pass start → earliest of pass end, now, last sales row) */
  window: { start: string; end: string } | null;
  /** true when sales data stops before the pass ends, so only part of the pass is reviewed */
  partial: boolean;
  dataFrom: string | null; dataTo: string | null;
  pass: WindowStats | null; baselines: WindowStats[];
  metrics: MetricRow[];
  itemFound: boolean;
  redeemed: number;
  extraOrdersVsMean: number | null;
}

export const BASELINE_WEEKS = 4;
const MIN_BASELINES = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Offset of `tz` from UTC (ms) at instant `t`. */
function tzOffset(t: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}
/** Same local wall-clock time `days` earlier (DST-safe: 7 days back is always the same weekday and hour). */
export function shiftLocalDays(t: number, days: number, tz: string) {
  const wall = t + tzOffset(t, tz) - days * 86400_000;
  let utc = wall - tzOffset(wall, tz);
  utc = wall - tzOffset(utc, tz);
  return utc;
}
/** Start of the local calendar day containing instant `t` (UTC ms). */
export function localDayStart(t: number, tz: string) {
  const wall = t + tzOffset(t, tz); const mid = wall - (((wall % 86400_000) + 86400_000) % 86400_000);
  let utc = mid - tzOffset(mid, tz); utc = mid - tzOffset(utc, tz); return utc;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function stats(rows: SalesRow[], s: number, e: number, tz: string, item: string | null): WindowStats {
  const inWin = rows.filter((r) => { const t = Date.parse(r.ordered_at); return t >= s && t < e; });
  const a = analyzeSales(inWin, tz);
  const itemUnits = item === null ? null : r2(inWin.filter((r) => r.status === "completed" && r.grain !== "day" && r.item_name && norm(r.item_name) === item).reduce((n, r) => n + (r.quantity ?? 1), 0));
  return { start: new Date(s).toISOString(), end: new Date(e).toISOString(), orders: a.orders, netSales: a.netSales, itemUnits };
}

export function reviewExperiment(i: { rows: SalesRow[]; startsAt: string; endsAt: string; now?: number; menuItem: string; redeemed: number; tz: string }): ExperimentReview {
  const done = i.rows.filter((r) => r.status === "completed");
  const times = done.map((r) => Date.parse(r.ordered_at)).sort((a, b) => a - b);
  const dataFrom = times.length ? times[0] : null; const dataTo = times.length ? times[times.length - 1] : null;
  const base: ExperimentReview = { status: "not_started", window: null, partial: false, dataFrom: dataFrom === null ? null : new Date(dataFrom).toISOString(), dataTo: dataTo === null ? null : new Date(dataTo).toISOString(), pass: null, baselines: [], metrics: [], itemFound: false, redeemed: i.redeemed, extraOrdersVsMean: null };
  const start = Date.parse(i.startsAt); const passEnd = Math.min(Date.parse(i.endsAt), i.now ?? Date.now());
  if (passEnd <= start) return base;
  if (dataTo === null || dataTo < start) return { ...base, status: "awaiting_sales", window: { start: new Date(start).toISOString(), end: new Date(passEnd).toISOString() } };
  const end = Math.min(passEnd, dataTo + 1000);
  const window = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
  const partial = end < passEnd;
  const firstDay = localDayStart(dataFrom!, i.tz);
  const shifts = Array.from({ length: BASELINE_WEEKS }, (_, k) => 7 * (k + 1)).filter((d) => shiftLocalDays(start, d, i.tz) >= firstDay);
  const lineLevel = done.some((r) => r.item_name);
  const item = norm(i.menuItem);
  const itemFound = lineLevel && done.some((r) => r.item_name && norm(r.item_name) === item);
  const key = itemFound ? item : null;
  if (shifts.length < MIN_BASELINES) return { ...base, status: "short_history", window, partial, itemFound };
  const pass = stats(done, start, end, i.tz, key);
  const baselines = shifts.map((d) => stats(done, shiftLocalDays(start, d, i.tz), shiftLocalDays(end, d, i.tz), i.tz, key));
  const keys: MetricKey[] = key ? ["orders", "netSales", "itemUnits"] : ["orders", "netSales"];
  const metrics = keys.map((k): MetricRow => {
    const v = (w: WindowStats) => (w[k] ?? 0) as number;
    const b = baselines.map(v); const mean = r2(b.reduce((s, x) => s + x, 0) / b.length); const min = Math.min(...b); const max = Math.max(...b); const p = v(pass);
    return { key: k, pass: p, mean, min, max, delta: mean > 0 ? r2((p - mean) / mean) : null, position: p > max ? "above" : p < min ? "below" : "within" };
  });
  return { ...base, status: "ready", window, partial, pass, baselines, metrics, itemFound, extraOrdersVsMean: r2(pass.orders - metrics[0].mean) };
}
