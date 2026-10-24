import { notFound } from "next/navigation";
import { Card, CardTitle, Empty } from "@/components/ui";
import { HypothesisCard } from "@/components/opportunity/HypothesisCard";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { getHypotheses, getLatestRun, getRestaurantOverview } from "@/lib/queries";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ params }: PageProps<"/r/[id]/opportunities">) {
  const { id } = await params;
  const [overview, run] = await Promise.all([getRestaurantOverview(id), getLatestRun(id)]);
  if (!overview) notFound();
  if (!run || run.status !== "completed") {
    return <Empty title="No opportunities yet" body="Run an analysis first. The engine returns up to three viable hypotheses and lists what it rejected, with reasons." action={<RunAnalysisButton restaurantId={id} hasRun={!!run} />} />;
  }
  const hs = await getHypotheses(id, run.id);
  const viable = hs.filter((h) => h.evidenceLabel !== "not_recommended").slice(0, 3);
  const rest = hs.filter((h) => !viable.includes(h));
  const summary = run.summary as { noViable?: boolean };
  return (
    <div className="grid gap-4">
      {summary.noViable ? (
        <Card className="border-warn/40">
          <CardTitle hint="Nothing passed the operational, evidence and economic screens. This is a valid outcome.">No viable opportunity</CardTitle>
          <p className="text-sm text-ink-2">Revisit the stated constraints, add menu costs, or connect live Qloo, then re-run. The rejected list below explains each screen that failed.</p>
        </Card>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Ranked hypotheses</h2>
            <p className="text-sm text-muted">{viable.length} viable of {hs.length} screened · these are hypotheses to test, not asserted opportunities.</p>
          </div>
          <RunAnalysisButton restaurantId={id} hasRun />
        </div>
      )}
      <div className="grid gap-3">{viable.map((h) => <HypothesisCard key={h.id} h={h} base={`/r/${id}`} />)}</div>
      {rest.length ? (
        <details className="card p-4" open={summary.noViable}>
          <summary className="cursor-pointer text-sm font-medium">Screened out or lower ranked ({rest.length})</summary>
          <div className="mt-3 grid gap-3">{rest.map((h) => <HypothesisCard key={h.id} h={h} base={`/r/${id}`} />)}</div>
        </details>
      ) : null}
    </div>
  );
}
