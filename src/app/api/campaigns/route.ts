import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { campaignCreateSchema } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { computePassEconomics, newSlug } from "@/lib/business/tastepass";
import { buildDecisionBasis } from "@/lib/pass-evidence";

/**
 * Create a TastePass. Economics are recomputed here; the decision basis (idea, cultural anchor or local moment, the Qloo evidence
 * behind it, rejected alternatives) is rebuilt on the server. Task + approval + campaign + idea status + event are written in one
 * database transaction (public.create_campaign), and a client request id makes retries idempotent.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid campaign", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const p = parsed.data;
  const db = getServiceClient();
  const { data: h } = await db.from("opportunity_hypotheses").select("id, run_id, restaurant_id, title, slug, status, evidence_label, qloo_variant").eq("id", p.hypothesisId).maybeSingle();
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeRestaurant(h.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  if (h.status === "rejected") return NextResponse.json({ error: "This idea was rejected" }, { status: 409 });

  const requestId = p.requestId ?? randomUUID();
  const { data: replay } = await db.from("campaigns").select("id, slug, status, economics").eq("request_id", requestId).maybeSingle();
  if (replay) return NextResponse.json({ ok: true, id: replay.id, slug: replay.slug, status: replay.status, economics: replay.economics, replayed: true });

  const { data: r } = await db.from("restaurants").select("id, city, cuisine, organizations!inner(is_demo)").eq("id", h.restaurant_id).maybeSingle();
  const isDemo = Boolean((r as unknown as { organizations?: { is_demo: boolean } } | null)?.organizations?.is_demo);
  const economics = computePassEconomics(p);
  const goLive = p.approve && economics.decision === "go";
  if (p.approve && economics.decision === "no_go") return NextResponse.json({ error: "NO-GO: contribution per redemption is zero or negative", economics }, { status: 409 });

  const { basis, citations } = await buildDecisionBasis(db, { restaurant: { id: h.restaurant_id, city: r?.city ?? null, cuisine: r?.cuisine ?? "" }, hypothesis: h, anchor: p.anchor, moment: p.moment });
  const now = new Date(); const actor = actorLabel(access);
  let slug = newSlug();
  for (let i = 0; i < 3; i++) { const { data: clash } = await db.from("campaigns").select("id").eq("slug", slug).maybeSingle(); if (!clash) break; slug = newSlug(); }
  const summary = `${goLive ? "Approved" : "Drafted"} TastePass "${p.offerName}" (${economics.decision.toUpperCase()}, $${economics.contributionPerRedemption.toFixed(2)} per redemption, break-even ${economics.breakEvenRedemptions ?? "n/a"}, worst-case loss $${economics.maxExposure.toFixed(2)}, basis: ${basis.source})`;
  const { data, error } = await db.rpc("create_campaign", { p: {
    request_id: requestId, go_live: goLive, restaurant_id: h.restaurant_id, hypothesis_id: h.id, slug,
    task_title: `Launch TastePass: ${p.offerName}`, task_title_lt: { key: "pass.taskTitle", params: { name: p.offerName } },
    task_desc: "Share the public pass link or QR code. Redeem tokens at the counter.", task_desc_lt: { key: "pass.taskDesc" },
    approved_by: access.kind === "member" ? access.userId : "", actor,
    offer_name: p.offerName, menu_item: p.menuItem, regular_price: p.regularPrice, offer_price: p.offerPrice, variable_cost: p.variableCost, fee_pct: p.feePct,
    fixed_spend: p.fixedSpend, max_redemptions: p.maxRedemptions, starts_at: now.toISOString(), ends_at: new Date(now.getTime() + p.days * 86400_000).toISOString(),
    terms: p.terms, moment: p.moment ?? null, why: h.slug, evidence: citations, economics, decision: economics.decision, mode: isDemo ? "sandbox" : "live", decision_basis: basis,
    event_summary: summary,
    event_payload: { lt: { key: goLive ? "pass.evApproved" : "pass.evDrafted", params: { name: p.offerName, c: economics.contributionPerRedemption.toFixed(2), be: String(economics.breakEvenRedemptions ?? "—") } }, hypothesisId: h.id, economics, basis: { source: basis.source, anchor: basis.anchor?.name, moment: basis.moment?.name, evidenceError: basis.evidenceError }, mode: isDemo ? "sandbox" : "live" },
  } });
  if (error || !data) {
    // A concurrent retry with the same request id may have won the race: return that campaign instead of an error.
    const { data: won } = await db.from("campaigns").select("id, slug, status").eq("request_id", requestId).maybeSingle();
    if (won) return NextResponse.json({ ok: true, id: won.id, slug: won.slug, status: won.status, economics, replayed: true });
    return NextResponse.json({ error: "Could not create campaign (nothing was saved)" }, { status: 500 });
  }
  const out = data as { id: string; slug: string; status: string; replayed: boolean };
  return NextResponse.json({ ok: true, id: out.id, slug: out.slug, status: out.status, economics, replayed: out.replayed });
}
