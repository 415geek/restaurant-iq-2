/**
 * TastePass economics and token helpers. Pure, deterministic arithmetic: no model ever computes these numbers.
 *
 * contribution per redemption = offer price × (1 − fee %) − variable cost
 * break-even redemptions      = ceil(fixed spend / contribution), only when contribution > 0
 * NO-GO                       = contribution ≤ 0 (more redemptions only lose more money)
 */
export interface PassInputs {
  regularPrice: number;
  offerPrice: number;
  variableCost: number;
  feePct: number; // 0..1 card / platform fee on the offer price
  fixedSpend: number; // printing, staff time, ads for the test
  maxRedemptions: number;
}

export interface PassEconomics {
  netReceipt: number;
  contributionPerRedemption: number;
  discountPerRedemption: number;
  breakEvenRedemptions: number | null;
  maxExposure: number; // worst case if every pass redeems: fixed spend minus total contribution (positive = loss)
  bestCaseContribution: number; // contribution if all max redemptions happen, after fixed spend
  decision: "go" | "no_go";
  reasons: Array<"negative_contribution" | "break_even_above_cap" | "discount_over_half">;
  unknowns: Array<"incrementality" | "cannibalization" | "fees_estimated">;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computePassEconomics(i: PassInputs): PassEconomics {
  const netReceipt = r2(i.offerPrice * (1 - i.feePct));
  const contribution = r2(netReceipt - i.variableCost);
  const reasons: PassEconomics["reasons"] = [];
  let breakEven: number | null = null;
  if (contribution <= 0) reasons.push("negative_contribution");
  else breakEven = i.fixedSpend > 0 ? Math.ceil(i.fixedSpend / contribution) : 0;
  if (breakEven !== null && breakEven > i.maxRedemptions) reasons.push("break_even_above_cap");
  const discount = r2(Math.max(0, i.regularPrice - i.offerPrice));
  if (i.regularPrice > 0 && discount / i.regularPrice > 0.5) reasons.push("discount_over_half");
  const best = r2(contribution * i.maxRedemptions - i.fixedSpend);
  return {
    netReceipt,
    contributionPerRedemption: contribution,
    discountPerRedemption: discount,
    breakEvenRedemptions: breakEven,
    maxExposure: r2(Math.max(0, -best)),
    bestCaseContribution: best,
    decision: contribution > 0 ? "go" : "no_go",
    reasons,
    unknowns: ["incrementality", "cannibalization", ...(i.feePct === 0 ? (["fees_estimated"] as const) : [])],
  };
}

export type CampaignStatus = "draft" | "active" | "ended";
export function campaignCanTransition(from: CampaignStatus, to: CampaignStatus, decision: "go" | "no_go"): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: "No change" };
  if (from === "draft" && to === "active") return decision === "go" ? { ok: true } : { ok: false, reason: "NO-GO: contribution per redemption is zero or negative" };
  if (to === "ended" && from !== "ended") return { ok: true };
  return { ok: false, reason: `Cannot move ${from} → ${to}` };
}

/** 8 chars, no 0/O/1/I to avoid misreads at the counter. */
export const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TOKEN_RE = /^[A-HJ-NP-Z2-9]{8}$/;

function randomIndexes(n: number, mod: number): number[] {
  const buf = new Uint32Array(n);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (x) => x % mod);
}
export function generateToken(): string {
  return randomIndexes(8, TOKEN_ALPHABET.length).map((i) => TOKEN_ALPHABET[i]).join("");
}
export function newSlug(): string {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  return randomIndexes(10, a.length).map((i) => a[i]).join("");
}
export function normalizeToken(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/I/g, "1");
}
