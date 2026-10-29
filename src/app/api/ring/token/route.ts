import { NextResponse } from "next/server";
import { ringConfig, exchangeCode, fetchAccountId } from "@/lib/ring/server";
import { sealTokens } from "@/lib/ring/core";
import { getServiceClient } from "@/lib/db/server";

export const dynamic = "force-dynamic";

/**
 * Ring Token Exchange URL. Ring POSTs a single-use code (valid 60 s). We trade it for tokens, read only the account id,
 * and park the connection as "pending" until the owner confirms it on /ring/link. Any non-2xx means "link failed" to Ring.
 */
export async function POST(req: Request) {
  const cfg = ringConfig();
  if (!cfg) return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  let code = "";
  let clientId = "";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as { code?: string; client_id?: string };
      code = j.code ?? ""; clientId = j.client_id ?? "";
    } else {
      const f = new URLSearchParams(await req.text());
      code = f.get("code") ?? ""; clientId = f.get("client_id") ?? "";
    }
  } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!code || code.length > 2000) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (clientId && clientId !== cfg.clientId) return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  try {
    const tokens = await exchangeCode(cfg, code);
    const accountId = await fetchAccountId(tokens.access_token);
    const db = getServiceClient();
    const { data: existing } = await db.from("ring_connections").select("status, restaurant_id").eq("account_id", accountId).maybeSingle();
    const relink = existing?.status === "linked";
    const { error } = await db.from("ring_connections").upsert({
      account_id: accountId,
      token_enc: sealTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token }, cfg.clientSecret),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      status: relink ? "linked" : "pending",
      restaurant_id: relink ? existing?.restaurant_id : null,
      created_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: "account_id" });
    if (error) throw new Error(`store: ${error.message}`);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[ring] token exchange failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "exchange_failed" }, { status: 502 });
  }
}
