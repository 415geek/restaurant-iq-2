/**
 * Runs the bounded agent workflow for the seeded demo restaurant against the real Supabase project.
 * Mode follows QLOO_API_KEY presence. Usage: bun scripts/run-demo-analysis.ts [restaurantId]
 */
import { createClient } from "@supabase/supabase-js";
import { SupabaseAnalysisStore } from "../src/lib/agents/store";
import { runAnalysis } from "../src/lib/agents/orchestrator";
import { createQlooProvider } from "../src/lib/providers/qloo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase service credentials"); process.exit(1); }
const restaurantId = process.argv[2] ?? "00000000-0000-4000-8000-000000000101";
const db = createClient(url, key, { auth: { persistSession: false } });
const store = new SupabaseAnalysisStore(db);
const provider = createQlooProvider(process.env, { store });
console.log(`mode=${provider.mode} restaurant=${restaurantId}`);
const res = await runAnalysis({ store, provider, restaurantId, actor: "script" });
console.log(JSON.stringify({ runId: res.runId, status: res.status, mode: res.mode, viable: res.viableCount, noViable: res.noViableOpportunity, failures: res.evidenceFailures, evaluator: res.evaluator.passed, top: res.hypotheses.slice(0, 4).map((h) => `${h.hypothesis.rank}. ${h.hypothesis.slug} [${h.hypothesis.evidenceLabel}]`) }, null, 2));
