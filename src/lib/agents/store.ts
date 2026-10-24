/**
 * Persistence boundary for the agent workflow. The Supabase implementation uses the service-role client
 * (server only) after the caller has already authorized the restaurant; the memory implementation backs tests.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Hypothesis, LText, MenuItemLite, RestaurantProfile } from "@/lib/business/types";
import en from "@/i18n/en";
import { formatLText, makeT } from "@/i18n/shared";
const enText = (x: LText) => formatLText(makeT(en), x);
import type { ProviderMode, SourceProvenance } from "@/lib/providers/qloo/types";
import type { CacheEntry, GuardStore, UsageEvent } from "@/lib/providers/qloo/guard";

export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type StepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface RunRecord { id: string; restaurantId: string; traceId: string; status: RunStatus; mode: ProviderMode; errorClass?: string; summary?: Record<string, unknown> }
export interface StepRecord { id: string; runId: string; agent: string; seq: number; status: StepStatus; inputSummary?: Record<string, unknown>; outputSummary?: Record<string, unknown>; toolCalls?: number }
export interface EvidenceSourceInput { restaurantId: string; provenance: SourceProvenance; ttlSeconds: number }
export interface EvidenceRecordInput { restaurantId: string; sourceId: string; type: string; payload: unknown; interpretation: string; confidenceLabel: "high" | "medium" | "low" | "requires_validation" }
export interface QlooInsightInput { restaurantId: string; sourceId: string; kind: "entities" | "tags" | "demographics" | "heatmap" | "search"; normalized: unknown; expiresAt?: string }
export interface HypothesisRow { id: string; runId: string; restaurantId: string; hypothesis: Hypothesis; status: "proposed" | "pursued" | "rejected" }
export interface ActionItemInput { hypothesisId: string; restaurantId: string; title: string; description: string; titleLt?: LText; descriptionLt?: LText; owner?: string; dueDate?: string; requiresApproval: boolean; externalSideEffect: boolean; evidenceIds: string[] }
export interface DecisionEventInput { restaurantId: string; kind: string; subjectId?: string; summary: string; payload?: unknown; actor: string }

export interface AnalysisStore extends GuardStore {
  getRestaurant(id: string): Promise<{ profile: RestaurantProfile; menu: MenuItemLite[]; isDemo: boolean } | null>;
  createRun(input: { restaurantId: string; traceId: string; mode: ProviderMode }): Promise<RunRecord>;
  updateRun(id: string, patch: Partial<Pick<RunRecord, "status" | "errorClass" | "summary">> & { startedAt?: string; finishedAt?: string }): Promise<void>;
  createStep(input: { runId: string; restaurantId: string; agent: string; seq: number; inputSummary?: Record<string, unknown> }): Promise<StepRecord>;
  updateStep(id: string, patch: Partial<Pick<StepRecord, "status" | "outputSummary" | "toolCalls">> & { startedAt?: string; finishedAt?: string }): Promise<void>;
  createEvidenceSource(input: EvidenceSourceInput): Promise<string>;
  createEvidenceRecord(input: EvidenceRecordInput): Promise<string>;
  createQlooInsight(input: QlooInsightInput): Promise<string>;
  createHypotheses(runId: string, restaurantId: string, hypotheses: Hypothesis[]): Promise<HypothesisRow[]>;
  createActionItems(items: ActionItemInput[]): Promise<string[]>;
  createDecisionEvent(input: DecisionEventInput): Promise<string>;
  latestCompletedRun(restaurantId: string): Promise<RunRecord | null>;
}

/* ---------------- in-memory implementation (tests, dry runs) ---------------- */

let seq = 0;
const nid = () => `mem-${(++seq).toString(36)}`;

