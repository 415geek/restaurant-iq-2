/**
 * Deterministic opportunity scoring. Produces ranked hypotheses WITH Qloo evidence and a baseline
 * ranking WITHOUT Qloo (generic consultant priorities), and explains which signal changed each rank.
 * Labels are categorical; no invented probabilities.
 */
import { HYPOTHESIS_CATALOG, type HypothesisTemplate } from "./catalog";
import { computeScenario, type ScenarioAssumptions } from "./margin";
import type { EvidenceBundle, EvidenceLabel, Hypothesis, MenuItemLite, Playbook, RestaurantProfile, ScoreBreakdown, SignalCitation, OpportunityOutcome } from "./types";
import type { TagSignal } from "@/lib/providers/qloo/types";

export const WEIGHTS = { tasteFit: 0.3, operationalFit: 0.25, feasibility: 0.15, economics: 0.2, evidenceQuality: 0.1 } as const;
export const BASELINE_WEIGHTS = { tasteFit: 0, operationalFit: 0.4, feasibility: 0.2, economics: 0.4, evidenceQuality: 0 } as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const AGE_LABEL: Record<string, string> = { "24_and_younger": "24 and younger", "25_to_29": "25–29", "30_to_34": "30–34", "35_to_44": "35–44", "45_to_54": "45–54", "55_and_older": "55+" };
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function matchTags(tags: TagSignal[], substrings: string[]): TagSignal[] {
  return tags.filter((t) => substrings.some((s) => t.tagId.toLowerCase().includes(s) || t.name.toLowerCase().includes(s)));
}

export function defaultScenario(t: HypothesisTemplate, profile: RestaurantProfile, menu: MenuItemLite[]): ScenarioAssumptions {
  const o = t.offeringTemplate(menu, profile);
  const ca = profile.costAssumptions;
  const delivery = profile.serviceFormats.includes("third_party_delivery");
  const deliveryShare = t.requirements.needsDelivery ? 1 : delivery ? 0.3 : 0;
  return {
    salePrice: o.salePrice,
    incrementalUnits: t.operationalComplexity === 1 ? 60 : 40,
    periodLabel: "per week",
    foodCostPerUnit: o.foodCost,
    packagingPerUnit: deliveryShare > 0 ? (ca.packaging_per_order ?? 0.85) : 0.25,
    incrementalLaborHours: t.requirements.extraLaborHoursPerWeek ?? 0,
    laborRatePerHour: ca.labor_cost_per_hour ?? 22,
    deliveryShare,
    deliveryCommissionPct: ca.delivery_commission_pct ?? 0.25,
    cardFeePct: ca.card_fee_pct ?? 0.029,
    discountPct: t.slug.includes("lunch") || t.slug.includes("bundle") ? 0.1 : 0,
    otherVariableCostPerUnit: 0,
    marketingCost: t.slug === "cross-domain-partnership" ? 200 : 100,
    fixedTestCosts: t.operationalComplexity === 3 ? 600 : 150,
    cannibalizationPct: t.slug.includes("lunch") ? 0.25 : 0.1,
    cannibalizedOrderContribution: Math.round(((ca.avg_ticket ?? 24) * (1 - (ca.food_cost_pct ?? 0.32)) - 2) * 100) / 100,
  };
}

interface Scored {
  template: HypothesisTemplate;
  score: ScoreBreakdown;
  baseline: ScoreBreakdown;
  citations: SignalCitation[];
  disqualifiers: string[];
  missing: string[];
  avoid: string[];
  scenario: ScenarioAssumptions;
  offering: ReturnType<HypothesisTemplate["offeringTemplate"]>;
}

function operational(t: HypothesisTemplate, profile: RestaurantProfile, menu: MenuItemLite[]): { fit: number; disq: string[]; notes: string[] } {
  const disq: string[] = [];
  const notes: string[] = [];
  let fit = 1;
  const r = t.requirements;
  const constraints = (profile.objectives.constraints ?? []).map((c) => c.toLowerCase());
  const objective = (profile.objectives.primary ?? "").toLowerCase();
  if (r.anyServiceFormat && !r.anyServiceFormat.some((f) => profile.serviceFormats.includes(f))) {
    disq.push(`Requires service format: ${r.anyServiceFormat.join(" or ")}`);
  }
  if (r.menuKeywords) {
    const has = menu.some((m) => r.menuKeywords!.some((k) => m.name.toLowerCase().includes(k) || m.category.toLowerCase().includes(k)));
    if (!has) disq.push("No menu items match this concept yet (would require new recipes)");
  }
  if (r.needsAlcohol && constraints.some((c) => c.includes("liquor") || c.includes("alcohol"))) disq.push("Constraint: no liquor license");
  for (const b of r.constraintBlockers ?? []) {
    if (constraints.some((c) => c.includes(b)) || objective.includes(b)) {
      if (r.needsExtendedHours || r.needsAlcohol) disq.push(`Conflicts with stated constraint: "${b}"`);
      else { fit -= 0.3; notes.push(`Tension with constraint "${b}"`); }
    }
  }
  if (r.needsExtendedHours) { fit -= 0.35; notes.push("Needs extended hours (labor + safety)"); }
  if (r.needsDelivery && !profile.serviceFormats.includes("third_party_delivery")) disq.push("Delivery channel not enabled");
  fit -= (t.operationalComplexity - 1) * 0.15;
  return { fit: clamp01(fit), disq, notes };
}

