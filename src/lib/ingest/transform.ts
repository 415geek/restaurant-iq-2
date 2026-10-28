import { DELIVERY_PLATFORMS, MONEY_TARGETS, PLATFORMS, type Channel, type ColumnMapping, type NormalizedRecord, type Platform } from "./schema";

/** Deterministic conversion of mapped rows into unified records. No AI here: parsing rules only. */
export function parseMoney(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-|^\$\s*-|-\s*\$/.test(s);
  const num = Number(s.replace(/[()$€£¥,\s-]/g, ""));
  if (!Number.isFinite(num)) return null;
  return Math.round((neg ? -num : num) * 100) / 100;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
interface Parts { y: number; m: number; d: number; h: number; mi: number; s: number; offsetMin?: number }
/** True when a slash-date column is day-first (any value whose first part is above 12, e.g. 25/10/2026). */
export function detectDayFirst(values: string[]): boolean {
  return values.some((v) => { const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/); return !!m && +m[1] > 12 && +m[2] <= 12; });
}
export function parseDateParts(v: string, dayFirst = false): Pick<Parts, "y" | "m" | "d"> | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return dayFirst ? { y, m: +m[2], d: +m[1] } : { y, m: +m[1], d: +m[2] }; }
  m = s.match(/^(?:[A-Za-z]{3,9},? )?([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})/);
  if (m) { const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); if (mi >= 0) return { y: +m[3], m: mi + 1, d: +m[2] }; }
  if (/^\d{5}(\.\d+)?$/.test(s)) { const dt = new Date(Math.round((+s - 25569) * 86400_000)); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }; } // Excel serial
  return null;
}
export function parseTimeParts(v: string): Pick<Parts, "h" | "mi" | "s"> | null {
  const m = v.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1]; if (m[4]) { h = h % 12; if (/pm/i.test(m[4])) h += 12; }
  return h < 24 && +m[2] < 60 ? { h, mi: +m[2], s: m[3] ? +m[3] : 0 } : null;
}
function offsetFor(utcMs: number, tz: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60000;
}
/** Wall-clock time in the restaurant's zone → UTC ISO. Explicit offsets (Z, +02:00) in the value win. */
export function toUtcIso(dateStr: string, timeStr: string | undefined, tz: string, dayFirst = false): string | null {
  const iso = dateStr.trim().match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i);
  if (iso) { const t = Date.parse(dateStr.trim().replace(" ", "T")); return Number.isFinite(t) ? new Date(t).toISOString() : null; }
  const d = parseDateParts(dateStr, dayFirst); if (!d) return null;
  const t = parseTimeParts(timeStr ?? dateStr.replace(/^\S+/, "")) ?? { h: 12, mi: 0, s: 0 };
  if (d.m < 1 || d.m > 12 || d.d < 1 || d.d > 31) return null;
  const guess = Date.UTC(d.y, d.m - 1, d.d, t.h, t.mi, t.s);
  const utc = guess - offsetFor(guess, tz) * 60000;
  return new Date(utc - (offsetFor(utc, tz) - offsetFor(guess, tz)) * 60000).toISOString();
}

export function normalizePlatform(v: string | undefined, fallback: Platform): Platform {
  const s = (v ?? "").toLowerCase();
  if (/doordash/.test(s)) return "doordash"; if (/uber/.test(s)) return "ubereats"; if (/grubhub|seamless/.test(s)) return "grubhub";
  if (/toast/.test(s)) return "toast"; if (/clover/.test(s)) return "clover"; if (/square/.test(s)) return "square";
  return (PLATFORMS as readonly string[]).includes(s) ? (s as Platform) : fallback;
}
export function normalizeChannel(v: string | undefined, platform: Platform): Channel {
  const s = (v ?? "").toLowerCase();
  if (/deliver|doordash|uber|grubhub|domicilio|entrega|外卖|配送|送餐/.test(s)) return "delivery";
  if (/pick ?up|take ?out|to ?go|carry|curbside|llevar|recoger|自取|打包|外带/.test(s)) return "takeout";
  if (/dine|for here|table|eat in|in-?store|en el local|comer aqu|mesa|堂食|店内/.test(s)) return "dine_in";
  if (/cater/.test(s)) return "catering";
  return DELIVERY_PLATFORMS.includes(platform) ? "delivery" : "unknown";
}
const normStatus = (v: string | undefined): NormalizedRecord["status"] => { const s = (v ?? "").toLowerCase(); return /refund/.test(s) ? "refunded" : /cancel|void|reject|fail/.test(s) ? "cancelled" : "completed"; };

