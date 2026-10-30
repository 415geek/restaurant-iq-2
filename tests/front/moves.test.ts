import { describe, expect, it } from "vitest";
import { applyGuardrails, applyMoves, verifyEvidence, proposalSchema } from "@/lib/front/moves";
import { DEFAULT_GUARDRAILS, type MenuItem, type QlooCallRecord } from "@/lib/front/types";

const item = (id: string, name: string, i: number, extra: Partial<MenuItem> = {}): MenuItem => ({ id, storeId: "s", name, nameEn: null, description: null, priceCents: 1400, costCents: 500, category: "Mains", sortIndex: i, qlooTagIds: [], tagCandidates: [], ambiguous: false, ...extra });
const items = [item("a", "Mapo Tofu", 0), item("b", "Kung Pao Chicken", 1), item("c", "Dan Dan Noodles", 2), item("d", "Egg Fried Rice", 3, { costCents: null })];
const calls: QlooCallRecord[] = [{ id: "c1", purpose: "neighborhood_tags", provenance: { provider: "qloo", endpoint: "/v2/insights", requestParams: {}, retrievedAt: "2026-10-30T00:00:00Z", mode: "sample", cacheHit: false }, facts: [{ name: "Spicy", id: "t1", score: 0.91 }, { name: "Vegan", id: "t2", score: 0.64 }] }];
const ev = (name: string, score: number | null, callId = "c1") => ({ callId, name, score, sentence: "x" });

describe("verifyEvidence", () => {
  it("accepts exact names and scores within tolerance, rejects invented ones", () => {
    expect(verifyEvidence(ev("spicy", 0.91), calls)).toBe(true);
    expect(verifyEvidence(ev("Spicy", 0.92), calls)).toBe(true);
    expect(verifyEvidence(ev("Spicy", 0.75), calls)).toBe(false);
    expect(verifyEvidence(ev("Umami", 0.9), calls)).toBe(false);
    expect(verifyEvidence(ev("Spicy", 0.91, "c9"), calls)).toBe(false);
  });
});

describe("applyGuardrails", () => {
  const ctx = (single: boolean, g = DEFAULT_GUARDRAILS) => ({ items, guardrails: g, singleStore: single, calls });
  it("allows rename for a single store, blocks it for a chain unless whitelisted, and flags banned terms", () => {
    const p = proposalSchema.parse({ moves: [{ kind: "rename", itemId: "a", after: { description: "for the spice-forward crowd" }, evidence: [ev("Spicy", 0.91)], rationale: "r", risk: "low" }] });
    expect(applyGuardrails(p, ctx(true))[0].guardrail?.ok).toBe(true);
    expect(applyGuardrails(p, ctx(false))[0].guardrail?.reason).toMatch(/HQ guardrail/);
    expect(applyGuardrails(p, ctx(false, { ...DEFAULT_GUARDRAILS, renamableItemIds: ["a"] }))[0].guardrail?.ok).toBe(true);
    const bad = proposalSchema.parse({ moves: [{ kind: "rename", itemId: "a", after: { description: "the most AUTHENTIC tofu" }, evidence: [], rationale: "r", risk: "low" }] });
    expect(applyGuardrails(bad, ctx(true))[0].guardrail?.reason).toMatch(/banned term "authentic"/);
  });
  it("caps features at 3, promotions at 1, and refuses promote without cost or with non-positive contribution", () => {
    const f = (id: string) => ({ kind: "feature" as const, itemId: id, after: {}, evidence: [ev("Spicy", 0.91)], rationale: "r", risk: "low" as const });
    const p = proposalSchema.parse({ moves: [f("a"), f("b"), f("c"), f("d")] });
    expect(applyGuardrails(p, ctx(true)).map((m) => m.guardrail?.ok)).toEqual([true, true, true, false]);
    const pr = proposalSchema.parse({ moves: [{ kind: "promote", itemId: "d", after: { promoteBudgetCents: 5000 }, evidence: [], rationale: "r", risk: "mid" }, { kind: "promote", itemId: "a", after: { promoteBudgetCents: 5000 }, evidence: [], rationale: "r", risk: "mid" }] });
    const out = applyGuardrails(pr, ctx(true));
    expect(out[0].guardrail?.reason).toMatch(/unit cost/); expect(out[1].guardrail?.reason).toMatch(/at most 1 promotion/);
  });
  it("marks a move verified only when every citation checks out", () => {
    const p = proposalSchema.parse({ moves: [{ kind: "feature", itemId: "a", after: {}, evidence: [ev("Spicy", 0.91), ev("Umami", 0.5)], rationale: "r", risk: "low" }] });
    const m = applyGuardrails(p, ctx(true))[0];
    expect(m.verified).toBe(false); expect(m.evidence.map((e) => e.verified)).toEqual([true, false]);
  });
});

describe("applyMoves", () => {
  it("puts featured items first, applies reorders and renames, and records what changed", () => {
    const p = proposalSchema.parse({ moves: [
      { kind: "feature", itemId: "c", after: {}, evidence: [], rationale: "r", risk: "low" },
      { kind: "reorder", itemId: "d", after: { sortIndex: 0 }, evidence: [], rationale: "r", risk: "low" },
      { kind: "rename", itemId: "a", after: { description: "silken, numbing" }, evidence: [], rationale: "r", risk: "low" },
    ] });
    const v = applyMoves(items, applyGuardrails(p, { items, guardrails: DEFAULT_GUARDRAILS, singleStore: true, calls }));
    expect(v.map((i) => i.id)).toEqual(["c", "d", "a", "b"]);
    expect(v[0].featured).toBe(true); expect(v[0].changed).toContain("featured"); expect(v[0].changed).toContain("sortIndex");
    expect(v[2].description).toBe("silken, numbing"); expect(v[2].changed).toContain("description");
    expect(v[3].changed).toEqual(["sortIndex"]);
  });
  it("ignores rejected moves", () => {
    const p = proposalSchema.parse({ moves: [{ kind: "rename", itemId: "a", after: { name: "Best Tofu" }, evidence: [], rationale: "r", risk: "low" }] });
    const v = applyMoves(items, applyGuardrails(p, { items, guardrails: DEFAULT_GUARDRAILS, singleStore: true, calls }));
    expect(v[0].name).toBe("Mapo Tofu"); expect(v.every((i) => i.changed.length === 0)).toBe(true);
  });
});
