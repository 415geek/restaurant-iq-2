import type { Move } from "@/lib/front/types";

/** Shared formatting for evidence lines: "name · score · ✓ verified". Scores are shown exactly as stored (never recomputed). */
export const fmtScore = (s: number | null) => (s === null ? "n/a" : s <= 1 && s >= -1 ? s.toFixed(2) : String(s));
export const okMoves = (moves: Move[]) => moves.filter((m) => m.guardrail?.ok !== false);
/** Item display name + the before/after text of a move, for "before → after" rows. */
export function moveDelta(m: Move): { before: string; after: string } {
  switch (m.kind) {
    case "rename": return { before: m.before.name ?? "", after: m.after.name ?? m.after.description ?? "" };
    case "reorder": return { before: `#${(m.before.sortIndex ?? 0) + 1}`, after: `#${(m.after.sortIndex ?? 0) + 1}` };
    case "feature": return { before: "—", after: "★" };
    case "promote": return { before: "—", after: m.after.promoteBudgetCents ? `$${(m.after.promoteBudgetCents / 100).toFixed(0)}` : "" };
    case "pass": return { before: "—", after: m.after.passOfferCents ? `$${(m.after.passOfferCents / 100).toFixed(2)}` : "" };
  }
}
