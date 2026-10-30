import "server-only";
import type { QlooProvider, CulturalSignal, TagSignal, HeatmapCell } from "@/lib/providers/qloo";
import { QlooError } from "@/lib/providers/qloo";
import type { MenuItem, NeighborhoodProfile, QlooCallRecord, Store } from "./types";

/**
 * TasteFront's Qloo workflows. Each call is recorded as a QlooCallRecord: provenance (endpoint, redacted params, time,
 * cache hit) plus the names and scores exactly as returned. The verifier later checks every sentence the agent writes
 * against these records. Raw payloads are never stored.
 */
export class CallLog {
  calls: QlooCallRecord[] = [];
  private n = 0;
  add(purpose: QlooCallRecord["purpose"], provenance: QlooCallRecord["provenance"], facts: QlooCallRecord["facts"], error?: string): QlooCallRecord {
    const rec: QlooCallRecord = { id: `c${++this.n}`, purpose, provenance, facts: facts.slice(0, 200), ...(error ? { error } : {}) };
    this.calls.push(rec);
    return rec;
  }
}

const r3 = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 1000) / 1000);
const point = (s: Store) => ({ lat: s.lat, lon: s.lng });
export const TASTEFRONT_TAG_TYPES = ["urn:tag:specialty_dish:place", "urn:tag:genre:place", "urn:tag:ambience:qloo", "urn:tag:customer_identity:qloo"];

/** What people around this store lean toward: tags with affinity + demographics. Built from the location signal, not the restaurant entity. */
export async function neighborhoodProfile(provider: QlooProvider, store: Store, log: CallLog): Promise<NeighborhoodProfile> {
  const caveats: string[] = [];
  let tags: TagSignal[] = [];
  try {
    const r = await provider.getNeighborhoodTags({ point: point(store), radiusMeters: 1500, tagTypes: TASTEFRONT_TAG_TYPES, take: 12 });
    tags = r.data;
    log.add("neighborhood_tags", r.provenance, tags.map((t) => ({ name: t.name, id: t.tagId, score: r3(t.affinity) })));
    if (!tags.length) caveats.push("Qloo returned no neighborhood tags for this location.");
  } catch (e) {
    const msg = e instanceof QlooError ? `${e.errorClass}` : "error";
    log.add("neighborhood_tags", provider.state.mode === "live" ? { provider: "qloo", endpoint: "/v2/insights", requestParams: {}, retrievedAt: new Date().toISOString(), mode: "live", cacheHit: false } : { provider: "qloo", endpoint: "/v2/insights", requestParams: {}, retrievedAt: new Date().toISOString(), mode: "sample", cacheHit: false }, [], msg);
    caveats.push(`Neighborhood tags unavailable (${msg}).`);
  }
  let demographics: NeighborhoodProfile["demographics"] = null;
  const top = tags.filter((t) => t.affinity !== undefined).slice(0, 3).map((t) => t.tagId);
  if (top.length) {
    try {
      const d = await provider.getDemographics({ tagIds: top });
      const age: Record<string, number> = {}; const gender: Record<string, number> = {};
      for (const a of d.data) { for (const [k, v] of Object.entries(a.age)) age[k] = r3(((age[k] ?? 0) + (v ?? 0)) / (age[k] === undefined ? 1 : 2)) ?? 0; for (const [k, v] of Object.entries(a.gender)) gender[k] = r3(((gender[k] ?? 0) + (v ?? 0)) / (gender[k] === undefined ? 1 : 2)) ?? 0; }
      demographics = d.data.length ? { age, gender } : null;
      log.add("demographics", d.provenance, [...Object.entries(age).map(([k, v]) => ({ name: `age:${k}`, score: v })), ...Object.entries(gender).map(([k, v]) => ({ name: `gender:${k}`, score: v }))]);
    } catch (e) {
      caveats.push(`Demographics unavailable (${e instanceof QlooError ? e.errorClass : "error"}).`);
    }
  }
  return {
    storeId: store.id, mode: provider.mode,
    tags: tags.map((t) => ({ id: t.tagId, name: t.name, type: t.types?.[0] ?? t.subtype, affinity: t.affinity ?? null })),
    demographics, calls: log.calls, caveats,
  };
}

export interface PlaceSets { crowd: Array<{ name: string; tags: CulturalSignal["tags"] }>; city: Array<{ name: string; tags: CulturalSignal["tags"] }>; crowdCall: QlooCallRecord | null; cityCall: QlooCallRecord | null; caveats: string[] }

