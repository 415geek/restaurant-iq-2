import Link from "next/link";
import { Badge, Card, EvidenceBadge, fmtUsd } from "@/components/ui";
import { computeScenario } from "@/lib/business/margin";
import type { HypothesisView } from "@/lib/queries";

export function HypothesisCard({ h, base }: { h: HypothesisView; base: string }) {
  const econ = computeScenario(h.defaultScenario);
  const rejected = h.evidenceLabel === "not_recommended";
  return (
    <Card as="article" className={rejected ? "opacity-90" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">#{h.rank}</span>
            <h3 className="text-lg font-semibold leading-6"><Link href={`${base}/opportunities/${h.id}`} className="hover:underline">{h.title}</Link></h3>
          </div>
          <p className="mt-0.5 text-sm text-ink-2">{h.segment}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <EvidenceBadge label={h.evidenceLabel} />
          {h.status !== "proposed" ? <Badge tone={h.status === "pursued" ? "good" : "muted"}>{h.status}</Badge> : null}
        </div>
      </div>
      <p className="mt-3 text-sm">{h.summary}</p>
      {rejected ? (
        <div className="mt-3 rounded-lg bg-bad-soft/60 p-3 text-sm">
          <div className="font-medium text-bad">Why not</div>
          <ul className="mt-1 list-disc pl-4 text-ink-2">{[...h.disqualifiers, ...h.reasonsToAvoid.slice(0, 2), ...(h.citations.length ? [] : ["No Qloo signal supports this hypothesis"])].slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Qloo signals</div>
            <ul className="mt-1 space-y-0.5 text-sm">{h.citations.slice(0, 3).map((c) => <li key={c.id} className="truncate">{c.name}{c.affinity !== undefined ? <span className="tabular text-muted"> · {c.affinity.toFixed(2)}</span> : null}</li>)}</ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Default economics ({h.defaultScenario.periodLabel ?? "per week"})</div>
            <div className={`tabular mt-1 text-lg font-semibold ${econ.adjustedIncrementalProfit >= 0 ? "text-good" : "text-bad"}`}>{fmtUsd(econ.adjustedIncrementalProfit)}</div>
            <div className="text-xs text-muted">adjusted contribution · CM {econ.contributionMarginPct ?? "—"}% · break-even {econ.breakEvenUnits ?? "n/a"} units</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Missing evidence</div>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-2">{(h.missingEvidence.length ? h.missingEvidence : ["—"]).slice(0, 3).map((m) => <li key={m} className="truncate">{m}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{h.qlooDelta.explanation}</span>
        <Link href={`${base}/opportunities/${h.id}`} className="text-accent-ink underline">Open workspace →</Link>
      </div>
    </Card>
  );
}
