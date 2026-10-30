import type { TFn } from "@/i18n/shared";
import type { Move } from "@/lib/front/types";

/** Shared formatting for evidence lines: "name · score · ✓ verified". Scores are shown exactly as stored (never recomputed). */
export const fmtScore = (s: number | null) => (s === null ? "n/a" : s <= 1 && s >= -1 ? s.toFixed(2) : String(s));
export const okMoves = (moves: Move[]) => moves.filter((m) => m.guardrail?.ok !== false);
/** Owner-language reason for a move. Structured `why` → localized template; otherwise the stored English rationale. */
export function moveWhy(m: Move, t: TFn): string {
  const w = m.why; if (!w) return m.rationale;
  const body = w.lift !== null ? t("front.owner.why.lift", { term: w.term, x: w.lift }) : t("front.owner.why.tag", { tag: w.term, s: fmtScore(w.affinity) });
  return `${t(`front.owner.why.${m.kind}`)}${t("front.owner.why.join")}${body}${t("front.owner.why.end")}${w.lowCount ? ` ${t("front.owner.why.lowCount")}` : ""}`;
}
/** Diner-facing reason behind a changed item (first move with a structured why), or null to fall back to raw evidence lines. */
export function menuWhy(moves: Move[], t: TFn): string | null {
  const w = moves.find((m) => m.why)?.why; if (!w) return null;
  const body = w.lift !== null ? t("front.menu.whyLift", { term: w.term, x: w.lift }) : t("front.menu.whyTag", { tag: w.term, s: fmtScore(w.affinity) });
  return w.lowCount ? `${body} ${t("front.menu.lowCount")}` : body;
}
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
