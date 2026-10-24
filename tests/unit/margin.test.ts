import { describe, it, expect } from "vitest";
import { computeScenario, sensitivity, formatUsd } from "@/lib/business/margin";

const base = {
  salePrice: 16,
  incrementalUnits: 100,
  foodCostPerUnit: 4.5,
  packagingPerUnit: 0.85,
  incrementalLaborHours: 10,
  laborRatePerHour: 22,
  deliveryShare: 0.5,
  deliveryCommissionPct: 0.25,
  cardFeePct: 0.029,
  discountPct: 0.1,
  marketingCost: 150,
  fixedTestCosts: 300,
  cannibalizationPct: 0.2,
  cannibalizedOrderContribution: 9,
};

describe("computeScenario", () => {
  it("computes a positive scenario with consistent totals and no double counting", () => {
    const r = computeScenario(base);
    expect(r.netPricePerUnit).toBe(14.4);
    expect(r.incrementalSales).toBe(1440);
    expect(r.costs.ingredients).toBe(450);
    expect(r.costs.packaging).toBe(85);
    expect(r.costs.incrementalLabor).toBe(220);
    expect(r.costs.deliveryFees).toBe(180); // 50 units * 14.4 * 0.25
    expect(r.costs.transactionFees).toBe(41.76); // 1440 * 0.029
    expect(r.costs.discounts).toBe(160);
    expect(r.costs.total).toBe(976.76);
    expect(r.incrementalContributionProfit).toBe(313.24); // 1440 - 976.76 - 150
    expect(r.contributionLostToCannibalization).toBe(180); // 20 * 9
    expect(r.adjustedIncrementalProfit).toBe(133.24);
    expect(r.breakEvenUnits).toBeGreaterThan(0);
    expect(r.warnings).not.toContain("Per-unit contribution is zero or negative: more volume does not fix the economics.");
  });

  it("flags negative per-unit contribution and gives no break-even", () => {
    const r = computeScenario({ ...base, salePrice: 5, foodCostPerUnit: 6, discountPct: 0 });
    expect(r.perUnitContribution).toBeLessThan(0);
    expect(r.breakEvenUnits).toBeNull();
    expect(r.adjustedIncrementalProfit).toBeLessThan(0);
    expect(r.warnings.join(" ")).toMatch(/more volume does not fix/);
  });

  it("handles zero units: only marketing exposure", () => {
    const r = computeScenario({ ...base, incrementalUnits: 0, incrementalLaborHours: 0 });
    expect(r.incrementalSales).toBe(0);
    expect(r.costs.total).toBe(0);
    expect(r.adjustedIncrementalProfit).toBe(-150);
    expect(r.warnings.join(" ")).toMatch(/No incremental units/);
  });

  it("0% and 100% cannibalization bound the result", () => {
    const none = computeScenario({ ...base, cannibalizationPct: 0 });
    const full = computeScenario({ ...base, cannibalizationPct: 1 });
    expect(none.contributionLostToCannibalization).toBe(0);
    expect(full.contributionLostToCannibalization).toBe(900);
    expect(full.adjustedIncrementalProfit).toBeLessThan(none.adjustedIncrementalProfit);
  });

  it("fee models: no delivery => no commission; card fee on net sales only", () => {
    const r = computeScenario({ ...base, deliveryShare: 0, discountPct: 0.5 });
    expect(r.costs.deliveryFees).toBe(0);
    expect(r.costs.transactionFees).toBe(Math.round(100 * 8 * 0.029 * 100) / 100);
  });

  it("rejects invalid assumptions", () => {
    expect(() => computeScenario({ ...base, deliveryShare: 2 })).toThrow();
    expect(() => computeScenario({ ...base, salePrice: -1 })).toThrow();
  });

  it("sensitivity moves in the expected direction", () => {
    const s = sensitivity(base, 0.2);
    const units = s.find((x) => x.driver === "Incremental units")!;
    expect(units.up).toBeGreaterThan(units.base);
    expect(units.down).toBeLessThan(units.base);
    const food = s.find((x) => x.driver === "Food cost per unit")!;
    expect(food.up).toBeLessThan(food.base);
  });

  it("formats currency", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(-3)).toBe("-$3.00");
  });
});
