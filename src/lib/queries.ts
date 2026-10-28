import "server-only";
import { getSsrClient } from "@/lib/db/ssr";
import type { Hypothesis, LText, MenuItemLite, RestaurantProfile, ScoreBreakdown, SignalCitation, Playbook } from "@/lib/business/types";
import type { AudienceAffinity, CulturalSignal, ProviderMode, TagSignal } from "@/lib/providers/qloo/types";
import type { ScenarioAssumptions, ScenarioResult } from "@/lib/business/margin";

export const DEMO_RESTAURANT_ID = "00000000-0000-4000-8000-000000000101";

export interface RestaurantOverview {
  profile: RestaurantProfile & { hoursSummary?: string | null; menuUrl?: string | null; posPreference?: string | null; dataMode: ProviderMode; createdAt: string };
  menu: MenuItemLite[];
  isDemo: boolean;
}

export async function getRestaurantOverview(id: string): Promise<RestaurantOverview | null> {
  const supabase = await getSsrClient();
  const { data: r } = await supabase.from("restaurants").select("*, organizations!inner(is_demo)").eq("id", id).maybeSingle();
  if (!r) return null;
  const { data: items } = await supabase.from("menu_items").select("id,name,category,price,food_cost,is_signature").eq("restaurant_id", id).order("created_at");
  return {
    profile: {
      id: r.id, name: r.name, neighborhood: r.neighborhood, city: r.city, cuisine: r.cuisine, serviceFormats: r.service_formats ?? [], hoursSummary: r.hours_summary,
      priceLevel: r.price_level, costAssumptions: r.cost_assumptions ?? {}, objectives: r.objectives ?? {}, menuUrl: r.menu_url, posPreference: r.pos_preference, dataMode: r.data_mode, createdAt: r.created_at,
    },
    menu: (items ?? []).map((m) => ({ id: m.id, name: m.name, category: m.category, price: m.price === null ? null : Number(m.price), foodCost: m.food_cost === null ? null : Number(m.food_cost), isSignature: m.is_signature })),
    isDemo: Boolean((r as { organizations?: { is_demo: boolean } }).organizations?.is_demo),
  };
}

export interface RunView { id: string; traceId: string; status: string; mode: ProviderMode; startedAt: string | null; finishedAt: string | null; errorClass: string | null; summary: Record<string, unknown>; steps: Array<{ agent: string; seq: number; status: string; startedAt: string | null; finishedAt: string | null; toolCalls: number; outputSummary: Record<string, unknown> }> }

