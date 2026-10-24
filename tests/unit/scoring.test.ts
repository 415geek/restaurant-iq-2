import { describe, it, expect } from "vitest";
import { scoreHypotheses } from "@/lib/business/scoring";
import type { EvidenceBundle, MenuItemLite, RestaurantProfile } from "@/lib/business/types";
import { sampleCrossDomainSignals, sampleCuisineTags, sampleDemographics, samplePlaceSignals, sampleTagSignals } from "@/lib/providers/qloo/fixtures";

const profile: RestaurantProfile = {
  id: "r1", name: "Golden Gate Noodle House (sample)", neighborhood: "Inner Sunset", city: "San Francisco",
  cuisine: "Taiwanese / Chinese noodles", serviceFormats: ["dine_in", "takeout", "third_party_delivery"], priceLevel: 2,
  costAssumptions: { avg_ticket: 24, food_cost_pct: 0.32, labor_cost_per_hour: 22, packaging_per_order: 0.85, delivery_commission_pct: 0.25, card_fee_pct: 0.029 },
  objectives: { primary: "grow weekday lunch and off-peak revenue without adding staff", constraints: ["no second fryer", "2 cooks on weekdays", "no liquor license"] },
};
const menu: MenuItemLite[] = [
  { name: "Beef Noodle Soup", category: "noodles", price: 18.5, foodCost: 6.4, isSignature: true },
  { name: "Scallion Pancake", category: "small_plates", price: 8, foodCost: 1.9 },
  { name: "Vegetarian Mapo Tofu", category: "mains", price: 15.5, foodCost: 3.9 },
  { name: "Boba Milk Tea", category: "drinks", price: 6.5, foodCost: 1.4 },
  { name: "Braised Pork Rice", category: "rice", price: 14.5, foodCost: 4.3 },
];
const ev = (mode: "sample" | "live"): EvidenceBundle => ({
  mode,
  cuisineTags: { data: sampleCuisineTags, sourceId: "s1" },
  tagAffinities: { data: sampleTagSignals, sourceId: "s2" },
  localPlaces: { data: samplePlaceSignals, sourceId: "s3" },
  crossDomain: { data: sampleCrossDomainSignals, sourceId: "s4" },
  demographics: { data: sampleDemographics, sourceId: "s5" },
  failures: [],
});

describe("scoreHypotheses", () => {
  it("ranks, disqualifies blocked concepts, and returns up to 3 viable", () => {
    const out = scoreHypotheses(profile, menu, ev("live"));
    expect(out.viable.length).toBeLessThanOrEqual(3);
    expect(out.viable.length).toBeGreaterThan(0);
    const bar = out.hypotheses.find((h) => h.slug === "bar-program")!;
    expect(bar.evidenceLabel).toBe("not_recommended");
    expect(bar.disqualifiers.join(" ")).toMatch(/liquor/);
    const late = out.hypotheses.find((h) => h.slug === "late-night-window")!;
    expect(late.evidenceLabel).toBe("not_recommended"); // conflicts with "2 cooks" / "without adding staff"
    expect(out.hypotheses.at(-1)!.evidenceLabel).toBe("not_recommended");
    expect(out.noViableOpportunity).toBe(false);
  });

  it("every viable hypothesis cites at least one Qloo signal and explains the rank change", () => {
    const out = scoreHypotheses(profile, menu, ev("live"));
    for (const h of out.viable) {
      expect(h.citations.length).toBeGreaterThan(0);
      expect(h.qlooDelta.explanation).toMatch(/baseline/);
      expect(h.evidenceSourceIds.length).toBeGreaterThan(0);
      expect(h.playbook.channels.every((c) => c.status === "not_verified")).toBe(true);
    }
    const cross = out.hypotheses.find((h) => h.slug === "cross-domain-partnership")!;
    expect(cross.baselineRank).toBeGreaterThan(cross.rank); // only exists because of cross-domain affinity
    expect(cross.citations.some((c) => c.kind === "entity")).toBe(true);
  });

  it("sample mode caps labels at requires_validation and adds the sample caveat", () => {
    const out = scoreHypotheses(profile, menu, ev("sample"));
    for (const h of out.viable) {
      expect(h.evidenceLabel).toBe("requires_validation");
      expect(h.playbook.risks.join(" ")).toMatch(/illustrative sample/);
    }
    expect(out.researchPlan[0]).toMatch(/live Qloo key/);
  });

  it("produces no viable opportunity when the restaurant cannot execute anything", () => {
    const blocked: RestaurantProfile = { ...profile, serviceFormats: [], objectives: { constraints: ["no liquor license"] } };
    const out = scoreHypotheses(blocked, [], { ...ev("live"), tagAffinities: { data: [], sourceId: "s2" }, localPlaces: { data: [], sourceId: "s3" }, crossDomain: { data: [], sourceId: "s4" }, demographics: { data: [], sourceId: "s5" } });
    expect(out.noViableOpportunity).toBe(true);
    expect(out.researchPlan.join(" ")).toMatch(/No hypothesis passes/);
  });

  it("is deterministic", () => {
    const a = JSON.stringify(scoreHypotheses(profile, menu, ev("live")).viable.map((h) => [h.slug, h.score.composite]));
    const b = JSON.stringify(scoreHypotheses(profile, menu, ev("live")).viable.map((h) => [h.slug, h.score.composite]));
    expect(a).toBe(b);
  });
});
