/**
 * QlooProvider: the only module the rest of the app talks to for taste intelligence.
 * - live mode: real calls through QlooClient + QlooUsageGuard; failures throw QlooError (no silent fallback)
 * - sample mode: synthetic fixtures with explicit provenance.mode = "sample"
 */
import { QlooClient, QLOO_DOC_URLS, toQuery } from "./client";
import { MemoryGuardStore, QlooUsageGuard, type GuardStore } from "./guard";
import {
  normalizeDemographics,
  normalizeHeatmap,
  normalizeInsightEntities,
  normalizeSearchEntities,
  normalizeTags,
} from "./normalizer";
import {
  SAMPLE_LABEL,
  sampleCrossDomainSignals,
  sampleCuisineTags,
  sampleDemographics,
  sampleHeatmap,
  samplePlaceSignals,
  sampleTagSignals,
} from "./fixtures";
import {
  QlooError,
  type AudienceAffinity,
  type CulturalSignal,
  type EntityReference,
  type EntityTypeUrn,
  type GeographyContext,
  type HeatmapCell,
  type InsightsParams,
  type ProviderMode,
  type ProviderResult,
  type ProviderState,
  type SourceProvenance,
  type TagSignal,
} from "./types";

export * from "./types";
export { SAMPLE_LABEL } from "./fixtures";
export { QlooClient } from "./client";
export { QlooUsageGuard, MemoryGuardStore } from "./guard";
export type { GuardStore } from "./guard";

export const CROSS_DOMAIN_TYPES: EntityTypeUrn[] = [
  "urn:entity:brand",
  "urn:entity:podcast",
  "urn:entity:artist",
  "urn:entity:tv_show",
];

export interface QlooProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  store?: GuardStore;
  ttlSeconds?: number;
  dailyCap?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  traceId?: string;
  now?: () => Date;
}

function locationParams(geo?: GeographyContext): Partial<InsightsParams> {
  if (!geo) return {};
  if (geo.point) {
    return {
      "filter.location": `POINT(${geo.point.lon} ${geo.point.lat})`,
      "filter.location.radius": geo.radiusMeters ?? 3000,
    };
  }
  if (geo.localityQuery) return { "filter.location.query": geo.localityQuery };
  return {};
}

/** Place tag types that carry usable taste structure on the hackathon tier (verified 2026-10-27). */
export const TASTE_TAG_TYPES = [
  "urn:tag:genre:place",
  "urn:tag:ambience:qloo",
  "urn:tag:customer_identity:qloo",
  "urn:tag:specialty_dish:place",
];

/** Entity types an owner can pick as a cultural anchor. */
export const ANCHOR_TYPES = ["urn:entity:artist", "urn:entity:movie", "urn:entity:tv_show", "urn:entity:brand", "urn:entity:podcast"];

export class QlooProvider {
  readonly mode: ProviderMode;
  private readonly client?: QlooClient;
  private readonly guard: QlooUsageGuard;
  private readonly traceId?: string;
  private readonly now: () => Date;

  constructor(opts: QlooProviderOptions = {}) {
    this.mode = opts.apiKey ? "live" : "sample";
    this.traceId = opts.traceId;
    this.now = opts.now ?? (() => new Date());
    this.guard = new QlooUsageGuard({
      store: opts.store ?? new MemoryGuardStore(),
      ttlSeconds: opts.ttlSeconds,
      dailyCap: opts.dailyCap,
      now: () => this.now().getTime(),
    });
    if (opts.apiKey) {
      this.client = new QlooClient({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
      });
    }
  }

  get state(): ProviderState {
    return this.mode === "live"
      ? { mode: "live", status: "ok" }
      : { mode: "sample", status: "not_connected", message: "Live Qloo not connected — " + SAMPLE_LABEL };
  }

  private provenance(endpoint: string, params: Record<string, string>, cacheHit: boolean, latencyMs?: number): SourceProvenance {
    return {
      provider: "qloo",
      endpoint,
      requestParams: params,
      retrievedAt: this.now().toISOString(),
      mode: this.mode,
      cacheHit,
      latencyMs,
      citationUrl: QLOO_DOC_URLS[endpoint],
      traceId: this.traceId,
    };
  }

  private sample<T>(endpoint: string, params: object, data: T): ProviderResult<T> {
    return { data, provenance: this.provenance(endpoint, toQuery(params), false), state: this.state };
  }

