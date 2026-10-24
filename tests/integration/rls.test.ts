/**
 * RLS cross-tenant test against the real Supabase project (needs .env.local).
 * Skipped when credentials are absent so unit runs stay green.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_RESTAURANT = "00000000-0000-4000-8000-000000000101";
const run = url && anon && service ? describe : describe.skip;

run("RLS", () => {
  let admin: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  const emails = { a: `rls-a-${Date.now()}@example.test`, b: `rls-b-${Date.now()}@example.test` };
  const ids: { a?: string; b?: string; org?: string; restaurant?: string } = {};

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    for (const k of ["a", "b"] as const) {
      const { data, error } = await admin.auth.admin.createUser({ email: emails[k], password: "Rls-test-password-1", email_confirm: true });
      if (error) throw error;
      ids[k] = data.user!.id;
    }
    a = createClient(url!, anon!, { auth: { persistSession: false } });
    b = createClient(url!, anon!, { auth: { persistSession: false } });
    const sa = await a.auth.signInWithPassword({ email: emails.a, password: "Rls-test-password-1" });
    const sb = await b.auth.signInWithPassword({ email: emails.b, password: "Rls-test-password-1" });
    if (sa.error || sb.error) throw sa.error ?? sb.error;
  }, 60_000);

  afterAll(async () => {
    if (ids.org) await admin.from("organizations").delete().eq("id", ids.org);
    for (const k of ["a", "b"] as const) if (ids[k]) await admin.auth.admin.deleteUser(ids[k]!);
  });

  it("anon can read the demo restaurant but cannot write to it", async () => {
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await anonClient.from("restaurants").select("id,name").eq("id", DEMO_RESTAURANT);
    expect(data?.length).toBe(1);
    const ins = await anonClient.from("menu_items").insert({ restaurant_id: DEMO_RESTAURANT, name: "hack", category: "x" });
    expect(ins.error).toBeTruthy();
  });

  it("user A creates an org + restaurant; user B and anon cannot see or edit it", async () => {
    const { data: orgId, error } = await a.rpc("create_organization", { org_name: "Tenant A" });
    expect(error).toBeNull();
    ids.org = orgId as string;
    const r = await a.from("restaurants").insert({ organization_id: ids.org, name: "A's place", cuisine: "test" }).select("id").single();
    expect(r.error).toBeNull();
    ids.restaurant = r.data!.id;

    const mine = await a.from("restaurants").select("id").eq("id", ids.restaurant);
    expect(mine.data?.length).toBe(1);

    const theirs = await b.from("restaurants").select("id").eq("id", ids.restaurant);
    expect(theirs.data?.length ?? 0).toBe(0);

    const upd = await b.from("restaurants").update({ name: "pwned" }).eq("id", ids.restaurant).select("id");
    expect(upd.data?.length ?? 0).toBe(0);

    const anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const anonRead = await anonClient.from("restaurants").select("id").eq("id", ids.restaurant);
    expect(anonRead.data?.length ?? 0).toBe(0);

    const bInsert = await b.from("menu_items").insert({ restaurant_id: ids.restaurant, name: "x", category: "y" });
    expect(bInsert.error).toBeTruthy();

    const ev = await a.from("decision_events").insert({ restaurant_id: ids.restaurant, kind: "test", summary: "s" }).select("id").single();
    expect(ev.error).toBeNull();
    const del = await admin.from("decision_events").delete().eq("id", ev.data!.id);
    expect(del.error?.message ?? "").toMatch(/immutable/);
  });

  it("anon cannot read operational tables", async () => {
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const u = await anonClient.from("usage_events").select("id").limit(1);
    expect(u.data?.length ?? 0).toBe(0);
    const c = await anonClient.from("provider_cache").select("cache_key").limit(1);
    expect(c.data?.length ?? 0).toBe(0);
  });
});
