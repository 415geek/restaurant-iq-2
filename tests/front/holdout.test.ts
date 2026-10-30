import { describe, expect, it } from "vitest";
import { scheduleHoldout, splitSummary, stratify } from "@/lib/front/holdout";

const TZ = "America/Los_Angeles";
// Oct 29 2026 00:00 PDT; the change week crosses the Nov 1 PDT→PST switch
const START = "2026-10-29T07:00:00Z";
const stores = Array.from({ length: 12 }, (_, i) => ({ id: `s${String(i + 1).padStart(2, "0")}`, heat: (i * 7) % 12 }));

describe("scheduleHoldout week_alternate", () => {
  it("makes two 7-local-day windows that keep the wall-clock hour across DST", () => {
    const h = scheduleHoldout({ kind: "week_alternate", storeId: "st1", startsAt: START, tz: TZ });
    expect(h.kind).toBe("week_alternate"); expect(h.storeId).toBe("st1"); expect(h.brandId).toBeNull();
    expect(h.changeWindow).toEqual({ start: "2026-10-29T07:00:00.000Z", end: "2026-11-05T08:00:00.000Z" }); // 00:00 PDT → 00:00 PST
    expect(h.controlWindow).toEqual({ start: "2026-11-05T08:00:00.000Z", end: "2026-11-12T08:00:00.000Z" });
    expect(splitSummary(h)).toEqual({ changed: 1, heldOut: 0 });
  });
  it("scales both phases by weeks", () => {
    const h = scheduleHoldout({ kind: "week_alternate", storeId: "st1", startsAt: "2026-09-01T07:00:00Z", tz: TZ, weeks: 2 });
    expect(h.changeWindow.end).toBe("2026-09-15T07:00:00.000Z"); expect(h.controlWindow?.end).toBe("2026-09-29T07:00:00.000Z");
  });
});

describe("scheduleHoldout store_split", () => {
  const input = { kind: "store_split" as const, brandId: "b1", startsAt: START, tz: TZ, stores, seed: 7 };
  it("splits 12 stores 6/6 within terciles of 4", () => {
    const h = scheduleHoldout(input);
    expect(splitSummary(h)).toEqual({ changed: 6, heldOut: 6 });
    expect(new Set([...h.assignment.change, ...h.assignment.control]).size).toBe(12);
    const strata = h.assignment.strata!;
    const count = (s: string) => Object.values(strata).filter((x) => x === s).length;
    expect([count("low"), count("mid"), count("high")]).toEqual([4, 4, 4]);
    for (const s of ["low", "mid", "high"]) {
      const ids = Object.keys(strata).filter((id) => strata[id] === s);
      expect(ids.filter((id) => h.assignment.change.includes(id))).toHaveLength(2);
    }
    expect(h.assignment.seed).toBe(7); expect(h.controlWindow).toEqual(h.changeWindow);
    expect(h.changeWindow.end).toBe("2026-11-05T08:00:00.000Z"); expect(h.brandId).toBe("b1"); expect(h.storeId).toBeNull();
  });
  it("is reproducible for the same seed and differs for another seed", () => {
    const a = scheduleHoldout(input); const b = scheduleHoldout(input); const c = scheduleHoldout({ ...input, seed: 8 });
    expect(a).toEqual(b);
    expect(c.assignment.change).not.toEqual(a.assignment.change);
    expect(splitSummary(c)).toEqual({ changed: 6, heldOut: 6 });
  });
  it("derives a stable seed when none is given and puts unknown heat in the middle tercile", () => {
    const list = [...stores.slice(0, 6), { id: "x", heat: null }];
    const a = scheduleHoldout({ kind: "store_split", brandId: "b1", startsAt: START, tz: TZ, stores: list });
    expect(a.assignment.seed).toBe(scheduleHoldout({ kind: "store_split", brandId: "b1", startsAt: START, tz: TZ, stores: list }).assignment.seed);
    expect(a.assignment.strata?.x).toBe("mid");
    expect(stratify(list).x).toBe("mid");
    expect(splitSummary(a)).toEqual({ changed: 4, heldOut: 3 });
  });
});
