import { Chip, DivergingBar, cx } from "@/components/ui";
import type { DecisionBasis } from "@/lib/pass-evidence";
import type { SignalCitation } from "@/lib/business/types";
import type { LText } from "@/i18n/locales";

const AGE: Array<[string, string]> = [["24_and_younger", "≤24"], ["25_to_29", "25–29"], ["30_to_34", "30–34"], ["35_to_44", "35–44"], ["45_to_54", "45–54"], ["55_and_older", "55+"]];
type T = (k: string, p?: Record<string, string | number>) => string;

/** "Why this offer": the frozen decision basis. Server component; used on the pass form (preview) and the campaign page (stored). */
export function DecisionBasisView({ basis, citations, t, lt, locale }: { basis: DecisionBasis | null; citations: SignalCitation[]; t: T; lt: (x: LText) => string; locale: string }) {
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  return (
    <div className="grid gap-3 text-[13px]" data-testid="decision-basis">
      {basis ? <div className="flex flex-wrap items-center gap-2"><Chip tone="coral">{t(`pass.basis.source.${basis.source}`)}</Chip>{basis.anchor ? <span className="font-semibold">{basis.anchor.name}</span> : basis.moment ? <span className="font-semibold">{basis.moment.name} · {basis.moment.date}</span> : <span className="font-semibold">{t(`hyp.${basis.idea.slug}.title`)}</span>}</div> : null}
      {basis?.evidenceError ? <p role="alert" className="rounded-lg bg-bad/10 p-2 text-bad">{t("pass.basis.error", { e: basis.evidenceError })}</p> : null}
      {basis?.anchor ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-muted">{t("pass.basis.whereT", { name: basis.anchor.name })}</div>
            <ul className="grid gap-1">{basis.anchor.places.map((p) => <li key={p.entityId} className="flex justify-between gap-2"><span className="truncate">{p.name}</span>{p.affinity !== undefined ? <span className="tabular text-ink-2">{p.affinity.toFixed(2)}</span> : null}</li>)}</ul></div>
          <div><div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-muted">{t("pass.basis.whoT", { name: basis.anchor.name })}</div>
            {basis.anchor.demographics ? <div className="grid gap-0.5">{AGE.filter(([k]) => basis.anchor!.demographics!.age[k] !== undefined).map(([k, l]) => <DivergingBar key={k} label={l} value={basis.anchor!.demographics!.age[k]} />)}</div> : <span className="text-ink-2">—</span>}</div>
        </div>
      ) : null}
      {basis?.moment?.fit ? <p>{t("pass.basis.fit", { level: t(`moments.levels.${basis.moment.fit.level}`), score: basis.moment.fit.score.toFixed(2), theme: basis.moment.theme ? t(`moments.themes.${basis.moment.theme}`) : "" })}</p> : null}
      {!basis?.anchor ? <ul className="grid gap-2">{citations.map((x) => <li key={x.id + x.kind} className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate font-semibold">{x.name}</div><div className="text-[11.5px] text-ink-2">{lt(x.note)}</div></div>{x.affinity !== undefined ? <Chip tone="coral">{x.affinity.toFixed(2)}</Chip> : null}</li>)}</ul> : null}
      {basis?.rejected.length ? (
        <div><div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-muted">{t("pass.basis.rejectedT")}</div>
          <ul className="grid gap-1">{basis.rejected.map((r) => <li key={r.slug} className={cx("rounded-lg bg-surface-2 px-2.5 py-1.5")}><span className="font-semibold">{t(`hyp.${r.slug}.title`)}</span> · <span className="text-ink-2">{t(`opps.labels.${r.label}`)}{r.reason ? ` · ${lt(r.reason)}` : ""}</span></li>)}</ul></div>
      ) : null}
      {basis ? <p className="text-[11.5px] text-muted">{basis.anchor ? `${t("common.source")} · ${basis.anchor.endpoint} · signal.interests.entities · ${when(basis.anchor.queriedAt)} · ${basis.anchor.mode}` : basis.moment?.queriedAt ? `${t("common.source")} · /v2/insights · signal.interests.tags · ${when(basis.moment.queriedAt)} · ${basis.moment.mode}` : t("pass.basis.frozen", { at: when(basis.createdAt) })}</p> : null}
    </div>
  );
}
