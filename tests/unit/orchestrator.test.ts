import { describe, it, expect } from "vitest";
import { runAnalysis } from "@/lib/agents/orchestrator";
import { MemoryAnalysisStore } from "@/lib/agents/store";
import { QlooProvider } from "@/lib/providers/qloo";
import type { MenuItemLite, RestaurantProfile } from "@/lib/business/types";

const profile: RestaurantProfile = {
  id: "r1", name: "Golden Gate Noodle House (sample)", neighborhood: "Inner Sunset", city: "San Francisco", cuisine: "Taiwanese / Chinese noodles",
  serviceFormats: ["dine_in", "takeout", "third_party_delivery"], priceLevel: 2,
  costAssumptions: { avg_ticket: 24, food_cost_pct: 0.32, labor_cost_per_hour: 22, packaging_per_order: 0.85, delivery_commission_pct: 0.25, card_fee_pct: 0.029 },
  objectives: { primary: "grow weekday lunch and off-peak revenue without adding staff", constraints: ["no second fryer", "2 cooks on weekdays", "no liquor license"] },
};
const menu: MenuItemLite[] = [
  { name: "Beef Noodle Soup", category: "noodles", price: 18.5, foodCost: 6.4, isSignature: true },
  { name: "Scallion Pancake", category: "small_plates", price: 8, foodCost: 1.9 },
  { name: "Vegetarian Mapo Tofu", category: "mains", price: 15.5, foodCost: 3.9 },
  { name: "Boba Milk Tea", category: "drinks", price: 6.5, foodCost: 1.4 },
];

describe("runAnalysis (sample mode, memory store)", () => {
  it("runs all six agents, persists evidence with provenance, hypotheses, tasks and a decision event", async () => {
    const store = new MemoryAnalysisStore();
    store.restaurants.set("r1", { profile, menu, isDemo: true });
    const provider = new QlooProvider({ store });
    const res = await runAnalysis({ store, provider, restaurantId: "r1", actor: "test" });
    expect(res.status).toBe("completed");
    expect(res.mode).toBe("sample");
    const steps = [...store.steps.values()].sort((a, b) => a.seq - b.seq);
    expect(steps.map((s) => s.agent)).toEqual(["IntakeAgent", "EvidenceAgent", "OpportunityAgent", "FinanceAgent", "ExecutionAgent", "Evaluator"]);
    expect(steps.every((s) => s.status === "succeeded")).toBe(true);
    expect(store.sources.length).toBe(5); // cuisine tags + 4 evidence calls
    expect(store.sources.every((s) => s.provenance.mode === "sample")).toBe(true);
    expect(store.insights.length).toBe(5);
    expect(res.hypotheses.length).toBeGreaterThan(3);
    expect(res.viableCount).toBeGreaterThan(0);
    expect(store.actions.length).toBeGreaterThan(0);
    expect(store.actions.filter((a) => a.externalSideEffect).every((a) => a.status === "needs_approval")).toBe(true);
    expect(store.events[0].kind).toBe("analysis_completed");
    expect((store.events[0].payload as { lt: { key: string } }).lt.key).toBe("gen.evAnalysis");
    expect(store.actions.every((a) => a.titleLt)).toBe(true);
    expect(res.evaluator.passed).toBe(true);
    expect(store.runs.get(res.runId)!.status).toBe("completed");
  });

  it("fails loudly in live mode when Qloo rejects the key (no fixture fallback)", async () => {
    const store = new MemoryAnalysisStore();
    store.restaurants.set("r1", { profile, menu, isDemo: true });
    const provider = new QlooProvider({ store, apiKey: "bad", fetchImpl: (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch });
    await expect(runAnalysis({ store, provider, restaurantId: "r1" })).rejects.toMatchObject({ errorClass: "forbidden" });
    const run = [...store.runs.values()][0];
    expect(run.status).toBe("failed");
    expect(run.errorClass).toBe("forbidden");
    expect(store.hypotheses.length).toBe(0);
  });

  it("records soft failures and continues in live mode on a timeout of one evidence call", async () => {
    const store = new MemoryAnalysisStore();
    store.restaurants.set("r1", { profile, menu, isDemo: true });
    let n = 0;
    const fetchImpl = async (url: string) => {
      n += 1;
      const u = new URL(url);
      if (u.pathname === "/v2/tags") return new Response(JSON.stringify({ results: { tags: [{ tag_id: "urn:tag:genre:place:restaurant:taiwanese", name: "Taiwanese" }] } }), { status: 200 });
      if (u.searchParams.get("filter.type") === "urn:demographics") return new Response("{}", { status: 500 });
      if (u.searchParams.get("filter.type") === "urn:tag") return new Response(JSON.stringify({ results: { tags: [{ tag_id: "urn:tag:offerings:place:lunch_specials", name: "Lunch specials", query: { affinity: 0.8 } }] } }), { status: 200 });
      return new Response(JSON.stringify({ results: { entities: [] } }), { status: 200 });
    };
    const provider = new QlooProvider({ store, apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await runAnalysis({ store, provider, restaurantId: "r1" });
    expect(res.status).toBe("completed");
    expect(res.evidenceFailures.map((f) => f.step)).toEqual(["getDemographics"]);
    expect(n).toBeGreaterThan(3);
  });
});
