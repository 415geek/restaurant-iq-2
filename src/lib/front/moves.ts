import { z } from "zod";
import { MOVE_KINDS, type Evidence, type Guardrails, type ItemLift, type MenuItem, type Move, type MoveWhy, type NeighborhoodProfile, type QlooCallRecord, type StorefrontVersion } from "./types";

/**
 * Moves: the agent's proposal schema, the guardrail filter, the citation verifier and the deterministic application to a menu.
 * Everything here is pure so it can be unit-tested; the model only produces `ProposalInput`.
 */
export const evidenceSchema = z.object({
  callId: z.string().min(1).max(10),
  name: z.string().min(1).max(120),
  score: z.number().nullable(),
  sentence: z.string().min(1).max(240),
});
export const moveInputSchema = z.object({
  kind: z.enum(MOVE_KINDS),
  itemId: z.string().min(1),
  after: z.object({
    sortIndex: z.number().int().min(0).optional(),
    name: z.string().min(1).max(120).optional(),
    nameEn: z.string().min(1).max(120).nullable().optional(),
    description: z.string().max(240).nullable().optional(),
    featured: z.boolean().optional(),
    promoteBudgetCents: z.number().int().min(0).max(100000).optional(),
    passOfferCents: z.number().int().min(0).optional(),
  }),
  evidence: z.array(evidenceSchema).max(4),
  rationale: z.string().min(1).max(240),
  risk: z.enum(["low", "mid"]),
  /** structured reason (term + lift or affinity); the UI phrases it in the owner's language */
  why: z.object({ term: z.string().min(1).max(120), lift: z.number().nullable(), affinity: z.number().nullable(), lowCount: z.boolean() }).optional(),
});
export const proposalSchema = z.object({ moves: z.array(moveInputSchema).max(7), caveats: z.array(z.string().max(240)).max(8).default([]) });
export type ProposalInput = z.infer<typeof proposalSchema>;

/** Verifier: every cited name must appear in that call's stored facts; scores must match what Qloo returned (±0.01 for 0..1 affinities, ±1 otherwise). */
export function verifyEvidence(ev: Evidence, calls: QlooCallRecord[]): boolean {
  const call = calls.find((c) => c.id === ev.callId);
  if (!call) return false;
  const name = ev.name.trim().toLowerCase();
  const fact = call.facts.find((f) => f.name.trim().toLowerCase() === name);
  if (!fact) return false;
  if (ev.score === null || fact.score === undefined) return ev.score === null || ev.score === undefined;
  const tol = Math.abs(fact.score) <= 1 ? 0.011 : 1.001;
  return Math.abs(ev.score - fact.score) <= tol;
}

const normBanned = (s: string) => s.toLowerCase();
const containsBanned = (text: string | null | undefined, banned: string[]) => { if (!text) return null; const t = normBanned(text); return banned.find((b) => b && t.includes(normBanned(b))) ?? null; };

