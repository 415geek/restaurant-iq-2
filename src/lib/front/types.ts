/**
 * TasteFront contracts. Shared by the deterministic scoring code, the agent, the API routes and the surfaces.
 * Interpretation rules (never violated anywhere downstream):
 *  - Qloo affinity and lift describe what a crowd "leans toward"; they are never demand, prediction or proof of sales.
 *  - Every number shown to a person is computed in deterministic TypeScript. The model chooses among candidates and writes copy.
 *  - Every Qloo-derived sentence cites a tag/entity name and score exactly as returned, and is verified against the run's stored responses.
 */
import type { ProviderMode, SourceProvenance } from "@/lib/providers/qloo";

export const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";
export const SIZE_CLASSES = ["single", "small_chain", "franchise"] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

export interface Brand { id: string; organizationId: string; name: string; slug: string; sizeClass: SizeClass; storeCount: number }

export interface Guardrails {
  /** item ids the agent may rename or re-describe; empty + single store = all items */
  renamableItemIds: string[];
  /** a promote whose price is outside ±pct of the brand price for the same item is rejected */
  priceBandPct: number;
  /** checked case-insensitively, all languages */
  bannedTerms: string[];
  tone: "warm" | "plain" | "playful" | "premium";
}
export const DEFAULT_GUARDRAILS: Guardrails = { renamableItemIds: [], priceBandPct: 15, bannedTerms: ["authentic", "healthy", "best", "world-famous"], tone: "plain" };

export interface Store {
  id: string; organizationId: string; brandId: string | null; restaurantId: string | null;
  name: string; slug: string; address: string; lat: number; lng: number;
  neighborhood: string; city: string; cuisine: string; language: "en" | "zh" | "es";
  qlooEntityId: string | null;
}

export type MenuSource = "photo" | "url" | "csv" | "manual" | "seed";
export interface MenuItem {
  id: string; storeId: string;
  name: string;           // source language, as printed on the menu
  nameEn: string | null;  // English name when the source is not English
  description: string | null;
  priceCents: number; costCents: number | null;
  category: string; sortIndex: number;
  /** resolved Qloo tag ids; empty when ambiguous or unmapped */
  qlooTagIds: string[];
  /** candidates kept for the owner to resolve; the item is excluded from scoring while ambiguous */
  tagCandidates: Array<{ id: string; name: string; type?: string }>;
  ambiguous: boolean;
}

/** A compact, verifiable record of one Qloo call made during a run. Numbers are stored as returned. */
export interface QlooCallRecord {
  id: string;                       // "c1", "c2", ... referenced by Move evidence
  purpose: "neighborhood_tags" | "demographics" | "crowd_places" | "city_places" | "heatmap" | "rank" | "compare" | "find_tags" | "brands";
  provenance: SourceProvenance;
  /** names + scores exactly as returned; used by the verifier (affinity 0..1, lift as computed) */
  facts: Array<{ name: string; id?: string; score?: number }>;
  error?: string;
}

export interface NeighborhoodTag { id: string; name: string; type?: string; affinity: number | null }
export interface NeighborhoodProfile {
  storeId: string; mode: ProviderMode;
  tags: NeighborhoodTag[];                       // top tags with affinity, all tag types merged, sorted by affinity
  demographics: { age: Record<string, number>; gender: Record<string, number> } | null;
  calls: QlooCallRecord[];
  caveats: string[];
}

/** crowd-vs-city contrast (Tastecraft method): share of crowd menus mentioning a term ÷ share of city menus, add-one smoothed */
export interface TermLift { term: string; crowd: number; city: number; crowdTotal: number; cityTotal: number; lift: number; lowCount: boolean }
export interface ItemLift { itemId: string; lift: number | null; terms: TermLift[]; lowCount: boolean; reason?: "no_terms" | "ambiguous" }

export const MOVE_KINDS = ["reorder", "rename", "feature", "promote", "pass"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];
export type Risk = "low" | "mid";

export interface Evidence { callId: string; name: string; score: number | null; sentence: string; verified?: boolean }

export interface MoveBefore { sortIndex?: number; name?: string; description?: string | null; featured?: boolean; priceCents?: number }
export interface MoveAfter { sortIndex?: number; name?: string; nameEn?: string | null; description?: string | null; featured?: boolean; promoteBudgetCents?: number; passOfferCents?: number }

export interface Move {
  id: string; kind: MoveKind; itemId: string; risk: Risk;
  before: MoveBefore; after: MoveAfter;
  evidence: Evidence[];
  verified: boolean;                      // every evidence line matched a stored Qloo fact
  rationale: string;                      // ≤ 1 sentence, owner-facing, "this crowd leans toward …"
  guardrail?: { ok: boolean; reason?: string };
}

export type VersionSource = "qloo" | "baseline";
export interface StorefrontVersion {
  id: string; storeId: string; versionNo: number; generatedBy: VersionSource; runId: string | null;
  items: Array<Pick<MenuItem, "id" | "name" | "nameEn" | "description" | "priceCents" | "category" | "sortIndex"> & { featured: boolean; changed: Array<"sortIndex" | "name" | "description" | "featured"> }>;
  parentVersionId: string | null; status: "draft" | "published" | "rolled_back";
  publishedAt: string | null; rolledBackAt: string | null; createdAt: string;
}

export type RunStatus = "running" | "completed" | "failed";
export interface RunEvent { t: number; step: string; detail: string; callId?: string }
export interface FrontRun {
  id: string; storeId: string; mode: ProviderMode; status: RunStatus; variant: VersionSource;
  events: RunEvent[]; calls: QlooCallRecord[]; moves: Move[]; caveats: string[];
  versionId: string | null; error: string | null; createdAt: string; finishedAt: string | null;
}

export type HoldoutKind = "week_alternate" | "store_split";
export interface Holdout {
  id: string; storeId: string | null; brandId: string | null; kind: HoldoutKind;
  changeWindow: { start: string; end: string }; controlWindow: { start: string; end: string } | null;
  /** store_split: which store ids change and which hold; seed makes it reproducible */
  assignment: { change: string[]; control: string[]; seed: number; strata?: Record<string, "low" | "mid" | "high"> };
  createdAt: string;
}

export type SettleStatus = "waiting_for_sales" | "short_history" | "ready";
export interface SettleMetric { key: "orders" | "netSales" | "featuredUnits"; change: number; control: number; delta: number | null; priorMin: number | null; priorMax: number | null; position: "above" | "below" | "within" | null }
export interface Settlement {
  status: SettleStatus; holdoutKind: HoldoutKind;
  window: { start: string; end: string } | null; controlLabel: string;
  metrics: SettleMetric[];
  netSalesLiftUsd: number | null;          // change − control, dollars, from sales rows only
  flukeRate: number | null;                // 1 / (prior weeks + 1) when the change week is the extreme; null otherwise
  synthetic: boolean; dataTo: string | null;
}
