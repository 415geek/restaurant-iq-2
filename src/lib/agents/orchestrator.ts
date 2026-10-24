/**
 * Bounded, inspectable agent workflow:
 *   Intake → Evidence → Opportunity → Finance → Execution → Evaluator
 * Each step: persisted agent_steps row, tool budget, timeout, trace id. No free-running loops, no LLM in the critical path.
 */
import { randomUUID } from "node:crypto";
import { scoreHypotheses } from "@/lib/business/scoring";
import { computeScenario, sensitivity } from "@/lib/business/margin";
import type { EvidenceBundle, Hypothesis, MenuItemLite, RestaurantProfile } from "@/lib/business/types";
import { QlooProvider, QlooError, type ProviderMode } from "@/lib/providers/qloo";
import type { AnalysisStore, HypothesisRow } from "./store";

export interface OrchestratorOptions {
  store: AnalysisStore;
  provider: QlooProvider;
  restaurantId: string;
  actor?: string; // "demo-visitor" | user id
  traceId?: string;
  stepTimeoutMs?: number;
  maxToolCallsPerStep?: number;
  now?: () => Date;
}

export interface AnalysisResult {
  runId: string;
  traceId: string;
  mode: ProviderMode;
  status: "completed" | "failed";
  hypotheses: HypothesisRow[];
  viableCount: number;
  noViableOpportunity: boolean;
  evidenceFailures: EvidenceBundle["failures"];
  evaluator: { passed: boolean; checks: Array<{ name: string; ok: boolean; detail: string }> };
  researchPlan: string[];
}

