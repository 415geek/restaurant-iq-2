import { NextResponse } from "next/server";
import { ringConfig } from "@/lib/ring/server";
import { parseWebhook, verifyWebhookSignature } from "@/lib/ring/core";
import { getServiceClient } from "@/lib/db/server";

export const dynamic = "force-dynamic";

/**
 * Ring webhook. Signed with HMAC-SHA256 over the raw body. Must answer within 5 s.
 * We keep only person-motion events from linked accounts, as (time, hashed device). Everything else is acknowledged and dropped.
 */
export async function POST(req: Request) {
  const cfg = ringConfig();
  if (!cfg) return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!verifyWebhookSignature(raw, req.headers.get("x-signature"), cfg.hmacKey)) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = parseWebhook(payload);
  const db = getServiceClient();
  if (parsed.kind === "integration_removed") {
    // The owner unlinked in the Ring app: stop accepting events and drop the tokens.
    await db.from("ring_connections").update({ status: "revoked", revoked_at: new Date().toISOString(), token_enc: "revoked" }).eq("account_id", parsed.accountId);
    return NextResponse.json({ ok: true, stored: false });
  }
  if (parsed.kind === "ignored") return NextResponse.json({ ok: true, stored: false });
  const { data: conn, error: connErr } = await db.from("ring_connections").select("restaurant_id").eq("account_id", parsed.event.accountId).eq("status", "linked").maybeSingle();
  if (connErr) return NextResponse.json({ error: "store_unavailable" }, { status: 503 }); // 5xx: Ring retries
  if (!conn?.restaurant_id) return NextResponse.json({ ok: true, stored: false });
  const { error } = await db.from("ring_events").upsert(
    { restaurant_id: conn.restaurant_id, request_id: parsed.event.requestId, kind: "person_motion", occurred_at: parsed.event.occurredAt, device_ref: parsed.event.deviceRef },
    { onConflict: "request_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, stored: true });
}
