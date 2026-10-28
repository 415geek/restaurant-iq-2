import { NextResponse } from "next/server";
import { redeemSchema } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { normalizeToken, TOKEN_RE } from "@/lib/business/tastepass";

/**
 * Merchant redemption. Members of the restaurant's organization redeem as themselves.
 * The synthetic demo tenant has an isolated "demo merchant" role so judges can complete the loop without an account;
 * it is rate-limited and can only touch demo campaigns. Private tenants require membership.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const token = normalizeToken(parsed.data.token);
  if (!TOKEN_RE.test(token)) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const db = getServiceClient();
  const { data: c } = await db.from("campaigns").select("id, restaurant_id, offer_name").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const access = await authorizeRestaurant(c.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "redeem", limit: 40 });
  if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  const actor = access.kind === "member" ? actorLabel(access) : "demo-merchant";
  const { data, error } = await db.rpc("redeem_pass", { p_campaign: id, p_token: token, p_actor: actor, p_sale: parsed.data.verifiedSale ?? null });
  if (error) return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  const r = data as { ok: boolean; reason?: string; redeemed_at?: string };
  if (r.ok) {
    await db.from("decision_events").insert({ restaurant_id: c.restaurant_id, kind: "pass_redeemed", subject_id: id, summary: `Redeemed a TastePass for "${c.offer_name}" (token ••••••${token.slice(-2)})`, payload: { lt: { key: "pass.evRedeemed", params: { name: c.offer_name, hint: token.slice(-2) } }, campaignId: id, verifiedSale: parsed.data.verifiedSale ?? null }, actor });
  }
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === "not_found" ? 404 : 409 });
}
