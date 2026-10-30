/**
 * Crowd-vs-city lift for TasteFront (Tastecraft method). Deterministic TypeScript: no randomness, no model calls.
 *
 * Method
 *  1. Qloo returns two place sets for the same area: `crowd` (query WITH the store's taste signal) and `city` (same query
 *     WITHOUT it = baseline). Each place carries tags such as "urn:tag:specialty_dish:place:dumplings" → "Dumplings".
 *  2. Every tag name (normalized: lowercase, punctuation stripped, whitespace collapsed) becomes a menu-tag; its 1–3 word
 *     n-grams become candidate terms. A place "mentions" a term when any of its tag names contains it as a whole-word run.
 *  3. A menu item's English name is split into the same 1–3 word n-grams. A term counts when it exists in the vocabulary,
 *     is not a bare preparation/format word (STOP_WORDS), has no digits, and — when multi-word — appears on ≥ 3 menus.
 *     A single word counts only when Qloo has a tag with exactly that name ("Dumplings", "Ramen"): fragments such as
 *     "cooked", "kung" or "chongqing" are never evidence on their own.
 *  4. termLift = share of crowd menus mentioning the term ÷ share of city menus mentioning it, add-one smoothed:
 *     ((crowd+1)/(crowdTotal+1)) / ((city+1)/(cityTotal+1)). No mention anywhere → neutral 1.0. Fewer than 5 mentions in
 *     total flags `lowCount` (a warning only; it never moves the score).
 *  5. itemLift = geometric mean of its term lifts, rounded to 2 decimals. Ambiguous items and items with no counted terms
 *     get `lift: null` with a reason and are excluded from ranking.
 *
 * Interpretation: lift says what the crowd near this store "leans toward" relative to the city. It is not demand, not a
 * sales forecast and not proof that an item will sell; it is one piece of evidence shown with its counts.
 */
import type { TagRef } from "@/lib/providers/qloo/types";
import type { ItemLift, MenuItem, TermLift } from "./types";

export interface Place { tags: TagRef[] }
export type LiftItem = Pick<MenuItem, "id" | "name" | "nameEn" | "category" | "ambiguous" | "qlooTagIds">;
/** `names`: distinct normalized tag names; `menus`: for every 1–3 word n-gram of those names, how many places mention it */
export interface TermIndex { names: Set<string>; menus: Map<string, number> }

/** preparation / season / format words that never count on their own (they still count inside a multi-word term) */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  "crispy", "grilled", "fried", "steamed", "braised", "roasted", "baked", "smoked", "spicy", "mild", "hot", "cold", "sweet", "sour",
  "large", "small", "medium", "regular", "mini", "half", "full", "bowl", "plate", "cup", "combo", "special", "house", "classic",
  "fresh", "seasonal", "daily", "new", "with", "and", "or", "of", "the", "in", "on", "a", "an", "style", "sauce", "soup", "set",
  "lunch", "dinner", "breakfast", "brunch", "side", "sides", "extra", "add", "pc", "pcs", "piece", "pieces", "serving", "size",
  "drink", "drinks", "food", "foods", "dish", "dishes", "meal", "meals", "snack", "snacks", "menu", "item", "items", "threads", "dan",
  "cooked", "twice", "boiled", "poached", "sliced", "dry", "stir", "pan", "deep", "slow", "cut", "mouthwatering",
]);
const MIN_SINGLE_WORD_CHARS = 4; // "egg", "tea" still count only inside a longer term; fragments like "dan" never do
const MIN_MULTIWORD_MENUS = 3;
const LOW_COUNT_MENUS = 5;
const MAX_NGRAM = 3;

