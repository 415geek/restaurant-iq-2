import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { QlooError } from "@/lib/providers/qloo";
import { THEMES, THEME_KEYS, type ThemeKey } from "@/lib/business/moments";
import { providerFor, themeFit } from "@/lib/pass-evidence";

const bodySchema = z.object({
  restaurantId: z.string().uuid(),
  theme: z.enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]]),
  moment: z.string().trim().min(2).max(90),
});

/**
 * Who does this kind of local moment draw, and does that crowd look like the people who like your cuisine?
 * Three live Qloo calls: demographics for the theme tag, demographics for the cuisine genre tags,
 * and (for place themes only) nearby restaurants the theme crowd also likes. The fit is plain cosine math in moments.ts.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const access = await authorizeRestaurant(b.restaurantId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "moments", limit: 20 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429 });
  const db = getServiceClient();
  const { data: r } = await db.from("restaurants").select("cuisine, neighborhood, city").eq("id", b.restaurantId).maybeSingle();
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const provider = providerFor(db, "moment");
  const themeTag = THEMES[b.theme].tagId;
  try {
    const locality = [r.neighborhood, r.city].filter(Boolean).join(", ");
    const [f, places] = await Promise.all([
      themeFit(provider, r.cuisine, b.theme),
      THEMES[b.theme].placeSignal ? provider.getLocalPlaceAffinities({ tagIds: [themeTag], geo: { localityQuery: locality }, take: 5, placeTags: "urn:tag:genre:place:restaurant" }) : Promise.resolve(null),
    ]);
    const c = f.crowd, y = f.yours, fit = f.fit, yoursIds = f.cuisineTags; const crowd = { provenance: f.provenance };
    await db.from("decision_events").insert({
      restaurant_id: b.restaurantId, kind: "moment_explored", subject_id: null,
      summary: `Checked who "${b.moment}" draws (theme ${b.theme}): fit ${fit ? fit.score : "unknown"}`,
      payload: { lt: { key: "moments.evExplored", params: { name: b.moment, theme: b.theme } }, theme: b.theme, tagId: themeTag, fit, mode: provider.mode },
      actor: actorLabel(access),
    });
    return NextResponse.json({
      mode: provider.mode, theme: b.theme, themeTag, cuisine: r.cuisine, cuisineTags: yoursIds,
      crowd: c, yours: y, fit,
      places: (places?.data ?? []).slice(0, 5).map((p) => ({ entityId: p.entityId, name: p.name, affinity: p.affinity })),
      provenance: { endpoint: "/v2/insights", params: crowd.provenance.requestParams, retrievedAt: crowd.provenance.retrievedAt, cacheHit: crowd.provenance.cacheHit },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errorClass = err instanceof QlooError ? err.errorClass : "internal";
    return NextResponse.json({ mode: provider.mode, error: errorClass }, { status: errorClass === "rate_limited" ? 429 : 502 });
  }
}