  private async live<T>(endpoint: string, params: object, call: (c: QlooClient) => Promise<{ data: T; latencyMs: number }>): Promise<ProviderResult<T>> {
    if (!this.client) throw new QlooError("no_key", "QLOO_API_KEY is not configured");
    const client = this.client;
    const q = toQuery(params);
    const { data, cacheHit, latencyMs } = await this.guard.run(endpoint, q, () => call(client), this.traceId);
    return { data, provenance: this.provenance(endpoint, q, cacheHit, latencyMs), state: { mode: "live", status: "ok" } };
  }

  /**
   * Resolve a cuisine string ("Taiwanese / Chinese noodles") to Qloo place tags via /v2/tags.
   * Each term is looked up separately; restaurant genre tags (urn:tag:genre:place:restaurant:*) are ranked first
   * because they are the strongest taste signal for insights. Dish tags follow.
   */
  async resolveCuisineTags(cuisine: string): Promise<ProviderResult<TagSignal[]>> {
    const params = { "filter.query": cuisine, "filter.parents.types": "urn:entity:place", take: 10 };
    if (this.mode === "sample") return this.sample("/v2/tags", params, sampleCuisineTags);
    const terms = Array.from(new Set(cuisine.split(/[\/,&+]| and /i).map((t) => t.trim()).filter((t) => t.length > 1))).slice(0, 3);
    if (!terms.length) terms.push(cuisine);
    const merged = new Map<string, TagSignal>();
    let first: ProviderResult<TagSignal[]> | undefined;
    for (const term of terms) {
      const p = { "filter.query": term, "filter.parents.types": "urn:entity:place", take: 10 };
      const r = await this.live("/v2/tags", p, async (c) => {
        const { data, meta } = await c.tags(p);
        return { data: normalizeTags(data), latencyMs: meta.latencyMs };
      });
      first ??= r;
      for (const t of r.data) if (!merged.has(t.tagId)) merged.set(t.tagId, t);
    }
    const isGenre = (t: TagSignal) => t.tagId.startsWith("urn:tag:genre:place:restaurant:");
    const data = [...merged.values()].sort((a, b) => Number(isGenre(b)) - Number(isGenre(a)));
    return { data, provenance: { ...first!.provenance, requestParams: toQuery({ ...params, "filter.query": terms.join(" | ") }) }, state: first!.state };
  }

  /** Entity lookup by name near a location via /search. */
  async discoverEntities(query: string, geo?: GeographyContext, types = "urn:entity:place"): Promise<ProviderResult<EntityReference[]>> {
    const params: Record<string, unknown> = { query, types, take: 10 };
    if (geo?.point) {
      params["filter.location"] = `${geo.point.lat},${geo.point.lon}`;
      params["filter.radius"] = Math.max(1, Math.round((geo.radiusMeters ?? 3000) / 1609));
    }
    if (this.mode === "sample") {
      return this.sample("/search", params, samplePlaceSignals.slice(0, 3).map((p) => ({ entityId: p.entityId, name: p.name, subtype: p.subtype, popularity: p.popularity })));
    }
    return this.live("/search", params, async (c) => {
      const { data, meta } = await c.search(params as { query: string });
      return { data: normalizeSearchEntities(data), latencyMs: meta.latencyMs };
    });
  }

  /** Places near the restaurant that people with the cuisine taste also have affinity for. */
  async getLocalPlaceAffinities(input: { tagIds: string[]; geo?: GeographyContext; take?: number }): Promise<ProviderResult<CulturalSignal[]>> {
    const params: InsightsParams = {
      "filter.type": "urn:entity:place",
      "signal.interests.tags": input.tagIds.join(","),
      "feature.explainability": true,
      take: input.take ?? 20,
      ...locationParams(input.geo),
    };
    if (this.mode === "sample") return this.sample("/v2/insights", params, samplePlaceSignals);
    return this.live("/v2/insights", params, async (c) => {
      const { data, meta } = await c.insights(params);
      return { data: normalizeInsightEntities(data), latencyMs: meta.latencyMs };
    });
  }