/** lowercase, strip punctuation (letters/digits of any script kept), collapse whitespace */
export const normalizeTerm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9À-￿]+/g, " ").trim();
const words = (s: string): string[] => normalizeTerm(s).split(" ").filter(Boolean);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** all 1..MAX_NGRAM word runs of a token list, in reading order */
export function ngrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) for (let n = 1; n <= MAX_NGRAM && i + n <= tokens.length; n++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

/** Index one place set: distinct tag names + per-term menu counts (a place counts once per term, however many tags match). */
export function indexPlaces(places: Place[]): TermIndex {
  const names = new Set<string>();
  const menus = new Map<string, number>();
  for (const place of places) {
    const seen = new Set<string>();
    for (const tag of place.tags) {
      const name = normalizeTerm(tag.name ?? "");
      if (!name) continue;
      names.add(name);
      for (const g of ngrams(name.split(" "))) seen.add(g);
    }
    for (const g of seen) menus.set(g, (menus.get(g) ?? 0) + 1);
  }
  return { names, menus };
}

/** Merge indexes (crowd + city) so multi-word thresholds and lowCount use combined menu counts. */
export function mergeIndexes(a: TermIndex, b: TermIndex): TermIndex {
  const names = new Set([...a.names, ...b.names]);
  const menus = new Map(a.menus);
  for (const [g, n] of b.menus) menus.set(g, (menus.get(g) ?? 0) + n);
  return { names, menus };
}

/**
 * Candidate food terms of an item name: 1–3 word n-grams that exist in the vocabulary (as, or inside, a tag name).
 * Bare stop words and anything with a digit never count; multi-word terms need ≥ MIN_MULTIWORD_MENUS menus. Pure; order preserved, deduped.
 */
export function extractTerms(name: string, index: TermIndex): string[] {
  const out: string[] = [];
  for (const g of ngrams(words(name))) {
    const toks = g.split(" ");
    if (toks.some((t) => /\d/.test(t)) || toks.every((t) => STOP_WORDS.has(t))) continue;
    if (toks.length === 1 && toks[0].length < MIN_SINGLE_WORD_CHARS) continue;
    const menus = index.menus.get(g);
    if (menus === undefined) continue;
    if (toks.length > 1 && menus < MIN_MULTIWORD_MENUS) continue;
    // a lone word is evidence only when it is a whole tag name; otherwise it is a fragment of something else ("chicken" in "Crispy Chicken")
    if (toks.length === 1 && !index.names.has(g)) continue;
    if (!out.includes(g)) out.push(g);
  }
  // keep the most specific terms: a term that is part of a longer kept term is a fragment ("kung" inside "kung pao chicken")
  return out.filter((t) => !out.some((u) => u !== t && ` ${u} `.includes(` ${t} `)));
}

/** Add-one smoothed share ratio. No mention in either set → 1.0 (no evidence either way). Unrounded. */
export function termLift(crowdCount: number, crowdTotal: number, cityCount: number, cityTotal: number): number {
  if (crowdCount === 0 && cityCount === 0) return 1;
  return ((crowdCount + 1) / (crowdTotal + 1)) / ((cityCount + 1) / (cityTotal + 1));
}

/** One TermLift record; `lowCount` flags thin evidence (< LOW_COUNT_MENUS mentions in total) and never changes `lift`. */
export function buildTermLift(term: string, crowd: number, city: number, crowdTotal: number, cityTotal: number): TermLift {
  return { term, crowd, city, crowdTotal, cityTotal, lift: round2(termLift(crowd, crowdTotal, city, cityTotal)), lowCount: crowd + city < LOW_COUNT_MENUS };
}

/** geometric mean of positive numbers; computed on unrounded lifts, rounded once */
const geoMean = (xs: number[]): number => round2(Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length));

export function scoreLift(input: { crowd: Place[]; city: Place[]; items: LiftItem[] }): { items: ItemLift[]; vocabularySize: number; crowdTotal: number; cityTotal: number } {
  const crowd = indexPlaces(input.crowd);
  const city = indexPlaces(input.city);
  const all = mergeIndexes(crowd, city);
  const crowdTotal = input.crowd.length;
  const cityTotal = input.city.length;
  const items = input.items.map((item): ItemLift => {
    if (item.ambiguous) return { itemId: item.id, lift: null, terms: [], lowCount: false, reason: "ambiguous" };
    const terms = extractTerms(item.nameEn ?? item.name, all);
    if (terms.length === 0) return { itemId: item.id, lift: null, terms: [], lowCount: false, reason: "no_terms" };
    const counts = terms.map((t) => ({ t, c: crowd.menus.get(t) ?? 0, y: city.menus.get(t) ?? 0 }));
    const records = counts.map(({ t, c, y }) => buildTermLift(t, c, y, crowdTotal, cityTotal));
    const lift = geoMean(counts.map(({ c, y }) => termLift(c, crowdTotal, y, cityTotal)));
    return { itemId: item.id, lift, terms: records, lowCount: records.every((r) => r.lowCount) };
  });
  return { items, vocabularySize: all.names.size, crowdTotal, cityTotal };
}
