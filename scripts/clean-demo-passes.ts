/**
 * Removes ended TastePass campaigns from the synthetic demo tenant (test noise), keeping active ones.
 * Memory events are immutable and stay. Usage: bun --env-file=.env.local scripts/clean-demo-passes.ts
 */
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DEMO = "00000000-0000-4000-8000-000000000101";
const { data: before } = await db.from("campaigns").select("id, offer_name, status").eq("restaurant_id", DEMO);
console.log("before", (before ?? []).map((c) => `${c.status}:${c.offer_name}`));
// The seeded past pass (scripts/seed-demo-review.ts) is kept: it is the worked example for the experiment review.
const { error, count } = await db.from("campaigns").delete({ count: "exact" }).eq("restaurant_id", DEMO).eq("status", "ended").neq("created_by", "seed:demo-review");
if (error) throw error;
console.log("deleted ended", count);