const AGENTS = ["IntakeAgent", "EvidenceAgent", "OpportunityAgent", "FinanceAgent", "ExecutionAgent", "Evaluator"] as const;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function runAnalysis(opts: OrchestratorOptions): Promise<AnalysisResult> {
  const { store, provider, restaurantId } = opts;
  const now = opts.now ?? (() => new Date());
  const traceId = opts.traceId ?? randomUUID();
  const stepTimeout = opts.stepTimeoutMs ?? 45_000;
  const maxCalls = opts.maxToolCallsPerStep ?? 8;
  const actor = opts.actor ?? "system";

  const run = await store.createRun({ restaurantId, traceId, mode: provider.mode });
  await store.updateRun(run.id, { status: "running", startedAt: now().toISOString() });

  let seq = 0;
  async function step<T>(agent: (typeof AGENTS)[number], input: Record<string, unknown>, fn: (budget: { use: () => void }) => Promise<{ out: T; summary: Record<string, unknown> }>): Promise<T> {
    const s = await store.createStep({ runId: run.id, restaurantId, agent, seq: ++seq, inputSummary: input });
    await store.updateStep(s.id, { status: "running", startedAt: now().toISOString() });
    let calls = 0;
    const budget = { use: () => { calls += 1; if (calls > maxCalls) throw new Error(`${agent} exceeded tool budget (${maxCalls})`); } };
    try {
      const { out, summary } = await withTimeout(fn(budget), stepTimeout, agent);
      await store.updateStep(s.id, { status: "succeeded", outputSummary: summary, toolCalls: calls, finishedAt: now().toISOString() });
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.updateStep(s.id, { status: "failed", outputSummary: { error: message.slice(0, 300) }, toolCalls: calls, finishedAt: now().toISOString() });
      throw err;
    }
  }

  try {
    // 1. Intake
    const intake = await step("IntakeAgent", { restaurantId }, async () => {
      const r = await store.getRestaurant(restaurantId);
      if (!r) throw new Error("Restaurant not found");
      const missing: string[] = [];
      if (!r.menu.length) missing.push("menu items");
      if (!r.profile.costAssumptions.avg_ticket) missing.push("average ticket");
      if (!r.profile.objectives.primary) missing.push("primary objective");
      if (!r.profile.neighborhood) missing.push("neighborhood");
      return { out: { ...r, missing }, summary: { menuItems: r.menu.length, missing, isDemo: r.isDemo } };
    });

    // 2. Evidence (Qloo)
    const evidence = await step("EvidenceAgent", { mode: provider.mode, cuisine: intake.profile.cuisine }, async (budget) =>
      collectEvidence(provider, store, intake.profile, budget),
    );

    // 3. Opportunity
    const outcome = await step("OpportunityAgent", { mode: evidence.mode, signals: evidence.tagAffinities.data.length + evidence.crossDomain.data.length }, async () => {
      const o = scoreHypotheses(intake.profile, intake.menu, evidence);
      return { out: o, summary: { ranked: o.hypotheses.length, viable: o.viable.length, noViable: o.noViableOpportunity, top: o.viable.map((h) => h.slug) } };
    });

    // 4. Finance (deterministic; attaches computed base scenario + sensitivity to each hypothesis playbook)
    const financed = await step("FinanceAgent", { hypotheses: outcome.hypotheses.length }, async () => {
      const hs: Hypothesis[] = outcome.hypotheses.map((h) => ({
        ...h,
        playbook: {
          ...h.playbook,
          offering: {
            ...h.playbook.offering,
            scenarios: h.playbook.offering.scenarios.map((s) => ({ ...s, assumptions: s.assumptions })),
          },
        },
      }));
      const computed = hs.map((h) => ({ slug: h.slug, base: computeScenario(h.defaultScenario), sensitivity: sensitivity(h.defaultScenario) }));
      return { out: { hs, computed }, summary: { positive: computed.filter((c) => c.base.adjustedIncrementalProfit > 0).length, negative: computed.filter((c) => c.base.adjustedIncrementalProfit <= 0).length } };
    });

    const rows = await store.createHypotheses(run.id, restaurantId, financed.hs);

    // 5. Execution (draft tasks; anything with external side effects needs approval)
    const actionIds = await step("ExecutionAgent", { viable: outcome.viable.length }, async () => {
      const items = rows
        .filter((r) => r.hypothesis.evidenceLabel !== "not_recommended")
        .slice(0, 3)
        .flatMap((r) => {
          const pb = r.hypothesis.playbook;
          const due = (d: number) => new Date(now().getTime() + d * 86_400_000).toISOString().slice(0, 10);
          return [
            ...pb.capacityChecklist.map((c) => ({ hypothesisId: r.id, restaurantId, title: c.item, description: `Capacity check for "${r.hypothesis.title}"`, owner: c.owner, dueDate: due(c.dueInDays), requiresApproval: false, externalSideEffect: false, evidenceIds: r.hypothesis.evidenceSourceIds })),
            ...pb.channels.map((c) => ({ hypothesisId: r.id, restaurantId, title: `Verify channel: ${c.name}`, description: c.task, owner: "Owner", dueDate: due(7), requiresApproval: false, externalSideEffect: false, evidenceIds: r.hypothesis.evidenceSourceIds })),
            { hypothesisId: r.id, restaurantId, title: `Publish launch post: ${r.hypothesis.title}`, description: pb.marketing.postingDraft, owner: "Owner", dueDate: due(10), requiresApproval: true, externalSideEffect: true, evidenceIds: r.hypothesis.evidenceSourceIds },
          ];
        });
      const ids = await store.createActionItems(items);
      return { out: ids, summary: { created: ids.length, needsApproval: items.filter((i) => i.requiresApproval).length } };
    });

    // 6. Evaluator
    const evaluator = await step("Evaluator", { hypotheses: rows.length, actions: actionIds.length }, async () => {
      const checks = evaluate(rows.map((r) => r.hypothesis), evidence);
      return { out: { passed: checks.every((c) => c.ok), checks }, summary: { passed: checks.every((c) => c.ok), failed: checks.filter((c) => !c.ok).map((c) => c.name) } };
    });

    await store.createDecisionEvent({
      restaurantId, kind: "analysis_completed", subjectId: run.id, actor,
      summary: `Analysis completed in ${provider.mode} mode: ${outcome.viable.length} viable hypothes${outcome.viable.length === 1 ? "is" : "es"}${outcome.noViableOpportunity ? " (no viable opportunity)" : ""}.`,
      payload: { traceId, mode: provider.mode, top: outcome.viable.map((h) => ({ slug: h.slug, label: h.evidenceLabel })), evidenceFailures: evidence.failures, evaluator: evaluator.passed },
    });
    await store.updateRun(run.id, { status: "completed", finishedAt: now().toISOString(), summary: { viable: outcome.viable.length, noViable: outcome.noViableOpportunity, evaluatorPassed: evaluator.passed, failures: evidence.failures.length } });

    return { runId: run.id, traceId, mode: provider.mode, status: "completed", hypotheses: rows, viableCount: outcome.viable.length, noViableOpportunity: outcome.noViableOpportunity, evidenceFailures: evidence.failures, evaluator, researchPlan: outcome.researchPlan };
  } catch (err) {
    const errorClass = err instanceof QlooError ? err.errorClass : "internal";
    await store.updateRun(run.id, { status: "failed", errorClass, finishedAt: now().toISOString(), summary: { message: (err instanceof Error ? err.message : String(err)).slice(0, 300) } });
    throw err;
  }
}