function tasteFit(t: HypothesisTemplate, ev: EvidenceBundle): { fit: number; citations: SignalCitation[]; notes: string[] } {
  const citations: SignalCitation[] = [];
  const notes: string[] = [];
  let fit = 0;
  const tagHits = matchTags(ev.tagAffinities.data, t.triggerTags);
  if (tagHits.length) {
    const best = tagHits.reduce((a, b) => ((b.affinity ?? 0) > (a.affinity ?? 0) ? b : a));
    fit = Math.max(fit, best.affinity ?? 0.5);
    for (const h of tagHits.slice(0, 2)) {
      citations.push({ kind: "tag", id: h.tagId, name: h.name, affinity: h.affinity, sourceId: ev.tagAffinities.sourceId, note: `Place attribute "${h.name}" has ${labelAff(h.affinity)} taste affinity for this cuisine's audience nearby` });
    }
  }
  // local place signals carrying the trigger tags reinforce
  const placeHits = ev.localPlaces.data.filter((p) => p.tags.some((tg) => t.triggerTags.some((s) => tg.id.toLowerCase().includes(s) || tg.name.toLowerCase().includes(s))));
  if (placeHits.length) {
    const best = placeHits.reduce((a, b) => ((b.affinity ?? 0) > (a.affinity ?? 0) ? b : a));
    fit = Math.max(fit, (best.affinity ?? 0.5) * 0.9);
    citations.push({ kind: "entity", id: best.entityId, name: best.name, affinity: best.affinity, sourceId: ev.localPlaces.sourceId, note: `Nearby place with matching attributes scores ${labelAff(best.affinity)} for this audience` });
  }
  // demographics
  if (t.triggerAgeBuckets?.length && ev.demographics.data.length) {
    const d = ev.demographics.data[0];
    const vals = t.triggerAgeBuckets.map((b) => d.age[b as keyof typeof d.age]).filter((v): v is number => typeof v === "number");
    if (vals.length) {
      const m = Math.max(...vals);
      if (m > 0) {
        fit = Math.min(1, fit + Math.min(0.2, m * 0.4));
        citations.push({ kind: "demographic", id: d.signalId, name: `Age ${t.triggerAgeBuckets.map((b) => AGE_LABEL[b] ?? b).join(" / ")}`, affinity: m, sourceId: ev.demographics.sourceId, note: `Target age buckets over-index for this cuisine (${m > 0 ? "+" : ""}${m.toFixed(2)} vs average)` });
      } else notes.push("Target age buckets under-index for this cuisine");
    }
  }
  // cross-domain
  if (t.triggerCrossDomains?.length) {
    const hits = ev.crossDomain.data.filter((c) => t.triggerCrossDomains!.includes(c.domain) && (c.affinity ?? 0) >= 0.7);
    if (hits.length) {
      const best = hits.reduce((a, b) => ((b.affinity ?? 0) > (a.affinity ?? 0) ? b : a));
      fit = Math.max(fit, best.affinity ?? 0.7);
      for (const h of hits.slice(0, 3)) {
        citations.push({ kind: "entity", id: h.entityId, name: h.name, affinity: h.affinity, sourceId: ev.crossDomain.sourceId, note: `${h.domain.replace("_", " ")} with ${labelAff(h.affinity)} cross-domain affinity: a partner or messaging hook` });
      }
    } else notes.push("No cross-domain entity above the 0.7 affinity threshold");
  }
  if (!citations.length) notes.push("No Qloo signal supports this hypothesis");
  return { fit: clamp01(fit), citations, notes };
}

function labelAff(a?: number) {
  if (a === undefined) return "unknown";
  return a >= 0.8 ? "strong" : a >= 0.5 ? "moderate" : "weak";
}

