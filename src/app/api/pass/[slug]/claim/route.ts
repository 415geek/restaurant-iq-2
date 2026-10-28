import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { passClaimSchema } from "@/lib/validation/schemas";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { generateToken } from "@/lib/business/tastepass";

const TTL_MINUTES = 60 * 24 * 3; // a claimed pass is valid for 3 days or until the campaign ends
const MOMENT_TTL_MINUTES = 60 * 24 * 120; // passes timed to a moment stay valid until the campaign ends (the SQL clamps to ends_at)

/** Public claim. No account and no personal data: only a truncated hash of IP + campaign for abuse limits. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 }); }
  if (!passClaimSchema.safeParse(body).success) return NextResponse.json({ ok: false, reason: "consent_required" }, { status: 400 });
  const ip = clientIp(req);
  const rl = await checkDemoRateLimit({ ip, bucket: "claims", limit: 15 });
  if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  const db = getServiceClient();
  const { data: c } = await db.from("campaigns").select("id, restaurant_id, offer_name, moment").eq("slug", slug).maybeSingle();
  if (!c) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const ipHash = createHash("sha256").update(`${c.id}:${ip}`).digest("hex").slice(0, 24);
  for (let i = 0; i < 3; i++) {
    const { data, error } = await db.rpc("claim_pass", { p_campaign: c.id, p_token: generateToken(), p_ttl_minutes: c.moment ? MOMENT_TTL_MINUTES : TTL_MINUTES, p_ip_hash: ipHash });
    if (error) return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    const r = data as { ok: boolean; reason?: string; token?: string; expires_at?: string };
    if (!r.ok && r.reason === "collision") continue;
    if (r.ok) await db.from("decision_events").insert({ restaurant_id: c.restaurant_id, kind: "pass_claimed", subject_id: c.id, summary: `A visitor claimed a TastePass for "${c.offer_name}"`, payload: { lt: { key: "pass.evClaimed", params: { name: c.offer_name } }, campaignId: c.id }, actor: "public-visitor" });
    return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
}