/** Crowd (pulled toward the store) vs city baseline restaurant sets for the contrast score. 3 pages × 50 each. */
export async function placeSets(provider: QlooProvider, store: Store, log: CallLog, pages = 3): Promise<PlaceSets> {
  const cityQuery = `${store.city}, CA`;
  const caveats: string[] = [];
  async function pull(withSignal: boolean) {
    const out: CulturalSignal[] = []; let prov: QlooCallRecord["provenance"] | null = null;
    for (let page = 1; page <= pages; page++) {
      try {
        const r = await provider.getPlaceSet({ cityQuery, take: 50, page, ...(withSignal ? { signalPoint: point(store), signalRadiusMeters: 1500 } : {}) });
        out.push(...r.data); prov = r.provenance;
        if (r.data.length < 50 || provider.mode === "sample") break;
      } catch (e) {
        caveats.push(`${withSignal ? "Crowd" : "City"} place set page ${page} failed (${e instanceof QlooError ? e.errorClass : "error"}).`); break;
      }
    }
    const seen = new Set<string>(); const uniq = out.filter((p) => (seen.has(p.entityId) ? false : (seen.add(p.entityId), true)));
    const rec = prov ? log.add(withSignal ? "crowd_places" : "city_places", { ...prov, requestParams: { ...prov.requestParams, pages: String(pages) } }, uniq.map((p) => ({ name: p.name, id: p.entityId, score: r3(p.affinity) }))) : null;
    return { places: uniq.map((p) => ({ name: p.name, tags: p.tags })), rec };
  }
  const crowd = await pull(true); const city = await pull(false);
  if (crowd.places.length < 5) caveats.push("Fewer than 5 crowd menus: the contrast is low-count.");
  return { crowd: crowd.places, city: city.places, crowdCall: crowd.rec, cityCall: city.rec, caveats };
}

/** Per-store heat for a tag set over the brand territory: nearest heatmap cell within 1.5 km, then z-scored across stores. */
export async function storeHeat(provider: QlooProvider, stores: Store[], tagIds: string[], log: CallLog, fallbackCuisine?: string): Promise<{ heat: Record<string, number | null>; z: Record<string, number | null>; call: QlooCallRecord | null; usedTags: string[] }> {
  if (!stores.length || !tagIds.length) return { heat: {}, z: {}, call: null, usedTags: [] };
  const lat = stores.reduce((s, x) => s + x.lat, 0) / stores.length, lon = stores.reduce((s, x) => s + x.lng, 0) / stores.length;
  const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => { const d2r = Math.PI / 180; const dLat = (b.lat - a.lat) * d2r, dLon = (b.lon - a.lon) * d2r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d2r) * Math.cos(b.lat * d2r) * Math.sin(dLon / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(h)); };
  const radius = Math.min(80_000, Math.round(Math.max(...stores.map((s) => km({ lat, lon }, point(s)))) * 1000) + 1500);
  let cells: HeatmapCell[] = []; let call: QlooCallRecord | null = null; let usedTags = tagIds.slice(0, 5);
  const fetchCells = async (ids: string[]) => {
    const r = await provider.getHeatmapAt({ tagIds: ids, center: { lat, lon }, radiusMeters: radius });
    call = log.add("heatmap", r.provenance, [{ name: "cells", score: r.data.length }]); return r.data;
  };
  try {
    cells = await fetchCells(usedTags);
    // very specific dish tags ("new_teriyaki_chicken_bowl") often have no heat at all: fall back to the cuisine's genre tags,
    // then to a genre tag found by the cuisine's first word, then to the generic restaurant genre
    if (!cells.length && fallbackCuisine) {
      const isGenre = (id: string) => id.startsWith("urn:tag:genre:place");
      const candidates: string[][] = [];
      try { candidates.push((await provider.resolveCuisineTags(fallbackCuisine)).data.map((t) => t.tagId).filter(isGenre).slice(0, 2)); } catch { /* next */ }
      try { candidates.push((await provider.findTags(fallbackCuisine.split(/[\s/]+/)[0] ?? fallbackCuisine)).data.map((t) => t.tagId).filter(isGenre).slice(0, 2)); } catch { /* next */ }
      candidates.push(["urn:tag:genre:place:restaurant"]);
      for (const ids of candidates) { if (!ids.length) continue; cells = await fetchCells(ids); if (cells.length) { usedTags = ids; break; } }
    }
  } catch (e) {
    call = log.add("heatmap", { provider: "qloo", endpoint: "/v2/insights", requestParams: { "filter.type": "urn:heatmap" }, retrievedAt: new Date().toISOString(), mode: provider.mode, cacheHit: false }, [], e instanceof QlooError ? e.errorClass : "error");
  }
  const heat: Record<string, number | null> = {};
  for (const s of stores) {
    let best: { d: number; a: number } | null = null;
    for (const c of cells) { const d = km(point(s), c); if (d <= 1.5 && c.affinity !== undefined && (!best || d < best.d)) best = { d, a: c.affinity }; }
    heat[s.id] = best ? r3(best.a) ?? null : null;
  }
  // affinity saturates at 1.0 in dense cells; when every store ties, rank on affinity_rank instead so the map still differentiates
  const flat = new Set(Object.values(heat).filter((v) => v !== null)).size <= 1 && cells.length > 0;
  if (flat) for (const s of stores) { let best: { d: number; a: number } | null = null; for (const c of cells) { const d = km(point(s), c); if (d <= 1.5 && c.affinityRank !== undefined && (!best || d < best.d)) best = { d, a: c.affinityRank }; } heat[s.id] = best ? r3(best.a) ?? null : null; }
  const vals = Object.values(heat).filter((v): v is number => v !== null);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1)) : 0;
  const z: Record<string, number | null> = {};
  for (const [id, v] of Object.entries(heat)) z[id] = v === null || sd === 0 ? (v === null ? null : 0) : Math.round(((v - mean) / sd) * 100) / 100;
  return { heat, z, call, usedTags };
}

