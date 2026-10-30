import { BASELINE_WEEKS, localDayStart, shiftLocalDays } from "@/lib/business/experiment";
import { analyzeSales, type SalesRow } from "@/lib/ingest/analyze";
import type { HoldoutKind, SettleMetric, Settlement } from "./types";

/**
 * Weekly settlement: change window vs. its holdout control, from the owner's sales rows only.
 * Pure arithmetic; it never estimates. If the sales do not reach the end of the later window, status is
 * "waiting_for_sales" with empty metrics; with fewer than 2 prior weeks it is "short_history".
 * Windows are half-open [start, end) ISO instants. Prior weeks are the same local weekday/hours 1..4 weeks earlier.
 *  - week_alternate: one store, change week vs. the following control week.
 *  - store_split: change stores vs. held-out stores in the same week. Both arms are divided by their store count,
 *    so every number (orders, net sales, featured units, lift) is a per-store average, not a brand total.
 */
export interface SettleWindow { start: string; end: string }
export type SettleInput =
  | { kind: "week_alternate"; rows: SalesRow[]; changeWindow: SettleWindow; controlWindow: SettleWindow; tz: string; featuredItems: string[]; now?: number; synthetic: boolean }
  | { kind: "store_split"; rowsByStore: Record<string, SalesRow[]>; assignment: { change: string[]; control: string[] }; changeWindow: SettleWindow; tz: string; featuredItems: string[]; now?: number; synthetic: boolean };

const MIN_PRIOR_WEEKS = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
interface Arm { orders: number; netSales: number; featuredUnits: number | null }

/** Totals for completed rows of one store inside [s, e); featuredUnits is null without line-level rows or featured items. */
function armStats(done: SalesRow[], s: number, e: number, tz: string, items: Set<string> | null): Arm {
  const inWin = done.filter((r) => { const t = Date.parse(r.ordered_at); return t >= s && t < e; });
  const a = analyzeSales(inWin, tz);
  const featuredUnits = items === null ? null : inWin.filter((r) => r.grain !== "day" && r.item_name && items.has(norm(r.item_name))).reduce((n, r) => n + (r.quantity ?? 1), 0);
  return { orders: a.orders, netSales: a.netSales, featuredUnits };
}
/** Per-store average over several stores' rows (orders are counted per store, so colliding order ids never merge). */
function avgArm(stores: SalesRow[][], s: number, e: number, tz: string, items: Set<string> | null): Arm {
  if (!stores.length) return { orders: 0, netSales: 0, featuredUnits: items === null ? null : 0 };
  const parts = stores.map((rows) => armStats(rows, s, e, tz, items)); const n = parts.length;
  const mean = (f: (a: Arm) => number) => r2(parts.reduce((t, a) => t + f(a), 0) / n);
  return { orders: mean((a) => a.orders), netSales: mean((a) => a.netSales), featuredUnits: items === null ? null : mean((a) => a.featuredUnits ?? 0) };
}

/** Settle one holdout week. Returns ready metrics, or a waiting/short-history status with nothing estimated. */
export function settleWeek(input: SettleInput): Settlement {
  const holdoutKind: HoldoutKind = input.kind; const tz = input.tz; const now = input.now ?? Date.now();
  const changeStores = input.kind === "week_alternate" ? [input.rows] : input.assignment.change.map((id) => input.rowsByStore[id] ?? []);
  const controlStores = input.kind === "week_alternate" ? [input.rows] : input.assignment.control.map((id) => input.rowsByStore[id] ?? []);
  const controlWindow = input.kind === "week_alternate" ? input.controlWindow : input.changeWindow;
  const controlLabel = input.kind === "week_alternate" ? "Control week (no changes)" : `${input.assignment.control.length} held-out stores (same week)`;
  const completed = (rows: SalesRow[]) => rows.filter((r) => r.status === "completed");
  const doneChange = changeStores.map(completed); const doneControl = controlStores.map(completed);
  const allTimes = [...doneChange, ...doneControl].flat().map((r) => Date.parse(r.ordered_at)).filter(Number.isFinite);
  const dataTo = allTimes.length ? Math.max(...allTimes) : null;
  const changeTimes = doneChange.flat().map((r) => Date.parse(r.ordered_at)).filter(Number.isFinite);
  const dataFrom = changeTimes.length ? Math.min(...changeTimes) : null;
  const cs = Date.parse(input.changeWindow.start); const ce = Date.parse(input.changeWindow.end);
  const ks = Date.parse(controlWindow.start); const ke = Date.parse(controlWindow.end);
  const window = { start: new Date(cs).toISOString(), end: new Date(ce).toISOString() };
  const base: Settlement = { status: "waiting_for_sales", holdoutKind, window, controlLabel, metrics: [], netSalesLiftUsd: null, flukeRate: null, synthetic: input.synthetic, dataTo: dataTo === null ? null : new Date(dataTo).toISOString() };
  // Covered = the later window has ended by `now` and a completed row falls on its final local day (or later).
  const laterEnd = Math.max(ce, ke);
  if (now < laterEnd || dataTo === null || dataTo < shiftLocalDays(laterEnd, 1, tz)) return base;
  const firstDay = localDayStart(dataFrom ?? dataTo, tz);
  const shifts = Array.from({ length: BASELINE_WEEKS }, (_, k) => 7 * (k + 1)).filter((d) => shiftLocalDays(cs, d, tz) >= firstDay);
  if (shifts.length < MIN_PRIOR_WEEKS) return { ...base, status: "short_history" };
  const lineLevel = doneChange.flat().some((r) => r.item_name) || doneControl.flat().some((r) => r.item_name);
  const items = lineLevel && input.featuredItems.length ? new Set(input.featuredItems.map(norm)) : null;
  const change = avgArm(doneChange, cs, ce, tz, items);
  const control = avgArm(doneControl, ks, ke, tz, items);
  const priors = shifts.map((d) => avgArm(doneChange, shiftLocalDays(cs, d, tz), shiftLocalDays(ce, d, tz), tz, items));
  const keys: SettleMetric["key"][] = items ? ["orders", "netSales", "featuredUnits"] : ["orders", "netSales"];
  const metrics = keys.map((key): SettleMetric => {
    const v = (a: Arm) => a[key] ?? 0; const c = v(change); const k = v(control); const p = priors.map(v);
    const priorMin = Math.min(...p); const priorMax = Math.max(...p);
    return { key, change: c, control: k, delta: k > 0 ? r2((c - k) / k) : null, priorMin, priorMax, position: c > priorMax ? "above" : c < priorMin ? "below" : "within" };
  });
  const extreme = metrics[0].position !== "within";
  return { ...base, status: "ready", metrics, netSalesLiftUsd: r2(change.netSales - control.netSales), flukeRate: extreme ? r2(1 / (priors.length + 1)) : null };
}
