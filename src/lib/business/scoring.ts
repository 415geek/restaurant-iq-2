/**
 * Deterministic opportunity scoring. Produces ranked hypotheses WITH Qloo evidence and a baseline
 * ranking WITHOUT Qloo, and explains which signal changed each rank. All text is keyed (LText).
 */
import { HYPOTHESIS_CATALOG, type HypothesisTemplate, type Offering } from "./catalog";
import { computeScenario, type ScenarioAssumptions } from "./margin";
import type { EvidenceBundle, EvidenceLabel, Hypothesis, LText, MenuItemLite, Playbook, RestaurantProfile, ScoreBreakdown, SignalCitation, OpportunityOutcome } from "./types";
import type { LParam } from "@/i18n/locales";
import type { TagSignal } from "@/lib/providers/qloo/types";

export const WEIGHTS = { tasteFit: 0.3, operationalFit: 0.25, feasibility: 0.15, economics: 0.2, evidenceQuality: 0.1 } as const;
/**
 * Controlled "without Qloo" counterfactual: same candidates, same constraints, same weights, same non-Qloo scores.
 * Only the two Qloo-derived inputs are replaced by an uninformed prior (taste fit neutral, evidence at the no-data level),
 * so any rank difference is attributable to Qloo evidence alone. A different rank is not proof of a better outcome.
 */
export const NO_QLOO_PRIOR = { tasteFit: 0.5, evidenceQuality: 0.4 } as const;
export const BASELINE_WEIGHTS = WEIGHTS;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const AGE_LABEL: Record<string, string> = { "24_and_younger": "≤24", "25_to_29": "25–29", "30_to_34": "30–34", "35_to_44": "35–44", "45_to_54": "45–54", "55_and_older": "55+" };
const K = (key: string, params?: Record<string, LParam>): LText => ({ key, params });
const L = (level: "strong" | "moderate" | "weak" | "unknown"): LText => ({ key: `gen.level.${level}` });

function matchTags(tags: TagSignal[], substrings: string[]): TagSignal[] {
  return tags.filter((t) => substrings.some((s) => t.tagId.toLowerCase().includes(s) || t.name.toLowerCase().includes(s)));
}
function levelOf(a?: number): "strong" | "moderate" | "weak" | "unknown" {
  if (a === undefined) return "unknown";
  return a >= 0.8 ? "strong" : a >= 0.5 ? "moderate" : "weak";
}

export function defaultScenario(t: HypothesisTemplate, profile: RestaurantProfile, menu: MenuItemLite[]): ScenarioAssumptions {
  const o = t.offeringTemplate(menu, profile);
  const ca = profile.costAssumptions;
  const delivery = profile.serviceFormats.includes("third_party_delivery");
  const deliveryShare = t.requirements.needsDelivery ? 1 : delivery ? 0.3 : 0;
  return {
    salePrice: o.salePrice, incrementalUnits: t.operationalComplexity === 1 ? 60 : 40, periodLabel: "per week", foodCostPerUnit: o.foodCost,
    packagingPerUnit: deliveryShare > 0 ? (ca.packaging_per_order ?? 0.85) : 0.25, incrementalLaborHours: t.requirements.extraLaborHoursPerWeek ?? 0,
    laborRatePerHour: ca.labor_cost_per_hour ?? 22, deliveryShare, deliveryCommissionPct: ca.delivery_commission_pct ?? 0.25, cardFeePct: ca.card_fee_pct ?? 0.029,
    discountPct: t.slug.includes("lunch") || t.slug.includes("bundle") ? 0.1 : 0, otherVariableCostPerUnit: 0,
    marketingCost: t.slug === "cross-domain-partnership" ? 200 : 100, fixedTestCosts: t.operationalComplexity === 3 ? 600 : 150,
    cannibalizationPct: t.slug.includes("lunch") ? 0.25 : 0.1,
    cannibalizedOrderContribution: Math.round(((ca.avg_ticket ?? 24) * (1 - (ca.food_cost_pct ?? 0.32)) - 2) * 100) / 100,
  };
}

