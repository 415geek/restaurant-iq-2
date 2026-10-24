/**
 * Deterministic restaurant unit economics. No LLM involvement. All money in USD.
 * Formulas (see prompt §8):
 *   incremental_sales = sale_price * incremental_units
 *   variable_costs = ingredients + packaging + incremental_labor + delivery_fees + transaction_fees + discounts + other
 *   incremental_contribution_profit = incremental_sales - variable_costs - marketing_cost
 *   adjusted_incremental_profit = incremental_contribution_profit - contribution_lost_to_cannibalized_orders
 *   break_even_units = fixed_test_costs / positive_per_order_contribution
 * Fee bases: delivery commission and card fees apply to the discounted sale price, once each (no double counting).
 */
import { z } from "zod";

export const scenarioAssumptionsSchema = z.object({
  salePrice: z.number().min(0).max(1000),
  incrementalUnits: z.number().int().min(0).max(100000), // per period
  periodLabel: z.string().default("per week"),
  foodCostPerUnit: z.number().min(0).max(1000),
  packagingPerUnit: z.number().min(0).max(100).default(0),
  incrementalLaborHours: z.number().min(0).max(10000).default(0),
  laborRatePerHour: z.number().min(0).max(500).default(0),
  deliveryShare: z.number().min(0).max(1).default(0), // share of incremental units via delivery channel
  deliveryCommissionPct: z.number().min(0).max(1).default(0),
  cardFeePct: z.number().min(0).max(0.2).default(0),
  discountPct: z.number().min(0).max(1).default(0), // promo discount on sale price
  otherVariableCostPerUnit: z.number().min(0).max(1000).default(0),
  marketingCost: z.number().min(0).max(1_000_000).default(0), // per period
  fixedTestCosts: z.number().min(0).max(1_000_000).default(0), // one-time setup for break-even
  cannibalizationPct: z.number().min(0).max(1).default(0), // share of incremental units that replace existing orders
  cannibalizedOrderContribution: z.number().min(0).max(1000).default(0), // contribution lost per cannibalized order
});
export type ScenarioAssumptions = z.input<typeof scenarioAssumptionsSchema>;
export type ScenarioAssumptionsResolved = z.output<typeof scenarioAssumptionsSchema>;

