import { NextResponse } from "next/server";
import { campaignCreateSchema } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { computePassEconomics, newSlug } from "@/lib/business/tastepass";

/**
 * Create a TastePass from one opportunity hypothesis. With approve=true and a GO verdict the pass goes live
 * (sandbox for the demo tenant) and an approval + launch task + decision event are recorded together.
 * Economics are recomputed here from the submitted inputs; the client's numbers are never trusted.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid campaign", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const p = parsed.data;
  const db = getServiceClient();
  const { data: h } = await db.from("opportunity_hypotheses").select("id, restaurant_id, title, slug, status, qloo_variant").eq("id", p.hypothesisId).maybeSingle();
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeRestaurant(h.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  if (h.status === "rejected") return NextResponse.json({ error: "This idea was rejected" }, { status: 409 });

  const { data: org } = await db.from("restaurants").select("organizations!inner(is_demo)").eq("id", h.restaurant_id).maybeSingle();
  const isDemo = Boolean((org as unknown as { organizations?: { is_demo: boolean } } | null)?.organizations?.is_demo);
  const economics = computePassEconomics(p);
  const goLive = p.approve && economics.decision === "go";
  if (p.approve && economics.decision === "no_go") return NextResponse.json({ error: "NO-GO: contribution per redemption is zero or negative", economics }, { status: 409 });

  const now = new Date();
  const citations = (((h.qloo_variant ?? {}) as { citations?: unknown[] }).citations ?? []).slice(0, 4);
  const actor = actorLabel(access);
  let actionId: string | null = null;
  if (goLive) {
    const { data: a, error: ae } = await db.from("action_items").insert({
      hypothesis_id: h.id, restaurant_id: h.restaurant_id, title: `Launch TastePass: ${p.offerName}`, title_lt: { key: "pass.taskTitle", params: { name: p.offerName } },
      description: "Share the public pass link or QR code. Redeem tokens at the counter.", description_lt: { key: "pass.taskDesc" },
      status: "ready", requires_approval: true, external_side_effect: true, owner: "Owner",
    }).select("id").single();
    if (ae || !a) return NextResponse.json({ error: "Could not record launch task" }, { status: 500 });
    actionId = a.id;
    await db.from("approvals").insert({ action_item_id: a.id, restaurant_id: h.restaurant_id, approved_by: access.kind === "member" ? access.userId : null, actor_label: actor, decision: "approved", note: "TastePass approved" });
  }
  let slug = newSlug();
  for (let i = 0; i < 3; i++) {
    const { data: clash } = await db.from("campaigns").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = newSlug();
  }
  const { data: c, error } = await db.from("campaigns").insert({
    restaurant_id: h.restaurant_id, hypothesis_id: h.id, action_item_id: actionId, slug,
    offer_name: p.offerName, menu_item: p.menuItem, regular_price: p.regularPrice, offer_price: p.offerPrice, variable_cost: p.variableCost,
    fee_pct: p.feePct, fixed_spend: p.fixedSpend, max_redemptions: p.maxRedemptions, starts_at: now.toISOString(),
    ends_at: new Date(now.getTime() + p.days * 86400_000).toISOString(), terms: p.terms, why: h.slug, evidence: citations, economics,
    decision: economics.decision, status: goLive ? "active" : "draft", mode: isDemo ? "sandbox" : "live", created_by: actor, approved_at: goLive ? now.toISOString() : null,
  }).select("id, slug, status").single();
  if (error || !c) return NextResponse.json({ error: "Could not create campaign" }, { status: 500 });
  if (h.status === "proposed") await db.from("opportunity_hypotheses").update({ status: "pursued" }).eq("id", h.id);
  await db.from("decision_events").insert({
    restaurant_id: h.restaurant_id, kind: goLive ? "campaign_approved" : "campaign_drafted", subject_id: c.id,
    summary: `${goLive ? "Approved" : "Drafted"} TastePass "${p.offerName}" (${economics.decision.toUpperCase()}, $${economics.contributionPerRedemption.toFixed(2)} per redemption, break-even ${economics.breakEvenRedemptions ?? "n/a"})`,
    payload: { lt: { key: goLive ? "pass.evApproved" : "pass.evDrafted", params: { name: p.offerName, c: economics.contributionPerRedemption.toFixed(2), be: String(economics.breakEvenRedemptions ?? "—") } }, campaignId: c.id, hypothesisId: h.id, economics, mode: isDemo ? "sandbox" : "live" },
    actor,
  });
  return NextResponse.json({ ok: true, id: c.id, slug: c.slug, status: c.status, economics });
}
