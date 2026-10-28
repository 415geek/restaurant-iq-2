import { describe, expect, it } from "vitest";
import { campaignCanTransition, computePassEconomics, generateToken, newSlug, normalizeToken, TOKEN_RE } from "@/lib/business/tastepass";

const base = { regularPrice: 16, offerPrice: 13.5, variableCost: 4.6, feePct: 0.03, fixedSpend: 60, maxRedemptions: 50 };

describe("TastePass economics", () => {
  it("computes contribution and break-even with ceil", () => {
    const e = computePassEconomics(base);
    expect(e.netReceipt).toBe(13.1);
    expect(e.contributionPerRedemption).toBe(8.5);
    expect(e.breakEvenRedemptions).toBe(8); // 60 / 8.5 = 7.06 → 8
    expect(e.decision).toBe("go");
    expect(e.discountPerRedemption).toBe(2.5);
    expect(e.bestCaseContribution).toBe(365);
    expect(e.maxExposure).toBe(60); // nobody redeems → the fixed spend is lost
  });
  it("zero contribution is NO-GO with no break-even", () => {
    const e = computePassEconomics({ ...base, offerPrice: 4.6, feePct: 0 });
    expect(e.contributionPerRedemption).toBe(0);
    expect(e.decision).toBe("no_go");
    expect(e.breakEvenRedemptions).toBeNull();
    expect(e.reasons).toContain("negative_contribution");
  });
  it("negative contribution is NO-GO and exposure grows with volume", () => {
    const e = computePassEconomics({ ...base, offerPrice: 3 });
    expect(e.decision).toBe("no_go");
    expect(e.maxExposure).toBeGreaterThan(60);
  });
  it("worst-case loss takes the worse end point: zero redemptions vs all redemptions", () => {
    // reviewer repro: $100 fixed, $5 contribution, cap 30 → full redemption still nets -$50, zero redemption loses $100
    const e = computePassEconomics({ regularPrice: 10, offerPrice: 5, variableCost: 0, feePct: 0, fixedSpend: 100, maxRedemptions: 30 });
    expect(e.contributionPerRedemption).toBe(5);
    expect(e.bestCaseContribution).toBe(50);
    expect(e.maxExposure).toBe(100);
    expect(computePassEconomics({ ...base, fixedSpend: 0 }).maxExposure).toBe(0);
    const neg = computePassEconomics({ ...base, offerPrice: 3, feePct: 0, fixedSpend: 10, maxRedemptions: 10 }); // −1.6 each
    expect(neg.maxExposure).toBe(26); // 10 + 1.6 × 10
  });
  it("flags break-even above the cap and deep discounts", () => {
    const e = computePassEconomics({ ...base, fixedSpend: 1000, offerPrice: 7.9 });
    expect(e.reasons).toContain("break_even_above_cap");
    expect(e.reasons).toContain("discount_over_half");
    expect(e.decision).toBe("go");
  });
  it("no fixed spend means break-even at zero", () => {
    expect(computePassEconomics({ ...base, fixedSpend: 0 }).breakEvenRedemptions).toBe(0);
  });
});

describe("campaign state", () => {
  it("only GO drafts can go live", () => {
    expect(campaignCanTransition("draft", "active", "go").ok).toBe(true);
    expect(campaignCanTransition("draft", "active", "no_go").ok).toBe(false);
    expect(campaignCanTransition("active", "ended", "go").ok).toBe(true);
    expect(campaignCanTransition("ended", "active", "go").ok).toBe(false);
  });
});

describe("tokens", () => {
  it("generates unambiguous 8-char tokens and url-safe slugs", () => {
    for (let i = 0; i < 200; i++) expect(generateToken()).toMatch(TOKEN_RE);
    expect(newSlug()).toMatch(/^[a-z0-9]{10}$/);
  });
  it("normalizes user input", () => {
    expect(normalizeToken(" abcd-efgh ")).toBe("ABCDEFGH");
  });
});
