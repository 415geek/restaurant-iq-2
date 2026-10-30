import { Chip, cx } from "@/components/ui";
import type { TFn } from "@/i18n/shared";
import type { Move, StorefrontVersion } from "@/lib/front/types";
import { fmtScore, moveDelta } from "./evidence";

/** Owner-facing list of moves: kind, item, before → after, evidence line(s) with ✓/⚠, one-sentence rationale. Held (rejected) moves show why. */
export function MovesList({ moves, items, t }: { moves: Move[]; items: StorefrontVersion["items"]; t: TFn }) {
  const nameOf = new Map(items.map((i) => [i.id, i.nameEn ?? i.name]));
  return (
    <ol data-testid="front-moves" className="grid gap-2">
      {moves.map((m) => {
        const held = m.guardrail?.ok === false; const d = moveDelta(m);
        return (
          <li key={m.id} data-testid="front-move" className={cx("rounded-xl border border-border p-3", held && "opacity-70")}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={held ? "bad" : m.kind === "feature" ? "coral" : "navy"}>{t(`front.owner.kinds.${m.kind}`)}</Chip>
              <span className="text-[14px] font-bold">{nameOf.get(m.itemId) ?? m.itemId}</span>
              <Chip tone={m.risk === "mid" ? "warn" : "neutral"}>{m.risk}</Chip>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]"><span className="text-ink-2 line-through decoration-muted">{d.before}</span><span aria-hidden className="text-muted">→</span><span className="font-semibold">{d.after}</span></div>
            {m.evidence.length ? m.evidence.map((e, i) => (
              <div key={i} className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px]">
                <span className="font-semibold">{e.name}</span><span className="tabular text-ink-2">{fmtScore(e.score)}</span>
                <span className={e.verified ? "text-good-ink" : "text-warn-ink"}>{e.verified ? `✓ ${t("front.menu.verified")}` : `⚠ ${t("front.menu.unverified")}`}</span>
              </div>
            )) : <div className="mt-1 text-[12.5px] text-warn-ink">⚠ {t("front.menu.noEvidence")}</div>}
            <p className="mt-1 text-[12.5px] text-ink-2">{m.rationale}</p>
            {held ? <p className="mt-1 text-[12px] font-semibold text-bad">{t("front.owner.held", { reason: m.guardrail?.reason ?? "" })}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