export async function getLatestRun(restaurantId: string): Promise<RunView | null> {
  const supabase = await getSsrClient();
  // Prefer the latest run that completed (passed the evaluator); a newer failed or running attempt must not hide usable results.
  const { data: ok } = await supabase.from("analysis_runs").select("*").eq("restaurant_id", restaurantId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const run = ok ?? (await supabase.from("analysis_runs").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
  if (!run) return null;
  const { data: steps } = await supabase.from("agent_steps").select("agent,seq,status,started_at,finished_at,tool_calls,output_summary").eq("run_id", run.id).order("seq");
  return {
    id: run.id, traceId: run.trace_id, status: run.status, mode: run.mode, startedAt: run.started_at, finishedAt: run.finished_at, errorClass: run.error_class, summary: run.summary ?? {},
    steps: (steps ?? []).map((s) => ({ agent: s.agent, seq: s.seq, status: s.status, startedAt: s.started_at, finishedAt: s.finished_at, toolCalls: s.tool_calls, outputSummary: s.output_summary ?? {} })),
  };
}

export interface EvidenceSourceView { id: string; provider: string; endpoint: string; requestParams: Record<string, string>; retrievedAt: string; ttlSeconds: number; mode: ProviderMode; citationUrl: string | null; fresh: boolean }
export interface EvidenceView {
  sources: EvidenceSourceView[];
  cuisineTags: TagSignal[];
  tagAffinities: TagSignal[];
  localPlaces: CulturalSignal[];
  crossDomain: CulturalSignal[];
  demographics: AudienceAffinity[];
  mode: ProviderMode | null;
}

export async function getLatestEvidence(restaurantId: string, since?: string | null): Promise<EvidenceView> {
  const supabase = await getSsrClient();
  let q = supabase.from("evidence_sources").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(12);
  if (since) q = q.gte("created_at", since);
  const { data: sources } = await q;
  const ids = (sources ?? []).map((s) => s.id);
  const { data: insights } = ids.length ? await supabase.from("qloo_insights").select("source_id,kind,normalized,created_at").in("source_id", ids).order("created_at", { ascending: false }) : { data: [] as Array<{ source_id: string; kind: string; normalized: unknown; created_at: string }> };
  const { data: records } = ids.length ? await supabase.from("evidence_records").select("source_id,type").in("source_id", ids) : { data: [] as Array<{ source_id: string; type: string }> };
  const typeBySource = new Map((records ?? []).map((r) => [r.source_id, r.type]));
  const pick = <T,>(type: string): T[] => {
    const hit = (insights ?? []).find((i) => typeBySource.get(i.source_id) === type);
    return (hit?.normalized as T[]) ?? [];
  };
  const now = Date.now();
  return {
    sources: (sources ?? []).map((s) => ({ id: s.id, provider: s.provider, endpoint: s.endpoint, requestParams: s.request_params ?? {}, retrievedAt: s.retrieved_at, ttlSeconds: s.freshness_ttl_seconds, mode: s.mode, citationUrl: s.citation_url, fresh: now - Date.parse(s.retrieved_at) < s.freshness_ttl_seconds * 1000 })),
    cuisineTags: pick<TagSignal>("cuisine_tags"),
    tagAffinities: pick<TagSignal>("tag_affinities"),
    localPlaces: pick<CulturalSignal>("local_place_affinities"),
    crossDomain: pick<CulturalSignal>("cross_domain_affinities"),
    demographics: pick<AudienceAffinity>("demographic_affinity"),
    mode: sources?.[0]?.mode ?? null,
  };
}

export interface HypothesisView {
  id: string; runId: string; rank: number; slug: string; title: string; segment: string; status: "proposed" | "pursued" | "rejected"; evidenceLabel: Hypothesis["evidenceLabel"]; disqualifiers: LText[];
  score: ScoreBreakdown; baselineScore: ScoreBreakdown; baselineRank: number; qlooDelta: Hypothesis["qlooDelta"]; citations: SignalCitation[]; summary: string; missingEvidence: LText[]; reasonsToAvoid: LText[]; defaultScenario: ScenarioAssumptions; playbook: Playbook; evidenceSourceIds: string[]; updatedAt: string;
}

function toHypothesisView(h: Record<string, unknown>): HypothesisView {
  const qv = (h.qloo_variant ?? {}) as Record<string, unknown>;
  const bv = (h.baseline_variant ?? {}) as Record<string, unknown>;
  return {
    id: String(h.id), runId: String(h.run_id), rank: Number(h.rank), slug: String(h.slug), title: String(h.title), segment: String(h.segment), status: h.status as HypothesisView["status"], evidenceLabel: h.evidence_label as HypothesisView["evidenceLabel"], disqualifiers: (qv.disqualifiers as LText[] | undefined) ?? ((h.disqualifiers as string[]) ?? []),
    score: h.score_breakdown as ScoreBreakdown, baselineScore: (bv.score as ScoreBreakdown) ?? (h.score_breakdown as ScoreBreakdown), baselineRank: Number(bv.rank ?? h.rank), qlooDelta: (qv.delta as Hypothesis["qlooDelta"]) ?? { rankChange: 0, changedBy: [], explanation: "" }, citations: (qv.citations as SignalCitation[]) ?? [], summary: String(qv.summary ?? ""), missingEvidence: (qv.missingEvidence as LText[]) ?? [], reasonsToAvoid: (qv.reasonsToAvoid as LText[]) ?? [], defaultScenario: qv.defaultScenario as ScenarioAssumptions, playbook: h.playbook as Playbook, evidenceSourceIds: (h.evidence_ids as string[]) ?? [], updatedAt: String(h.updated_at),
  };
}

export async function getHypotheses(restaurantId: string, runId: string): Promise<HypothesisView[]> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("opportunity_hypotheses").select("*").eq("restaurant_id", restaurantId).eq("run_id", runId).order("rank");
  return (data ?? []).map((h) => toHypothesisView(h as Record<string, unknown>));
}

export interface ScenarioView { id: string; label: string; assumptions: ScenarioAssumptions; results: ScenarioResult; createdAt: string }

export async function getHypothesis(id: string): Promise<{ hypothesis: HypothesisView; scenarios: ScenarioView[]; restaurantId: string } | null> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("opportunity_hypotheses").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: sc } = await supabase.from("scenarios").select("id,label,assumptions,results,created_at").eq("hypothesis_id", id).order("created_at", { ascending: false }).limit(10);
  return { hypothesis: toHypothesisView(data as Record<string, unknown>), restaurantId: data.restaurant_id, scenarios: (sc ?? []).map((s) => ({ id: s.id, label: s.label, assumptions: s.assumptions, results: s.results, createdAt: s.created_at })) };
}

