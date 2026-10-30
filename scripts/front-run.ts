/**
 * Runs TasteFront for one store from the command line: maps menu tags, runs the agent (Qloo on + baseline), writes draft versions.
 * Usage: bun --conditions=react-server --env-file=.env.local scripts/front-run.ts <store-slug> [qloo|baseline|both] [--publish]
 */
import { getServiceClient } from "@/lib/db/server";
import { createQlooProvider } from "@/lib/providers/qloo";
import { SupabaseAnalysisStore } from "@/lib/agents/store";
import { runStorefrontAgent } from "@/lib/front/agent";
import { createRun, createVersion, currentVersion, getGuardrails, getItems, getStoreBySlug, getVersions, publishVersion, updateItemTags, updateRun } from "@/lib/front/db";
import { mapMenuTags } from "@/lib/front/menu/tags";
import type { VersionSource } from "@/lib/front/types";

const slug = process.argv[2]; const which = (process.argv[3] ?? "both") as VersionSource | "both"; const publish = process.argv.includes("--publish");
if (!slug) throw new Error("usage: front-run.ts <store-slug> [qloo|baseline|both] [--publish]");
const db = getServiceClient();
const store = await getStoreBySlug(db, slug);
if (!store) throw new Error(`no store ${slug}`);
const provider = createQlooProvider(process.env, { store: new SupabaseAnalysisStore(db), traceId: `cli-${slug}` });
let items = await getItems(db, store.id);
if (items.some((i) => !i.qlooTagIds.length && !i.tagCandidates.length)) {
  const mapped = await mapMenuTags(items, async (q) => (await provider.findTags(q)).data, { concurrency: 3 });
  for (const r of mapped) { const it = items[r.index]; if (it) await updateItemTags(it.id, { qlooTagIds: r.qlooTagIds, tagCandidates: r.tagCandidates, ambiguous: r.ambiguous }); }
  items = await getItems(db, store.id);
  console.log(`tags: ${items.filter((i) => i.qlooTagIds.length).length}/${items.length} mapped, ${items.filter((i) => i.ambiguous).length} ambiguous (${provider.mode})`);
}
const guardrails = await getGuardrails(db, store.brandId);
const { count } = await db.from("front_stores").select("id", { count: "exact", head: true }).eq("brand_id", store.brandId ?? "00000000-0000-0000-0000-000000000000");
const parent = currentVersion(await getVersions(db, store.id));
for (const variant of (which === "both" ? ["qloo", "baseline"] : [which]) as VersionSource[]) {
  const runId = await createRun({ storeId: store.id, mode: provider.mode, variant, actor: "cli" });
  const t0 = Date.now();
  const out = await runStorefrontAgent({ store, items, guardrails, singleStore: (count ?? 1) <= 1, provider, variant, emit: (e) => console.log(`[${variant}] ${String(e.t).padStart(6)}ms ${e.step}: ${e.detail}`) });
  const v = await createVersion({ storeId: store.id, generatedBy: variant, runId, items: out.items, parentVersionId: parent?.id ?? null, moves: out.moves });
  await updateRun(runId, { status: "completed", events: out.events, calls: out.calls, moves: out.moves, caveats: out.caveats, versionId: v.id, finishedAt: new Date().toISOString() });
  console.log(`[${variant}] v${v.versionNo} ${v.id} · ${out.moves.length} moves (${out.moves.filter((m) => m.guardrail?.ok !== false).length} kept, ${out.moves.filter((m) => m.verified).length} verified) · model ${out.modelUsed ?? "none"} · ${Date.now() - t0}ms`);
  for (const m of out.moves) console.log(`   ${m.guardrail?.ok === false ? "✗" : m.verified ? "✓" : "⚠"} ${m.kind} ${(items.find((i) => i.id === m.itemId)?.nameEn ?? items.find((i) => i.id === m.itemId)?.name ?? m.itemId)} — ${m.rationale}${m.guardrail?.reason ? ` [${m.guardrail.reason}]` : ""}`);
  if (out.caveats.length) console.log("   caveats:", out.caveats.join(" | "));
  if (publish && variant === "qloo") { await publishVersion(v.id, "cli"); console.log(`   published v${v.versionNo}`); }
}