/** Guardrails + caps. Returns moves annotated with `guardrail` (rejected moves keep their reason) and `verified`. */
export function applyGuardrails(input: ProposalInput, ctx: { items: MenuItem[]; guardrails: Guardrails; singleStore: boolean; calls: QlooCallRecord[] }): Move[] {
  const byId = new Map(ctx.items.map((i) => [i.id, i]));
  const counts = { feature: 0, promote: 0, pass: 0 };
  return input.moves.map((m, idx): Move => {
    const item = byId.get(m.itemId);
    const before = item ? { sortIndex: item.sortIndex, name: item.name, description: item.description, featured: false, priceCents: item.priceCents } : {};
    const evidence = m.evidence.map((e) => ({ ...e, verified: verifyEvidence(e, ctx.calls) }));
    const base: Move = { id: `m${idx + 1}`, kind: m.kind, itemId: m.itemId, risk: m.kind === "promote" || m.kind === "pass" ? "mid" : "low", before, after: m.after, evidence, verified: evidence.length > 0 && evidence.every((e) => e.verified), rationale: m.rationale, ...(m.why ? { why: m.why } : {}) };
    const reject = (reason: string): Move => ({ ...base, guardrail: { ok: false, reason } });
    if (!item) return reject("unknown item");
    if (item.ambiguous && m.kind !== "reorder") return reject("item tags are ambiguous; resolve before changing it");
    const banned = containsBanned(m.after.name, ctx.guardrails.bannedTerms) ?? containsBanned(m.after.nameEn, ctx.guardrails.bannedTerms) ?? containsBanned(m.after.description, ctx.guardrails.bannedTerms) ?? containsBanned(m.rationale, ctx.guardrails.bannedTerms);
    if (banned) return reject(`uses banned term "${banned}"`);
    switch (m.kind) {
      case "reorder":
        if (m.after.sortIndex === undefined) return reject("reorder needs a sortIndex");
        return { ...base, guardrail: { ok: true } };
      case "rename": {
        const allowed = ctx.singleStore || ctx.guardrails.renamableItemIds.includes(item.id);
        if (!allowed) return reject("HQ guardrail: this item cannot be renamed at store level");
        if (!m.after.name && !m.after.description && !m.after.nameEn) return reject("rename needs a new name or description");
        return { ...base, after: { ...m.after, name: m.after.name ?? item.name, nameEn: m.after.nameEn ?? item.nameEn, description: m.after.description ?? item.description }, guardrail: { ok: true } };
      }
      case "feature":
        if (++counts.feature > 3) return reject("at most 3 featured items");
        return { ...base, after: { ...m.after, featured: true }, guardrail: { ok: true } };
      case "promote": {
        if (++counts.promote > 1) return reject("at most 1 promotion");
        if (item.costCents === null) return reject("promote needs a unit cost to compute contribution");
        const contribution = item.priceCents - item.costCents;
        if (contribution <= 0) return reject("NO-GO: contribution per unit is zero or negative");
        if (!m.after.promoteBudgetCents) return reject("promote needs a budget");
        return { ...base, after: { ...m.after, promoteBudgetCents: m.after.promoteBudgetCents }, guardrail: { ok: true } };
      }
      case "pass":
        if (++counts.pass > 1) return reject("at most 1 TastePass");
        if (m.after.passOfferCents !== undefined && m.after.passOfferCents < item.priceCents * (1 - ctx.guardrails.priceBandPct / 100) * 0.5) return reject(`offer price is outside the brand price band (${ctx.guardrails.priceBandPct}%)`);
        return { ...base, guardrail: { ok: true } };
    }
  });
}

/** Apply accepted moves to the menu: new order, names, descriptions, featured flags. Marks what changed per item. */
export function applyMoves(items: MenuItem[], moves: Move[]): StorefrontVersion["items"] {
  const ok = moves.filter((m) => m.guardrail?.ok !== false);
  const state = new Map(items.map((i) => [i.id, { ...i, featured: false, changed: [] as StorefrontVersion["items"][number]["changed"] }]));
  for (const m of ok) {
    const it = state.get(m.itemId); if (!it) continue;
    if (m.kind === "rename") {
      if (m.after.name && m.after.name !== it.name) { it.name = m.after.name; it.changed.push("name"); }
      if (m.after.nameEn !== undefined && m.after.nameEn !== it.nameEn) it.nameEn = m.after.nameEn;
      if (m.after.description !== undefined && m.after.description !== it.description) { it.description = m.after.description; it.changed.push("description"); }
    }
    if (m.kind === "feature") { it.featured = true; it.changed.push("featured"); }
  }
  // order: featured first (kept in relative order), then explicit reorders, then the rest by their original sort index
  const reorders = new Map(ok.filter((m) => m.kind === "reorder" && m.after.sortIndex !== undefined).map((m) => [m.itemId, m.after.sortIndex!]));
  const arr = [...state.values()];
  // explicit slots win ties: an item without a reorder sits half a step after its original index
  const key = (i: { id: string; sortIndex: number }) => reorders.get(i.id) ?? i.sortIndex + 0.5;
  arr.sort((a, b) => key(a) - key(b) || a.sortIndex - b.sortIndex);
  const featured = arr.filter((i) => i.featured), rest = arr.filter((i) => !i.featured);
  return [...featured, ...rest].map((i, idx) => {
    const changed = [...i.changed]; if (idx !== i.sortIndex && !changed.includes("sortIndex")) changed.push("sortIndex");
    return { id: i.id, name: i.name, nameEn: i.nameEn, description: i.description, priceCents: i.priceCents, category: i.category, sortIndex: idx, featured: i.featured, changed: Array.from(new Set(changed)) };
  });
}

/** The menu as it is, for the baseline/"Qloo off" view and as the parent of every version. */
export function identityItems(items: MenuItem[]): StorefrontVersion["items"] {
  return [...items].sort((a, b) => a.sortIndex - b.sortIndex).map((i, idx) => ({ id: i.id, name: i.name, nameEn: i.nameEn, description: i.description, priceCents: i.priceCents, category: i.category, sortIndex: idx, featured: false, changed: [] }));
}

