import { z } from "zod";

/** The unified sales schema every upload is normalized into. Money is in the file's currency (assumed USD). */
export const TARGETS = [
  "ordered_at", "ordered_date", "ordered_time", "order_id", "platform", "channel", "item_name", "quantity",
  "gross_sales", "discounts", "net_sales", "tax", "tip", "platform_fees", "payout", "refunds", "status",
  "ignore", "pii",
] as const;
export type Target = (typeof TARGETS)[number];
export const MONEY_TARGETS = ["gross_sales", "discounts", "net_sales", "tax", "tip", "platform_fees", "payout", "refunds"] as const;
export type MoneyTarget = (typeof MONEY_TARGETS)[number];
export const PLATFORMS = ["square", "toast", "clover", "doordash", "ubereats", "grubhub", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const DELIVERY_PLATFORMS: Platform[] = ["doordash", "ubereats", "grubhub"];
export const CHANNELS = ["dine_in", "takeout", "delivery", "catering", "unknown"] as const;
export type Channel = (typeof CHANNELS)[number];

export type MappingMethod = "memory" | "rules" | "ai" | "owner";
export interface ColumnMapping { column: string; target: Target; confidence: number; method: MappingMethod; reason?: string }

export interface NormalizedRecord {
  platform: Platform; channel: Channel; order_id: string | null; ordered_at: string; item_name: string | null; quantity: number | null;
  gross_sales: number | null; discounts: number | null; net_sales: number | null; tax: number | null; tip: number | null;
  platform_fees: number | null; payout: number | null; refunds: number | null; status: "completed" | "refunded" | "cancelled"; row_ref: number;
  /** order = one row per order, line = one row per item line, day = a daily summary (never counted as an order) */
  grain: "order" | "line" | "day";
  /** false when the source had a date but no time of day (then the row is kept out of hour-of-week analysis) */
  has_time: boolean;
  /** stable identity across files, so overlapping reports do not count the same order twice */
  dedupe_key: string;
}

export const mappingInputSchema = z.array(z.object({
  column: z.string().min(1).max(120),
  target: z.enum(TARGETS),
  confidence: z.number().min(0).max(1).default(1),
  method: z.enum(["memory", "rules", "ai", "owner"]).default("owner"),
}));
