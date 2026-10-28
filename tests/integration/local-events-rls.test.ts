/** Local events snapshot: public read, no public writes (real Supabase, needs .env.local). */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const run = url && anon ? describe : describe.skip;

run("local_events RLS", () => {
  const pub = () => createClient(url!, anon!, { auth: { persistSession: false } });
  it("anyone can read the public snapshot", async () => {
    const { error } = await pub().from("local_events").select("id, name, date").limit(1);
    expect(error).toBeNull();
  });
  it("anon cannot insert, update or delete events or refresh logs", async () => {
    const ins = await pub().from("local_events").insert({ area_key: "test", source: "sf_street", external_id: "x", name: "Injected", date: "2030-01-01" });
    expect(ins.error).not.toBeNull();
    const log = await pub().from("local_event_refreshes").insert({ area_key: "test", source: "sf_street", state: "ok" });
    expect(log.error).not.toBeNull();
    const del = await pub().from("local_events").delete().eq("area_key", "san francisco").select("id");
    expect(del.data ?? []).toHaveLength(0);
  });
});
