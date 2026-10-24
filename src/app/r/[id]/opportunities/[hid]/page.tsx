import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Bar, Card, CardTitle, EvidenceBadge, fmtDate, fmtUsd } from "@/components/ui";
import { DecisionLab } from "@/components/opportunity/DecisionLab";
import { DecideButtons } from "@/components/opportunity/DecideButtons";
import { PlaybookView } from "@/components/opportunity/PlaybookView";
import { getHypothesis, getLatestEvidence } from "@/lib/queries";

export const metadata = { title: "Opportunity workspace" };

export default async function HypothesisPage({ params }: PageProps<"/r/[id]/opportunities/[hid]">) {
  const { id, hid } = await params;
  const data = await getHypothesis(hid);
  if (!data || data.restaurantId !== id) notFound();
  const { hypothesis: h, scenarios } = data;
  const evidence = await getLatestEvidence(id);
  const sources = evidence.sources.filter((s) => h.evidenceSourceIds.includes(s.id));
  return (
    <div className="grid gap-4">
      <div>
        <Link href={`/r/${id}/opportunities`} className="text-sm text-accent-ink underline">← All opportunities</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{h.title}</h2>
          <EvidenceBadge label={h.evidenceLabel} />
          <Badge tone="neutral">rank #{h.rank} · baseline #{h.baselineRank}</Badge>
        </div>
        <p className="mt-1 text-ink-2">{h.summary}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardTitle hint="Which returned Qloo signal changed this recommendation versus the generic baseline.">How Qloo changed the recommendation</CardTitle>
          <p className="text-sm">{h.qlooDelta.explanation}</p>
          <ul className="mt-3 space-y-2">
            {h.citations.length === 0 ? <li className="text-sm text-muted">No Qloo signal supports this hypothesis.</li> : h.citations.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{c.kind}</Badge><span className="font-medium">{c.name}</span>{c.affinity !== undefined ? <span className="tabular text-muted">affinity {c.affinity.toFixed(2)}</span> : null}</div>
                <p className="mt-1 text-ink-2">{c.note}</p>
                <p className="mt-1 font-mono text-[11px] text-muted">source {c.sourceId.slice(0, 8)}{sources.find((s) => s.id === c.sourceId) ? ` · ${sources.find((s) => s.id === c.sourceId)!.endpoint} · ${sources.find((s) => s.id === c.sourceId)!.mode} · ${fmtDate(sources.find((s) => s.id === c.sourceId)!.retrievedAt)}` : ""}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle hint="Labeled dimensions, weighted. No invented probabilities.">Score breakdown</CardTitle>
          <Bar label={`Taste / audience fit (w ${h.score.weights.tasteFit})`} value={h.score.tasteFit} />
          <Bar label={`Operational fit (w ${h.score.weights.operationalFit})`} value={h.score.operationalFit} />
          <Bar label={`External feasibility (w ${h.score.weights.feasibility})`} value={h.score.feasibility} />
          <Bar label={`Economics (w ${h.score.weights.economics})`} value={h.score.economics} />
          <Bar label={`Evidence quality (w ${h.score.weights.evidenceQuality})`} value={h.score.evidenceQuality} />
          <div className="mt-2 flex items-center justify-between text-sm"><span className="font-medium">Composite</span><span className="tabular">{h.score.composite.toFixed(3)} <span className="text-muted">(baseline {h.baselineScore.composite.toFixed(3)})</span></span></div>
          {h.disqualifiers.length ? <div className="mt-3 rounded-md bg-bad-soft/60 p-2 text-sm"><strong className="text-bad">Disqualified:</strong> {h.disqualifiers.join("; ")}</div> : null}
          {h.score.notes.length ? <ul className="mt-2 list-disc pl-4 text-xs text-muted">{h.score.notes.slice(0, 5).map((n) => <li key={n}>{n}</li>)}</ul> : null}
          {h.missingEvidence.length ? <p className="mt-2 text-xs text-muted"><strong>Missing:</strong> {h.missingEvidence.join("; ")}</p> : null}
        </Card>
      </div>

      <Card>
        <CardTitle hint="Adjust assumptions; contribution margin, break-even and sensitivity recompute deterministically.">Decision Lab</CardTitle>
        <DecisionLab hypothesisId={h.id} initial={h.defaultScenario} canSave />
        {scenarios.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Saved scenarios</div>
            <ul className="mt-1 divide-y divide-border text-sm">{scenarios.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{s.label} <span className="text-muted">· {fmtDate(s.createdAt)}</span></span><span className={`tabular ${s.results.adjustedIncrementalProfit >= 0 ? "text-good" : "text-bad"}`}>{fmtUsd(s.results.adjustedIncrementalProfit)} / wk · {s.assumptions.incrementalUnits} units @ {fmtUsd(Number(s.assumptions.salePrice), 2)}</span></li>)}</ul>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle hint="Pursuing creates nothing external. Tasks with side effects wait for approval on the Action board.">Decision</CardTitle>
        <DecideButtons hypothesisId={h.id} status={h.status} />
        {h.reasonsToAvoid.length ? <div className="mt-3 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-muted">Reasons to avoid</div><ul className="list-disc pl-4 text-ink-2">{h.reasonsToAvoid.map((r) => <li key={r}>{r}</li>)}</ul></div> : null}
      </Card>

      <h3 className="mt-2 text-xl font-semibold">Opportunity playbook</h3>
      <PlaybookView pb={h.playbook} />
      <p className="text-sm"><Link href={`/r/${id}/actions`} className="text-accent-ink underline">Open the Action board →</Link></p>
    </div>
  );
}
