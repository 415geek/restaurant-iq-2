import "server-only";
import type { MomentInput } from "@/lib/validation/schemas";
import { getSsrClient } from "@/lib/db/ssr";
import { getServiceClient } from "@/lib/db/server";
import type { PassEconomics } from "@/lib/business/tastepass";
import type { SignalCitation } from "@/lib/business/types";

export interface CampaignView {
  id: string; restaurantId: string; hypothesisId: string | null; slug: string; offerName: string; menuItem: string;
  regularPrice: number; offerPrice: number; variableCost: number; feePct: number; fixedSpend: number; maxRedemptions: number;
  startsAt: string; endsAt: string; terms: string; why: string; evidence: SignalCitation[]; economics: PassEconomics;
  decision: "go" | "no_go"; status: "draft" | "active" | "ended"; mode: "sandbox" | "live"; approvedAt: string | null; createdAt: string;
  moment: MomentInput | null;
}
export interface CampaignStats { views: number; claims: number; redeemed: number; expired: number; verifiedSales: number; conversion: number | null; lastRedeemedAt: string | null; recent: Array<{ tokenHint: string; status: string; at: string }> }

const n = (v: unknown) => Number(v ?? 0);
function toView(c: Record<string, unknown>): CampaignView {
  return {
    id: c.id as string, restaurantId: c.restaurant_id as string, hypothesisId: (c.hypothesis_id as string) ?? null, slug: c.slug as string,
    offerName: c.offer_name as string, menuItem: c.menu_item as string, regularPrice: n(c.regular_price), offerPrice: n(c.offer_price),
    variableCost: n(c.variable_cost), feePct: n(c.fee_pct), fixedSpend: n(c.fixed_spend), maxRedemptions: n(c.max_redemptions),
    startsAt: c.starts_at as string, endsAt: c.ends_at as string, terms: (c.terms as string) ?? "", why: (c.why as string) ?? "",
    evidence: (c.evidence as SignalCitation[]) ?? [], economics: c.economics as PassEconomics, decision: c.decision as "go" | "no_go",
    status: c.status as CampaignView["status"], mode: c.mode as CampaignView["mode"], approvedAt: (c.approved_at as string) ?? null, createdAt: c.created_at as string,
    moment: (c.moment as MomentInput) ?? null,
  };
}

/** Read through RLS: demo campaigns are world-readable, private ones members-only. */
export async function getCampaign(id: string): Promise<CampaignView | null> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  return data ? toView(data) : null;
}
export async function getCampaignsForRestaurant(restaurantId: string): Promise<CampaignView[]> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("campaigns").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map(toView);
}
export async function getActiveCampaignForHypothesis(hypothesisId: string): Promise<CampaignView | null> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("campaigns").select("*").eq("hypothesis_id", hypothesisId).neq("status", "ended").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? toView(data) : null;
}
/** Public pass page: only active or ended campaigns are visible by slug (drafts never are). */
export async function getPublicCampaign(slug: string): Promise<(CampaignView & { restaurantName: string; neighborhood: string | null; isDemo: boolean }) | null> {
  const db = getServiceClient();
  const { data } = await db.from("campaigns").select("*, restaurants!inner(name, neighborhood, organizations!inner(is_demo))").eq("slug", slug).in("status", ["active", "ended"]).maybeSingle();
  if (!data) return null;
  const r = (data as unknown as { restaurants: { name: string; neighborhood: string | null; organizations: { is_demo: boolean } } }).restaurants;
  return { ...toView(data), restaurantName: r.name, neighborhood: r.neighborhood, isDemo: r.organizations.is_demo };
}

/** Aggregate counters. Caller must have authorized read access to the campaign's restaurant. Tokens are never returned. */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const db = getServiceClient();
  const [{ data: c }, { data: claims }] = await Promise.all([
    db.from("campaigns").select("page_views").eq("id", campaignId).maybeSingle(),
    db.from("pass_claims").select("token, status, claimed_at, redeemed_at, expires_at, verified_sale_amount").eq("campaign_id", campaignId).order("claimed_at", { ascending: false }).limit(500),
  ]);
  const now = Date.now();
  const rows = claims ?? [];
  const redeemedRows = rows.filter((r) => r.status === "redeemed");
  const expired = rows.filter((r) => r.status === "claimed" && Date.parse(r.expires_at) <= now).length;
  const lastRedeemedAt = redeemedRows.map((r) => r.redeemed_at as string).sort().pop() ?? null;
  return {
    views: n(c?.page_views), claims: rows.length, redeemed: redeemedRows.length, expired,
    verifiedSales: Math.round(redeemedRows.reduce((s, r) => s + n(r.verified_sale_amount), 0) * 100) / 100,
    conversion: rows.length ? redeemedRows.length / rows.length : null, lastRedeemedAt,
    recent: rows.slice(0, 8).map((r) => ({ tokenHint: `••••••${String(r.token).slice(-2)}`, status: r.status === "claimed" && Date.parse(r.expires_at) <= now ? "expired" : r.status, at: (r.redeemed_at as string) ?? (r.claimed_at as string) })),
  };
}

/** Why a public pass cannot be claimed right now, or undefined if it can. */
export function passClosedReason(c: Pick<CampaignView, "status" | "endsAt" | "maxRedemptions">, claimed: number): "ended" | "sold_out" | "not_active" | undefined {
  if (c.status === "draft") return "not_active";
  if (c.status === "ended" || Date.now() >= Date.parse(c.endsAt)) return "ended";
  if (claimed >= c.maxRedemptions) return "sold_out";
  return undefined;
}
