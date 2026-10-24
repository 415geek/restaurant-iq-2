/**
 * Qloo provider domain types. Raw API shapes are kept loose (the public docs do not fully
 * type per-entity fields); the normalizer converts them into these stable domain types.
 * Interpretation rule: affinity is a 0..1 "taste affinity" relation, never demand or sales.
 */
import { z } from "zod";

export type ProviderMode = "live" | "sample";

export type QlooErrorClass =
  | "no_key"
  | "timeout"
  | "rate_limited"
  | "forbidden"
  | "not_found"
  | "bad_request"
  | "server"
  | "malformed"
  | "network"
  | "quota_exceeded";

export class QlooError extends Error {
  constructor(
    public readonly errorClass: QlooErrorClass,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export interface ProviderState {
  mode: ProviderMode;
  status: "ok" | "failed" | "not_connected";
  errorClass?: QlooErrorClass;
  message?: string; // sanitized, user-facing
}

export interface SourceProvenance {
  provider: "qloo";
  endpoint: string; // e.g. "/v2/insights"
  requestParams: Record<string, string>; // redacted (no key)
  retrievedAt: string; // ISO
  mode: ProviderMode;
  cacheHit: boolean;
  latencyMs?: number;
  citationUrl?: string; // documentation link for the endpoint
  traceId?: string;
}

export interface ProviderResult<T> {
  data: T;
  provenance: SourceProvenance;
  state: ProviderState;
}

export interface GeographyContext {
  localityQuery?: string; // e.g. "Inner Sunset, San Francisco"
  point?: { lat: number; lon: number };
  radiusMeters?: number;
}

export interface EntityReference {
  entityId: string;
  name: string;
  subtype?: string; // urn:entity:place etc.
  popularity?: number; // 0..1 percentile, per Qloo docs
}

export interface TagRef {
  id: string; // urn:tag:...
  name: string;
  type?: string;
}

/** A place/brand/media entity returned by Insights with its taste-affinity reading. */
export interface CulturalSignal extends EntityReference {
  domain: string; // "place" | "brand" | "artist" | "movie" | "tv_show" | "podcast" | "book" | "videogame" | "destination" | "unknown"
  affinity?: number; // 0..1 if the API supplied query.affinity; otherwise undefined (never invented)
  affinityRank?: number;
  tags: TagRef[];
  properties: {
    address?: string;
    city?: string;
    neighborhood?: string;
    priceLevel?: number; // 1..4
    businessRating?: number;
    description?: string;
    imageUrl?: string;
    keywords?: string[];
    goodFor?: string[];
    hours?: Record<string, unknown>;
  };
  explainability?: Record<string, number>; // input signal → normalized contribution, from feature.explainability
}

/** Demographic affinity: signed deviation from average, per Qloo demographics docs. */
export interface AudienceAffinity {
  signalId: string; // entity or tag id that was queried
  age: Partial<Record<AgeBucket, number>>;
  gender: Partial<Record<"male" | "female", number>>;
}

export const AGE_BUCKETS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export interface TagSignal {
  tagId: string;
  name: string;
  subtype?: string;
  types?: string[];
  affinity?: number; // only if supplied by the API
}

export interface HeatmapCell {
  lat: number;
  lon: number;
  geohash?: string;
  affinity?: number;
  affinityRank?: number;
  popularity?: number;
}

/* ---------- loose raw schemas (tolerant; unknown keys allowed) ---------- */

export const rawTagSchema = z
  .object({
    id: z.string().optional(),
    tag_id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    types: z.array(z.string()).optional(),
    tag_value: z.string().optional(),
    query: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

export const rawEntitySchema = z
  .object({
    entity_id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    popularity: z.number().optional(),
    disambiguation: z.string().optional(),
    tags: z.array(rawTagSchema).optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    query: z.record(z.string(), z.unknown()).optional(),
    location: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

export const rawInsightsEnvelope = z
  .object({
    success: z.boolean().optional(),
    results: z
      .object({
        entities: z.array(rawEntitySchema).optional(),
        tags: z.array(rawTagSchema).optional(),
        demographics: z.array(z.record(z.string(), z.unknown())).optional(),
        heatmap: z.array(z.record(z.string(), z.unknown())).optional(),
        duration: z.number().optional(),
      })
      .loose()
      .optional(),
    query: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

export const rawSearchEnvelope = z
  .object({
    success: z.boolean().optional(),
    duration: z.number().optional(),
    results: z.array(rawEntitySchema).optional(),
  })
  .loose();

export type RawInsightsEnvelope = z.infer<typeof rawInsightsEnvelope>;
export type RawSearchEnvelope = z.infer<typeof rawSearchEnvelope>;
export type RawEntity = z.infer<typeof rawEntitySchema>;
export type RawTag = z.infer<typeof rawTagSchema>;

/* ---------- request parameter types (documented names only) ---------- */

export type EntityTypeUrn =
  | "urn:entity:place"
  | "urn:entity:brand"
  | "urn:entity:artist"
  | "urn:entity:movie"
  | "urn:entity:tv_show"
  | "urn:entity:podcast"
  | "urn:entity:book"
  | "urn:entity:videogame"
  | "urn:entity:destination"
  | "urn:demographics"
  | "urn:tag"
  | "urn:heatmap";

export interface InsightsParams {
  "filter.type": EntityTypeUrn;
  "filter.location.query"?: string;
  "filter.location"?: string;
  "filter.location.radius"?: number;
  "filter.tags"?: string;
  "filter.tag.types"?: string;
  "filter.parents.types"?: string;
  "filter.price_level.min"?: number;
  "filter.price_level.max"?: number;
  "filter.popularity.min"?: number;
  "signal.interests.entities"?: string;
  "signal.interests.tags"?: string;
  "signal.demographics.audiences"?: string;
  "signal.demographics.age"?: AgeBucket | string;
  "signal.demographics.gender"?: "male" | "female";
  "signal.location.query"?: string;
  "signal.location"?: string;
  "signal.location.radius"?: number;
  "feature.explainability"?: boolean;
  "sort_by"?: "affinity" | "distance" | "rating" | "quality";
  "bias.trends"?: string;
  take?: number;
  page?: number;
}

export interface SearchParams {
  query: string;
  types?: string; // comma-separated urn:entity:*
  "filter.location"?: string;
  "filter.radius"?: number; // miles 0..100
  "filter.tags"?: string;
  take?: number;
  sort_by?: "match" | "distance" | "popularity";
}

export interface TagsParams {
  "filter.query"?: string;
  "filter.tag.types"?: string;
  "filter.parents.types"?: string;
  take?: number;
  page?: number;
}
