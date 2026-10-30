import { Card, Chip, H2, Stat, fmtDate, fmtUsd } from "@/components/ui";
import type { TFn } from "@/i18n/shared";
import type { Holdout, Settlement } from "@/lib/front/types";
import { PostButton } from "./PostButton";

/**
 * Settlement card: the only place dollars appear. ready → the one-line verdict + three metrics; otherwise the status word.
 * No holdout yet → a button that schedules the alternate weeks (POST /api/front/stores/{id}/holdout).
 */
export function SettleCard({ storeId, holdout, settlement, hasRestaurant, sample, t, locale }: { storeId: string; holdout: Holdout | null; settlement: Settlement | null; hasRestaurant: boolean; sample: boolean; t: TFn; locale: string }) {
  const s = settlement;
  const units = s?.metrics.find((m) => m.key === "featuredUnits");
  const x = units && units.control > 0 ? (units.change / units.control).toFixed(1) : "—";
  const ready = s?.status === "ready";
  return (
    <Card>
      <H2 right={sample ? <Chip tone="warn" title={t("front.sampleTitle")}>{t("front.sample")}</Chip> : null}>{t("front.settle.title")}</H2>
      <div data-testid="settle-card" data-status={s?.status ?? "no_holdout"} className="grid gap-3">
        {!holdout ? (
          <>
            <div className="text-[15px] font-bold">{t("front.settle.noHoldout")}</div>
            <p className="text-[12.5px] text-ink-2">{t("front.settle.holdoutHint")}</p>
            <PostButton url={`/api/front/stores/${storeId}/holdout`} label={t("front.settle.startHoldout")} busyLabel={t("front.settle.starting")} variant="primary" testId="start-holdout" />
          </>
        ) : ready && s ? (
          <>
            <div className="text-[15px] font-bold leading-6">{t("front.settle.ready", { lift: `${(s.netSalesLiftUsd ?? 0) >= 0 ? "+" : ""}${fmtUsd(s.netSalesLiftUsd)}`, x, f: s.flukeRate === null ? "—" : `${Math.round(s.flukeRate * 100)}%` })}</div>
            <div className="grid grid-cols-3 gap-3">
              {s.metrics.map((m) => <Stat key={m.key} label={t(`front.settle.metrics.${m.key}`)} value={m.key === "netSales" ? fmtUsd(m.change) : m.change} hint={`${t("front.settle.controlShort")} ${m.key === "netSales" ? fmtUsd(m.control) : m.control}`} tone={m.delta === null ? "neutral" : m.delta >= 0 ? "pos" : "neg"} />)}
            </div>
          </>
        ) : (
          <div className="text-[15px] font-bold">{s?.status === "short_history" ? t("front.settle.shortHistory") : t("front.settle.waiting")}</div>
        )}
        {holdout ? <p className="text-[12px] text-muted">{t("front.settle.window", { s: fmtDate(holdout.changeWindow.start, locale), e: fmtDate(holdout.changeWindow.end, locale) })}{s?.dataTo ? ` · ${t("front.settle.dataTo", { d: fmtDate(s.dataTo, locale) })}` : ""}</p> : null}
        {holdout && s ? <p className="text-[12px] text-muted">{t("front.settle.control", { label: s.controlLabel })}</p> : null}
        {!hasRestaurant ? <p className="text-[12px] text-warn-ink">{t("front.settle.noLink")}</p> : null}
        <p className="text-[12px] text-muted">{t("front.settle.note")}</p>
      </div>
    </Card>
  );
}
