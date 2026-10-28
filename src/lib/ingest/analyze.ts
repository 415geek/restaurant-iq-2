import { DELIVERY_PLATFORMS, type Channel, type Platform } from "./schema";

/** Deterministic operating analysis over unified sales records. Every number here is arithmetic; nothing is estimated by AI. */
export interface SalesRow { platform: string; channel: string; order_id: string | null; ordered_at: string; item_name: string | null; quantity: number | null; gross_sales: number | null; net_sales: number | null; platform_fees: number | null; payout: number | null; discounts: number | null; status: string; grain?: "order" | "line" | "day"; has_time?: boolean }

export interface Analysis {
  rows: number; orders: number; netSales: number; avgTicket: number | null; from: string | null; to: string | null; weeks: number;
  byPlatform: Array<{ platform: Platform; orders: number; netSales: number; fees: number; feeRate: number | null; share: number }>;
  byChannel: Array<{ channel: Channel; orders: number; share: number }>;
  heat: number[][]; // [weekday 0=Sun][hour] average orders per week
  openHours: number[]; // hours with any orders
  slow: Array<{ weekday: number; hour: number; avg: number; vsMedian: number }>;
  peak: { weekday: number; hour: number; avg: number } | null;
  topItems: Array<{ name: string; qty: number; netSales: number }>;
  lineLevel: boolean;
  /** daily summary rows used for sales totals only (days with no order-level data); never counted as orders */
  summaryDays: number;
  /** orders without a time of day: counted, but kept out of the weekday × hour view */
  untimedOrders: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
function local(iso: string, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", weekday: "short", hour: "2-digit" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), hour: Number(p.hour) % 24 };
}

const localDay = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function analyzeSales(all: SalesRow[], tz = "America/Los_Angeles"): Analysis {
  const completed = all.filter((r) => r.status === "completed");
  const rows = completed.filter((r) => r.grain !== "day");
  // A daily summary only fills days that have no order-level rows for that platform; otherwise the same sales would count twice.
  const covered = new Set(rows.map((r) => `${r.platform}|${localDay(r.ordered_at, tz)}`));
  const summaries = completed.filter((r) => r.grain === "day" && !covered.has(`${r.platform}|${localDay(r.ordered_at, tz)}`));
  const lineLevel = rows.some((r) => r.item_name);
  // One "order" = distinct order id when present, else one row (order-level exports).
  const orderKey = (r: SalesRow, i: number) => (r.order_id ? `${r.platform}|${r.order_id}` : `row${i}`);
  const orders = new Map<string, { platform: string; channel: string; at: string; net: number; fees: number; timed: boolean }>();
  rows.forEach((r, i) => {
    const k = orderKey(r, i); const o = orders.get(k) ?? { platform: r.platform, channel: r.channel, at: r.ordered_at, net: 0, fees: 0, timed: r.has_time !== false };
    o.net += r.net_sales ?? r.gross_sales ?? 0; o.fees += r.platform_fees ?? 0; orders.set(k, o);
  });
  const list = [...orders.values()];
  const times = list.map((o) => o.at).sort();
  const from = times[0] ?? null, to = times[times.length - 1] ?? null;
  const weeks = from && to ? Math.max(1, (Date.parse(to) - Date.parse(from)) / (7 * 86400_000)) : 1;
  const summaryNet = summaries.reduce((s, r) => s + (r.net_sales ?? r.gross_sales ?? 0), 0);
  const orderNet = list.reduce((s, o) => s + o.net, 0);
  const netSales = r2(orderNet + summaryNet);
  const grossBy = new Map<string, number>();
  [...rows, ...summaries].forEach((r) => grossBy.set(r.platform, (grossBy.get(r.platform) ?? 0) + (r.gross_sales ?? r.net_sales ?? 0)));

  const byPlatformMap = new Map<string, { orders: number; netSales: number; fees: number }>();
  for (const o of list) { const p = byPlatformMap.get(o.platform) ?? { orders: 0, netSales: 0, fees: 0 }; p.orders++; p.netSales += o.net; p.fees += o.fees; byPlatformMap.set(o.platform, p); }
  for (const r of summaries) { const p = byPlatformMap.get(r.platform) ?? { orders: 0, netSales: 0, fees: 0 }; p.netSales += r.net_sales ?? r.gross_sales ?? 0; p.fees += r.platform_fees ?? 0; byPlatformMap.set(r.platform, p); }
  const byPlatform = [...byPlatformMap].map(([platform, v]) => ({ platform: platform as Platform, orders: v.orders, netSales: r2(v.netSales), fees: r2(v.fees), feeRate: v.fees > 0 && (grossBy.get(platform) ?? 0) > 0 ? r2(v.fees / grossBy.get(platform)!) : null, share: list.length ? r2(v.orders / list.length) : 0 })).sort((a, b) => b.orders - a.orders);
  const chMap = new Map<string, number>(); for (const o of list) chMap.set(o.channel, (chMap.get(o.channel) ?? 0) + 1);
  const byChannel = [...chMap].map(([channel, n]) => ({ channel: channel as Channel, orders: n, share: r2(n / Math.max(1, list.length)) })).sort((a, b) => b.orders - a.orders);

  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const timed = list.filter((o) => o.timed);
  for (const o of timed) { const l = local(o.at, tz); heat[l.weekday][l.hour] += 1; }
  for (const d of heat) for (let h = 0; h < 24; h++) d[h] = r2(d[h] / weeks);
  const openHours = Array.from({ length: 24 }, (_, h) => h).filter((h) => heat.some((d) => d[h] > 0));
  const cells = heat.flatMap((d, w) => openHours.map((h) => ({ weekday: w, hour: h, avg: d[h] })));
  const sorted = [...cells].map((c) => c.avg).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  // Slow windows: open hours (with at least one order somewhere in the week) that sit lowest, excluding the first/last open hour (prep/close).
  const inner = openHours.slice(1, -1);
  const slow = cells.filter((c) => inner.includes(c.hour) && median > 0).sort((a, b) => a.avg - b.avg).slice(0, 3).map((c) => ({ ...c, vsMedian: r2(c.avg / median) }));
  const peak = cells.length ? cells.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;

  const items = new Map<string, { qty: number; net: number }>();
  for (const r of rows) if (r.item_name) { const it = items.get(r.item_name) ?? { qty: 0, net: 0 }; it.qty += r.quantity ?? 1; it.net += r.net_sales ?? r.gross_sales ?? 0; items.set(r.item_name, it); }
  const topItems = [...items].map(([name, v]) => ({ name, qty: r2(v.qty), netSales: r2(v.net) })).sort((a, b) => b.netSales - a.netSales).slice(0, 5);

  return { summaryDays: new Set(summaries.map((r) => `${r.platform}|${localDay(r.ordered_at, tz)}`)).size, untimedOrders: list.length - timed.length,
    rows: all.length, orders: list.length, netSales, avgTicket: list.length ? r2(orderNet / list.length) : null, from, to, weeks: r2(weeks), byPlatform, byChannel, heat, openHours, slow, peak, topItems, lineLevel };
}

export type ActionKind = "fill_slow_window" | "shift_from_delivery" | "feature_top_item";
export interface SuggestedAction { kind: ActionKind; params: Record<string, string | number> }
/** Rule-based next steps from the analysis. Each one opens an existing flow (TastePass form); nothing runs automatically. */
export function suggestActions(a: Analysis): SuggestedAction[] {
  const out: SuggestedAction[] = [];
  const s = a.slow[0];
  if (s && a.orders - a.untimedOrders >= 20) out.push({ kind: "fill_slow_window", params: { weekday: s.weekday, hour: s.hour, avg: s.avg, vsMedian: s.vsMedian } });
  const del = a.byPlatform.filter((p) => DELIVERY_PLATFORMS.includes(p.platform) && p.feeRate !== null).sort((x, y) => (y.feeRate ?? 0) - (x.feeRate ?? 0))[0];
  if (del && (del.feeRate ?? 0) >= 0.15) out.push({ kind: "shift_from_delivery", params: { platform: del.platform, feeRate: del.feeRate!, orders: del.orders, fees: del.fees } });
  if (a.topItems[0]) out.push({ kind: "feature_top_item", params: { item: a.topItems[0].name, qty: a.topItems[0].qty } });
  return out;
}
