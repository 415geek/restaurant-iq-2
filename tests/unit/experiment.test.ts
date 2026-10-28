import { describe, expect, it } from "vitest";
import { reviewExperiment, shiftLocalDays } from "@/lib/business/experiment";
import type { SalesRow } from "@/lib/ingest/analyze";

const TZ = "America/Los_Angeles";
let n = 0;
const row = (iso: string, net = 10, item: string | null = null): SalesRow => ({ platform: "square", channel: "dine_in", order_id: `o${n++}`, ordered_at: iso, item_name: item, quantity: 1, gross_sales: net, net_sales: net, platform_fees: null, payout: null, discounts: null, status: "completed", grain: item ? "line" : "order", has_time: true });
// Tuesdays 3pm PT (22:00Z in PDT) for 5 weeks: Sep 29, Oct 6, 13, 20, 27
const tue = ["2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"];
const at = (d: string) => `${d}T22:00:00Z`;
const base = { startsAt: "2026-10-27T21:00:00Z", endsAt: "2026-10-27T23:00:00Z", now: Date.parse("2026-11-01T00:00:00Z"), menuItem: "Cucumber Salad", redeemed: 3, tz: TZ };

describe("reviewExperiment", () => {
  it("compares the pass window with the same hours in prior weeks", () => {
    const rows = tue.flatMap((d, i) => Array.from({ length: i === 4 ? 9 : 3 + i % 2 }, () => row(at(d), 10, "Cucumber Salad")));
    const r = reviewExperiment({ ...base, rows });
    expect(r.status).toBe("ready");
    expect(r.baselines).toHaveLength(4);
    const o = r.metrics.find((m) => m.key === "orders")!;
    expect(o.pass).toBe(9); expect(o.min).toBe(3); expect(o.max).toBe(4); expect(o.mean).toBe(3.5);
    expect(o.position).toBe("above"); expect(o.delta).toBeCloseTo(1.57, 2);
    expect(r.metrics.find((m) => m.key === "itemUnits")?.pass).toBe(9);
    expect(r.extraOrdersVsMean).toBe(5.5);
  });
  it("says 'within' when the window looks like a normal week", () => {
    const rows = tue.flatMap((d, i) => Array.from({ length: [3, 5, 4, 6, 4][i] }, () => row(at(d))));
    expect(reviewExperiment({ ...base, rows }).metrics[0].position).toBe("within");
  });
  it("waits for sales that cover the pass window instead of guessing", () => {
    const rows = tue.slice(0, 4).map((d) => row(at(d)));
    const r = reviewExperiment({ ...base, rows });
    expect(r.status).toBe("awaiting_sales"); expect(r.metrics).toEqual([]);
  });
  it("needs at least two prior weeks", () => {
    const rows = tue.slice(3).map((d) => row(at(d)));
    expect(reviewExperiment({ ...base, rows }).status).toBe("short_history");
  });
  it("has not started before the pass starts", () => {
    expect(reviewExperiment({ ...base, rows: [], now: Date.parse("2026-10-01T00:00:00Z") }).status).toBe("not_started");
  });
  it("drops item units when the item never appears in uploaded data", () => {
    const rows = tue.map((d) => row(at(d), 10, "Beef Noodle Soup"));
    const r = reviewExperiment({ ...base, rows });
    expect(r.itemFound).toBe(false); expect(r.metrics.map((m) => m.key)).toEqual(["orders", "netSales"]);
  });
  it("marks a partial review when sales stop before the pass ends", () => {
    const rows = tue.map((d) => row(at(d)));
    const r = reviewExperiment({ ...base, endsAt: "2026-11-03T23:00:00Z", rows });
    expect(r.partial).toBe(true); expect(r.status).toBe("ready");
  });
  it("shifts by local calendar days across the DST change", () => {
    // Nov 3 2026 3pm PST (23:00Z) → one week earlier is Oct 27 3pm PDT (22:00Z)
    expect(new Date(shiftLocalDays(Date.parse("2026-11-03T23:00:00Z"), 7, TZ)).toISOString()).toBe("2026-10-27T22:00:00.000Z");
  });
});
