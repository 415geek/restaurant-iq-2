import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { classifyTheme, crowdFit, daysToCover, holidaysForYear, milesBetween, nthWeekday, upcomingHolidays } from "@/lib/business/moments";
import { normalizeCommunityRows, normalizeStreetRows } from "@/lib/providers/events/sf-open-data";
import { campaignCreateSchema, momentSchema } from "@/lib/validation/schemas";

describe("holiday math", () => {
  it("computes rule-based US dates", () => {
    expect(nthWeekday(2026, 11, 4, 4)).toBe("2026-11-26"); // Thanksgiving
    expect(nthWeekday(2027, 1, 1, 3)).toBe("2027-01-18"); // MLK
    expect(nthWeekday(2026, 5, 1, -1)).toBe("2026-05-25"); // Memorial Day
    expect(nthWeekday(2026, 9, 1, 1)).toBe("2026-09-07"); // Labor Day
    const h = holidaysForYear(2026);
    expect(h.find((x) => x.id === "small_business_saturday")?.date).toBe("2026-11-28");
  });
  it("lists only the window, sorted, across the year boundary", () => {
    const u = upcomingHolidays("2026-10-28", 105);
    expect(u[0]).toMatchObject({ id: "halloween", date: "2026-10-31", theme: "halloween" });
    expect(u.map((x) => x.id)).toContain("lunar_new_year");
    expect(u.every((x, i) => i === 0 || u[i - 1].date <= x.date)).toBe(true);
    expect(u.every((x) => x.date >= "2026-10-28" && x.date <= "2027-02-10")).toBe(true);
  });
  it("omits lunar dates for years outside the published table instead of guessing", () => {
    expect(holidaysForYear(2031).some((x) => x.id === "lunar_new_year")).toBe(false);
  });
  it("covers the moment day and caps the duration", () => {
    const now = new Date("2026-10-28T19:00:00Z");
    expect(daysToCover("2026-10-31", now)).toBe(4);
    expect(daysToCover("2026-10-28", now)).toBe(1);
    expect(daysToCover("2027-12-31", now)).toBe(120);
  });
});

describe("theme classifier", () => {
  it.each([
    ["Trick-or-Treat -12th Avenue (Irving-Judah)", "kids"],
    ["Golden Gate Half Marathon & 5k", "running"],
    ["North Beach Farmers Market", "farmers_market"],
    ["Fillmore After Dark Night Market", "night_market"],
    ["Crawloween", "halloween"],
    ["Block Party - Mirabel Ave", "family"],
    ["Castro Merchants Signature Events - 18th St", null],
  ])("%s → %s", (name, theme) => expect(classifyTheme(name)).toBe(theme));
});

describe("crowd fit", () => {
  const older = { age: { "24_and_younger": -0.7, "25_to_29": -0.6, "30_to_34": -0.6, "35_to_44": -0.5, "45_to_54": 0.9, "55_and_older": 0.6 }, gender: { female: 0.3 } };
  const young = { age: { "24_and_younger": 0.9, "25_to_29": 0.8, "30_to_34": 0.7, "35_to_44": -0.8, "45_to_54": -0.7, "55_and_older": -0.6 }, gender: { female: 0.5 } };
  it("scores similar skews as strong and opposite skews as different", () => {
    expect(crowdFit(older, older)).toEqual({ score: 1, level: "strong" });
    expect(crowdFit(young, older)?.level).toBe("different");
  });
  it("returns null when a vector is empty", () => {
    expect(crowdFit({ age: {}, gender: {} }, older)).toBeNull();
  });
  it("derives female skew from male when only male is present", () => {
    const m = { age: older.age, gender: { male: -0.3 } };
    expect(crowdFit(m, older)?.score).toBe(1);
  });
});

describe("SF Open Data normalizers (synthetic rows)", () => {
  const center: [number, number] = [37.7625, -122.466];
  it("groups street segments per case and day, keeps the nearest point, drops film shoots and shared spaces", () => {
    const seg = (lng: number, lat: number) => ({ type: "LineString", coordinates: [[lng, lat], [lng, lat + 0.001]] });
    const rows = [
      { case_num: "1", case_name: "Sample Street Fair 2026", type: "Special Event", start_date: "2026-11-07T00:00:00.000", end_date: "2026-11-07T00:00:00.000", start_time: "10:00:00", end_time: "16:00:00", loc_desc: "SAMPLE ST between A ST and B ST", shape: seg(-122.40, 37.76) },
      { case_num: "1", case_name: "Sample Street Fair 2026", type: "Special Event", start_date: "2026-11-07T00:00:00.000", end_date: "2026-11-07T00:00:00.000", loc_desc: "SAMPLE ST between B ST and C ST", shape: seg(-122.465, 37.763) },
      { case_num: "2", case_name: "Sample Feature Film", type: "Special Event", start_date: "2026-11-07T00:00:00.000" },
      { case_num: "3", case_name: "Sample Shared Space", type: "Roadway Shared Spaces", start_date: "2026-11-07T00:00:00.000" },
    ];
    const out = normalizeStreetRows(rows, center);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Sample Street Fair", date: "2026-11-07", start: "10:00", theme: "festival" });
    expect(out[0].miles).toBeLessThan(0.2);
    expect(out[0].where).toBe("Sample St Between A St And B St");
  });
  it("keeps only themed one-day community events and strips HTML and URLs", () => {
    const rows = [
      { id: "1", org_name: "Sample Org", event_name: "<b>Family Dance Party</b> https://x.example", event_start_date: "2026-11-02T00:00:00.000", site_location_name: "SAMPLE CENTER", latitude: "37.76", longitude: "-122.46" },
      { id: "2", org_name: "Sample Org", event_name: "Tutorial: Basic Tech Help", event_start_date: "2026-11-02T00:00:00.000" },
      { id: "3", org_name: "Sample Org", event_name: "Chess Club", event_start_date: "2026-11-02T00:00:00.000" },
      { id: "4", org_name: "Sample Library", event_name: "Storytime: For Toddlers", event_start_date: "2026-11-02T00:00:00.000" },
    ];
    const out = normalizeCommunityRows(rows, center);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Family Dance Party", theme: "family", where: "Sample Center" });
  });
  it("measures miles", () => {
    expect(milesBetween([37.7625, -122.466], [37.7749, -122.4194])).toBeCloseTo(2.7, 0);
  });
});

describe("moment validation", () => {
  it("accepts a valid moment and rejects bad dates or kinds", () => {
    expect(momentSchema.safeParse({ kind: "street", name: "Sample fair", date: "2026-11-07", theme: "family" }).success).toBe(true);
    expect(momentSchema.safeParse({ kind: "street", name: "Sample fair", date: "11/07/2026" }).success).toBe(false);
    expect(momentSchema.safeParse({ kind: "concert", name: "Sample", date: "2026-11-07" }).success).toBe(false);
  });
  it("allows passes up to 120 days so lunar new year fits", () => {
    const base = { hypothesisId: "00000000-0000-4000-8000-000000000001", offerName: "Sample", menuItem: "Sample", regularPrice: 10, offerPrice: 9, variableCost: 3, feePct: 0.03, fixedSpend: 0, maxRedemptions: 10, terms: "" };
    expect(campaignCreateSchema.safeParse({ ...base, days: 101 }).success).toBe(true);
    expect(campaignCreateSchema.safeParse({ ...base, days: 121 }).success).toBe(false);
  });
});