export class MemoryAnalysisStore implements AnalysisStore {
  restaurants = new Map<string, { profile: RestaurantProfile; menu: MenuItemLite[]; isDemo: boolean }>();
  runs = new Map<string, RunRecord>();
  steps = new Map<string, StepRecord>();
  sources: Array<EvidenceSourceInput & { id: string }> = [];
  records: Array<EvidenceRecordInput & { id: string }> = [];
  insights: Array<QlooInsightInput & { id: string }> = [];
  hypotheses: HypothesisRow[] = [];
  actions: Array<ActionItemInput & { id: string; status: string }> = [];
  events: Array<DecisionEventInput & { id: string; createdAt: string }> = [];
  cache = new Map<string, CacheEntry>();
  usage: UsageEvent[] = [];

  async getRestaurant(id: string) { return this.restaurants.get(id) ?? null; }
  async createRun(input: { restaurantId: string; traceId: string; mode: ProviderMode }) {
    const r: RunRecord = { id: nid(), status: "queued", ...input };
    this.runs.set(r.id, r);
    return r;
  }
  async updateRun(id: string, patch: Partial<RunRecord>) { Object.assign(this.runs.get(id)!, patch); }
  async createStep(input: { runId: string; restaurantId: string; agent: string; seq: number; inputSummary?: Record<string, unknown> }) {
    const s: StepRecord = { id: nid(), status: "pending", ...input };
    this.steps.set(s.id, s);
    return s;
  }
  async updateStep(id: string, patch: Partial<StepRecord>) { Object.assign(this.steps.get(id)!, patch); }
  async createEvidenceSource(input: EvidenceSourceInput) { const id = nid(); this.sources.push({ ...input, id }); return id; }
  async createEvidenceRecord(input: EvidenceRecordInput) { const id = nid(); this.records.push({ ...input, id }); return id; }
  async createQlooInsight(input: QlooInsightInput) { const id = nid(); this.insights.push({ ...input, id }); return id; }
  async createHypotheses(runId: string, restaurantId: string, hypotheses: Hypothesis[]) {
    const rows = hypotheses.map((h) => ({ id: nid(), runId, restaurantId, hypothesis: h, status: "proposed" as const }));
    this.hypotheses.push(...rows);
    return rows;
  }
  async createActionItems(items: ActionItemInput[]) {
    return items.map((i) => { const id = nid(); this.actions.push({ ...i, id, status: i.requiresApproval ? "needs_approval" : "draft" }); return id; });
  }
  async createDecisionEvent(input: DecisionEventInput) { const id = nid(); this.events.push({ ...input, id, createdAt: new Date().toISOString() }); return id; }
  async latestCompletedRun(restaurantId: string) {
    return [...this.runs.values()].reverse().find((r) => r.restaurantId === restaurantId && r.status === "completed") ?? null;
  }
  async getCache(key: string) { return this.cache.get(key); }
  async setCache(key: string, entry: CacheEntry) { this.cache.set(key, entry); }
  async countCallsSince(sinceIso: string) { const s = Date.parse(sinceIso); return this.usage.filter((e) => !e.cacheHit && Date.parse(e.createdAt) >= s).length; }
  async recordUsage(ev: UsageEvent) { this.usage.push(ev); }
}

/* ---------------- Supabase implementation (service role, server only) ---------------- */

type Row = Record<string, unknown>;

function toProfile(r: Row): RestaurantProfile {
  return {
    id: String(r.id),
    name: String(r.name),
    neighborhood: (r.neighborhood as string | null) ?? null,
    city: String(r.city ?? "San Francisco"),
    cuisine: String(r.cuisine),
    serviceFormats: (r.service_formats as string[]) ?? [],
    hoursSummary: (r.hours_summary as string | null) ?? null,
    priceLevel: (r.price_level as number | null) ?? null,
    costAssumptions: (r.cost_assumptions as RestaurantProfile["costAssumptions"]) ?? {},
    objectives: (r.objectives as RestaurantProfile["objectives"]) ?? {},
  };
}

