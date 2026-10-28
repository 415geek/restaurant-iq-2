/**
 * Converts loose Qloo payloads into stable domain types. Never invents values:
 * if the API did not supply an affinity, the field stays undefined.
 */
import {
  AGE_BUCKETS,
  type AudienceAffinity,
  type CulturalSignal,
  type HeatmapCell,
  type RawEntity,
  type RawInsightsEnvelope,
  type RawSearchEnvelope,
  type RawTag,
  type TagRef,
  type TagSignal,
  type EntityReference,
} from "./types";

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;

const firstType = (e: RawEntity): string | undefined => {
  const ts = (e as { types?: unknown }).types;
  return Array.isArray(ts) && typeof ts[0] === "string" ? ts[0] : undefined;
};

export function domainFromSubtype(subtype?: string): CulturalSignal["domain"] {
  if (!subtype) return "unknown";
  const m = subtype.match(/^urn:entity:([a-z_]+)/);
  return m ? m[1] : "unknown";
}

export function normalizeTag(t: RawTag): TagRef | undefined {
  const id = t.id ?? t.tag_id ?? t.tag_value;
  if (!id) return undefined;
  return { id, name: t.name ?? id.split(":").pop() ?? id, type: t.type ?? t.subtype };
}

export function normalizeEntity(e: RawEntity): CulturalSignal | undefined {
  if (!e.entity_id || !e.name) return undefined;
  const props = (e.properties ?? {}) as Record<string, unknown>;
  const geocode = (props.geocode ?? {}) as Record<string, unknown>;
  const query = (e.query ?? {}) as Record<string, unknown>;
  const explain = query.explainability as Record<string, unknown> | undefined;
  const explainability: Record<string, number> | undefined = explain
    ? Object.fromEntries(
        Object.entries(explain)
          // live payloads give either a number or a list of { entity_id, score }: keep the strongest score
          .map(([k, v]) => [k, num(v) ?? (Array.isArray(v) ? Math.max(...v.map((x) => num((x as Record<string, unknown>)?.score) ?? Number.NEGATIVE_INFINITY)) : undefined)] as const)
          .map(([k, v]) => [k, v !== undefined && Number.isFinite(v) ? v : undefined] as const)
          .filter((kv): kv is readonly [string, number] => kv[1] !== undefined),
      )
    : undefined;
  const image = props.image as Record<string, unknown> | string | undefined;
  return {
    entityId: e.entity_id,
    name: e.name,
    subtype: e.subtype ?? firstType(e) ?? e.type,
    domain: domainFromSubtype(e.subtype ?? firstType(e)),
    popularity: num(e.popularity),
    affinity: num(query.affinity),
    affinityRank: num(query.affinity_rank),
    tags: (e.tags ?? []).map(normalizeTag).filter((t): t is TagRef => !!t),
    properties: {
      address: str(props.address),
      city: str(geocode.city) ?? str(geocode.name),
      neighborhood: str(props.neighborhood),
      priceLevel: num(props.price_level),
      businessRating: num(props.business_rating),
      description: str(props.description),
      imageUrl: typeof image === "string" ? image : str((image as Record<string, unknown> | undefined)?.url),
      keywords: strArr(props.keywords)
        ?? (Array.isArray(props.keywords)
          ? (props.keywords as Array<Record<string, unknown>>).map((k) => str(k?.name)).filter((x): x is string => !!x)
          : undefined),
      goodFor: strArr(props.good_for),
      hours: (props.hours as Record<string, unknown> | undefined) ?? undefined,
    },
    explainability,
  };
}

export function normalizeInsightEntities(env: RawInsightsEnvelope): CulturalSignal[] {
  return (env.results?.entities ?? []).map(normalizeEntity).filter((x): x is CulturalSignal => !!x);
}

export function normalizeSearchEntities(env: RawSearchEnvelope): EntityReference[] {
  const out: EntityReference[] = [];
  for (const e of env.results ?? []) {
    if (e.entity_id && e.name) {
      out.push({ entityId: e.entity_id, name: e.name, subtype: e.subtype ?? firstType(e) ?? e.type, popularity: num(e.popularity), disambiguation: str(e.disambiguation) });
    }
  }
  return out;
}

export function normalizeTags(env: RawInsightsEnvelope): TagSignal[] {
  return (env.results?.tags ?? [])
    .map((t) => {
      const id = t.tag_id ?? t.id ?? t.tag_value;
      if (!id) return undefined;
      const q = (t.query ?? {}) as Record<string, unknown>;
      const sig: TagSignal = {
        tagId: id,
        name: t.name ?? id.split(":").pop() ?? id,
        subtype: t.subtype,
        types: t.types,
        affinity: num(q.affinity),
      };
      return sig;
    })
    .filter((x): x is TagSignal => !!x);
}

export function normalizeDemographics(env: RawInsightsEnvelope): AudienceAffinity[] {
  return (env.results?.demographics ?? [])
    .map((d) => {
      const signalId = str(d.entity_id) ?? str(d.tag_id) ?? str(d.id);
      const q = (d.query ?? {}) as Record<string, unknown>;
      const ageRaw = (q.age ?? {}) as Record<string, unknown>;
      const genderRaw = (q.gender ?? {}) as Record<string, unknown>;
      if (!signalId) return undefined;
      const age: AudienceAffinity["age"] = {};
      for (const b of AGE_BUCKETS) {
        const v = num(ageRaw[b]);
        if (v !== undefined) age[b] = v;
      }
      const gender: AudienceAffinity["gender"] = {};
      const m = num(genderRaw.male);
      const f = num(genderRaw.female);
      if (m !== undefined) gender.male = m;
      if (f !== undefined) gender.female = f;
      return { signalId, age, gender };
    })
    .filter((x): x is AudienceAffinity => !!x);
}

export function normalizeHeatmap(env: RawInsightsEnvelope): HeatmapCell[] {
  return (env.results?.heatmap ?? [])
    .map((h) => {
      const loc = (h.location ?? {}) as Record<string, unknown>;
      const q = (h.query ?? {}) as Record<string, unknown>;
      const lat = num(loc.latitude);
      const lon = num(loc.longitude);
      if (lat === undefined || lon === undefined) return undefined;
      const cell: HeatmapCell = {
        lat,
        lon,
        geohash: str(loc.geohash),
        affinity: num(q.affinity),
        affinityRank: num(q.affinity_rank),
        popularity: num(q.popularity),
      };
      return cell;
    })
    .filter((x): x is HeatmapCell => !!x);
}

/** Human label for an affinity value. Never a percentage of customers. */
export function affinityLabel(a?: number): "strong" | "moderate" | "weak" | "unknown" {
  if (a === undefined) return "unknown";
  if (a >= 0.8) return "strong";
  if (a >= 0.5) return "moderate";
  return "weak";
}
