import type { TagSignal } from "@/lib/providers/qloo/types";
import type { MenuItem } from "@/lib/front/types";
import { normalizeItemName, type ParsedItem } from "./parse";

/**
 * Map menu items to Qloo tag ids. Pure: the caller supplies `lookup` (wired to GET /v2/tags with filter.query and
 * filter.parents.types=urn:entity:place, take 20) and this module only chooses among what Qloo returned — it never invents an id.
 * The "five Jazz" rule: when the same name comes back under several ids and none is place-scoped we refuse to pick; the item
 * is flagged `ambiguous`, gets no tag id, and keeps its candidates for the owner to resolve. Scoring skips ambiguous items.
 */
export interface TagLookup { (query: string): Promise<TagSignal[]> }
export interface TagCandidate { id: string; name: string; type?: string }
export interface TagChoice { qlooTagIds: string[]; tagCandidates: TagCandidate[]; ambiguous: boolean }
export interface ItemTagResult extends TagChoice { index: number; queries: string[]; error?: string }

/** Preferred id prefixes, highest priority first. All are place-scoped or cuisine/dietary facets that Insights accepts as signals. */
export const PREFERRED_PREFIXES = ["urn:tag:specialty_dish:place", "urn:tag:genre:place", "urn:tag:cuisine", "urn:tag:dietary"] as const;
const MAX_CANDIDATES = 6;
const MIN_PARTIAL_LEN = 4;
const QUERY_STOPWORDS = new Set(["style", "special", "plate", "bowl", "combo", "dish", "set", "meal", "lunch", "dinner", "with", "and", "the", "size", "large", "small", "regular", "half", "full", "cup", "pint"]);

const prefRank = (id: string): number => { const i = PREFERRED_PREFIXES.findIndex((p) => id.startsWith(p)); return i < 0 ? Number.POSITIVE_INFINITY : i; };
const isPlaceScoped = (id: string): boolean => /:place(:|$)/.test(id);

/** exact: normalized names equal; partial: one contains the other and both are ≥4 chars; null otherwise */
function nameMatch(tagName: string, query: string): "exact" | "partial" | null {
  const t = normalizeItemName(tagName), q = normalizeItemName(query);
  if (!t || !q) return null;
  if (t === q) return "exact";
  if (t.length >= MIN_PARTIAL_LEN && q.length >= MIN_PARTIAL_LEN && (q.includes(t) || t.includes(q))) return "partial";
  return null;
}
const toCandidate = (t: TagSignal): TagCandidate => ({ id: t.tagId, name: t.name, ...(t.subtype ?? t.types?.[0] ? { type: t.subtype ?? t.types?.[0] } : {}) });

export function chooseTags(candidates: TagSignal[], query: string): TagChoice {
  const seen = new Set<string>();
  const matched = candidates
    .filter((c) => c.tagId && c.name && !seen.has(c.tagId) && seen.add(c.tagId))
    .map((c) => ({ c, m: nameMatch(c.name, query) }))
    .filter((x): x is { c: TagSignal; m: "exact" | "partial" } => x.m !== null);
  if (!matched.length) return { qlooTagIds: [], tagCandidates: [], ambiguous: false };

  const preferred = matched.filter((x) => Number.isFinite(prefRank(x.c.tagId)));
  if (preferred.length) {
    // exact name first, then prefix priority, then the shortest name; one id per distinct name, at most two names
    preferred.sort((a, b) => (a.m === b.m ? 0 : a.m === "exact" ? -1 : 1) || prefRank(a.c.tagId) - prefRank(b.c.tagId) || a.c.name.length - b.c.name.length);
    const byName = new Map<string, TagSignal>();
    for (const { c } of preferred) { const k = normalizeItemName(c.name); if (!byName.has(k)) byName.set(k, c); }
    const picked = [...byName.values()].slice(0, 2);
    return { qlooTagIds: picked.map((c) => c.tagId), tagCandidates: preferred.map((x) => toCandidate(x.c)).slice(0, MAX_CANDIDATES), ambiguous: false };
  }

  // no preferred match: same name under several ids with no place-scoped one is the "five Jazz" case → leave it to the owner
  const groups = new Map<string, TagSignal[]>();
  for (const { c } of matched) { const k = normalizeItemName(c.name); groups.set(k, [...(groups.get(k) ?? []), c]); }
  const dup = [...groups.values()].find((g) => g.length >= 2 && !g.some((c) => isPlaceScoped(c.tagId)));
  if (dup) return { qlooTagIds: [], tagCandidates: matched.map((x) => toCandidate(x.c)).slice(0, MAX_CANDIDATES), ambiguous: true };

  // a single unambiguous place-scoped exact match outside the preferred prefixes (e.g. urn:tag:keyword:place:…) is still usable
  const exactPlace = matched.filter((x) => x.m === "exact" && isPlaceScoped(x.c.tagId));
  if (exactPlace.length === 1 && groups.size === 1) return { qlooTagIds: [exactPlace[0].c.tagId], tagCandidates: matched.map((x) => toCandidate(x.c)).slice(0, MAX_CANDIDATES), ambiguous: false };

  return { qlooTagIds: [], tagCandidates: [], ambiguous: false };
}

/** 1–2 queries per item: the English name (or the source name), plus the last noun-ish word of a ≥3-word name ("Spicy Mapo Tofu" → "tofu"). */
export function buildQueries(item: Pick<ParsedItem, "name" | "nameEn">): string[] {
  const primary = (item.nameEn ?? item.name).replace(/\s+/g, " ").trim();
  if (!primary) return [];
  const words = normalizeItemName(primary).split(" ").filter(Boolean);
  const last = words.length >= 3 ? words[words.length - 1] : "";
  const out = [primary];
  if (last && last.length >= 3 && !QUERY_STOPWORDS.has(last) && last !== normalizeItemName(primary)) out.push(last);
  return out;
}

export async function mapMenuTags(items: Array<ParsedItem | MenuItem>, lookup: TagLookup, opts: { concurrency?: number } = {}): Promise<ItemTagResult[]> {
  const concurrency = Math.max(1, Math.min(16, opts.concurrency ?? 4));
  const cache = new Map<string, Promise<TagSignal[]>>(); // identical queries across items (two "Jasmine Tea" sizes) hit Qloo once
  const cached = (q: string): Promise<TagSignal[]> => {
    const k = normalizeItemName(q);
    let p = cache.get(k);
    if (!p) { p = lookup(q); cache.set(k, p); }
    return p;
  };
  const results: ItemTagResult[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      const queries = buildQueries(items[i]);
      const r: ItemTagResult = { index: i, queries, qlooTagIds: [], tagCandidates: [], ambiguous: false };
      try {
        for (const q of queries) {
          const choice = chooseTags(await cached(q), q);
          if (choice.ambiguous || choice.qlooTagIds.length) { Object.assign(r, choice); break; } // first decisive answer wins; ambiguity is decisive
          if (choice.tagCandidates.length && !r.tagCandidates.length) r.tagCandidates = choice.tagCandidates;
        }
      } catch (e) {
        r.error = e instanceof Error ? e.message : "tag lookup failed";
        r.qlooTagIds = []; r.ambiguous = false; // a failed lookup is "unmapped", never a guess
      }
      results[i] = r;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, worker));
  return results;
}
