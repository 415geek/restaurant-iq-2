import { z } from "zod";

export const SERVICE_FORMATS = ["dine_in", "takeout", "third_party_delivery", "catering"] as const;

export const restaurantInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  neighborhood: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(80).default("San Francisco"),
  cuisine: z.string().trim().min(2).max(80),
  serviceFormats: z.array(z.enum(SERVICE_FORMATS)).min(1),
  hoursSummary: z.string().trim().max(160).optional().or(z.literal("")),
  priceLevel: z.coerce.number().int().min(1).max(4).optional(),
  menuUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  menuText: z.string().max(4000).optional().or(z.literal("")), // "Name | category | price | food cost" per line
  avgTicket: z.coerce.number().min(1).max(500).default(24),
  foodCostPct: z.coerce.number().min(0.05).max(0.8).default(0.32),
  laborCostPerHour: z.coerce.number().min(5).max(200).default(22),
  deliveryCommissionPct: z.coerce.number().min(0).max(0.5).default(0.25),
  objective: z.string().trim().max(300).optional().or(z.literal("")),
  constraints: z.string().trim().max(500).optional().or(z.literal("")), // comma separated
  posPreference: z.string().trim().max(40).optional().or(z.literal("")),
  useSampleData: z.boolean().default(false),
});
export type RestaurantInput = z.infer<typeof restaurantInputSchema>;

export function parseMenuText(text: string | undefined): Array<{ name: string; category: string; price: number | null; foodCost: number | null }> {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 60)
    .map((line) => {
      const [name, category, price, foodCost] = line.split("|").map((s) => s.trim());
      const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
      return { name: (name ?? "").slice(0, 80), category: (category || "main").slice(0, 40).toLowerCase(), price: num(price), foodCost: num(foodCost) };
    })
    .filter((m) => m.name.length > 0);
}

export const analysisRequestSchema = z.object({ restaurantId: z.string().uuid() });

export const hypothesisStatusSchema = z.object({ status: z.enum(["pursued", "rejected"]), note: z.string().max(500).optional() });

export const scenarioRequestSchema = z.object({
  hypothesisId: z.string().uuid(),
  label: z.string().trim().min(1).max(60).default("Scenario"),
  assumptions: z.record(z.string(), z.union([z.number(), z.string()])),
});

export const ACTION_STATUSES = ["draft", "needs_approval", "ready", "in_progress", "completed", "canceled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const actionPatchSchema = z.object({
  status: z.enum(ACTION_STATUSES).optional(),
  owner: z.string().trim().max(80).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  approvalNote: z.string().max(500).optional(),
});

/** Valid action transitions. Items with external side effects must pass through needs_approval → ready via an approval row. */
export function canTransition(from: ActionStatus, to: ActionStatus, opts: { requiresApproval: boolean; hasApproval: boolean }): { ok: boolean; reason?: string } {
  if (from === to) return { ok: true };
  if (to === "canceled") return from === "completed" ? { ok: false, reason: "Completed items cannot be canceled" } : { ok: true };
  const allowed: Record<ActionStatus, ActionStatus[]> = {
    draft: ["needs_approval", "ready"],
    needs_approval: ["ready", "draft"],
    ready: ["in_progress", "draft"],
    in_progress: ["completed", "ready"],
    completed: [],
    canceled: ["draft"],
  };
  if (!allowed[from].includes(to)) return { ok: false, reason: `Cannot move from ${from} to ${to}` };
  if (from === "draft" && to === "ready" && opts.requiresApproval) return { ok: false, reason: "This item needs approval first" };
  if (from === "needs_approval" && to === "ready" && !opts.hasApproval) return { ok: false, reason: "An approval record is required" };
  return { ok: true };
}

// ---- TastePass ----
export const momentSchema = z.object({
  kind: z.enum(["holiday", "street", "community", "web", "manual"]),
  name: z.string().trim().min(2).max(90),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.enum(["kids", "halloween", "family", "farmers_market", "night_market", "street_food", "running", "festival"]).optional(),
  source: z.string().trim().max(80).optional(),
});
export type MomentInput = z.infer<typeof momentSchema>;
export const campaignCreateSchema = z.object({
  hypothesisId: z.string().uuid(),
  offerName: z.string().trim().min(2).max(80),
  menuItem: z.string().trim().min(1).max(80),
  regularPrice: z.coerce.number().min(0).max(1000),
  offerPrice: z.coerce.number().min(0).max(1000),
  variableCost: z.coerce.number().min(0).max(1000),
  feePct: z.coerce.number().min(0).max(0.5),
  fixedSpend: z.coerce.number().min(0).max(100000),
  maxRedemptions: z.coerce.number().int().min(1).max(10000),
  days: z.coerce.number().int().min(1).max(120),
  terms: z.string().trim().max(400).default(""),
  approve: z.boolean().default(true),
  moment: momentSchema.optional(),
  anchor: z.object({ entityId: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9-]+$/), name: z.string().trim().min(1).max(80) }).optional(),
  requestId: z.string().uuid().optional(), // idempotency: retries of the same submit create one campaign
});
export type CampaignCreate = z.infer<typeof campaignCreateSchema>;
export const campaignPatchSchema = z.object({ action: z.enum(["end"]) });
export const redeemSchema = z.object({
  token: z.string().trim().min(6).max(16),
  verifiedSale: z.coerce.number().min(0).max(10000).optional(),
});
export const passClaimSchema = z.object({ consent: z.literal(true) });
