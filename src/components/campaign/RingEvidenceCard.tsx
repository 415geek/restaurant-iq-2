import { Card, Chip, H2, fmtDate } from "@/components/ui";
import type { RingEvidence } from "@/lib/ring/evidence";

type T = (k: string, p?: Record<string, string | number>) => string;

/** Second evidence source next to redemptions and sales: person-motion events from the entrance camera. Times only, no video. */
export function RingEvidenceCard({ r, t, locale, demo }: { r: RingEvidence; t: T; locale: string; demo: boolean }) {
  const max = Math.max(1, ...r.last7.map((d) => d.count));
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  return (
    <Card>
      <div data-testid="ring-evidence">
        <H2 hint={t("ring.hint")} right={<div className="flex flex-wrap gap-1.5"><Chip tone="pos">{t("ring.source")}</Chip><Chip>{t("ring.noVideo")}</Chip></div>}>{t("ring.title")}</H2>
        {demo ? <p className="-mt-2 mb-3 text-[12.5px] text-ink-2">{t("ring.demoNote")}</p> : null}
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
          <div className="grid gap-1">
            {r.window ? (
              <>
                <div className="text-[12px] font-semibold text-ink-2">{t("ring.duringPass")}</div>
                <div className="text-[30px] font-extrabold leading-none tabular-nums" data-testid="ring-pass-count">{r.passCount}</div>
                <div className="text-[12px] text-muted">{fmtDate(r.window.start, locale)} – {fmtDate(r.window.end, locale)}</div>
                <div className="text-[12.5px] text-ink-2">{r.prior ? t("ring.prior", { n: r.prior.count }) : t("ring.noPrior")}</div>
              </>
            ) : <p className="text-[13px] text-ink-2">{t("ring.notStarted")}</p>}
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold text-ink-2">{t("ring.last7")}</div>
            <ol className="flex h-20 items-end gap-1.5" aria-label={t("ring.last7")}>
              {r.last7.map((d) => (
                <li key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
                  <span className="text-[11px] tabular-nums text-ink-2">{d.count}</span>
                  <span className="w-full max-w-8 rounded-t bg-navy" style={{ height: `${Math.max(2, (d.count / max) * 44)}px`, opacity: d.count ? 1 : 0.25 }} />
                  <span className="text-[10.5px] text-muted">{dayLabel(d.day)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        {r.linkedAt ? <p className="mt-3 text-[12px] text-muted">{t("ring.linkedSince", { date: fmtDate(r.linkedAt, locale) })}</p> : null}
        <p className="mt-2 text-[12.5px] text-ink-2">{t("ring.caveat")}</p>
      </div>
    </Card>
  );
}
