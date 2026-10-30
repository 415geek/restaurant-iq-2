import { Chip, cx } from "@/components/ui";
import type { TFn } from "@/i18n/shared";
import type { Move, StorefrontVersion } from "@/lib/front/types";
import { fmtScore, moveDelta, moveWhy } from "./evidence";

/**
 * Owner-facing list of moves: kind, item (menu-language name first, English second), before → after, evidence line(s) with ✓/⚠,
 * and a one-sentence reason phrased in the owner's language. Held (rejected) moves show why.
 */
export function MovesList({ moves, items, t }: { moves: Move[]; items: StorefrontVersion["items"]; t: TFn }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <ol data-testid="front-moves" className="grid gap-2">
      {moves.map((m) => {
        const held = m.guardrail?.ok === false; const d = moveDelta(m); const it = byId.get(m.itemId);
        return (
          <li key={m.id} data-testid="front-move" className={cx("rounded-xl border border-border p-3", held && "opacity-70")}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={held ? "bad" : m.kind === "feature" ? "coral" : "navy"}>{t(`front.owner.kinds.${m.kind}`)}</Chip>
              <span className="text-[14px] font-bold">{it?.name ?? m.itemId}</span>
              {it?.nameEn && it.nameEn !== it.name ? <span className="text-[12.5px] text-ink-2">{it.nameEn}</span> : null}
              <Chip tone={m.risk === "mid" ? "warn" : "neutral"}>{t(`front.owner.risk.${m.risk}`)}</Chip>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]"><span className="text-ink-2 line-through decoration-muted">{d.before}</span><span aria-hidden className="text-muted">→</span><span className="font-semibold">{d.after}</span></div>
            <p className="mt-1 text-[13px] leading-5">{moveWhy(m, t)}</p>
            {m.evidence.length ? m.evidence.map((e, i) => (
              <div key={i} className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-2">
                <span className="font-semibold">{e.name}</span><span className="tabular">{e.score !== null && e.score > 1 ? `×${fmtScore(e.score)}` : fmtScore(e.score)}</span>
                <span className={e.verified ? "text-good-ink" : "text-warn-ink"}>{e.verified ? `✓ ${t("front.menu.verifiedBy")}` : `⚠ ${t("front.menu.unverifiedBy")}`}</span>
              </div>
            )) : <div className="mt-1 text-[12.5px] text-warn-ink">⚠ {t("front.menu.noEvidence")}</div>}
            {held ? <p className="mt-1 text-[12px] font-semibold text-bad">{t("front.owner.held", { reason: m.guardrail?.reason ?? "" })}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
