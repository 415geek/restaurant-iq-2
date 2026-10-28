import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { createQlooProvider, QlooError } from "@/lib/providers/qloo";
import { SupabaseAnalysisStore } from "@/lib/agents/store";

const bodySchema = z.object({
  restaurantId: z.string().uuid(),
  query: z.string().trim().min(2).max(80).optional(),
  entityId: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9-]+$/).optional(),
}).refine((b) => b.query || b.entityId, "query or entityId required");

/**
 * Cultural anchor lookup: owner types an artist, film, show, brand or podcast.
 * Qloo resolves it (/search), then returns restaurants in the city whose audience overlaps that anchor's fans
 * (/v2/insights with signal.interests.entities + explainability) and the anchor's age/gender skew.
 * Live failures are returned as errors, never replaced with fixtures.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Type a name of at least 2 characters" }, { status: 400 });
  const b = parsed.data;
  const access = await authorizeRestaurant(b.restaurantId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "anchors", limit: 15 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429 });
  const db = getServiceClient();
  const { data: r } = await db.from("restaurants").select("city").eq("id", b.restaurantId).maybeSingle();
  const city = r?.city || "San Francisco";
  const provider = createQlooProvider(process.env, { store: new SupabaseAnalysisStore(db), traceId: `anchor-${Date.now()}` });
  try {
    const search = await provider.resolveAnchor(b.query ?? b.entityId!);
    const candidates = search.data.slice(0, 5);
    const anchor = (b.entityId && candidates.find((c) => c.entityId === b.entityId)) || candidates[0];
    if (!anchor) return NextResponse.json({ mode: provider.mode, anchor: null, candidates: [], places: [], demographics: null, error: "no_match" });
    const [places, demo] = await Promise.all([
      provider.getAnchorPlaces({ entityId: anchor.entityId, localityQuery: city }),
      provider.getDemographics({ entityIds: [anchor.entityId] }),
    ]);
    await db.from("decision_events").insert({
      restaurant_id: b.restaurantId, kind: "anchor_explored", subject_id: null,
      summary: `Explored cultural anchor "${anchor.name}" (${places.data.length} places in ${city})`,
      payload: { lt: { key: "anchor.evExplored", params: { name: anchor.name, n: places.data.length, city } }, entityId: anchor.entityId, mode: provider.mode },
      actor: actorLabel(access),
    });
    return NextResponse.json({
      mode: provider.mode, city, anchor, candidates,
      places: places.data.map((p) => ({ entityId: p.entityId, name: p.name, affinity: p.affinity, explain: p.explainability ? Math.max(...Object.values(p.explainability)) : undefined, neighborhood: p.properties.neighborhood, tags: p.tags.filter((t) => /genre:place|ambience|specialty_dish|cuisine/.test(t.type ?? t.id)).slice(0, 3).map((t) => t.name) })),
      demographics: demo.data[0] ?? null,
      provenance: { endpoint: "/v2/insights", params: places.provenance.requestParams, retrievedAt: places.provenance.retrievedAt, cacheHit: places.provenance.cacheHit },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errorClass = err instanceof QlooError ? err.errorClass : "internal";
    return NextResponse.json({ mode: provider.mode, error: errorClass }, { status: errorClass === "rate_limited" ? 429 : 502 });
  }
}