/** EvidenceAgent body: bounded Qloo calls, each persisted as evidence_sources + qloo_insights + evidence_records. */
export async function collectEvidence(provider: QlooProvider, store: AnalysisStore, profile: RestaurantProfile, budget: { use: () => void }): Promise<{ out: EvidenceBundle; summary: Record<string, unknown> }> {
  const failures: EvidenceBundle["failures"] = [];
  const geo = { localityQuery: [profile.neighborhood, profile.city].filter(Boolean).join(", ") };
  const ttl = 86_400;
  const rid = profile.id;
  const conf = provider.mode === "live" ? ("medium" as const) : ("requires_validation" as const);

  async function persist<T>(kind: "tags" | "entities" | "demographics" | "search", type: string, r: { data: T; provenance: Parameters<AnalysisStore["createEvidenceSource"]>[0]["provenance"] }, interpretation: string) {
    const sourceId = await store.createEvidenceSource({ restaurantId: rid, provenance: r.provenance, ttlSeconds: ttl });
    await store.createQlooInsight({ restaurantId: rid, sourceId, kind, normalized: r.data, expiresAt: new Date(Date.parse(r.provenance.retrievedAt) + ttl * 1000).toISOString() });
    await store.createEvidenceRecord({ restaurantId: rid, sourceId, type, payload: { count: Array.isArray(r.data) ? r.data.length : 1 }, interpretation, confidenceLabel: conf });
    return sourceId;
  }

  // In live mode a hard failure aborts the step (no silent fixture substitution). Soft failures are recorded.
  const empty = <T,>(): { data: T[]; sourceId: string } => ({ data: [], sourceId: "" });

  budget.use();
  const cuisine = await provider.resolveCuisineTags(profile.cuisine);
  const cuisineSrc = await persist("tags", "cuisine_tags", cuisine, `Cuisine "${profile.cuisine}" resolved to ${cuisine.data.length} Qloo place tag(s).`);
  const tagIds = cuisine.data.slice(0, 3).map((t) => t.tagId);
  if (!tagIds.length) {
    failures.push({ step: "resolveCuisineTags", errorClass: "not_found", message: "No Qloo tag matched the cuisine" });
  }

  let tagAff = empty<EvidenceBundle["tagAffinities"]["data"][number]>();
  let places = empty<EvidenceBundle["localPlaces"]["data"][number]>();
  let cross: EvidenceBundle["crossDomain"] = { ...empty<EvidenceBundle["crossDomain"]["data"][number]>(), failedDomains: [] };
  let demo = empty<EvidenceBundle["demographics"]["data"][number]>();

  if (tagIds.length) {
    const tasks: Array<[string, () => Promise<void>]> = [
      ["getTagAffinities", async () => { const r = await provider.getTagAffinities({ tagIds, geo }); tagAff = { data: r.data, sourceId: await persist("tags", "tag_affinities", r, `${r.data.length} place attributes ranked by taste affinity for this cuisine's audience near ${geo.localityQuery}.`) }; }],
      ["getLocalPlaceAffinities", async () => { const r = await provider.getLocalPlaceAffinities({ tagIds, geo, take: 20 }); places = { data: r.data, sourceId: await persist("entities", "local_place_affinities", r, `${r.data.length} nearby places with affinity for this taste profile.`) }; }],
      ["getCrossDomainAffinities", async () => { const r = await provider.getCrossDomainAffinities({ tagIds, geo }); cross = { data: r.data, failedDomains: r.failedDomains, sourceId: await persist("entities", "cross_domain_affinities", r, `${r.data.length} non-food entities (brands, podcasts, artists, shows) linked to this cuisine's fans.`) }; }],
      ["getDemographics", async () => { const r = await provider.getDemographics({ tagIds }); demo = { data: r.data, sourceId: await persist("demographics", "demographic_affinity", r, "Age/gender affinity deltas (signed vs average) for the cuisine tags.") }; }],
    ];
    for (const [name, fn] of tasks) {
      budget.use();
      try {
        await fn();
      } catch (err) {
        const errorClass = err instanceof QlooError ? err.errorClass : "internal";
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ step: name, errorClass, message });
        if (provider.mode === "live" && (errorClass === "forbidden" || errorClass === "quota_exceeded" || errorClass === "no_key")) throw err; // hard stop, never fake
      }
    }
  }

  const bundle: EvidenceBundle = {
    mode: provider.mode,
    cuisineTags: { data: cuisine.data, sourceId: cuisineSrc },
    tagAffinities: tagAff,
    localPlaces: places,
    crossDomain: cross,
    demographics: demo,
    failures,
  };
  return { out: bundle, summary: { mode: provider.mode, tags: tagAff.data.length, places: places.data.length, crossDomain: cross.data.length, demographics: demo.data.length, failures: failures.map((f) => `${f.step}:${f.errorClass}`) } };
}