export interface ActionView { id: string; hypothesisId: string | null; hypothesisSlug: string | null; hypothesisTitle: string | null; title: string; description: string | null; titleLt: LText | null; descriptionLt: LText | null; status: string; owner: string | null; dueDate: string | null; requiresApproval: boolean; externalSideEffect: boolean; evidenceIds: string[]; updatedAt: string; approvals: Array<{ decision: string; actorLabel: string; note: string | null; createdAt: string }> }

/** Tasks for a restaurant; when `runId` is given, only tasks drafted for that analysis run's hypotheses. */
export async function getActions(restaurantId: string, runId?: string | null): Promise<ActionView[]> {
  const supabase = await getSsrClient();
  let q = supabase.from("action_items").select("*, opportunity_hypotheses!inner(title,slug,run_id), approvals(decision,actor_label,note,created_at)").eq("restaurant_id", restaurantId).order("created_at");
  if (runId) q = q.eq("opportunity_hypotheses.run_id", runId);
  const { data } = await q;
  return (data ?? []).map((a) => ({
    id: a.id, hypothesisId: a.hypothesis_id, hypothesisSlug: (a as { opportunity_hypotheses?: { slug: string } | null }).opportunity_hypotheses?.slug ?? null, hypothesisTitle: (a as { opportunity_hypotheses?: { title: string } | null }).opportunity_hypotheses?.title ?? null, title: a.title, description: a.description, titleLt: (a.title_lt as LText | null) ?? null, descriptionLt: (a.description_lt as LText | null) ?? null, status: a.status, owner: a.owner, dueDate: a.due_date, requiresApproval: a.requires_approval, externalSideEffect: a.external_side_effect, evidenceIds: a.evidence_ids ?? [], updatedAt: a.updated_at,
    approvals: ((a as { approvals?: Array<{ decision: string; actor_label: string; note: string | null; created_at: string }> }).approvals ?? []).map((p) => ({ decision: p.decision, actorLabel: p.actor_label, note: p.note, createdAt: p.created_at })),
  }));
}

export interface EventView { id: string; kind: string; subjectId: string | null; summary: string; payload: Record<string, unknown>; actor: string; createdAt: string }

export async function getDecisionEvents(restaurantId: string, limit = 100): Promise<EventView[]> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("decision_events").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((e) => ({ id: e.id, kind: e.kind, subjectId: e.subject_id, summary: e.summary, payload: e.payload ?? {}, actor: e.actor, createdAt: e.created_at }));
}

export async function getMyRestaurants(): Promise<Array<{ id: string; name: string; cuisine: string; neighborhood: string | null; city: string; dataMode: ProviderMode; createdAt: string }>> {
  const supabase = await getSsrClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase.from("restaurants").select("id,name,cuisine,neighborhood,city,data_mode,created_at, organizations!inner(is_demo)").eq("organizations.is_demo", false).order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine, neighborhood: r.neighborhood, city: r.city, dataMode: r.data_mode, createdAt: r.created_at }));
}