interface Scored {
  template: HypothesisTemplate; score: ScoreBreakdown; baseline: ScoreBreakdown; citations: SignalCitation[];
  disqualifiers: LText[]; missing: LText[]; avoid: LText[]; scenario: ScenarioAssumptions; offering: Offering;
}

function operational(t: HypothesisTemplate, profile: RestaurantProfile, menu: MenuItemLite[]): { fit: number; disq: LText[]; notes: LText[] } {
  const disq: LText[] = []; const notes: LText[] = []; let fit = 1;
  const r = t.requirements;
  const constraints = (profile.objectives.constraints ?? []).map((c) => c.toLowerCase());
  const objective = (profile.objectives.primary ?? "").toLowerCase();
  if (r.anyServiceFormat && !r.anyServiceFormat.some((f) => profile.serviceFormats.includes(f))) disq.push(K("gen.dqFormat", { formats: r.anyServiceFormat.join(" / ") }));
  if (r.menuKeywords && !menu.some((m) => r.menuKeywords!.some((k) => m.name.toLowerCase().includes(k) || m.category.toLowerCase().includes(k)))) disq.push(K("gen.dqMenu"));
  if (r.needsAlcohol && constraints.some((c) => c.includes("liquor") || c.includes("alcohol"))) disq.push(K("gen.dqAlcohol"));
  for (const b of r.constraintBlockers ?? []) {
    const hit = constraints.find((c) => c.includes(b)) ?? (objective.includes(b) ? b : undefined);
    if (hit) {
      if (r.needsExtendedHours || r.needsAlcohol) disq.push(K("gen.dqConstraint", { c: hit }));
      else { fit -= 0.3; notes.push(K("gen.noteTension", { c: hit })); }
    }
  }
  if (r.needsExtendedHours) { fit -= 0.35; notes.push(K("gen.noteHours")); }
  if (r.needsDelivery && !profile.serviceFormats.includes("third_party_delivery")) disq.push(K("gen.dqDelivery"));
  fit -= (t.operationalComplexity - 1) * 0.15;
  return { fit: clamp01(fit), disq: dedupe(disq), notes };
}
function dedupe(xs: LText[]): LText[] { const seen = new Set<string>(); return xs.filter((x) => { const k = JSON.stringify(x); if (seen.has(k)) return false; seen.add(k); return true; }); }

function tasteFit(t: HypothesisTemplate, ev: EvidenceBundle): { fit: number; citations: SignalCitation[]; notes: LText[] } {
  const citations: SignalCitation[] = []; const notes: LText[] = []; let fit = 0;
  const tagHits = matchTags(ev.tagAffinities.data, t.triggerTags);
  if (tagHits.length) {
    const best = tagHits.reduce((a, b) => ((b.affinity ?? 0) > (a.affinity ?? 0) ? b : a));
    fit = Math.max(fit, best.affinity ?? 0.5);
    for (const h of tagHits.slice(0, 2)) citations.push({ kind: "tag", id: h.tagId, name: h.name, affinity: h.affinity, sourceId: ev.tagAffinities.sourceId, note: K("gen.citeTag", { name: h.name, level: L(levelOf(h.affinity)) }) });
  }
  const placeHits = ev.localPlaces.data.filter((p) => p.tags.some((tg) => t.triggerTags.some((s) => tg.id.toLowerCase().includes(s) || tg.name.toLowerCase().includes(s))));
  if (placeHits.length) {
    const best = placeHits.reduce((a, b) => ((b.affinity ?? 0) > (a.affinity ?? 0) ? b : a));
    fit = Math.max(fit, (best.affinity ?? 0.5) * 0.9);
    const matched = best.tags.find((tg) => t.triggerTags.some((s) => tg.id.toLowerCase().includes(s) || tg.name.toLowerCase().includes(s)));
    citations.push({ kind: "entity", id: best.entityId, name: matched ? `${best.name} · ${matched.name}` : best.name, affinity: best.affinity, sourceId: ev.localPlaces.sourceId, note: K("gen.citePlace", { level: L(levelOf(best.affinity)) }) });
  }
  if (t.triggerAgeBuckets?.length && ev.demographics.data.length) {
    const d = ev.demographics.data[0];
    const vals = t.triggerAgeBuckets.map((b) => d.age[b as keyof typeof d.age]).filter((v): v is number => typeof v === "number");
    if (vals.length) {
      const m = Math.max(...vals);
      const buckets = t.triggerAgeBuckets.map((b) => AGE_LABEL[b] ?? b).join(" / ");
      if (m > 0) { fit = Math.min(1, fit + Math.min(0.2, m * 0.4)); citations.push({ kind: "demographic", id: d.signalId, name: `Age ${buckets}`, affinity: m, sourceId: ev.demographics.sourceId, note: K("gen.citeAge", { buckets, v: `${m > 0 ? "+" : ""}${m.toFixed(2)}` }) }); }
      else notes.push(K("gen.noteAgeUnder"));
    }
  }
  if (t.triggerCrossDomains?.length) {
    const hits = ev.crossDomain.data.filter((c) => t.triggerCrossDomains!.includes(c.domain) && (c.affinity ?? 0) >= 0.7);
    if (hits.length) {
      const best = hits.reduce((a, b) => ((b.affinity ?? 0) > (a.affinity ?? 0) ? b : a));
      fit = Math.max(fit, best.affinity ?? 0.7);
      for (const h of hits.slice(0, 3)) citations.push({ kind: "entity", id: h.entityId, name: h.name, affinity: h.affinity, sourceId: ev.crossDomain.sourceId, note: K("gen.citeCross", { domain: { key: `taste.domain.${h.domain}` }, level: L(levelOf(h.affinity)) }) });
    } else notes.push(K("gen.noteNoCross"));
  }
  if (!citations.length) notes.push(K("gen.noteNoSignal"));
  return { fit: clamp01(fit), citations, notes };
}