/** Evaluator: provenance, unsupported claims, schema/calc consistency, safeguards. */
export function evaluate(hs: Hypothesis[], ev: EvidenceBundle): Array<{ name: string; ok: boolean; detail: string }> {
  const viable = hs.filter((h) => h.evidenceLabel !== "not_recommended");
  const checks = [
    { name: "viable_have_citations", ok: viable.every((h) => h.citations.length > 0), detail: `${viable.filter((h) => !h.citations.length).length} viable hypotheses lack a cited signal` },
    { name: "citations_have_sources", ok: hs.every((h) => h.citations.every((c) => c.sourceId)), detail: "every citation references an evidence source" },
    { name: "no_invented_affinity", ok: hs.every((h) => h.citations.every((c) => c.affinity === undefined || (c.affinity >= -1 && c.affinity <= 1))), detail: "affinity values stay within provider range" },
    { name: "economics_consistent", ok: hs.every((h) => { const r = computeScenario(h.defaultScenario); return Math.abs(r.incrementalContributionProfit - r.contributionLostToCannibalization - r.adjustedIncrementalProfit) < 0.011; }), detail: "adjusted profit = contribution - cannibalization" },
    { name: "not_recommended_has_reason", ok: hs.filter((h) => h.evidenceLabel === "not_recommended").every((h) => h.disqualifiers.length > 0 || h.reasonsToAvoid.length > 0 || h.score.notes.length > 0), detail: "every rejection carries a reason" },
    { name: "sample_mode_labeled", ok: ev.mode === "live" || hs.every((h) => h.evidenceLabel === "not_recommended" || h.evidenceLabel === "requires_validation"), detail: "sample evidence cannot produce high/medium labels" },
    { name: "approval_gate_present", ok: hs.every((h) => h.playbook.approvalGate.length > 0), detail: "external actions gated behind approval" },
  ];
  return checks;
}