function feasibility(t: HypothesisTemplate, profile: RestaurantProfile): { f: number; missing: string[] } {
  const missing: string[] = [];
  let f = 0.5; // unknown until channels are verified
  if (t.channelNames.some((c) => c.toLowerCase().includes("google") || c.toLowerCase().includes("signage") || c.toLowerCase().includes("menu"))) f += 0.2;
  if (t.requirements.needsDelivery) { f -= 0.1; missing.push("Delivery platform eligibility and current commission not verified"); }
  if (t.slug === "cross-domain-partnership") missing.push("Partner contact and willingness not verified");
  if (t.requirements.needsExtendedHours) missing.push("Staff availability for added hours not confirmed");
  if (!profile.priceLevel) missing.push("Price level unknown");
  return { f: clamp01(f), missing };
}

function economicsScore(scn: ScenarioAssumptions): { e: number; notes: string[]; avoid: string[] } {
  const r = computeScenario(scn);
  const avoid: string[] = [];
  const notes: string[] = [];
  if (r.perUnitContribution <= 0) { avoid.push("Per-unit contribution is not positive under default assumptions"); return { e: 0, notes: r.warnings, avoid }; }
  const cm = r.contributionMarginPct ?? 0; // %
  const e = clamp01(cm / 60); // 60% CM => 1.0
  if (r.adjustedIncrementalProfit <= 0) { avoid.push("Adjusted weekly profit is not positive under default assumptions"); }
  if (r.breakEvenUnits && r.breakEvenUnits > scn.incrementalUnits * 4) notes.push("Break-even needs more than four weeks of assumed volume");
  return { e, notes: [...notes, ...r.warnings], avoid };
}

export function scoreHypotheses(profile: RestaurantProfile, menu: MenuItemLite[], ev: EvidenceBundle): OpportunityOutcome {
  const evidenceQuality = ev.mode === "live" ? 0.9 : 0.4;
  const scored: Scored[] = HYPOTHESIS_CATALOG.map((t) => {
    const op = operational(t, profile, menu);
    const taste = tasteFit(t, ev);
    const feas = feasibility(t, profile);
    const scenario = defaultScenario(t, profile, menu);
    const eco = economicsScore(scenario);
    const dims = { tasteFit: taste.fit, operationalFit: op.fit, feasibility: feas.f, economics: eco.e, evidenceQuality: ev.mode === "live" ? Math.min(1, evidenceQuality + taste.citations.length * 0.03) : evidenceQuality };
    const composite = Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * dims[k as keyof typeof dims], 0);
    const baseDims = { ...dims, tasteFit: 0, evidenceQuality: 0 };
    const baselineComposite = Object.entries(BASELINE_WEIGHTS).reduce((a, [k, w]) => a + w * baseDims[k as keyof typeof baseDims], 0) * (0.6 + 0.4 * t.genericPriority);
    return {
      template: t,
      score: { ...dims, composite: r3(composite), weights: { ...WEIGHTS }, notes: [...op.notes, ...taste.notes, ...eco.notes] },
      baseline: { ...baseDims, composite: r3(baselineComposite), weights: { ...BASELINE_WEIGHTS }, notes: ["Generic priority without taste evidence"] },
      citations: taste.citations,
      disqualifiers: op.disq,
      missing: feas.missing,
      avoid: eco.avoid,
      scenario,
      offering: t.offeringTemplate(menu, profile),
    };
  });

  const baselineOrder = [...scored].sort((a, b) => b.baseline.composite - a.baseline.composite);
  const withQloo = [...scored].sort((a, b) => {
    const ad = a.disqualifiers.length > 0 ? 1 : 0;
    const bd = b.disqualifiers.length > 0 ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return b.score.composite - a.score.composite;
  });

  const hypotheses: Hypothesis[] = withQloo.map((s, i) => {
    const baselineRank = baselineOrder.indexOf(s) + 1;
    const label = evidenceLabel(s, ev.mode);
    const rankChange = baselineRank - (i + 1);
    const changedBy = s.citations.slice(0, 2);
    const explanation = s.citations.length
      ? `${rankChange > 0 ? `Moved up ${rankChange}` : rankChange < 0 ? `Moved down ${-rankChange}` : "Rank unchanged"} vs the no-Qloo baseline because ${changedBy.map((c) => `"${c.name}" (${c.affinity !== undefined ? `affinity ${c.affinity.toFixed(2)}` : "signal present"})`).join(" and ")} ${changedBy.length > 1 ? "support" : "supports"} this segment.`
      : `No Qloo signal supports this; it ranks on generic operational and economic grounds only${rankChange < 0 ? ` and moved down ${-rankChange}` : ""}.`;
    return {
      slug: s.template.slug,
      title: s.template.title,
      segment: s.template.segment,
      summary: s.template.summary,
      rank: i + 1,
      evidenceLabel: label,
      disqualifiers: s.disqualifiers,
      missingEvidence: s.missing,
      reasonsToAvoid: [...s.avoid, ...s.template.riskNotes],
      score: s.score,
      baselineScore: s.baseline,
      baselineRank,
      qlooDelta: { rankChange, changedBy, explanation },
      citations: s.citations,
      evidenceSourceIds: Array.from(new Set(s.citations.map((c) => c.sourceId))),
      defaultScenario: s.scenario,
      playbook: buildPlaybook(s, profile, ev),
    };
  });

  const viable = hypotheses.filter((h) => h.evidenceLabel !== "not_recommended").slice(0, 3);
  const noViable = viable.length === 0;
  const researchPlan = buildResearchPlan(hypotheses, ev);
  return { hypotheses, viable, noViableOpportunity: noViable, researchPlan, mode: ev.mode };
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

