/** Sales data and Business Brain tables: readable per RLS, never writable from the public API (real Supabase). */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEMO = "00000000-0000-4000-8000-000000000101";
const run = url && anon ? describe : describe.skip;

run("data ingest + brain RLS", () => {
  const pub = () => createClient(url!, anon!, { auth: { persistSession: false } });
  it("anon can read the synthetic demo tenant's records and memories", async () => {
    for (const tbl of ["sales_records", "data_uploads", "brain_memories"]) {
      const { error } = await pub().from(tbl).select("*").eq("restaurant_id", DEMO).limit(1);
      expect(error).toBeNull();
    }
  });
  it("anon cannot write sales records, uploads or memories", async () => {
    const a = await pub().from("brain_memories").insert({ restaurant_id: DEMO, kind: "insight", key: "x", title: "Injected", source: "test" });
    expect(a.error).not.toBeNull();
    const b = await pub().from("data_uploads").insert({ restaurant_id: DEMO, file_name: "x", file_type: "csv", size_bytes: 1, sha256: "0".repeat(64), status: "imported", mapping_method: "rules", created_by: "test" });
    expect(b.error).not.toBeNull();
    const c = await pub().from("sales_records").delete().eq("restaurant_id", DEMO).select("id");
    expect(c.data ?? []).toHaveLength(0);
  });
  it("anon cannot read a private tenant's sales", async () => {
    const { data } = await pub().from("sales_records").select("id").neq("restaurant_id", DEMO).limit(5);
    expect(data ?? []).toHaveLength(0);
  });
});
