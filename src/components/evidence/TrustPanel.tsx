import { Badge, Card, CardTitle, ModeBadge, fmtDate } from "@/components/ui";
import type { EvidenceView, RunView } from "@/lib/queries";

export function TrustPanel({ evidence, run, assumptions, unknowns }: { evidence: EvidenceView; run: RunView | null; assumptions: string[]; unknowns: string[] }) {
  return (
    <Card>
      <CardTitle hint="What the system knows, assumes, and does not know." right={<ModeBadge mode={evidence.mode ?? run?.mode ?? null} />}>Trust &amp; data</CardTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Sources ({evidence.sources.length})</h3>
          {evidence.sources.length === 0 ? <p className="text-sm text-muted">No evidence yet. Run an analysis.</p> : (
            <ul className="space-y-1.5 text-sm">
              {evidence.sources.slice(0, 6).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-xs">{s.provider} {s.endpoint}</span>
                  <Badge tone={s.mode === "live" ? "good" : "warn"}>{s.mode}</Badge>
                  <Badge tone={s.fresh ? "neutral" : "bad"}>{s.fresh ? `fresh · ${fmtDate(s.retrievedAt)}` : "stale"}</Badge>
                  {s.citationUrl ? <a className="text-xs text-accent-ink underline" href={s.citationUrl} target="_blank" rel="noreferrer">docs</a> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Provider state</h3>
          <ul className="space-y-1 text-sm">
            <li>Qloo: {evidence.mode === "live" ? "connected (live)" : "not connected — sample fixtures"}</li>
            <li>POS: <Badge tone="muted">Planned / not connected</Badge></li>
            <li>Last run: {run ? `${run.status} · ${fmtDate(run.finishedAt ?? run.startedAt)} · trace ${run.traceId.slice(0, 8)}` : "none"}</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Assumptions (editable in Decision Lab)</h3>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-ink-2">{assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Unknowns</h3>
          {unknowns.length ? <ul className="list-disc space-y-0.5 pl-4 text-sm text-ink-2">{unknowns.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="text-sm text-muted">No gaps flagged.</p>}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Affinity is Qloo&apos;s 0–1 measure of how closely two things are connected. It is not demand, sales, foot traffic or market share.</p>
    </Card>
  );
}
