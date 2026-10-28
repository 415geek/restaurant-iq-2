import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createQlooProvider, QlooError, type QlooProvider } from "@/lib/providers/qloo";
import { SupabaseAnalysisStore } from "@/lib/agents/store";
import { crowdFit, THEMES, type ThemeKey } from "@/lib/business/moments";
import type { SignalCitation } from "@/lib/business/types";
import type { LText } from "@/i18n/locales";
import type { MomentInput } from "@/lib/validation/schemas";

/**
 * The decision basis a TastePass is created from, frozen at creation time and re-fetched on the server (never trusted from the client):
 * which idea, which cultural anchor or local moment, what Qloo returned for it (with query parameters and time),
 * and which alternatives were not chosen and why. This is what the campaign page shows under "Why this offer".
 */
type Demo = { age: Record<string, number>; gender: Record<string, number> } | null;
export interface DecisionBasis {
  source: "idea" | "anchor" | "moment";
  idea: { slug: string; label: string; citations: SignalCitation[] };
  anchor?: { entityId: string; name: string; places: Array<{ entityId: string; name: string; affinity?: number; explain?: number }>; demographics: Demo; endpoint: string; params: Record<string, string>; queriedAt: string; mode: string };
  moment?: { name: string; date: string; kind: string; theme?: string; tagId?: string; fit?: { score: number; level: string } | null; crowd?: Demo; yours?: Demo; queriedAt?: string; mode?: string };
  evidenceError?: string;
  rejected: Array<{ slug: string; label: string; reason: LText | null }>;
  createdAt: string;
}

export function providerFor(db: SupabaseClient, trace: string): QlooProvider {
  return createQlooProvider(process.env, { store: new SupabaseAnalysisStore(db), traceId: `${trace}-${Date.now()}` });
}

/** Theme crowd vs cuisine crowd (shared by the Moments page and campaign creation). */
export async function themeFit(provider: QlooProvider, cuisine: string, theme: ThemeKey) {
  const cuisineTags = await provider.resolveCuisineTags(cuisine);
  const genre = cuisineTags.data.filter((t) => t.tagId.startsWith("urn:tag:genre:place:restaurant:")).slice(0, 2).map((t) => t.tagId);
  const yoursIds = genre.length ? genre : cuisineTags.data.slice(0, 1).map((t) => t.tagId);
  const tagId = THEMES[theme].tagId;
  const [crowd, yours] = await Promise.all([provider.getDemographics({ tagIds: [tagId] }), yoursIds.length ? provider.getDemographics({ tagIds: yoursIds }) : Promise.resolve(null)]);
  const c = crowd.data[0] ?? null, y = yours?.data[0] ?? null;
  return { tagId, cuisineTags: yoursIds, crowd: c, yours: y, fit: c && y ? crowdFit(c, y) : null, provenance: crowd.provenance };
}

export async function buildDecisionBasis(db: SupabaseClient, input: {
  restaurant: { id: string; city: string | null; cuisine: string };
  hypothesis: { id: string; slug: string; evidence_label: string; qloo_variant: unknown; run_id: string };
  anchor?: { entityId: string; name: string };
  moment?: MomentInput;
}): Promise<{ basis: DecisionBasis; citations: SignalCitation[] }> {
  const qv = (input.hypothesis.qloo_variant ?? {}) as { citations?: SignalCitation[] };
  const ideaCitations = (qv.citations ?? []).slice(0, 4);
  const { data: others } = await db.from("opportunity_hypotheses").select("slug, evidence_label, qloo_variant, rank").eq("run_id", input.hypothesis.run_id).neq("id", input.hypothesis.id).order("rank").limit(3);
  const rejected = (others ?? []).slice(0, 2).map((o) => {
    const v = (o.qloo_variant ?? {}) as { disqualifiers?: LText[]; reasonsToAvoid?: LText[] };
    return { slug: o.slug as string, label: o.evidence_label as string, reason: v.disqualifiers?.[0] ?? v.reasonsToAvoid?.[0] ?? null };
  });
  const basis: DecisionBasis = { source: input.anchor ? "anchor" : input.moment ? "moment" : "idea", idea: { slug: input.hypothesis.slug, label: input.hypothesis.evidence_label, citations: ideaCitations }, rejected, createdAt: new Date().toISOString() };
  let citations: SignalCitation[] = ideaCitations;
  const provider = providerFor(db, "pass-basis");
  try {
    if (input.anchor) {
      const [places, demo] = await Promise.all([
        provider.getAnchorPlaces({ entityId: input.anchor.entityId, localityQuery: input.restaurant.city || "San Francisco" }),
        provider.getDemographics({ entityIds: [input.anchor.entityId] }),
      ]);
      const top = places.data.slice(0, 5).map((p) => ({ entityId: p.entityId, name: p.name, affinity: p.affinity, explain: p.explainability ? Math.max(...Object.values(p.explainability)) : undefined }));
      basis.anchor = { entityId: input.anchor.entityId, name: input.anchor.name, places: top, demographics: demo.data[0] ?? null, endpoint: "/v2/insights", params: places.provenance.requestParams, queriedAt: places.provenance.retrievedAt, mode: provider.mode };
      citations = [
        { kind: "entity", id: input.anchor.entityId, name: input.anchor.name, sourceId: "anchor", note: { key: "pass.basis.anchorNote" } },
        ...top.slice(0, 3).map((p) => ({ kind: "entity" as const, id: p.entityId, name: p.name, affinity: p.affinity, sourceId: "anchor", note: { key: "pass.basis.placeNote", params: { name: input.anchor!.name } } })),
      ];
    }
    if (input.moment) {
      basis.moment = { name: input.moment.name, date: input.moment.date, kind: input.moment.kind, theme: input.moment.theme };
      if (input.moment.theme) {
        const f = await themeFit(provider, input.restaurant.cuisine, input.moment.theme as ThemeKey);
        Object.assign(basis.moment, { tagId: f.tagId, fit: f.fit, crowd: f.crowd, yours: f.yours, queriedAt: f.provenance.retrievedAt, mode: provider.mode });
        if (!input.anchor) citations = [{ kind: "tag", id: f.tagId, name: input.moment.name, affinity: f.fit?.score, sourceId: "moment", note: { key: "pass.basis.momentNote", params: { level: f.fit?.level ?? "unknown" } } }, ...ideaCitations.slice(0, 2)];
      }
    }
  } catch (e) {
    basis.evidenceError = e instanceof QlooError ? e.errorClass : "internal"; // shown on the campaign page; nothing substituted
  }
  return { basis, citations };
}
