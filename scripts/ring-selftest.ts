/**
 * End-to-end check of the Ring webhook against a running server, with a fake linked account.
 * Usage: bun scripts/ring-selftest.ts [baseUrl]. Cleans up everything it creates.
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const KEY = process.env.RING_HMAC_KEY!;
const ACC = "ava1.ring.account.SELFTEST";
const DEMO = "00000000-0000-4000-8000-000000000101";
const stamp = Date.now();

async function send(body: object, sign = true) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", KEY).update(raw).digest("hex");
  const r = await fetch(`${base}/api/ring/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...(sign ? { "X-Signature": `sha256=${sig}` } : { "X-Signature": "sha256=" + "0".repeat(64) }) }, body: raw });
  return { status: r.status, json: await r.json() };
}
const ev = (rid: string, sub: string) => ({ meta: { version: "1.1", request_id: rid, account_id: ACC, time: new Date().toISOString() }, data: { id: `x_motion_${stamp}`, type: "motion_detected", attributes: { source: "selftest-device", source_type: "devices", timestamp: stamp, sub_type: sub } } });

let fail = 0;
const check = (name: string, ok: boolean, info?: unknown) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(info)}`); if (!ok) fail++; };
try {
  await db.from("ring_connections").upsert({ account_id: ACC, restaurant_id: DEMO, status: "linked", token_enc: "selftest", token_expires_at: new Date(stamp + 3600e3).toISOString(), linked_at: new Date().toISOString() }, { onConflict: "account_id" });
  const rid = `selftest-${stamp}`;
  let r = await send(ev(rid, "human")); check("human motion stored", r.status === 200 && r.json.stored === true, r);
  r = await send(ev(rid, "human")); check("retry is idempotent", r.status === 200, r);
  r = await send(ev(`${rid}-v`, "vehicle")); check("vehicle dropped", r.status === 200 && r.json.stored === false, r);
  r = await send(ev(`${rid}-bad`, "human"), false); check("bad signature rejected", r.status === 401, r);
  const { count } = await db.from("ring_events").select("id", { count: "exact", head: true }).like("request_id", `${rid}%`);
  check("exactly one row", count === 1, { count });
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: conns } = await anon.from("ring_connections").select("account_id");
  check("anon cannot read connections", !conns || conns.length === 0, conns);
  const { error: insErr } = await anon.from("ring_events").insert({ restaurant_id: DEMO, request_id: "anon", kind: "person_motion", occurred_at: new Date().toISOString(), device_ref: "000000000000" });
  check("anon cannot insert events", !!insErr);
  r = await send({ meta: { account_id: ACC, request_id: `${rid}-rm` }, data: { type: "app_integration_removed", attributes: { source: ACC, source_type: "users" } } });
  const { data: c } = await db.from("ring_connections").select("status").eq("account_id", ACC).single();
  check("unlink revokes", r.status === 200 && c?.status === "revoked", { r, c });
} finally {
  await db.from("ring_events").delete().like("request_id", `selftest-${stamp}%`);
  await db.from("ring_connections").delete().eq("account_id", ACC);
}
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