function feasibility(t: HypothesisTemplate, profile: RestaurantProfile): { f: number; missing: LText[] } {
  const missing: LText[] = []; let f = 0.5;
  if (t.channelKeys.some((c) => ["gbp", "signage", "menuRelabel", "hoursUpdate", "afternoonSignage"].includes(c))) f += 0.2;
  if (t.requirements.needsDelivery) { f -= 0.1; missing.push(K("gen.missDelivery")); }
  if (t.slug === "cross-domain-partnership") missing.push(K("gen.missPartner"));
  if (t.requirements.needsExtendedHours) missing.push(K("gen.missStaff"));
  if (!profile.priceLevel) missing.push(K("gen.missPrice"));
  return { f: clamp01(f), missing };
}

const WARN_KEY: Record<string, string> = {
  "Per-unit contribution is zero or negative: more volume does not fix the economics.": "lab.warn.negative",
  "No incremental units assumed: result shows fixed and marketing cost exposure only.": "lab.warn.zeroUnits",
  "Food cost above 40% of net price.": "lab.warn.foodCost",
  "Delivery share set but commission is 0%: confirm channel fees.": "lab.warn.deliveryNoFee",
  "Cannibalization set but lost contribution per order is 0: confirm baseline order margin.": "lab.warn.cannibNoLoss",
  "Thin margin: a small cost change could turn this negative.": "lab.warn.thin",
};
export const warnKey = (w: string): LText => (WARN_KEY[w] ? { key: WARN_KEY[w] } : w);

function economicsScore(scn: ScenarioAssumptions): { e: number; notes: LText[]; avoid: LText[] } {
  const r = computeScenario(scn); const avoid: LText[] = []; const notes: LText[] = [];
  if (r.perUnitContribution <= 0) { avoid.push(K("gen.avoidNegUnit")); return { e: 0, notes: r.warnings.map(warnKey), avoid }; }
  const e = clamp01((r.contributionMarginPct ?? 0) / 60);
  if (r.adjustedIncrementalProfit <= 0) avoid.push(K("gen.avoidNegWeek"));
  if (r.breakEvenUnits && r.breakEvenUnits > scn.incrementalUnits * 4) notes.push(K("gen.noteBreakEven"));
  return { e, notes: [...notes, ...r.warnings.map(warnKey)], avoid };
}