function buildResearchPlan(h: Hypothesis[], ev: EvidenceBundle): string[] {
  const plan: string[] = [];
  if (ev.mode === "sample") plan.push("Connect a live Qloo key and re-run the analysis to replace illustrative signals with real taste affinities.");
  if (ev.failures.length) plan.push(`Retry failed evidence steps: ${ev.failures.map((f) => f.step).join(", ")}.`);
  const top = h.find((x) => x.evidenceLabel !== "not_recommended");
  if (!top) plan.push("No hypothesis passes the operational and economic screens. Revisit constraints (hours, staffing, formats) or add menu cost data, then re-run.");
  plan.push("Count weekday lunch covers for two weeks to establish the baseline before any experiment.");
  plan.push("Verify channel eligibility and fees (delivery apps, Google Business Profile) before committing marketing spend.");
  return plan;
}

function buildPlaybook(s: Scored, profile: RestaurantProfile, ev: EvidenceBundle): Playbook {
  const t = s.template;
  const base = s.scenario;
  const scenarios = [
    { label: "Conservative", assumptions: { ...base, incrementalUnits: Math.round(base.incrementalUnits * 0.5), salePrice: base.salePrice } },
    { label: "Base", assumptions: base },
    { label: "Premium price", assumptions: { ...base, salePrice: Math.round(base.salePrice * 1.1 * 100) / 100, incrementalUnits: Math.round(base.incrementalUnits * 0.8) } },
  ];
  const seg = s.citations.length
    ? `Chosen because ${s.citations.map((c) => c.note).join("; ")}.`
    : "No taste signal supports this segment; it is a generic hypothesis.";
  return {
    objective: `${profile.objectives.primary ?? "Grow incremental contribution"} via "${t.title}"`,
    baseline: "Current weekly covers and ticket for the affected daypart/channel (to be measured for 2 weeks before launch).",
    segment: { label: t.segment, rationale: seg, citations: s.citations },
    offering: { description: s.offering.description, menuDependencies: s.offering.deps, scenarios },
    channels: t.channelNames.map((name) => ({ name, status: "not_verified" as const, task: `Verify eligibility, fees and setup steps for "${name}" and record the source link.` })),
    capacityChecklist: [
      { item: "Confirm kitchen can add the volume at peak without raising ticket times", owner: "Head cook", dueInDays: 5 },
      { item: "Confirm ingredient supply and prep time for the offering", owner: "Owner", dueInDays: 5 },
      ...(t.requirements.needsExtendedHours ? [{ item: "Confirm staff availability and safety plan for added hours", owner: "Owner", dueInDays: 7 }] : []),
      { item: "Set up a coupon/code or POS button to track orders from this experiment", owner: "Owner", dueInDays: 7 },
    ],
    marketing: {
      sampleMessage: `New at ${profile.name}: ${s.offering.description}. Try it this week.`,
      creativeBrief: `One hero image of ${s.offering.deps[0] ?? "the offering"}; copy speaks to ${t.segment.toLowerCase()}; include price and hours; no claims about health or authenticity that are not verified.`,
      postingDraft: `${s.offering.description} — available ${t.requirements.needsExtendedHours ? "on the new hours" : "now"} at ${profile.name}${profile.neighborhood ? `, ${profile.neighborhood}` : ""}. Show this post for the launch price.`,
    },
    budgetCapUsd: base.marketingCost! + base.fixedTestCosts!,
    risks: [...t.riskNotes, ...s.avoid, ...(ev.mode === "sample" ? ["Signals are illustrative sample data, not live Qloo results"] : [])],
    stopConditions: ["Adjusted contribution negative after 3 weeks", "Ticket times rise above target at peak", "Cannibalization above 40% of incremental orders"],
    successCriteria: [`At least ${base.incrementalUnits} incremental units per week by week 3`, "Positive adjusted contribution for 2 consecutive weeks", "No decline in baseline daypart revenue"],
    measurement: { method: "Coupon/code tracking plus daypart cover counts vs a 2-week pre-launch baseline.", caveats: ["Attribution is correlational: seasonality and nearby events can move covers.", "Taste affinity is not a demand forecast."] },
    approvalGate: "Owner approval required before any external posting, menu publication or partner outreach.",
  };
}
