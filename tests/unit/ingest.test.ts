import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { parseFile } from "@/lib/ingest/parse";
import { detectPlatform, headerFingerprint, mappingGaps, normHeader, ruleMapping } from "@/lib/ingest/rules";
import { applyMapping, parseMoney, toUtcIso } from "@/lib/ingest/transform";
import { analyzeSales, suggestActions } from "@/lib/ingest/analyze";

const load = (f: string) => { const p = parseFile(f, "", readFileSync(`public/samples/${f}`)); if (p.kind !== "table") throw new Error("not a table"); return p.tables[0]; };
const target = (m: ReturnType<typeof ruleMapping>, col: string) => m.find((x) => x.column === col)?.target;

describe("parsing", () => {
  it("money: currency, commas, parentheses and minus signs", () => {
    expect(parseMoney("$1,234.50")).toBe(1234.5);
    expect(parseMoney("($1.50)")).toBe(-1.5);
    expect(parseMoney("-8.62")).toBe(-8.62);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("n/a")).toBeNull();
  });
  it("wall-clock time in the restaurant zone becomes UTC (PDT and PST)", () => {
    expect(toUtcIso("9/14/2026", "11:41 AM", "America/Los_Angeles")).toBe("2026-09-14T18:41:00.000Z");
    expect(toUtcIso("2026-12-01", "18:00", "America/Los_Angeles")).toBe("2026-12-02T02:00:00.000Z");
    expect(toUtcIso("2026-09-14T10:00:00Z", undefined, "America/Los_Angeles")).toBe("2026-09-14T10:00:00.000Z");
    expect(toUtcIso("25/10/2026", "12:00", "America/Los_Angeles", true)).toBe("2026-10-25T19:00:00.000Z");
    expect(toUtcIso("not a date", undefined, "America/Los_Angeles")).toBeNull();
  });
  it("normalizes Spanish and Chinese headers", () => {
    expect(normHeader("Fecha")).toBe("date");
    expect(normHeader("订单号")).toBe("order id");
    expect(normHeader("Teléfono del cliente")).toContain("phone");
  });
});

describe("rule mapping on synthetic exports", () => {
  it("Square line items: dates, items, money, and the customer column is dropped as personal data", () => {
    const t = load("square-item-sales-sample.csv"); const m = ruleMapping(t.headers, t.rows);
    expect(detectPlatform("square-item-sales-sample.csv", t.headers)).toBe("square");
    expect(target(m, "Date")).toBe("ordered_date"); expect(target(m, "Time")).toBe("ordered_time");
    expect(target(m, "Item")).toBe("item_name"); expect(target(m, "Qty")).toBe("quantity");
    expect(target(m, "Gross Sales")).toBe("gross_sales"); expect(target(m, "Net Sales")).toBe("net_sales"); expect(target(m, "Discounts")).toBe("discounts");
    expect(target(m, "Transaction ID")).toBe("order_id"); expect(target(m, "Dining Option")).toBe("channel");
    expect(target(m, "Customer Name")).toBe("pii");
    expect(mappingGaps(m)).toEqual([]);
  });
  it("DoorDash orders: commission is a fee, net total is the payout, both name columns are personal data", () => {
    const t = load("doordash-orders-sample.csv"); const m = ruleMapping(t.headers, t.rows);
    expect(detectPlatform("doordash-orders-sample.csv", t.headers)).toBe("doordash");
    expect(target(m, "Commission")).toBe("platform_fees"); expect(target(m, "Net Total")).toBe("payout"); expect(target(m, "Subtotal")).toBe("gross_sales");
    expect(target(m, "Customer Name")).toBe("pii"); expect(target(m, "Dasher Name")).toBe("pii");
    expect(target(m, "DoorDash Order ID")).toBe("order_id"); expect(target(m, "Order Status")).toBe("status");
    expect(target(m, "Marketing Fees")).toBe("platform_fees");
    const { records } = applyMapping(t.rows, t.headers, m, { platform: "doordash", tz: "America/Los_Angeles" });
    const withMkt = t.rows.findIndex((r) => r[t.headers.indexOf("Marketing Fees")] === "-3.00");
    const rec = records.find((r) => r.row_ref === withMkt + 1)!;
    expect(rec.platform_fees).toBeCloseTo(Math.abs(Number(t.rows[withMkt][t.headers.indexOf("Commission")])) + 3, 2);
  });
  it("Spanish spreadsheet: maps without AI and reads day-first dates", () => {
    const t = load("ventas-muestra.xlsx"); const m = ruleMapping(t.headers, t.rows);
    expect(target(m, "Fecha")).toBe("ordered_date"); expect(target(m, "Pedido")).toBe("order_id"); expect(target(m, "Total")).toBe("gross_sales");
    expect(target(m, "Teléfono del cliente")).toBe("pii");
    const { records, rejected } = applyMapping(t.rows, t.headers, m, { platform: "other", tz: "America/Los_Angeles" });
    expect(rejected).toHaveLength(0);
    expect(records.every((r) => r.ordered_at >= "2026-10-12" && r.ordered_at < "2026-10-27")).toBe(true);
    expect(new Set(records.map((r) => r.channel))).toEqual(new Set(["takeout", "dine_in"]));
  });
  it("same header layout → same fingerprint regardless of order", () => {
    expect(headerFingerprint(["Date", "Total"])).toBe(headerFingerprint(["total", "date"]));
  });
});

describe("analysis (deterministic)", () => {
  const sq = load("square-item-sales-sample.csv"); const dd = load("doordash-orders-sample.csv");
  const recs = [
    ...applyMapping(sq.rows, sq.headers, ruleMapping(sq.headers, sq.rows), { platform: "square", tz: "America/Los_Angeles" }).records,
    ...applyMapping(dd.rows, dd.headers, ruleMapping(dd.headers, dd.rows), { platform: "doordash", tz: "America/Los_Angeles" }).records,
  ];
  const a = analyzeSales(recs);
  it("counts orders by distinct id, not lines", () => {
    expect(a.lineLevel).toBe(true);
    expect(a.orders).toBeLessThan(recs.length);
    expect(a.byPlatform.find((p) => p.platform === "doordash")?.feeRate).toBeGreaterThan(0.2);
  });
  it("finds the planted Tue/Wed afternoon dip and suggests acting on it and on delivery fees", () => {
    expect(a.slow.some((s) => (s.weekday === 2 || s.weekday === 3) && s.hour >= 14 && s.hour <= 16)).toBe(true);
    const kinds = suggestActions(a).map((x) => x.kind);
    expect(kinds).toContain("fill_slow_window"); expect(kinds).toContain("shift_from_delivery"); expect(kinds).toContain("feature_top_item");
  });
  it("cancelled orders are excluded", () => {
    const cancelled = recs.filter((r) => r.status === "cancelled").length;
    expect(cancelled).toBeGreaterThan(0);
    expect(analyzeSales(recs.filter((r) => r.status !== "cancelled")).orders).toBe(a.orders);
  });
});