  /** Cross-domain affinities (brands, podcasts, artists, shows) for the cuisine taste. One call per domain. */
  async getCrossDomainAffinities(input: { tagIds: string[]; geo?: GeographyContext; domains?: EntityTypeUrn[]; takePerDomain?: number }): Promise<ProviderResult<CulturalSignal[]> & { failedDomains: string[] }> {
    const domains = input.domains ?? CROSS_DOMAIN_TYPES;
    const base = {
      "signal.interests.tags": input.tagIds.join(","),
      take: input.takePerDomain ?? 5,
      ...(input.geo?.localityQuery ? { "signal.location.query": input.geo.localityQuery } : {}),
    };
    if (this.mode === "sample") {
      return { ...this.sample("/v2/insights", { ...base, "filter.type": domains.join("|") }, sampleCrossDomainSignals), failedDomains: [] };
    }
    const results: CulturalSignal[] = [];
    const failed: string[] = [];
    let lastProv: SourceProvenance | undefined;
    for (const d of domains) {
      const params: InsightsParams = { "filter.type": d, ...base };
      try {
        const r = await this.live("/v2/insights", params, async (c) => {
          const { data, meta } = await c.insights(params);
          return { data: normalizeInsightEntities(data), latencyMs: meta.latencyMs };
        });
        results.push(...r.data);
        lastProv = r.provenance;
      } catch (err) {
        if (err instanceof QlooError && (err.errorClass === "forbidden" || err.errorClass === "not_found" || err.errorClass === "timeout")) {
          failed.push(d);
          continue;
        }
        throw err;
      }
    }
    if (results.length === 0 && failed.length === domains.length) {
      throw new QlooError("forbidden", "All cross-domain entity types were rejected");
    }
    return {
      data: results,
      provenance: lastProv ?? this.provenance("/v2/insights", toQuery({ ...base, "filter.type": domains.join("|") }), false),
      state: { mode: "live", status: "ok", message: failed.length ? `Unavailable domains: ${failed.join(", ")}` : undefined },
      failedDomains: failed,
    };
  }

  /**
   * Tag taste analysis: which place attributes people with this taste associate with, near a locality.
   * Live: one call per tag type, because an untyped call returns only dish tags. Types that return nothing are skipped.
   */
  async getTagAffinities(input: { tagIds: string[]; geo?: GeographyContext; take?: number; tagTypes?: string[] }): Promise<ProviderResult<TagSignal[]>> {
    const base = {
      "filter.type": "urn:tag" as const,
      "filter.parents.types": "urn:entity:place",
      "signal.interests.tags": input.tagIds.join(","),
      ...(input.geo?.localityQuery ? { "signal.location.query": input.geo.localityQuery } : {}),
    };
    const types = input.tagTypes ?? TASTE_TAG_TYPES;
    if (this.mode === "sample") return this.sample("/v2/insights", { ...base, "filter.tag.types": types.join(","), take: input.take ?? 8 }, sampleTagSignals);
    const out: TagSignal[] = [];
    let lastProv: SourceProvenance | undefined;
    for (const tt of types) {
      const params: InsightsParams = { ...base, "filter.tag.types": tt, take: input.take ?? 8 };
      try {
        const r = await this.live("/v2/insights", params, async (c) => {
          const { data, meta } = await c.insights(params);
          return { data: normalizeTags(data), latencyMs: meta.latencyMs };
        });
        out.push(...r.data.filter((t) => !input.tagIds.includes(t.tagId)));
        lastProv = r.provenance;
      } catch (err) {
        if (err instanceof QlooError && (err.errorClass === "timeout" || err.errorClass === "bad_request" || err.errorClass === "not_found")) continue;
        throw err;
      }
    }
    return {
      data: out,
      provenance: { ...(lastProv ?? this.provenance("/v2/insights", toQuery(base), false)), requestParams: toQuery({ ...base, "filter.tag.types": types.join(",") }) },
      state: { mode: "live", status: "ok" },
    };
  }

  /** Demographic affinity deltas (age/gender) for the cuisine tags. */
  async getDemographics(input: { tagIds?: string[]; entityIds?: string[] }): Promise<ProviderResult<AudienceAffinity[]>> {
    const params: InsightsParams = { "filter.type": "urn:demographics" };
    if (input.tagIds?.length) params["signal.interests.tags"] = input.tagIds.join(",");
    if (input.entityIds?.length) params["signal.interests.entities"] = input.entityIds.join(",");
    if (this.mode === "sample") return this.sample("/v2/insights", params, sampleDemographics);
    return this.live("/v2/insights", params, async (c) => {
      const { data, meta } = await c.insights(params);
      return { data: normalizeDemographics(data), latencyMs: meta.latencyMs };
    });
  }

