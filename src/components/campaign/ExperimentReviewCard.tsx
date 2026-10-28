import { Button, Card, Chip, H2, fmtDate, fmtUsd } from "@/components/ui";
import type { ExperimentReview, MetricRow } from "@/lib/business/experiment";

type T = (k: string, p?: Record<string, string | number>) => string;
const pct = (d: number | null) => (d === null ? "—" : `${d > 0 ? "+" : ""}${Math.round(d * 100)}%`);

/** Range strip: grey band = prior weeks (min–max), navy tick = their average, coral dot = this pass. Values are printed beside it. */
function Strip({ m }: { m: MetricRow }) {
  // zoomed to the values shown (not from 0), so a 10% difference is visible; padding keeps dots off the edges
  const lo0 = Math.min(m.pass, m.min), hi0 = Math.max(m.pass, m.max); const pad = (hi0 - lo0) * 0.2 || Math.max(1, hi0 * 0.1);
  const lo = lo0 - pad, hi = hi0 + pad; const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative h-4 w-full min-w-24 rounded-full bg-surface-2" aria-hidden>
      <div className="absolute inset-y-1 rounded-full bg-border" style={{ left: x(m.min), width: `calc(${x(m.max)} - ${x(m.min)} + 4px)` }} />
      <div className="absolute inset-y-0 w-0.5 bg-navy" style={{ left: x(m.mean) }} />
      <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-coral ring-2 ring-surface" style={{ left: x(m.pass) }} />
    </div>
  );
}

export function ExperimentReviewCard({ r, t, locale, dataHref, synthetic }: { r: ExperimentReview; t: T; locale: string; dataHref: string; synthetic: boolean }) {
  const val = (m: MetricRow, v: number) => (m.key === "netSales" ? fmtUsd(v, 0) : String(Math.round(v * 10) / 10));
  const head = r.metrics[0];
  const verdict = head ? (head.position === "above" ? <Chip tone="good">{t("review.above", { n: r.baselines.length })}</Chip> : head.position === "below" ? <Chip tone="bad">{t("review.below", { n: r.baselines.length })}</Chip> : <Chip>{t("review.within")}</Chip>) : null;
  return (
    <Card>
      <div data-testid="experiment-review">
        <H2 hint={t("review.hint")} right={<div className="flex flex-wrap gap-1.5">{synthetic ? <Chip tone="warn">{t("review.synthetic")}</Chip> : <Chip tone="pos">{t("review.source")}</Chip>}{verdict}</div>}>{t("review.title")}</H2>
        {r.window ? <p className="-mt-2 mb-3 text-[12.5px] text-ink-2">{t("review.window", { from: fmtDate(r.window.start, locale), to: fmtDate(r.window.end, locale) })}{r.partial ? ` · ${t("review.partial", { date: fmtDate(r.dataTo, locale) })}` : ""}</p> : null}
        {r.status === "not_started" ? <p className="text-[13px] text-ink-2">{t("review.notStarted")}</p> : null}
        {r.status === "awaiting_sales" ? (
          <div className="grid gap-2 text-[13px] text-ink-2" data-testid="review-awaiting">
            <p>{r.dataTo ? t("review.awaiting", { last: fmtDate(r.dataTo, locale) }) : t("review.noSales")}</p>
            <div><Button size="sm" variant="secondary" href={dataHref}>{t("review.upload")}</Button></div>
          </div>
        ) : null}
        {r.status === "short_history" ? <p className="text-[13px] text-ink-2">{t("review.short")}</p> : null}
        {r.status === "ready" ? (
          <>
            <div className="scroll-x -mx-1 overflow-x-auto px-1">
              <table className="w-full text-[12.5px] sm:min-w-[520px] sm:text-[13px]">
                <thead><tr className="text-left text-[12px] text-muted"><th className="py-1.5 font-semibold">{t("review.metric")}</th><th className="font-semibold">{t("review.thisPass")}</th><th className="font-semibold">{t("review.prior", { n: r.baselines.length })}</th><th className="font-semibold">{t("review.range")}</th><th className="font-semibold">{t("review.change")}</th><th className="hidden w-40 sm:table-cell" /></tr></thead>
                <tbody>
                  {r.metrics.map((m) => (
                    <tr key={m.key} className="border-t border-border" data-testid={`review-${m.key}`}>
                      <td className="py-2 font-semibold">{t(`review.m.${m.key}`)}</td>
                      <td className="tabular font-extrabold">{val(m, m.pass)}</td>
                      <td className="tabular">{val(m, m.mean)}</td>
                      <td className="tabular text-ink-2">{val(m, m.min)}–{val(m, m.max)}</td>
                      <td className="tabular">{pct(m.delta)}</td>
                      <td className="hidden sm:table-cell"><Strip m={m} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 hidden flex-wrap items-center gap-3 text-[11.5px] text-muted sm:flex"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-coral" />{t("review.legendPass")}</span><span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-full bg-border" />{t("review.legendRange")}</span><span className="flex items-center gap-1"><i className="h-3 w-0.5 bg-navy" />{t("review.legendMean")}</span></div>
            <p className="mt-3 text-[13px]">{t("review.redeemedVs", { redeemed: r.redeemed, extra: `${Math.round(r.extraOrdersVsMean ?? 0) > 0 ? "+" : ""}${Math.round(r.extraOrdersVsMean ?? 0)}` })}</p>
            {head ? <p className="mt-1 text-[13px] font-semibold" data-testid="review-next">{t(`review.next.${head.position}`)}</p> : null}
            {!r.itemFound ? <p className="mt-1 text-[12.5px] text-ink-2">{t("review.noItem")}</p> : null}
            <ul className="mt-2 list-disc pl-4 text-[12.5px] text-ink-2"><li>{t("review.chance", { n: r.baselines.length + 1 })}</li><li>{t("review.confounders")}</li></ul>
          </>
        ) : null}
      </div>
    </Card>
  );
}
