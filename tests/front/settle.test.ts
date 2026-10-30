import { describe, expect, it } from "vitest";
import { settleWeek } from "@/lib/front/settle";
import type { SalesRow } from "@/lib/ingest/analyze";

const TZ = "America/Los_Angeles";
let n = 0;
const row = (iso: string, net = 10, item: string | null = null): SalesRow => ({ platform: "square", channel: "dine_in", order_id: `o${n++}`, ordered_at: iso, item_name: item, quantity: 1, gross_sales: net, net_sales: net, platform_fees: null, payout: null, discounts: null, status: "completed", grain: item ? "line" : "order", has_time: true });
// Weeks start Thursday 00:00 local: Oct 1, 8, 15, 22 (prior), Oct 29 (change, crosses DST), Nov 5 (control)
const changeWindow = { start: "2026-10-29T07:00:00Z", end: "2026-11-05T08:00:00Z" };
const controlWindow = { start: "2026-11-05T08:00:00Z", end: "2026-11-12T08:00:00Z" };
/** `orders` rows on the Thursday afternoon plus one on the following Wednesday (the window's last local day). */
const week = (thu: string, wed: string, orders: number, item: string | null = null) => [...Array.from({ length: orders }, () => row(`${thu}T22:00:00Z`, 10, item)), row(`${wed}T20:00:00Z`)];
const priors = [["2026-10-01", "2026-10-07", 3], ["2026-10-08", "2026-10-14", 4], ["2026-10-15", "2026-10-21", 3], ["2026-10-22", "2026-10-28", 4]] as const;
const priorRows = () => priors.flatMap(([t, w, o]) => week(t, w, o));
const changeRows = (item: string | null = null) => week("2026-10-29", "2026-11-04", 8, item);
const controlRows = (item: string | null = null) => week("2026-11-05", "2026-11-11", 4, item);
const base = { kind: "week_alternate" as const, changeWindow, controlWindow, tz: TZ, featuredItems: ["Cucumber Salad"], now: Date.parse("2026-11-20T00:00:00Z"), synthetic: true };

describe("settleWeek week_alternate", () => {
  it("is ready: lift equals change − control, featured units count only the named item, extreme week has flukeRate 0.2", () => {
    const rows = [...priorRows(), ...changeRows("Cucumber Salad"), ...controlRows("Beef Noodle Soup")];
    const s = settleWeek({ ...base, rows });
    expect(s.status).toBe("ready"); expect(s.holdoutKind).toBe("week_alternate"); expect(s.controlLabel).toBe("Control week (no changes)");
    expect(s.window).toEqual({ start: "2026-10-29T07:00:00.000Z", end: "2026-11-05T08:00:00.000Z" });
    const o = s.metrics.find((m) => m.key === "orders")!;
    expect(o.change).toBe(9); expect(o.control).toBe(5); expect(o.priorMin).toBe(4); expect(o.priorMax).toBe(5); expect(o.position).toBe("above"); expect(o.delta).toBe(0.8);
    const ns = s.metrics.find((m) => m.key === "netSales")!;
    expect(ns.change).toBe(90); expect(ns.control).toBe(50);
    expect(s.netSalesLiftUsd).toBe(40);
    const f = s.metrics.find((m) => m.key === "featuredUnits")!;
    expect(f.change).toBe(8); expect(f.control).toBe(0); expect(f.priorMax).toBe(0); expect(f.delta).toBeNull();
    expect(s.flukeRate).toBe(0.2); expect(s.synthetic).toBe(true); expect(s.dataTo).toBe("2026-11-11T20:00:00.000Z");
  });
  it("has no flukeRate when the change week sits within the prior range and drops featured units without line rows", () => {
    const rows = [...priorRows(), ...week("2026-10-29", "2026-11-04", 3), ...controlRows()];
    const s = settleWeek({ ...base, rows });
    expect(s.status).toBe("ready"); expect(s.metrics[0].position).toBe("within"); expect(s.flukeRate).toBeNull();
    expect(s.metrics.map((m) => m.key)).toEqual(["orders", "netSales"]); expect(s.netSalesLiftUsd).toBe(-10);
  });
  it("waits for sales when the control week has no rows yet, without estimating", () => {
    const s = settleWeek({ ...base, rows: [...priorRows(), ...changeRows()] });
    expect(s.status).toBe("waiting_for_sales"); expect(s.metrics).toEqual([]); expect(s.netSalesLiftUsd).toBeNull(); expect(s.flukeRate).toBeNull();
    expect(s.dataTo).toBe("2026-11-04T20:00:00.000Z");
  });
  it("waits while the control window is still in the future even if rows exist", () => {
    const rows = [...priorRows(), ...changeRows(), ...controlRows()];
    expect(settleWeek({ ...base, rows, now: Date.parse("2026-11-10T00:00:00Z") }).status).toBe("waiting_for_sales");
  });
  it("reports short_history with only one prior week", () => {
    const rows = [...week("2026-10-22", "2026-10-28", 4), ...changeRows(), ...controlRows()];
    const s = settleWeek({ ...base, rows });
    expect(s.status).toBe("short_history"); expect(s.metrics).toEqual([]);
  });
});

describe("settleWeek store_split", () => {
  it("averages each arm per store over the same week", () => {
    const store = (change: number, prior: number) => [...priors.flatMap(([t, w]) => week(t, w, prior)), ...week("2026-10-29", "2026-11-04", change)];
    const rowsByStore = { a: store(10, 3), b: store(6, 3), c: store(4, 3), d: store(4, 3) };
    const s = settleWeek({ kind: "store_split", rowsByStore, assignment: { change: ["a", "b"], control: ["c", "d"] }, changeWindow, tz: TZ, featuredItems: [], now: base.now, synthetic: false });
    expect(s.status).toBe("ready"); expect(s.controlLabel).toBe("2 held-out stores (same week)");
    const o = s.metrics.find((m) => m.key === "orders")!;
    expect(o.change).toBe(9); expect(o.control).toBe(5); expect(o.priorMin).toBe(4); expect(o.priorMax).toBe(4); expect(o.position).toBe("above");
    expect(s.netSalesLiftUsd).toBe(40); expect(s.flukeRate).toBe(0.2); expect(s.synthetic).toBe(false);
  });
  it("waits when the change stores' week is not covered yet", () => {
    const rowsByStore = { a: priors.flatMap(([t, w]) => week(t, w, 3)), c: priors.flatMap(([t, w]) => week(t, w, 3)) };
    const s = settleWeek({ kind: "store_split", rowsByStore, assignment: { change: ["a"], control: ["c"] }, changeWindow, tz: TZ, featuredItems: [], now: base.now, synthetic: true });
    expect(s.status).toBe("waiting_for_sales"); expect(s.metrics).toEqual([]);
  });
});
