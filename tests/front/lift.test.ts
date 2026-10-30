import { describe, expect, it } from "vitest";
import { buildTermLift, extractTerms, indexPlaces, mergeIndexes, scoreLift, termLift, type LiftItem, type Place } from "@/lib/front/lift";
import crowdJson from "./fixtures/crowd.json";
import cityJson from "./fixtures/city.json";

// Synthetic fixtures (not Qloo data): 145 crowd places vs 139 city places, tag counts chosen so every assertion below is exact.
const crowd = crowdJson as Place[];
const city = cityJson as Place[];
const index = mergeIndexes(indexPlaces(crowd), indexPlaces(city));
const item = (id: string, name: string, ambiguous = false): LiftItem => ({ id, name, nameEn: null, category: "mains", ambiguous, qlooTagIds: [] });
const score = (...items: LiftItem[]) => scoreLift({ crowd, city, items }).items;

describe("termLift", () => {
  it("40/145 crowd vs 8/139 city menus → (41/146)/(9/140) = 4.3683 → 4.37 after add-one smoothing", () => {
    expect(crowd.length).toBe(145); expect(city.length).toBe(139);
    expect(termLift(40, 145, 8, 139)).toBeCloseTo(4.3683, 4);
    const [dumplings] = score(item("i1", "Dumplings"));
    expect(dumplings.terms).toEqual([{ term: "dumplings", crowd: 40, city: 8, crowdTotal: 145, cityTotal: 139, lift: 4.37, lowCount: false }]);
    expect(dumplings.lift).toBe(4.37);
  });
  it("0/145 vs 0/139 is neutral 1.0 and lowCount", () => {
    expect(termLift(0, 145, 0, 139)).toBe(1);
    expect(buildTermLift("ghost", 0, 0, 145, 139)).toMatchObject({ lift: 1, lowCount: true });
  });
  it("lowCount is a flag only; the score is the same formula either way", () => {
    const thin = buildTermLift("taro", 2, 1, 145, 139);            // 3 menus total → lowCount
    expect(thin.lowCount).toBe(true);
    expect(thin.lift).toBe(Math.round(termLift(2, 145, 1, 139) * 100) / 100); // (3/146)/(2/140) → 1.44
    expect(thin.lift).toBe(1.44);
    const thick = buildTermLift("lamb", 72, 34, 145, 139);
    expect(thick.lowCount).toBe(false);
    expect(thick.lift).toBe(Math.round(termLift(72, 145, 34, 139) * 100) / 100);
    const [taro] = score(item("i", "Taro"));
    expect(taro.lift).toBe(1.44); expect(taro.lowCount).toBe(true);
  });
});

describe("extractTerms", () => {
  it("multi-word terms need ≥3 menus; fragments of a kept longer term and words under 4 chars are dropped", () => {
    expect(extractTerms("Mapo Tofu", index)).toEqual(["mapo tofu"]);   // 40 menus; "mapo"/"tofu" are fragments of it
    expect(extractTerms("Tea Egg", index)).toEqual([]);                 // "tea egg" on only 2 menus; "tea"/"egg" too short
    expect(extractTerms("Tea Egg", index)).not.toContain("tea egg");
  });
  it("preparation words never count alone, and numbers never count", () => {
    expect(extractTerms("Crispy", index)).toEqual([]);
    expect(extractTerms("Grilled", index)).toEqual([]);
    expect(extractTerms("Crispy Chicken", index)).toEqual(["crispy chicken"]);
    expect(extractTerms("Wonton Soup", index)).toEqual(["wonton soup"]);     // "soup" alone excluded, "wonton" is a fragment
    expect(extractTerms("Grilled Fish 2 pcs", index)).toEqual(["grilled fish"]);
    expect(score(item("x", "Crispy Grilled"))[0]).toMatchObject({ lift: null, reason: "no_terms" });
  });
  it("normalizes case, punctuation and whitespace", () => {
    expect(extractTerms("  MAPO-TOFU!! ", index)).toEqual(["mapo tofu"]);
  });
});

describe("scoreLift", () => {
  it("item lift is the geometric mean of its term lifts: [2.0, 0.5] → 1.0", () => {
    const [r] = score(item("i", "Lamb Rice"));
    expect(r.terms.map((t) => t.lift)).toEqual([2, 0.5]);   // lamb 72/34 → (73/146)/(35/140); rice 72/139 → (73/146)/(140/140)
    expect(r.lift).toBe(1);
    expect(r.lowCount).toBe(false);
  });
  it("ambiguous items and items with no recognized terms are excluded with a reason", () => {
    const [amb, none] = score(item("a", "Dumplings", true), item("n", "Zzyzx Quux"));
    expect(amb).toEqual({ itemId: "a", lift: null, terms: [], lowCount: false, reason: "ambiguous" });
    expect(none).toEqual({ itemId: "n", lift: null, terms: [], lowCount: false, reason: "no_terms" });
  });
  it("uses nameEn when present, reports totals and vocabulary size, and is deterministic", () => {
    const zh: LiftItem = { ...item("z", "麻婆豆腐"), nameEn: "Mapo Tofu" };
    const a = scoreLift({ crowd, city, items: [zh] });
    const b = scoreLift({ crowd, city, items: [zh] });
    expect(a).toEqual(b);
    expect(a.crowdTotal).toBe(145); expect(a.cityTotal).toBe(139);
    expect(a.vocabularySize).toBeGreaterThan(10);
    expect(a.items[0].terms.map((t) => t.term)).toEqual(["mapo tofu"]);
    expect(a.items[0].lift).toBe(Math.round(termLift(30, 145, 10, 139) * 100) / 100); // all three terms share the same counts
  });
});