export function scoreHypotheses(profile: RestaurantProfile, menu: MenuItemLite[], ev: EvidenceBundle): OpportunityOutcome {
  const evidenceQuality = ev.mode === "live" ? 0.9 : 0.4;
  const scored: Scored[] = HYPOTHESIS_CATALOG.map((t) => {
    const op = operational(t, profile, menu); const taste = tasteFit(t, ev); const feas = feasibility(t, profile);
    const scenario = defaultScenario(t, profile, menu); const eco = economicsScore(scenario);
    const dims = { tasteFit: taste.fit, operationalFit: op.fit, feasibility: feas.f, economics: eco.e, evidenceQuality: ev.mode === "live" ? Math.min(1, evidenceQuality + taste.citations.length * 0.03) : evidenceQuality };
    const composite = Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * dims[k as keyof typeof dims], 0);
    const baseDims = { ...dims, ...NO_QLOO_PRIOR };
    const baselineComposite = Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * baseDims[k as keyof typeof baseDims], 0);
    return {
      template: t,
      score: { ...dims, composite: r3(composite), weights: { ...WEIGHTS }, notes: [...op.notes, ...taste.notes, ...eco.notes] },
      baseline: { ...baseDims, composite: r3(baselineComposite), weights: { ...BASELINE_WEIGHTS }, notes: [] },
      citations: taste.citations, disqualifiers: op.disq, missing: feas.missing, avoid: eco.avoid, scenario, offering: t.offeringTemplate(menu, profile),
    };
  });

  // Both orders apply the same constraint rule (disqualified last) and the same deterministic tie-break (catalog order).
  const order = (key: "score" | "baseline") => [...scored].map((s, i) => ({ s, i })).sort((a, b) => {
    const ad = a.s.disqualifiers.length > 0 ? 1 : 0; const bd = b.s.disqualifiers.length > 0 ? 1 : 0;
    return ad !== bd ? ad - bd : b.s[key].composite - a.s[key].composite || a.i - b.i;
  }).map((x) => x.s);
  const baselineOrder = order("baseline");
  const withQloo = order("score");

  const hypotheses: Hypothesis[] = withQloo.map((s, i) => {
    const baselineRank = baselineOrder.indexOf(s) + 1;
    const rankChange = baselineRank - (i + 1);
    const changedBy = s.citations.slice(0, 2);
    const signals = changedBy.map((c) => `“${c.name}”${c.affinity !== undefined ? ` (${c.affinity.toFixed(2)})` : ""}`).join(", ");
    const explanation: LText = !s.citations.length ? K("gen.deltaNone") : rankChange > 0 ? K("gen.deltaUp", { n: rankChange, signals }) : rankChange < 0 ? K("gen.deltaDown", { n: -rankChange, signals }) : K("gen.deltaSame", { signals });
    return {
      slug: s.template.slug, title: s.template.title, segment: s.template.segment, summary: s.template.summary, rank: i + 1,
      evidenceLabel: evidenceLabel(s, ev.mode), disqualifiers: s.disqualifiers, missingEvidence: s.missing,
      reasonsToAvoid: [...s.avoid, ...s.template.riskKeys.map((k) => K(`gen.risk.${k}`))],
      score: s.score, baselineScore: s.baseline, baselineRank, qlooDelta: { rankChange, changedBy, explanation }, citations: s.citations,
      evidenceSourceIds: Array.from(new Set(s.citations.map((c) => c.sourceId))), defaultScenario: s.scenario, playbook: buildPlaybook(s, profile, ev, menu),
    };
  });

  const viable = hypotheses.filter((h) => h.evidenceLabel !== "not_recommended").slice(0, 3);
  return { hypotheses, viable, noViableOpportunity: viable.length === 0, researchPlan: buildResearchPlan(hypotheses, ev), mode: ev.mode };
}

