import { notFound } from "next/navigation";
import { Card, CardTitle, Empty } from "@/components/ui";
import { CrossDomainCard, DemographicsCard, LocalPlacesCard, TagAffinityCard } from "@/components/taste/TasteViews";
import { CompareToggle } from "@/components/opportunity/CompareToggle";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { getHypotheses, getLatestEvidence, getLatestRun, getRestaurantOverview } from "@/lib/queries";

export const metadata = { title: "Taste signals" };

export default async function TastePage({ params }: PageProps<"/r/[id]/taste">) {
  const { id } = await params;
  const [overview, run] = await Promise.all([getRestaurantOverview(id), getLatestRun(id)]);
  if (!overview) notFound();
  if (!run || run.status !== "completed") {
    return <Empty title="No taste evidence yet" body="Run an analysis to fetch Qloo signals (or the labeled sample fixture when no key is configured)." action={<RunAnalysisButton restaurantId={id} hasRun={!!run} />} />;
  }
  const [evidence, hypotheses] = await Promise.all([getLatestEvidence(id, run.startedAt), getHypotheses(id, run.id)]);
  const src = (endpointType: string) => evidence.sources.find((s) => (s.requestParams["filter.type"] ?? "").includes(endpointType) || (endpointType === "tags-endpoint" && s.endpoint === "/v2/tags"));
  const failed = (run.steps.find((s) => s.agent === "EvidenceAgent")?.outputSummary.failures as string[] | undefined) ?? [];
  return (
    <div className="grid gap-4">
      {failed.length ? <Card className="border-bad/30"><p className="text-sm text-bad">Some evidence steps failed and were not substituted: {failed.join(", ")}.</p></Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <TagAffinityCard tags={evidence.tagAffinities} source={src("urn:tag")} mode={evidence.mode} />
        <DemographicsCard demo={evidence.demographics} source={src("urn:demographics")} mode={evidence.mode} />
        <CrossDomainCard items={evidence.crossDomain} source={evidence.sources.find((s) => (s.requestParams["filter.type"] ?? "").includes("brand") || (s.requestParams["filter.type"] ?? "").includes("|"))} mode={evidence.mode} />
        <LocalPlacesCard places={evidence.localPlaces} source={src("urn:entity:place")} mode={evidence.mode} />
      </div>
      <Card>
        <CardTitle hint="Same hypothesis catalog, two rankings. The toggle shows exactly which returned signal moved each recommendation.">With Qloo vs without Qloo</CardTitle>
        <CompareToggle hypotheses={hypotheses} base={`/r/${id}`} mode={evidence.mode} />
      </Card>
    </div>
  );
}
