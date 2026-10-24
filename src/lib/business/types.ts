import type { AudienceAffinity, CulturalSignal, ProviderMode, TagSignal } from "@/lib/providers/qloo/types";
import type { ScenarioAssumptions } from "./margin";
import type { LText } from "@/i18n/locales";
export type { LText };

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
  note: LText; // why it matters for this hypothesis (localizable)
}

export interface ScoreBreakdown {
  tasteFit: number; // 0..1, from Qloo signals (0 in baseline)
  operationalFit: number;
  feasibility: number;
  economics: number;
  evidenceQuality: number;
  composite: number;
  weights: Record<string, number>;
  notes: LText[];
}

export interface ChannelPlan {
  name: LText;
  status: "not_verified" | "verified" | "not_applicable";
  task: LText;
  link?: string; // official page when known, else undefined
}

export interface Playbook {
  objective: LText;
  baseline: LText;
  segment: { label: LText; rationale: LText; citations: SignalCitation[] };
  offering: { description: LText; menuDependencies: string[]; scenarios: Array<{ label: LText; assumptions: ScenarioAssumptions }> };
  channels: ChannelPlan[];
  capacityChecklist: Array<{ item: LText; owner: LText; dueInDays: number }>;
  marketing: { sampleMessage: LText; creativeBrief: LText; postingDraft: LText };
  budgetCapUsd: number;
  risks: LText[];
  stopConditions: LText[];
  successCriteria: LText[];
  measurement: { method: LText; caveats: LText[] };
  approvalGate: LText;
}

export interface Hypothesis {
  slug: string;
  title: string; // English (DB column); UI renders hyp.<slug>.title per locale
  segment: string;
  summary: string;
  rank: number;
  evidenceLabel: EvidenceLabel;
  disqualifiers: LText[];
  missingEvidence: LText[];
  reasonsToAvoid: LText[];
  score: ScoreBreakdown;
  baselineScore: ScoreBreakdown; // without Qloo
  baselineRank: number;
  qlooDelta: { rankChange: number; changedBy: SignalCitation[]; explanation: LText };
  citations: SignalCitation[];
  evidenceSourceIds: string[];
  defaultScenario: ScenarioAssumptions;
  playbook: Playbook;
}

export interface OpportunityOutcome {
  hypotheses: Hypothesis[]; // ranked, includes not_recommended ones at the end
  viable: Hypothesis[]; // top 3 viable
  noViableOpportunity: boolean;
  researchPlan: LText[]; // when nothing is viable or evidence is thin
  mode: ProviderMode;
}
