/**
 * TastePass data safety against the real Supabase project (needs .env.local).
 * Pass codes are never readable through the public API, claim/redeem functions are server-only,
 * and concurrent redemptions of one code count exactly once.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateToken, newSlug } from "@/lib/business/tastepass";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_RESTAURANT = "00000000-0000-4000-8000-000000000101";
const run = url && anon && service ? describe : describe.skip;

run("TastePass RLS and atomicity", () => {
  let admin: SupabaseClient; let pub: SupabaseClient; let campaignId = "";
  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    pub = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data, error } = await admin.from("campaigns").insert({
      restaurant_id: DEMO_RESTAURANT, slug: newSlug(), offer_name: "RLS test pass", menu_item: "Test", regular_price: 10, offer_price: 8,
      variable_cost: 3, fee_pct: 0.03, fixed_spend: 0, max_redemptions: 3, ends_at: new Date(Date.now() + 86400_000).toISOString(),
      decision: "go", status: "active", mode: "sandbox", created_by: "test",
    }).select("id").single();
    if (error) throw error;
    campaignId = data.id;
  }, 30_000);
  afterAll(async () => { if (campaignId) await admin.from("campaigns").delete().eq("id", campaignId); });

  it("anon can read a demo campaign but cannot create or change one", async () => {
    const r = await pub.from("campaigns").select("id, offer_name").eq("id", campaignId);
    expect(r.data?.length).toBe(1);
    const ins = await pub.from("campaigns").insert({ restaurant_id: DEMO_RESTAURANT, slug: newSlug(), offer_name: "hack", menu_item: "x", regular_price: 1, offer_price: 1, variable_cost: 0, max_redemptions: 1, ends_at: new Date(Date.now() + 1e7).toISOString(), decision: "go" });
    expect(ins.error).toBeTruthy();
    await pub.from("campaigns").update({ offer_price: 0 }).eq("id", campaignId);
    const after = await admin.from("campaigns").select("offer_price").eq("id", campaignId).single();
    expect(Number(after.data!.offer_price)).toBe(8);
  });

  it("claim and redeem functions are not callable by anon", async () => {
    const c = await pub.rpc("claim_pass", { p_campaign: campaignId, p_token: generateToken(), p_ttl_minutes: 60, p_ip_hash: "x" });
    expect(c.error).toBeTruthy();
    const r = await pub.rpc("redeem_pass", { p_campaign: campaignId, p_token: "ABCDEFGH", p_actor: "anon" });
    expect(r.error).toBeTruthy();
  });

  it("pass codes are never readable through the public API, even for the demo tenant", async () => {
    const token = generateToken();
    const c = await admin.rpc("claim_pass", { p_campaign: campaignId, p_token: token, p_ttl_minutes: 60, p_ip_hash: "h1" });
    expect((c.data as { ok: boolean }).ok).toBe(true);
    const r = await pub.from("pass_claims").select("token").eq("campaign_id", campaignId);
    expect(r.data ?? []).toEqual([]);
  });

  it("five concurrent redemptions of one code count once", async () => {
    const token = generateToken();
    await admin.rpc("claim_pass", { p_campaign: campaignId, p_token: token, p_ttl_minutes: 60, p_ip_hash: "h2" });
    const results = await Promise.all(Array.from({ length: 5 }, () => admin.rpc("redeem_pass", { p_campaign: campaignId, p_token: token, p_actor: "test" })));
    const oks = results.filter((r) => (r.data as { ok: boolean }).ok).length;
    expect(oks).toBe(1);
    expect(results.filter((r) => (r.data as { reason?: string }).reason === "already_redeemed").length).toBe(4);
  });

  it("cap, expiry and unknown codes are enforced", async () => {
    const third = await admin.rpc("claim_pass", { p_campaign: campaignId, p_token: generateToken(), p_ttl_minutes: 60, p_ip_hash: "h3" });
    expect((third.data as { ok: boolean }).ok).toBe(true);
    const fourth = await admin.rpc("claim_pass", { p_campaign: campaignId, p_token: generateToken(), p_ttl_minutes: 60, p_ip_hash: "h4" });
    expect((fourth.data as { reason: string }).reason).toBe("sold_out");
    const { data: one } = await admin.from("pass_claims").select("token").eq("campaign_id", campaignId).eq("status", "claimed").limit(1).single();
    await admin.from("pass_claims").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("campaign_id", campaignId).eq("token", one!.token);
    const exp = await admin.rpc("redeem_pass", { p_campaign: campaignId, p_token: one!.token, p_actor: "test" });
    expect((exp.data as { reason: string }).reason).toBe("expired");
    const nf = await admin.rpc("redeem_pass", { p_campaign: campaignId, p_token: "ZZZZ2222", p_actor: "test" });
    expect((nf.data as { reason: string }).reason).toBe("not_found");
  });
});