/**
 * Deterministic feature ranking. Neighborhood affinities saturate near 1.0 for almost every tag, so the crowd-vs-city lift
 * (×1.0 = same as the city) is the primary signal; the mean affinity of an item's tags breaks ties and ranks items without lift.
 * Explainability = the lift terms and the tags that counted.
 */
export function rankFeatures(items: MenuItem[], profile: NeighborhoodProfile, lift: Record<string, number | null>): Array<{ itemId: string; score: number | null; tags: Array<{ id: string; name: string; affinity: number | null }>; lift: number | null }> {
  const byId = new Map(profile.tags.map((t) => [t.id, t]));
  const nameOf = new Map(profile.tags.map((t) => [t.name.toLowerCase(), t]));
  return items.filter((i) => !i.ambiguous).map((i) => {
    const hits = i.qlooTagIds.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
    // fall back to a name match (e.g. "Dumplings" tag vs "Zhong Dumplings") so items without resolved ids still rank
    if (!hits.length) for (const t of nameOf.values()) if ((i.nameEn ?? i.name).toLowerCase().includes(t.name.toLowerCase()) && t.name.length >= 4) hits.push(t);
    const aff = hits.map((t) => t.affinity).filter((a): a is number => a !== null);
    const score = aff.length ? Math.round((aff.reduce((a, b) => a + b, 0) / aff.length) * 1000) / 1000 : null;
    return { itemId: i.id, score, tags: hits.map((t) => ({ id: t.id, name: t.name, affinity: t.affinity })), lift: lift[i.id] ?? null };
  }).sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0) || (b.score ?? -1) - (a.score ?? -1));
}

/** Nearest same-cuisine place in the crowd set and the tags only one side carries (ours = menu tag ids / names). */
export function compareRival(store: Store, items: MenuItem[], crowd: Array<{ name: string; tags: CulturalSignal["tags"] }>): { rival: string | null; theirsOnly: string[]; oursOnly: string[] } {
  const cuisine = store.cuisine.toLowerCase().split(/[\s/]+/)[0] ?? "";
  const rival = crowd.find((p) => p.name.toLowerCase() !== store.name.toLowerCase() && p.tags.some((t) => t.name.toLowerCase().includes(cuisine))) ?? crowd[0] ?? null;
  if (!rival) return { rival: null, theirsOnly: [], oursOnly: [] };
  const ours = new Set(items.flatMap((i) => [...i.qlooTagIds, ...i.tagCandidates.map((c) => c.id)]));
  const ourNames = new Set(items.map((i) => (i.nameEn ?? i.name).toLowerCase()));
  const theirsOnly = rival.tags.filter((t) => t.id.startsWith("urn:tag:specialty_dish") && !ours.has(t.id) && !ourNames.has(t.name.toLowerCase())).map((t) => t.name).slice(0, 6);
  const theirs = new Set(rival.tags.map((t) => t.name.toLowerCase()));
  const oursOnly = items.filter((i) => !theirs.has((i.nameEn ?? i.name).toLowerCase())).map((i) => i.nameEn ?? i.name).slice(0, 6);
  return { rival: rival.name, theirsOnly, oursOnly };
}
