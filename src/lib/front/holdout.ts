import { shiftLocalDays } from "@/lib/business/experiment";
import type { Holdout } from "./types";

/**
 * Holdout scheduling: decides *when* (week_alternate) or *where* (store_split) a storefront change is not applied,
 * so the settlement has a real control. Pure and deterministic: the same input (and seed) always yields the same plan.
 *  - week_alternate: change week, then a control week with no changes, in local calendar days (DST-safe).
 *  - store_split: stores are stratified into heat terciles and split half/half inside each tercile with a seeded PRNG.
 */
export type HoldoutPlan = Omit<Holdout, "id" | "createdAt">;
export type Stratum = "low" | "mid" | "high";
export type ScheduleInput =
  | { kind: "week_alternate"; storeId: string; startsAt: string; tz: string; /** weeks per phase, default 1 */ weeks?: number }
  | { kind: "store_split"; brandId: string; startsAt: string; tz: string; stores: Array<{ id: string; heat: number | null }>; seed?: number };

const iso = (t: number) => new Date(t).toISOString();
/** Same local wall-clock time `days` later (shiftLocalDays with a negative shift). */
const forwardLocalDays = (t: number, days: number, tz: string) => shiftLocalDays(t, -days, tz);

/** mulberry32: tiny seeded PRNG returning floats in [0, 1); enough for a reproducible shuffle, never used for anything shown as a number. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** FNV-1a hash of a string → 32-bit seed, so an omitted seed is still reproducible from the brand + start. */
function fnv1a(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function shuffle<T>(xs: T[], rnd: () => number) { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Heat terciles by z-score rank: lowest third "low", top third "high"; stores without heat sit in "mid". Ties break by id. */
export function stratify(stores: Array<{ id: string; heat: number | null }>): Record<string, Stratum> {
  const known = stores.filter((s): s is { id: string; heat: number } => s.heat !== null);
  const mean = known.length ? known.reduce((s, x) => s + x.heat, 0) / known.length : 0;
  const sd = known.length ? Math.sqrt(known.reduce((s, x) => s + (x.heat - mean) ** 2, 0) / known.length) : 0;
  const z = (h: number) => (sd > 0 ? (h - mean) / sd : 0);
  const ranked = [...known].sort((a, b) => z(a.heat) - z(b.heat) || a.id.localeCompare(b.id));
  const cut1 = Math.floor(ranked.length / 3); const cut2 = ranked.length - Math.floor(ranked.length / 3);
  const out: Record<string, Stratum> = {};
  ranked.forEach((s, i) => { out[s.id] = i < cut1 ? "low" : i >= cut2 ? "high" : "mid"; });
  for (const s of stores) if (s.heat === null) out[s.id] = "mid";
  return out;
}

/** Build a holdout plan (no id/createdAt): alternate weeks for one store, or a stratified seeded store split for a brand. */
export function scheduleHoldout(input: ScheduleInput): HoldoutPlan {
  const start = Date.parse(input.startsAt);
  if (!Number.isFinite(start)) throw new Error(`scheduleHoldout: invalid startsAt ${input.startsAt}`);
  if (input.kind === "week_alternate") {
    const days = 7 * Math.max(1, Math.floor(input.weeks ?? 1));
    const changeEnd = forwardLocalDays(start, days, input.tz); const controlEnd = forwardLocalDays(changeEnd, days, input.tz);
    return { storeId: input.storeId, brandId: null, kind: "week_alternate",
      changeWindow: { start: iso(start), end: iso(changeEnd) }, controlWindow: { start: iso(changeEnd), end: iso(controlEnd) },
      assignment: { change: [input.storeId], control: [], seed: 0 } };
  }
  const seed = input.seed ?? fnv1a(`${input.brandId}|${input.startsAt}`);
  const rnd = mulberry32(seed);
  const strata = stratify(input.stores);
  const change: string[] = []; const control: string[] = [];
  for (const stratum of ["low", "mid", "high"] as const) {
    const ids = input.stores.filter((s) => strata[s.id] === stratum).map((s) => s.id).sort();
    const order = shuffle(ids, rnd);
    // odd tercile: the extra store goes to whichever arm is currently smaller, so the brand total stays as even as possible
    const half = Math.floor(order.length / 2) + (order.length % 2 === 1 && change.length <= control.length ? 1 : 0);
    change.push(...order.slice(0, half)); control.push(...order.slice(half));
  }
  const end = forwardLocalDays(start, 7, input.tz);
  const window = { start: iso(start), end: iso(end) };
  return { storeId: null, brandId: input.brandId, kind: "store_split", changeWindow: window, controlWindow: { ...window },
    assignment: { change: change.sort(), control: control.sort(), seed, strata } };
}

/** How many stores receive the change vs. are held out (week_alternate: the single store changes, nothing is held out by store). */
export function splitSummary(h: Pick<Holdout, "assignment">): { changed: number; heldOut: number } {
  return { changed: h.assignment.change.length, heldOut: h.assignment.control.length };
}
