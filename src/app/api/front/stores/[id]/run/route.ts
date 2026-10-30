import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { createQlooProvider } from "@/lib/providers/qloo";
import { SupabaseAnalysisStore } from "@/lib/agents/store";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { actorLabel } from "@/lib/auth/authorize";
import { authorizeOrg } from "@/lib/front/auth";
import { runStorefrontAgent } from "@/lib/front/agent";
import { createRun, createVersion, currentVersion, getGuardrails, getItems, getStore, getVersions, updateRun } from "@/lib/front/db";
import type { RunEvent, VersionSource } from "@/lib/front/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const bodySchema = z.object({ variant: z.enum(["qloo", "baseline", "both"]).default("both") });

/**
 * Runs the agent for a store and streams NDJSON: {type:"event", variant, t, step, detail, callId?} … {type:"done", variant, runId, versionId, moves, caveats, modelUsed}.
 * Each variant writes a run row and a draft version. "both" runs Qloo on, then the neutral baseline (for the public on/off switch).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const store = await getStore(db, id);
  if (!store) return Response.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeOrg(store.organizationId);
  if (access.kind === "none") return Response.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "front-run", limit: 6, windowSeconds: 3600 });
  if (!rl.ok) return Response.json({ error: "Rate limit reached: 6 live runs per hour per visitor", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429 });
  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body = both */ }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const variants: VersionSource[] = parsed.data.variant === "both" ? ["qloo", "baseline"] : [parsed.data.variant];
  const actor = actorLabel(access);
  const [items, guardrails, versions] = await Promise.all([getItems(db, store.id), getGuardrails(db, store.brandId), getVersions(db, store.id)]);
  if (!items.length) return Response.json({ error: "This store has no menu yet" }, { status: 409 });
  const { count } = await db.from("front_stores").select("id", { count: "exact", head: true }).eq("brand_id", store.brandId ?? "00000000-0000-0000-0000-000000000000");
  const singleStore = !store.brandId || (count ?? 1) <= 1;
  const parent = currentVersion(versions);
  const provider = createQlooProvider(process.env, { store: new SupabaseAnalysisStore(db), traceId: `front-${store.slug}-${Date.now()}` });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      for (const variant of variants) {
        const runId = await createRun({ storeId: store.id, mode: provider.mode, variant, actor });
        send({ type: "start", variant, runId, mode: provider.mode });
        try {
          const out = await runStorefrontAgent({ store, items, guardrails, singleStore, provider, variant, emit: (e: RunEvent) => send({ type: "event", variant, ...e }) });
          const version = await createVersion({ storeId: store.id, generatedBy: variant, runId, items: out.items, parentVersionId: parent?.id ?? null, moves: out.moves });
          await updateRun(runId, { status: "completed", events: out.events, calls: out.calls, moves: out.moves, caveats: out.caveats, versionId: version.id, finishedAt: new Date().toISOString() });
          send({ type: "done", variant, runId, versionId: version.id, versionNo: version.versionNo, moves: out.moves, caveats: out.caveats, modelUsed: out.modelUsed, mode: provider.mode, calls: out.calls.map((c) => ({ id: c.id, purpose: c.purpose, endpoint: c.provenance.endpoint, cacheHit: c.provenance.cacheHit, facts: c.facts.length, error: c.error })) });
        } catch (e) {
          const message = e instanceof Error ? e.message.slice(0, 200) : "run failed";
          await updateRun(runId, { status: "failed", error: message, finishedAt: new Date().toISOString() }).catch(() => undefined);
          send({ type: "error", variant, runId, message });
        }
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
