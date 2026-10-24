import { Chip, fmtDate } from "@/components/ui";
import { getT } from "@/i18n";
import type { EvidenceView, RunView } from "@/lib/queries";

/** Server component. Rendered inside the DataPill slide-over. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5"><h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">{title}</h3>{children}</section>;
}

export async function TrustPanel({ evidence, run, assumptions, unknowns }: { evidence: EvidenceView; run: RunView | null; assumptions: string[]; unknowns: string[] }) {
  const { t, locale } = await getT();
  return (
    <div className="text-[14px]">
      <p className="text-ink-2">{t("trust.hint")}</p>
      <Section title={`${t("trust.sources")} · ${evidence.sources.length}`}>
        {evidence.sources.length === 0 ? <p className="text-muted">{t("trust.noSources")}</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {evidence.sources.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-mono text-[12px]">{s.endpoint}{s.requestParams["filter.type"] ? ` · ${s.requestParams["filter.type"].replace("urn:entity:", "").replace("urn:", "")}` : ""}</span>
                <span className="flex items-center gap-1.5"><Chip tone={s.mode === "live" ? "good" : "warn"}>{s.mode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge")}</Chip><Chip tone={s.fresh ? "neutral" : "bad"}>{s.fresh ? fmtDate(s.retrievedAt, locale) : t("common.stale")}</Chip>{s.citationUrl ? <a className="text-[12px] text-pos underline" href={s.citationUrl} target="_blank" rel="noreferrer">{t("trust.docs")}</a> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("trust.provider")}>
        <ul className="space-y-1 text-ink-2">
          <li>{evidence.mode === "live" ? t("trust.qlooLive") : t("trust.qlooSample")}</li>
          <li>{t("trust.posPlanned")}</li>
          <li>{t("trust.lastRun")}: {run ? `${run.status} · ${fmtDate(run.finishedAt ?? run.startedAt, locale)} · ${t("snapshot.trace")} ${run.traceId.slice(0, 8)}` : t("common.none")}</li>
        </ul>
      </Section>
      <Section title={t("trust.assumptions")}><ul className="flex flex-wrap gap-1.5">{assumptions.map((a) => <Chip key={a}>{a}</Chip>)}</ul></Section>
      <Section title={t("trust.unknowns")}>{unknowns.length ? <ul className="flex flex-wrap gap-1.5">{unknowns.map((u) => <Chip key={u} tone="warn">{u}</Chip>)}</ul> : <p className="text-muted">{t("trust.noUnknowns")}</p>}</Section>
      <p className="mt-5 rounded-xl bg-surface-2 p-3 text-[12.5px] text-ink-2">{t("trust.affinityNote")}</p>
    </div>
  );
}
