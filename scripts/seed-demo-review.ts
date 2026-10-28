/**
 * Seeds ONE past, ended TastePass on the fictional demo restaurant so the experiment review has a worked example.
 * Its dates (Mon Oct 19 – Sun Oct 25, 2026, Pacific) sit inside the synthetic sample sales (Sep 14 – Oct 25), so the
 * review compares that week with the 4 weeks before it. Claims/redemptions are synthetic demo events, like everything
 * on the demo tenant. Idempotent: re-running replaces the previous seed. Usage: bun --env-file=.env.local scripts/seed-demo-review.ts
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DEMO = "00000000-0000-4000-8000-000000000101";
const TAG = "seed:demo-review";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const token = () => Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const slug = () => Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[randomInt(36)]).join("");

const { data: tmpl, error: e1 } = await db.from("campaigns").select("*").eq("restaurant_id", DEMO).eq("menu_item", "Cucumber Salad").neq("created_by", TAG).order("created_at").limit(1).maybeSingle();
if (e1 || !tmpl) throw e1 ?? new Error("no template campaign: approve the plant-forward pass on the demo first");
await db.from("campaigns").delete().eq("restaurant_id", DEMO).eq("created_by", TAG);

const startsAt = "2026-10-19T07:00:00.000Z"; // Mon Oct 19 00:00 PDT
const endsAt = "2026-10-26T07:00:00.000Z";   // Mon Oct 26 00:00 PDT
const { id: _id, slug: _s, request_id: _r, created_at: _c, updated_at: _u, page_views: _p, action_item_id: _a, ...rest } = tmpl;
const { data: c, error: e2 } = await db.from("campaigns").insert({ ...rest, slug: slug(), offer_name: "Plant-forward mini-menu (past week)", status: "ended", starts_at: startsAt, ends_at: endsAt, approved_at: "2026-10-18T22:00:00.000Z", created_at: "2026-10-18T22:00:00.000Z", created_by: TAG, page_views: 61, max_redemptions: 50 }).select("id").single();
if (e2 || !c) throw e2;

const claims = Array.from({ length: 12 }, (_, i) => {
  // spread over the week, inside opening hours (11:00–20:00 PDT = 18:00–03:00Z)
  const at = Date.parse(startsAt) + Math.floor(i * 7 / 12) * 86400_000 + (11 + (i * 5) % 9) * 3600_000 + 15 * 60_000;
  const redeemed = i % 12 < 7;
  return { campaign_id: c.id, restaurant_id: DEMO, token: token(), status: redeemed ? "redeemed" : "claimed", claimed_at: new Date(at).toISOString(), expires_at: new Date(at + 2 * 86400_000).toISOString(), redeemed_at: redeemed ? new Date(at + 40 * 60_000).toISOString() : null, redeemed_by: redeemed ? "demo-merchant" : null };
});
const { error: e3 } = await db.from("pass_claims").insert(claims);
if (e3) throw e3;
console.log("seeded past pass", c.id, "claims", claims.length, "redeemed", claims.filter((x) => x.status === "redeemed").length);
