import { Badge, Card, CardTitle, fmtUsd } from "@/components/ui";
import type { Playbook } from "@/lib/business/types";

export function PlaybookView({ pb }: { pb: Playbook }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Objective &amp; baseline</CardTitle>
        <p className="text-sm">{pb.objective}</p>
        <p className="mt-2 text-sm text-ink-2"><strong>Baseline:</strong> {pb.baseline}</p>
      </Card>
      <Card>
        <CardTitle hint={pb.segment.label}>Target segment: why this audience?</CardTitle>
        <p className="text-sm">{pb.segment.rationale}</p>
        <ul className="mt-2 space-y-1 text-sm">{pb.segment.citations.map((c) => <li key={c.id} className="flex flex-wrap gap-2"><Badge tone="accent">{c.kind}</Badge><span>{c.name}{c.affinity !== undefined ? <span className="tabular text-muted"> · {c.affinity.toFixed(2)}</span> : null}</span></li>)}</ul>
      </Card>
      <Card>
        <CardTitle>Offering &amp; menu dependencies</CardTitle>
        <p className="text-sm">{pb.offering.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{pb.offering.menuDependencies.map((m) => <Badge key={m}>{m}</Badge>)}</div>
        <ul className="mt-3 grid gap-1 text-sm">{pb.offering.scenarios.map((s) => <li key={s.label} className="flex justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"><span>{s.label}</span><span className="tabular text-ink-2">{fmtUsd(Number(s.assumptions.salePrice), 2)} × {s.assumptions.incrementalUnits}/wk</span></li>)}</ul>
      </Card>
      <Card>
        <CardTitle hint="Eligibility and fees are tasks to verify, never assumed.">Channels</CardTitle>
        <ul className="space-y-2 text-sm">{pb.channels.map((c) => <li key={c.name}><div className="flex items-center gap-2"><span className="font-medium">{c.name}</span><Badge tone={c.status === "verified" ? "good" : "warn"}>{c.status.replace("_", " ")}</Badge></div><p className="text-ink-2">{c.task}</p></li>)}</ul>
      </Card>
      <Card>
        <CardTitle>Capacity &amp; logistics checklist</CardTitle>
        <ul className="space-y-1.5 text-sm">{pb.capacityChecklist.map((c) => <li key={c.item} className="flex items-start justify-between gap-3"><span>{c.item}</span><span className="shrink-0 text-xs text-muted">{c.owner} · {c.dueInDays}d</span></li>)}</ul>
      </Card>
      <Card>
        <CardTitle hint="Editable drafts. Nothing is posted without approval.">Marketing assets</CardTitle>
        <div className="space-y-2 text-sm">
          <div><div className="text-xs uppercase tracking-wide text-muted">Sample message</div><p>{pb.marketing.sampleMessage}</p></div>
          <div><div className="text-xs uppercase tracking-wide text-muted">Creative brief</div><p className="text-ink-2">{pb.marketing.creativeBrief}</p></div>
          <div><div className="text-xs uppercase tracking-wide text-muted">Posting draft</div><p className="rounded-md bg-surface-2 p-2">{pb.marketing.postingDraft}</p></div>
        </div>
      </Card>
      <Card>
        <CardTitle hint={`Budget cap ${fmtUsd(pb.budgetCapUsd)}`}>Risks &amp; stop conditions</CardTitle>
        <ul className="list-disc pl-4 text-sm text-ink-2">{pb.risks.map((r) => <li key={r}>{r}</li>)}</ul>
        <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Stop when</div>
        <ul className="list-disc pl-4 text-sm text-ink-2">{pb.stopConditions.map((r) => <li key={r}>{r}</li>)}</ul>
      </Card>
      <Card>
        <CardTitle>Success criteria &amp; measurement</CardTitle>
        <ul className="list-disc pl-4 text-sm">{pb.successCriteria.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="mt-2 text-sm text-ink-2">{pb.measurement.method}</p>
        <ul className="mt-1 list-disc pl-4 text-xs text-muted">{pb.measurement.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="mt-3 rounded-md bg-accent-soft p-2 text-sm text-accent-ink">{pb.approvalGate}</p>
      </Card>
    </div>
  );
}