export function evidenceLabel(s: Scored, mode: EvidenceBundle["mode"]): EvidenceLabel {
  if (s.disqualifiers.length) return "not_recommended";
  if (s.score.economics === 0) return "not_recommended";
  if (s.score.tasteFit < 0.35 && s.citations.length === 0) return "not_recommended";
  if (mode === "sample") return "requires_validation";
  if (s.score.composite >= 0.7 && s.citations.length >= 2) return "high";
  if (s.score.composite >= 0.55) return "medium";
  if (s.score.composite >= 0.4) return "low";
  return "requires_validation";
}

function buildResearchPlan(h: Hypothesis[], ev: EvidenceBundle): LText[] {
  const plan: LText[] = [];
  if (ev.mode === "sample") plan.push(K("gen.rpConnect"));
  if (ev.failures.length) plan.push(K("gen.rpRetry", { steps: ev.failures.map((f) => f.step).join(", ") }));
  if (!h.find((x) => x.evidenceLabel !== "not_recommended")) plan.push(K("gen.rpNone"));
  plan.push(K("gen.rpBaseline"), K("gen.rpChannels"));
  return plan;
}

function buildPlaybook(s: Scored, profile: RestaurantProfile, ev: EvidenceBundle, menu: MenuItemLite[]): Playbook {
  const t = s.template; const base = s.scenario; const o = s.offering;
  void menu;
  return {
    objective: K("gen.pbObjective", { goal: profile.objectives.primary ?? "Grow incremental contribution", title: { key: `hyp.${t.slug}.title` } }),
    baseline: K("gen.pbBaseline"),
    segment: { label: { key: `hyp.${t.slug}.segment` }, rationale: s.citations.length ? K("gen.pbSegmentRationale", { reasons: s.citations.map((c) => c.note) }) : K("gen.pbSegmentGeneric"), citations: s.citations },
    offering: {
      description: o.description, menuDependencies: o.deps,
      scenarios: [
        { label: K("gen.pbScenarioConservative"), assumptions: { ...base, incrementalUnits: Math.round(base.incrementalUnits * 0.5) } },
        { label: K("gen.pbScenarioBase"), assumptions: base },
        { label: K("gen.pbScenarioPremium"), assumptions: { ...base, salePrice: Math.round(base.salePrice * 1.1 * 100) / 100, incrementalUnits: Math.round(base.incrementalUnits * 0.8) } },
      ],
    },
    channels: t.channelKeys.map((k) => ({ name: K(`gen.ch.${k}`), status: "not_verified" as const, task: K("gen.pbChannelTask", { name: { key: `gen.ch.${k}` } }) })),
    capacityChecklist: [
      { item: K("gen.pbCap1"), owner: K("gen.pbOwnerCook"), dueInDays: 5 },
      { item: K("gen.pbCap2"), owner: K("gen.pbOwner"), dueInDays: 5 },
      ...(t.requirements.needsExtendedHours ? [{ item: K("gen.pbCap3"), owner: K("gen.pbOwner"), dueInDays: 7 }] : []),
      { item: K("gen.pbCap4"), owner: K("gen.pbOwner"), dueInDays: 7 },
    ],
    marketing: {
      sampleMessage: K("gen.pbMsg", { name: profile.name, offer: o.description }),
      creativeBrief: K("gen.pbBrief", { dish: o.heroDish, segment: { key: `hyp.${t.slug}.segment` } }),
      postingDraft: K("gen.pbPost", { offer: o.description, name: profile.name, where: profile.neighborhood ? `, ${profile.neighborhood}` : "" }),
    },
    budgetCapUsd: (base.marketingCost ?? 0) + (base.fixedTestCosts ?? 0),
    risks: [...t.riskKeys.map((k) => K(`gen.risk.${k}`)), ...s.avoid, ...(ev.mode === "sample" ? [K("gen.pbRiskSample")] : [])],
    stopConditions: [K("gen.pbStop1"), K("gen.pbStop2"), K("gen.pbStop3")],
    successCriteria: [K("gen.pbSuccess1", { n: base.incrementalUnits }), K("gen.pbSuccess2"), K("gen.pbSuccess3")],
    measurement: { method: K("gen.pbMeasure"), caveats: [K("gen.pbCaveat1"), K("gen.pbCaveat2")] },
    approvalGate: K("gen.pbApproval"),
  };
}
