import { NextResponse } from "next/server";
import { z } from "zod";
import { ringConfig, completeLink } from "@/lib/ring/server";
import { isFreshLinkTime, nonceMatches, openTokens, passcodeMatches } from "@/lib/ring/core";
import { getServiceClient } from "@/lib/db/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { DEMO_RESTAURANT_ID } from "@/lib/queries";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  nonce: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
  time: z.string().regex(/^\d{12,14}$/),
  passcode: z.string().min(1).max(100),
});

/**
 * Owner confirms the Ring link. The passcode keeps strangers' Ring accounts out (this build has one restaurant to attach to).
 * The nonce proves which pending Ring account started this link: nonce = HMAC(time:account_id).
 */
export async function POST(req: Request) {
  const cfg = ringConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "not_enabled" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "ring-link", limit: 8 });
  if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 }); }
  const p = bodySchema.safeParse(body);
  if (!p.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  if (!isFreshLinkTime(p.data.time)) return NextResponse.json({ ok: false, reason: "expired" }, { status: 400 });
  if (!passcodeMatches(p.data.passcode, cfg.passcode)) return NextResponse.json({ ok: false, reason: "wrong_passcode" }, { status: 403 });

  const db = getServiceClient();
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: rows } = await db.from("ring_connections").select("id, account_id, token_enc, status").in("status", ["pending", "linked"]).gte("created_at", since).limit(50);
  const match = (rows ?? []).find((r) => nonceMatches(cfg.hmacKey, p.data.time, r.account_id, p.data.nonce));
  if (!match) return NextResponse.json({ ok: false, reason: "no_pending_link" }, { status: 404 });

  try {
    const tokens = openTokens(match.token_enc, cfg.clientSecret);
    const { data: r } = await db.from("restaurants").select("name").eq("id", DEMO_RESTAURANT_ID).maybeSingle();
    await completeLink(tokens.access_token, `Restaurant IQ · ${r?.name ?? "demo restaurant"}`, p.data.nonce);
  } catch (e) {
    console.error("[ring] link completion failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, reason: "ring_error" }, { status: 502 });
  }
  await db.from("ring_connections").update({ status: "linked", restaurant_id: DEMO_RESTAURANT_ID, linked_at: new Date().toISOString() }).eq("id", match.id);
  await db.from("decision_events").insert({
    restaurant_id: DEMO_RESTAURANT_ID, kind: "ring_linked", subject_id: match.id,
    summary: "Ring entrance camera connected (person-motion events only, no video)",
    payload: { lt: { key: "ring.evLinked", params: {} } }, actor: "owner",
  });
  return NextResponse.json({ ok: true });
}
