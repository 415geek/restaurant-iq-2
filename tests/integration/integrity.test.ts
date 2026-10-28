/** Transactions and idempotency added after review (real Supabase; needs .env.local). */
import { describe, it, expect, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO = "00000000-0000-4000-8000-000000000101";
const run = url && anon && service ? describe : describe.skip;

run("create_campaign + import_sales", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const pub = createClient(url!, anon!, { auth: { persistSession: false } });
  const cleanup: Array<() => Promise<unknown>> = [];
  afterAll(async () => { for (const f of cleanup) await f(); });

  it("the same request id creates exactly one campaign, task and approval (retries are safe)", async () => {
    const { data: h } = await admin.from("opportunity_hypotheses").select("id").eq("restaurant_id", DEMO).limit(1).single();
    const rid = randomUUID(); const slug = `t${randomUUID().replace(/-/g, "").slice(0, 9)}`;
    const p = { request_id: rid, go_live: true, restaurant_id: DEMO, hypothesis_id: h!.id, slug, task_title: "Test task", task_desc: "x", actor: "test", approved_by: "",
      offer_name: "Integrity test pass", menu_item: "Test", regular_price: 10, offer_price: 9, variable_cost: 3, fee_pct: 0.03, fixed_spend: 0, max_redemptions: 5,
      starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86400_000).toISOString(), terms: "", why: "test", evidence: [], economics: {}, decision: "go", mode: "sandbox",
      decision_basis: { source: "idea" }, event_summary: "test", event_payload: {} };
    const [a, b] = await Promise.all([admin.rpc("create_campaign", { p }), admin.rpc("create_campaign", { p })]).then((rs) => rs.map((r) => r.data as { id: string; replayed: boolean } | null));
    const ids = [a?.id, b?.id].filter(Boolean);
    const { data: rows } = await admin.from("campaigns").select("id, action_item_id").eq("request_id", rid);
    cleanup.push(async () => { for (const r of rows ?? []) { await admin.from("campaigns").delete().eq("id", r.id); if (r.action_item_id) await admin.from("action_items").delete().eq("id", r.action_item_id); } });
    expect(rows).toHaveLength(1);
    expect(new Set(ids).size).toBe(1);
    const again = await admin.rpc("create_campaign", { p });
    expect((again.data as { replayed: boolean }).replayed).toBe(true);
    const { count } = await admin.from("approvals").select("id", { count: "exact", head: true }).eq("action_item_id", rows![0].action_item_id);
    expect(count).toBe(1);
  });

  it("overlapping reports: rows already present are skipped, in one transaction", async () => {
    const row = (key: string, amt: number) => ({ platform: "other", channel: "unknown", order_id: key, ordered_at: "2026-10-12T19:00:00Z", item_name: null, quantity: null, gross_sales: amt, discounts: null, net_sales: amt, tax: null, tip: null, platform_fees: null, payout: null, refunds: null, status: "completed", row_ref: 1, grain: "order", has_time: true, dedupe_key: `o|other|it-${key}|1` });
    const tag = randomUUID().slice(0, 8);
    const up = (n: string) => ({ restaurant_id: DEMO, file_name: `integrity-${n}.csv`, file_type: "csv", size_bytes: 1, sha256: createHash("sha256").update(tag + n).digest("hex"), platform: "other", row_count: 2, mapping: [], mapping_method: "rules", header_fingerprint: null, created_by: "test", rejected_count: 0 });
    const day = await admin.rpc("import_sales", { p_upload: up("day"), p_rows: [row(`${tag}-A`, 20)] });
    const week = await admin.rpc("import_sales", { p_upload: up("week"), p_rows: [row(`${tag}-A`, 20), row(`${tag}-B`, 15)] });
    cleanup.push(async () => { await admin.from("data_uploads").delete().like("file_name", "integrity-%"); });
    expect(day.data).toMatchObject({ ok: true, inserted: 1, overlapping: 0 });
    expect(week.data).toMatchObject({ ok: true, inserted: 1, overlapping: 1 });
    const { data: recs } = await admin.from("sales_records").select("net_sales").like("dedupe_key", `o|other|it-${tag}%`);
    expect((recs ?? []).reduce((s, r) => s + Number(r.net_sales), 0)).toBe(35);
  });

  it("anon cannot call either function", async () => {
    expect((await pub.rpc("create_campaign", { p: {} })).error).not.toBeNull();
    expect((await pub.rpc("import_sales", { p_upload: {}, p_rows: [] })).error).not.toBeNull();
  });
});