/**
 * Deterministic proposal used when no model is configured (fixture mode) or as the fallback after a malformed model answer:
 * feature the top-ranked items and move high-affinity items up. It never writes copy, so no rename moves.
 * Only items whose best term rests on enough menus (not lowCount) can be featured; thin evidence may only move an item up.
 */
export function deterministicProposal(input: { items: MenuItem[]; ranked: Array<{ itemId: string; score: number | null; tags: Array<{ id: string; name: string; affinity: number | null }>; lift: number | null }>; lifts: ItemLift[]; profile: NeighborhoodProfile; calls: QlooCallRecord[] }): ProposalInput {
  const tagCall = input.calls.find((c) => c.purpose === "neighborhood_tags");
  const liftCall = input.calls.find((c) => c.purpose === "rank");
  const liftOf = new Map(input.lifts.map((l) => [l.itemId, l]));
  type Reason = { ev: ProposalInput["moves"][number]["evidence"]; why: MoveWhy; text: string };
  const reasonFor = (r: (typeof input.ranked)[number]): Reason | null => {
    const l = liftOf.get(r.itemId);
    const bestTerm = l?.terms.filter((t) => t.lift > 1).sort((a, b) => b.lift - a.lift)[0];
    if (liftCall && bestTerm) return { ev: [{ callId: liftCall.id, name: bestTerm.term, score: bestTerm.lift, sentence: `Menus near this store mention "${bestTerm.term}" ×${bestTerm.lift} as often as the city${bestTerm.lowCount ? " (low count)" : ""}` }], why: { term: bestTerm.term, lift: bestTerm.lift, affinity: null, lowCount: bestTerm.lowCount }, text: `this crowd leans toward "${bestTerm.term}" (×${bestTerm.lift} vs the city${bestTerm.lowCount ? ", low count" : ""})` };
    const t = r.tags[0];
    if (tagCall && t) return { ev: [{ callId: tagCall.id, name: t.name, score: t.affinity, sentence: `Neighborhood tag "${t.name}" affinity ${t.affinity ?? "n/a"}` }], why: { term: t.name, lift: null, affinity: t.affinity, lowCount: false }, text: `this crowd leans toward ${t.name}${t.affinity !== null ? ` (affinity ${t.affinity})` : ""}` };
    return null;
  };
  const moves: ProposalInput["moves"] = [];
  // order: well-supported lift first, then low-count lift, then affinity-only items
  const lowCount = (id: string) => liftOf.get(id)?.lowCount ?? false;
  const candidates = input.ranked
    .filter((r) => (r.lift !== null && r.lift > 1) || (r.score !== null && r.tags.length))
    .sort((a, b) => Number(lowCount(a.itemId)) - Number(lowCount(b.itemId)) || (b.lift ?? 0) - (a.lift ?? 0))
    .map((r) => ({ r, reason: reasonFor(r) }))
    .filter((c): c is { r: (typeof input.ranked)[number]; reason: Reason } => c.reason !== null);
  // feature: lift above the city AND enough menus behind the term. Thin or affinity-only evidence can only move an item up.
  const featured = candidates.filter((c) => c.r.lift !== null && c.r.lift > 1 && c.reason.why.lift !== null && !c.reason.why.lowCount).slice(0, 2);
  const featuredIds = new Set(featured.map((c) => c.r.itemId));
  for (const { r, reason } of featured) moves.push({ kind: "feature", itemId: r.itemId, after: { featured: true }, risk: "low", rationale: `Featured: ${reason.text}.`, evidence: reason.ev, why: reason.why });
  let pos = 0;
  for (const { r, reason } of candidates.filter((c) => !featuredIds.has(c.r.itemId)).slice(0, 4)) moves.push({ kind: "reorder", itemId: r.itemId, after: { sortIndex: pos++ }, risk: "low", rationale: `Moved up: ${reason.text}.`, evidence: reason.ev, why: reason.why });
  const caveats = ["Copy was not rewritten: no language model configured, so only order and featured items changed."];
  if (liftCall && input.lifts.every((l) => l.lift === null)) caveats.push("No menu term matched the crowd/city place sets; lift was not used.");
  if (!candidates.length) caveats.push("Nothing stood out: no menu item leaned above the city baseline and no neighborhood tag matched the menu.");
  else if (!featured.length) caveats.push("Nothing featured: every lead rests on too few menus; items were only moved up.");
  return { moves: moves.slice(0, 7), caveats };
}