export class SupabaseAnalysisStore implements AnalysisStore {
  constructor(private readonly db: SupabaseClient) {}

  private async one(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row> {
    const { data, error } = await p;
    if (error) throw new Error(`db: ${error.message}`);
    if (data === null || data === undefined) throw new Error("db: no row returned");
    return data as Row;
  }

  async getRestaurant(id: string) {
    const { data: r, error } = await this.db.from("restaurants").select("*, organizations!inner(is_demo)").eq("id", id).maybeSingle();
    if (error) throw new Error(`db: ${error.message}`);
    if (!r) return null;
    const { data: items } = await this.db.from("menu_items").select("id,name,category,price,food_cost,is_signature").eq("restaurant_id", id).order("created_at");
    const menu: MenuItemLite[] = (items ?? []).map((m) => ({ id: m.id, name: m.name, category: m.category, price: m.price === null ? null : Number(m.price), foodCost: m.food_cost === null ? null : Number(m.food_cost), isSignature: m.is_signature }));
    const org = (r as Row).organizations as { is_demo: boolean } | null;
    return { profile: toProfile(r as Row), menu, isDemo: Boolean(org?.is_demo) };
  }

  async createRun(input: { restaurantId: string; traceId: string; mode: ProviderMode }) {
    const row = await this.one(this.db.from("analysis_runs").insert({ restaurant_id: input.restaurantId, trace_id: input.traceId, mode: input.mode, status: "queued" }).select("id").single());
    return { id: String(row.id), restaurantId: input.restaurantId, traceId: input.traceId, status: "queued" as const, mode: input.mode };
  }
  async updateRun(id: string, patch: Partial<RunRecord> & { startedAt?: string; finishedAt?: string }) {
    const { error } = await this.db.from("analysis_runs").update({ status: patch.status, error_class: patch.errorClass, summary: patch.summary, started_at: patch.startedAt, finished_at: patch.finishedAt }).eq("id", id);
    if (error) throw new Error(`db: ${error.message}`);
  }
  async createStep(input: { runId: string; restaurantId: string; agent: string; seq: number; inputSummary?: Record<string, unknown> }) {
    const row = await this.one(this.db.from("agent_steps").insert({ run_id: input.runId, restaurant_id: input.restaurantId, agent: input.agent, seq: input.seq, input_summary: input.inputSummary ?? {}, status: "pending" }).select("id").single());
    return { id: String(row.id), status: "pending" as const, ...input };
  }
  async updateStep(id: string, patch: Partial<StepRecord> & { startedAt?: string; finishedAt?: string }) {
    const { error } = await this.db.from("agent_steps").update({ status: patch.status, output_summary: patch.outputSummary, tool_calls: patch.toolCalls, started_at: patch.startedAt, finished_at: patch.finishedAt }).eq("id", id);
    if (error) throw new Error(`db: ${error.message}`);
  }
  async createEvidenceSource(input: EvidenceSourceInput) {
    const p = input.provenance;
    const row = await this.one(this.db.from("evidence_sources").insert({ restaurant_id: input.restaurantId, provider: p.provider, endpoint: p.endpoint, request_params: p.requestParams, retrieved_at: p.retrievedAt, freshness_ttl_seconds: input.ttlSeconds, mode: p.mode, citation_url: p.citationUrl ?? null }).select("id").single());
    return String(row.id);
  }
  async createEvidenceRecord(input: EvidenceRecordInput) {
    const row = await this.one(this.db.from("evidence_records").insert({ restaurant_id: input.restaurantId, source_id: input.sourceId, type: input.type, payload: input.payload, interpretation: input.interpretation, confidence_label: input.confidenceLabel }).select("id").single());
    return String(row.id);
  }
  async createQlooInsight(input: QlooInsightInput) {
    const row = await this.one(this.db.from("qloo_insights").insert({ restaurant_id: input.restaurantId, source_id: input.sourceId, kind: input.kind, normalized: input.normalized, expires_at: input.expiresAt ?? null }).select("id").single());
    return String(row.id);
  }
  async createHypotheses(runId: string, restaurantId: string, hypotheses: Hypothesis[]) {
    const rows = hypotheses.map((h) => ({
      run_id: runId, restaurant_id: restaurantId, rank: h.rank, slug: h.slug, title: h.title, segment: h.segment,
      baseline_variant: { score: h.baselineScore, rank: h.baselineRank },
      qloo_variant: { score: h.score, delta: h.qlooDelta, citations: h.citations, summary: h.summary, missingEvidence: h.missingEvidence, reasonsToAvoid: h.reasonsToAvoid, disqualifiers: h.disqualifiers, defaultScenario: h.defaultScenario },
      evidence_ids: h.evidenceSourceIds, score_breakdown: h.score, evidence_label: h.evidenceLabel, disqualifiers: h.disqualifiers.map(enText), status: "proposed", playbook: h.playbook,
    }));
    const { data, error } = await this.db.from("opportunity_hypotheses").insert(rows).select("id,slug");
    if (error) throw new Error(`db: ${error.message}`);
    return (data ?? []).map((d) => ({ id: String(d.id), runId, restaurantId, hypothesis: hypotheses.find((h) => h.slug === d.slug)!, status: "proposed" as const }));
  }
  async createActionItems(items: ActionItemInput[]) {
    if (!items.length) return [];
    const { data, error } = await this.db.from("action_items").insert(items.map((i) => ({ hypothesis_id: i.hypothesisId, restaurant_id: i.restaurantId, title: i.title, description: i.description, title_lt: i.titleLt ?? null, description_lt: i.descriptionLt ?? null, owner: i.owner ?? null, due_date: i.dueDate ?? null, requires_approval: i.requiresApproval, external_side_effect: i.externalSideEffect, evidence_ids: i.evidenceIds, status: i.requiresApproval ? "needs_approval" : "draft" }))).select("id");
    if (error) throw new Error(`db: ${error.message}`);
    return (data ?? []).map((d) => String(d.id));
  }
  async createDecisionEvent(input: DecisionEventInput) {
    const row = await this.one(this.db.from("decision_events").insert({ restaurant_id: input.restaurantId, kind: input.kind, subject_id: input.subjectId ?? null, summary: input.summary, payload: input.payload ?? {}, actor: input.actor }).select("id").single());
    return String(row.id);
  }
  async latestCompletedRun(restaurantId: string) {
    const { data } = await this.db.from("analysis_runs").select("id,restaurant_id,trace_id,status,mode,summary").eq("restaurant_id", restaurantId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? { id: data.id, restaurantId: data.restaurant_id, traceId: data.trace_id, status: data.status, mode: data.mode, summary: data.summary } : null;
  }
  async getCache(key: string) {
    const { data } = await this.db.from("provider_cache").select("payload,expires_at").eq("cache_key", key).maybeSingle();
    return data ? { payload: data.payload, expiresAt: Date.parse(data.expires_at) } : undefined;
  }
  async setCache(key: string, entry: CacheEntry) {
    await this.db.from("provider_cache").upsert({ cache_key: key, provider: "qloo", payload: entry.payload, expires_at: new Date(entry.expiresAt).toISOString() });
  }
  async countCallsSince(sinceIso: string) {
    const { count } = await this.db.from("usage_events").select("id", { count: "exact", head: true }).eq("provider", "qloo").eq("cache_hit", false).gte("created_at", sinceIso);
    return count ?? 0;
  }
  async recordUsage(ev: UsageEvent) {
    await this.db.from("usage_events").insert({ provider: ev.provider, endpoint: ev.endpoint, cache_hit: ev.cacheHit, latency_ms: ev.latencyMs ?? null, error_class: ev.errorClass ?? null, trace_id: ev.traceId ?? null, created_at: ev.createdAt });
  }
}
