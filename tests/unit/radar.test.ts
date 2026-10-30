import { describe, expect, it } from "vitest";
import { buildPlays, outlookFor, outsideCauses, schoolBreakAhead, schoolBreakOn, weeklyPulse, type RadarMoment } from "@/lib/business/radar";

const hol = (over: Partial<RadarMoment>): RadarMoment => ({ id: "h", kind: "holiday", name: "Holiday", date: "2026-11-11", theme: null, scope: "us", source: "calendar", ...over });
const ev = (over: Partial<RadarMoment>): RadarMoment => ({ id: "e", kind: "street", name: "Block party", date: "2026-11-07", theme: "family", miles: 0.4, source: "DataSF", ...over });

describe("radar outlook", () => {
  it("weekday federal holiday → offices closed, mixed", () => { expect(outlookFor(hol({ date: "2026-11-11" }))).toEqual({ key: "offices_closed", direction: "mixed" }); });
  it("weekend family holiday → family dinner", () => { expect(outlookFor(hol({ date: "2026-11-28", scope: "retail", theme: "family" })).key).toBe("family_dinner"); });
  it("cultural holiday → cultural menu", () => { expect(outlookFor(hol({ scope: "cultural", theme: "festival" })).key).toBe("cultural_menu"); });
  it("late-ending nearby event → late crowd", () => { expect(outlookFor(ev({ end: "22:00" })).key).toBe("late_crowd"); });
  it("festival theme → festival crowd; near event default → foot traffic; far → nearby", () => {
    expect(outlookFor(ev({ theme: "festival" })).key).toBe("festival_crowd");
    expect(outlookFor(ev({ theme: null })).key).toBe("foot_traffic");
    expect(outlookFor(ev({ theme: null, miles: 4 })).key).toBe("nearby");
  });
});

describe("school calendar heuristic", () => {
  it("knows winter, summer and Thanksgiving week", () => {
    expect(schoolBreakOn("2026-12-26")?.kind).toBe("winter");
    expect(schoolBreakOn("2027-01-02")?.kind).toBe("winter");
    expect(schoolBreakOn("2026-07-04")?.kind).toBe("summer");
    expect(schoolBreakOn("2026-11-25")?.kind).toBe("thanksgiving");
    expect(schoolBreakOn("2026-10-30")).toBeNull();
  });
  it("reports the upcoming break inside the horizon only", () => {
    expect(schoolBreakAhead("2026-11-10", 21)?.state).toBe("upcoming");
    expect(schoolBreakAhead("2026-10-30", 14)).toBeNull();
    expect(schoolBreakAhead("2026-12-22", 7)?.state).toBe("in_break");
  });
});

describe("weekly pulse", () => {
  const tz = "America/Los_Angeles";
  const row = (day: string, net: number, status = "completed") => ({ ordered_at: `${day}T19:00:00Z`, net_sales: net, status });
  it("no data → no_data", () => { expect(weeklyPulse([], "2026-10-30", tz).status).toBe("no_data"); });
  it("one prior week → short_history", () => {
    const rows = [...Array(14)].map((_, i) => row(`2026-10-${String(15 + i).padStart(2, "0")}`, 100));
    expect(weeklyPulse(rows, "2026-10-30", tz).status).toBe("short_history");
  });
  it("down week against four prior weeks, ignoring refunds", () => {
    const rows: ReturnType<typeof row>[] = [];
    for (let i = 0; i < 35; i++) { const d = new Date(Date.UTC(2026, 8, 25) + i * 86400_000).toISOString().slice(0, 10); rows.push(row(d, i >= 28 ? 60 : 100)); }
    rows.push(row("2026-10-29", 5000, "refunded"));
    const p = weeklyPulse(rows, "2026-10-30", tz);
    expect(p.status).toBe("ready"); expect(p.prior.length).toBe(4); expect(p.verdict).toBe("down"); expect(Math.round((p.pct ?? 0) * 100)).toBe(-40);
  });
});

describe("plays and causes", () => {
  const hyps = [
    { id: "a", slug: "weekday-lunch-set", rank: 1, evidenceLabel: "supported" },
    { id: "b", slug: "group-bundle", rank: 2, evidenceLabel: "supported" },
    { id: "c", slug: "late-night-window", rank: 3, evidenceLabel: "partially_supported" },
    { id: "d", slug: "bar-program", rank: 4, evidenceLabel: "not_recommended" },
  ];
  it("pairs a family moment with the group bundle, a festival with late night, and closes with the top idea", () => {
    const plays = buildPlays([ev({ id: "e1", theme: "family", date: "2026-11-07" }), ev({ id: "e2", theme: "festival", date: "2026-11-08", end: "23:00" }), ev({ id: "far", theme: "festival", date: "2026-11-09", miles: 9 })], hyps, "2026-10-30");
    expect(plays.map((p) => p.slug)).toEqual(["group-bundle", "late-night-window", "weekday-lunch-set"]);
    expect(plays[1].outlook?.key).toBe("late_crowd");
    expect(plays.at(-1)?.moment).toBeNull();
    expect(plays.some((p) => p.moment?.id === "far")).toBe(false);
  });
  it("returns nothing without viable ideas", () => { expect(buildPlays([ev({})], [hyps[3]], "2026-10-30")).toEqual([]); });
  it("names outside causes in priority order", () => {
    const causes = outsideCauses([hol({ date: "2026-11-11" }), ev({ end: "21:00" })], schoolBreakAhead("2026-11-10", 21), "2026-11-01");
    expect(causes.map((c) => c.key)).toEqual(["school_break_soon", "holiday_weekday", "events_near", "late_events"]);
  });
});
