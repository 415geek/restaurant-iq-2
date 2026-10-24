import { Badge, Card, CardTitle, Empty, fmtDate } from "@/components/ui";
import { SnapshotCard } from "@/components/restaurant/SnapshotCard";
import { TrustPanel } from "@/components/evidence/TrustPanel";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { getLatestEvidence, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function SnapshotPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const [overview, run] = await Promise.all([getRestaurantOverview(id), getLatestRun(id)]);
  if (!overview) notFound();
  const evidence = await getLatestEvidence(id, run?.startedAt ?? null);
  const p = overview.profile;
  const ca = p.costAssumptions;
  const assumptions = [
    `Average ticket ${ca.avg_ticket ? `$${ca.avg_ticket}` : "unknown"}`,
    `Food cost ${ca.food_cost_pct ? `${Math.round(ca.food_cost_pct * 100)}%` : "unknown"}`,
    `Labor $${ca.labor_cost_per_hour ?? 22}/hour`,
    `Delivery commission ${Math.round((ca.delivery_commission_pct ?? 0.25) * 100)}%`,
    `Card fee ${((ca.card_fee_pct ?? 0.029) * 100).toFixed(1)}%`,
  ];
  const unknowns = [
    overview.menu.some((m) => !m.foodCost) ? "Food cost missing for some menu items" : null,
    !p.hoursSummary ? "Operating hours not provided" : null,
    "Actual daypart sales (no POS connected)",
    "Channel eligibility and fees (not verified)",
  ].filter((x): x is string => !!x);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="grid gap-4">
        <SnapshotCard overview={overview} />
        <Card>
          <CardTitle hint="Bounded six-agent workflow with per-step budgets, timeouts and a trace id.">Analysis run</CardTitle>
          {run ? (
            <div className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={run.status === "completed" ? "good" : run.status === "failed" ? "bad" : "neutral"}>{run.status}</Badge>
                <span className="text-muted">{fmtDate(run.finishedAt ?? run.startedAt)} · mode {run.mode} · trace <span className="font-mono">{run.traceId.slice(0, 8)}</span></span>
                {run.errorClass ? <Badge tone="bad">{run.errorClass}</Badge> : null}
              </div>
              <ol className="mt-3 grid gap-1 sm:grid-cols-2">
                {run.steps.map((s) => (
                  <li key={s.seq} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                    <span className="flex items-center gap-2"><span className="font-mono text-xs text-muted">{s.seq}</span>{s.agent}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">{s.toolCalls ? `${s.toolCalls} call${s.toolCalls === 1 ? "" : "s"}` : null}<Badge tone={s.status === "succeeded" ? "good" : s.status === "failed" ? "bad" : "neutral"}>{s.status}</Badge></span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <RunAnalysisButton restaurantId={id} hasRun />
                <Link href={`/r/${id}/opportunities`} className="text-sm text-accent-ink underline">View ranked opportunities →</Link>
              </div>
            </div>
          ) : (
            <Empty title="No analysis yet" body="Run the bounded agent workflow: intake → Qloo evidence → opportunities → finance → execution → evaluator." action={<RunAnalysisButton restaurantId={id} hasRun={false} />} />
          )}
        </Card>
      </div>
      <TrustPanel evidence={evidence} run={run} assumptions={assumptions} unknowns={unknowns} />
    </div>
  );
}
