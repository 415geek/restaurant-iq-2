import type { AudienceAffinity, CulturalSignal, ProviderMode, TagSignal } from "@/lib/providers/qloo/types";
import type { ScenarioAssumptions } from "./margin";

export interface RestaurantProfile {
  id: string;
  name: string;
  neighborhood?: string | null;
  city: string;
  cuisine: string;
  serviceFormats: string[]; // dine_in | takeout | third_party_delivery | catering
  hoursSummary?: string | null;
  priceLevel?: number | null;
  costAssumptions: {
    avg_ticket?: number;
    food_cost_pct?: number;
    labor_cost_per_hour?: number;
    packaging_per_order?: number;
    delivery_commission_pct?: number;
    card_fee_pct?: number;
    seats?: number;
    kitchen_peak_orders_per_hour?: number;
  };
  objectives: { primary?: string; constraints?: string[]; horizon_weeks?: number };
}

export interface MenuItemLite {
  id?: string;
  name: string;
  category: string;
  price?: number | null;
  foodCost?: number | null;
  isSignature?: boolean;
}

/** Evidence bundle assembled by the EvidenceAgent. Each array carries the evidence source id for provenance. */
export interface EvidenceBundle {
  mode: ProviderMode;
  cuisineTags: { data: TagSignal[]; sourceId: string };
  tagAffinities: { data: TagSignal[]; sourceId: string };
  localPlaces: { data: CulturalSignal[]; sourceId: string };
  crossDomain: { data: CulturalSignal[]; sourceId: string; failedDomains?: string[] };
  demographics: { data: AudienceAffinity[]; sourceId: string };
  failures: Array<{ step: string; errorClass: string; message: string }>;
}

export type EvidenceLabel = "high" | "medium" | "low" | "requires_validation" | "not_recommended";

export interface SignalCitation {
  kind: "tag" | "entity" | "demographic";
  id: string;
  name: string;
  affinity?: number;
  sourceId: string;
  note: string; // why it matters for this hypothesis
}

export interface ScoreBreakdown {
  tasteFit: number; // 0..1, from Qloo signals (0 in baseline)
  operationalFit: number;
  feasibility: number;
  economics: number;
  evidenceQuality: number;
  composite: number;
  weights: Record<string, number>;
  notes: string[];
}

export interface ChannelPlan {
  name: string;
  status: "not_verified" | "verified" | "not_applicable";
  task: string;
  link?: string; // official page when known, else undefined
}

export interface Playbook {
  objective: string;
  baseline: string;
  segment: { label: string; rationale: string; citations: SignalCitation[] };
  offering: { description: string; menuDependencies: string[]; scenarios: Array<{ label: string; assumptions: ScenarioAssumptions }> };
  channels: ChannelPlan[];
  capacityChecklist: Array<{ item: string; owner: string; dueInDays: number }>;
  marketing: { sampleMessage: string; creativeBrief: string; postingDraft: string };
  budgetCapUsd: number;
  risks: string[];
  stopConditions: string[];
  successCriteria: string[];
  measurement: { method: string; caveats: string[] };
  approvalGate: string;
}

export interface Hypothesis {
  slug: string;
  title: string;
  segment: string;
  summary: string;
  rank: number;
  evidenceLabel: EvidenceLabel;
  disqualifiers: string[];
  missingEvidence: string[];
  reasonsToAvoid: string[];
  score: ScoreBreakdown;
  baselineScore: ScoreBreakdown; // without Qloo
  baselineRank: number;
  qlooDelta: { rankChange: number; changedBy: SignalCitation[]; explanation: string };
  citations: SignalCitation[];
  evidenceSourceIds: string[];
  defaultScenario: ScenarioAssumptions;
  playbook: Playbook;
}

export interface OpportunityOutcome {
  hypotheses: Hypothesis[]; // ranked, includes not_recommended ones at the end
  viable: Hypothesis[]; // top 3 viable
  noViableOpportunity: boolean;
  researchPlan: string[]; // when nothing is viable or evidence is thin
  mode: ProviderMode;
}