export interface ScenarioResult {
  netPricePerUnit: number;
  incrementalSales: number;
  costs: {
    ingredients: number;
    packaging: number;
    incrementalLabor: number;
    deliveryFees: number;
    transactionFees: number;
    discounts: number;
    other: number;
    total: number;
  };
  marketingCost: number;
  incrementalContributionProfit: number;
  cannibalizedOrders: number;
  contributionLostToCannibalization: number;
  adjustedIncrementalProfit: number;
  perUnitContribution: number; // after variable costs, before marketing/fixed
  breakEvenUnits: number | null; // null when per-unit contribution <= 0
  contributionMarginPct: number | null; // perUnitContribution / netPrice
  warnings: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeScenario(input: ScenarioAssumptions): ScenarioResult {
  const a = scenarioAssumptionsSchema.parse(input);
  const warnings: string[] = [];
  const discountPerUnit = a.salePrice * a.discountPct;
  const netPrice = a.salePrice - discountPerUnit;
  const grossSales = a.salePrice * a.incrementalUnits;
  const discounts = discountPerUnit * a.incrementalUnits;
  const incrementalSales = netPrice * a.incrementalUnits; // sales after discounts
  const ingredients = a.foodCostPerUnit * a.incrementalUnits;
  const packaging = a.packagingPerUnit * a.incrementalUnits;
  const incrementalLabor = a.incrementalLaborHours * a.laborRatePerHour;
  const deliveryUnits = a.incrementalUnits * a.deliveryShare;
  const deliveryFees = deliveryUnits * netPrice * a.deliveryCommissionPct;
  const transactionFees = incrementalSales * a.cardFeePct;
  const other = a.otherVariableCostPerUnit * a.incrementalUnits;
  const variableTotal = ingredients + packaging + incrementalLabor + deliveryFees + transactionFees + other;
  const incrementalContributionProfit = incrementalSales - variableTotal - a.marketingCost;
  const cannibalizedOrders = a.incrementalUnits * a.cannibalizationPct;
  const contributionLost = cannibalizedOrders * a.cannibalizedOrderContribution;
  const adjusted = incrementalContributionProfit - contributionLost;

  // per-unit contribution (variable costs only; labor spread across units when units > 0)
  const perUnitVariable =
    a.foodCostPerUnit +
    a.packagingPerUnit +
    a.otherVariableCostPerUnit +
    netPrice * a.deliveryShare * a.deliveryCommissionPct +
    netPrice * a.cardFeePct +
    (a.incrementalUnits > 0 ? incrementalLabor / a.incrementalUnits : 0) +
    a.cannibalizationPct * a.cannibalizedOrderContribution;
  const perUnitContribution = netPrice - perUnitVariable;
  const breakEvenUnits = perUnitContribution > 0 ? Math.ceil((a.fixedTestCosts + a.marketingCost) / perUnitContribution) : null;

  if (perUnitContribution <= 0) warnings.push("Per-unit contribution is zero or negative: more volume does not fix the economics.");
  if (a.incrementalUnits === 0) warnings.push("No incremental units assumed: result shows fixed and marketing cost exposure only.");
  if (a.foodCostPerUnit > 0 && netPrice > 0 && a.foodCostPerUnit / netPrice > 0.4) warnings.push("Food cost above 40% of net price.");
  if (a.deliveryShare > 0 && a.deliveryCommissionPct === 0) warnings.push("Delivery share set but commission is 0%: confirm channel fees.");
  if (a.cannibalizationPct > 0 && a.cannibalizedOrderContribution === 0) warnings.push("Cannibalization set but lost contribution per order is 0: confirm baseline order margin.");
  if (grossSales > 0 && adjusted / grossSales < 0.05 && adjusted > 0) warnings.push("Thin margin: a small cost change could turn this negative.");

  return {
    netPricePerUnit: r2(netPrice),
    incrementalSales: r2(incrementalSales),
    costs: {
      ingredients: r2(ingredients),
      packaging: r2(packaging),
      incrementalLabor: r2(incrementalLabor),
      deliveryFees: r2(deliveryFees),
      transactionFees: r2(transactionFees),
      discounts: r2(discounts),
      other: r2(other),
      total: r2(variableTotal),
    },
    marketingCost: r2(a.marketingCost),
    incrementalContributionProfit: r2(incrementalContributionProfit),
    cannibalizedOrders: r2(cannibalizedOrders),
    contributionLostToCannibalization: r2(contributionLost),
    adjustedIncrementalProfit: r2(adjusted),
    perUnitContribution: r2(perUnitContribution),
    breakEvenUnits,
    contributionMarginPct: netPrice > 0 ? Math.round((perUnitContribution / netPrice) * 1000) / 10 : null,
    warnings,
  };
}

/** One-at-a-time sensitivity: how adjusted profit moves when each driver shifts by ±delta (fraction). */
export function sensitivity(input: ScenarioAssumptions, delta = 0.2): Array<{ driver: string; down: number; base: number; up: number }> {
  const base = computeScenario(input).adjustedIncrementalProfit;
  const a = scenarioAssumptionsSchema.parse(input);
  const drivers: Array<[string, keyof ScenarioAssumptionsResolved]> = [
    ["Incremental units", "incrementalUnits"],
    ["Sale price", "salePrice"],
    ["Food cost per unit", "foodCostPerUnit"],
    ["Marketing cost", "marketingCost"],
    ["Cannibalization", "cannibalizationPct"],
  ];
  return drivers.map(([label, key]) => {
    const v = a[key] as number;
    const mk = (f: number) => {
      const next = { ...a, [key]: key === "incrementalUnits" ? Math.round(v * f) : key === "cannibalizationPct" ? Math.min(1, v * f) : v * f };
      return computeScenario(next).adjustedIncrementalProfit;
    };
    return { driver: label, down: mk(1 - delta), base, up: mk(1 + delta) };
  });
}

export function formatUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