export type RejectReason = "no_date" | "no_amount";
export function applyMapping(rows: string[][], headers: string[], mapping: ColumnMapping[], opts: { platform: Platform; tz: string }): { records: NormalizedRecord[]; rejected: Array<{ row: number; reason: RejectReason }> } {
  const col = (t: string) => { const m = mapping.find((x) => x.target === t); return m ? headers.indexOf(m.column) : -1; };
  const idx = Object.fromEntries(["ordered_at", "ordered_date", "ordered_time", "order_id", "platform", "channel", "item_name", "quantity", "status", ...MONEY_TARGETS].map((t) => [t, col(t)]));
  const get = (r: string[], t: string) => (idx[t] >= 0 ? r[idx[t]] : undefined);
  const records: NormalizedRecord[] = []; const rejected: Array<{ row: number; reason: RejectReason }> = [];
  const dateCol = idx.ordered_at >= 0 ? idx.ordered_at : idx.ordered_date;
  const dayFirst = dateCol >= 0 && detectDayFirst(rows.map((r) => r[dateCol] ?? ""));
  rows.forEach((r, i) => {
    const at = get(r, "ordered_at") ? toUtcIso(get(r, "ordered_at")!, undefined, opts.tz, dayFirst) : get(r, "ordered_date") ? toUtcIso(get(r, "ordered_date")!, get(r, "ordered_time"), opts.tz, dayFirst) : null;
    if (!at) { rejected.push({ row: i + 1, reason: "no_date" }); return; }
    const money = Object.fromEntries(MONEY_TARGETS.map((t) => {
      const cols = mapping.filter((m) => m.target === t).map((m) => headers.indexOf(m.column)).filter((i) => i >= 0);
      const vals = cols.map((i) => parseMoney(r[i])).filter((v): v is number => v !== null);
      return [t, vals.length ? Math.round(vals.reduce((a, b) => a + (t === "platform_fees" || t === "discounts" ? Math.abs(b) : b), 0) * 100) / 100 : null];
    })) as Record<(typeof MONEY_TARGETS)[number], number | null>;
    const item = get(r, "item_name")?.trim().slice(0, 120) || null;
    if (MONEY_TARGETS.every((t) => money[t] === null) && !item) { rejected.push({ row: i + 1, reason: "no_amount" }); return; }
    if (money.net_sales === null && money.gross_sales !== null) money.net_sales = Math.round((money.gross_sales - Math.abs(money.discounts ?? 0)) * 100) / 100;
    if (money.platform_fees !== null) money.platform_fees = Math.abs(money.platform_fees);
    if (money.discounts !== null) money.discounts = Math.abs(money.discounts);
    const platform = normalizePlatform(get(r, "platform"), opts.platform);
    const q = get(r, "quantity") ? Number(String(get(r, "quantity")).replace(/,/g, "")) : NaN;
    records.push({
      platform, channel: normalizeChannel(get(r, "channel"), platform), order_id: get(r, "order_id")?.trim().slice(0, 80) || null, ordered_at: at,
      item_name: item, quantity: Number.isFinite(q) ? q : null, ...money, status: normStatus(get(r, "status")), row_ref: i + 1,
    });
  });
  return { records, rejected };
}