  /**
   * Cultural anchor: resolve a name the owner types (artist, film, show, brand, podcast) to one Qloo entity.
   * Places are excluded: the anchor is a taste, not a competitor.
   */
  async resolveAnchor(query: string): Promise<ProviderResult<EntityReference[]>> {
    const params = { query, types: ANCHOR_TYPES.join(","), take: 5 };
    if (this.mode === "sample") return this.sample("/search", params, sampleCrossDomainSignals.slice(0, 3).map((p) => ({ entityId: p.entityId, name: p.name, subtype: p.subtype, popularity: p.popularity })));
    return this.live("/search", params, async (c) => {
      const { data, meta } = await c.search(params as { query: string });
      return { data: normalizeSearchEntities(data).filter((e) => e.subtype !== "urn:entity:place"), latencyMs: meta.latencyMs };
    });
  }

  /** Restaurants in the locality whose audience overlaps the anchor's fans, with Qloo explainability. */
  async getAnchorPlaces(input: { entityId: string; localityQuery: string; take?: number }): Promise<ProviderResult<CulturalSignal[]>> {
    const params: InsightsParams = {
      "filter.type": "urn:entity:place",
      "filter.location.query": input.localityQuery,
      "filter.tags": "urn:tag:genre:place:restaurant",
      "signal.interests.entities": input.entityId,
      "feature.explainability": true,
      take: input.take ?? 8,
    };
    if (this.mode === "sample") return this.sample("/v2/insights", params, samplePlaceSignals);
    return this.live("/v2/insights", params, async (c) => {
      const { data, meta } = await c.insights(params);
      return { data: normalizeInsightEntities(data), latencyMs: meta.latencyMs };
    });
  }

  /** City-level taste heatmap cells for the cuisine tags (coarse, geohash based). */
  async getHeatmap(input: { tagIds: string[]; cityQuery: string }): Promise<ProviderResult<HeatmapCell[]>> {
    const params: InsightsParams = {
      "filter.type": "urn:heatmap",
      "filter.location.query": input.cityQuery,
      "signal.interests.tags": input.tagIds.join(","),
    };
    if (this.mode === "sample") return this.sample("/v2/insights", params, sampleHeatmap);
    return this.live("/v2/insights", params, async (c) => {
      const { data, meta } = await c.insights(params);
      return { data: normalizeHeatmap(data), latencyMs: meta.latencyMs };
    });
  }

  /** Live verification: a known public landmark search and a one-result place insight. */
  async verifyLive(): Promise<{ ok: boolean; mode: ProviderMode; checks: Array<{ name: string; ok: boolean; detail: string }> }> {
    if (this.mode !== "live" || !this.client) {
      return { ok: false, mode: this.mode, checks: [{ name: "key", ok: false, detail: "QLOO_API_KEY not configured" }] };
    }
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    try {
      const s = await this.client.search({ query: "Golden Gate Park", types: "urn:entity:place", take: 1 });
      const n = normalizeSearchEntities(s.data);
      checks.push({ name: "search", ok: n.length > 0, detail: n.length ? `resolved "${n[0].name}" (${s.meta.latencyMs} ms)` : "no results" });
    } catch (err) {
      checks.push({ name: "search", ok: false, detail: err instanceof QlooError ? err.errorClass : "error" });
    }
    try {
      const i = await this.client.insights({ "filter.type": "urn:entity:place", "filter.location.query": "San Francisco", take: 1 });
      const n = normalizeInsightEntities(i.data);
      checks.push({ name: "insights", ok: n.length > 0, detail: n.length ? `got place "${n[0].name}" affinity=${n[0].affinity ?? "n/a"} (${i.meta.latencyMs} ms)` : "empty results (check parameters)" });
    } catch (err) {
      checks.push({ name: "insights", ok: false, detail: err instanceof QlooError ? err.errorClass : "error" });
    }
    return { ok: checks.every((c) => c.ok), mode: "live", checks };
  }
}

export function createQlooProvider(env: NodeJS.ProcessEnv = process.env, extra: Partial<QlooProviderOptions> = {}): QlooProvider {
  return new QlooProvider({
    apiKey: env.QLOO_API_KEY || undefined,
    baseUrl: env.QLOO_BASE_URL || undefined,
    ttlSeconds: env.QLOO_CACHE_TTL_SECONDS ? Number(env.QLOO_CACHE_TTL_SECONDS) : undefined,
    dailyCap: env.QLOO_DAILY_CALL_CAP ? Number(env.QLOO_DAILY_CALL_CAP) : undefined,
    ...extra,
  });
}
