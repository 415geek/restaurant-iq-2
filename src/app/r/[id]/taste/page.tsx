import { notFound } from "next/navigation";
import { Card, Empty } from "@/components/ui";
import { StepBar } from "@/components/shell/StepBar";
import { AttributesTile, AudienceTile, CompareRanking, CrossTile, PlacesTile } from "@/components/taste/TasteTiles";
import { AnchorCard } from "@/components/taste/AnchorCard";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { getHypotheses, getLatestEvidence, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getT } from "@/i18n";

export default async function TastePage({ params }: PageProps<"/r/[id]/taste">) {
  const { id } = await params;
  const [overview, run, { t }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const base = `/r/${id}`;
  const labels = { signals: t("steps.signals"), recommend: t("steps.recommend"), execute: t("steps.execute"), prove: t("steps.prove") };
  if (!run || run.status !== "completed") return <div className="grid gap-5"><StepBar current="signals" labels={labels} hrefs={{ snapshot: base }} /><Empty title={t("taste.emptyT")} body={t("taste.emptyB")} action={<RunAnalysisButton restaurantId={id} hasRun={!!run} />} /></div>;
  const [evidence, hypotheses] = await Promise.all([getLatestEvidence(id, run.startedAt), getHypotheses(id, run.id)]);
  const src = (type: string) => evidence.sources.find((s) => (s.requestParams["filter.type"] ?? "").includes(type));
  const partner = hypotheses.find((h) => h.slug === "cross-domain-partnership" && h.status !== "rejected");
  const failed = (run.steps.find((s) => s.agent === "EvidenceAgent")?.outputSummary.failures as string[] | undefined) ?? [];
  return (
    <div className="grid gap-5">
      <StepBar current="signals" labels={labels} hrefs={{ snapshot: base, choose: `${base}/opportunities`, act: `${base}/passes` }} />
      {failed.length ? <Card className="border-bad/30"><p className="text-[13px] text-bad">{t("taste.failed", { steps: failed.join(", ") })}</p></Card> : null}
      <AnchorCard restaurantId={id} city={overview.profile.city || "San Francisco"} passHref={partner ? `${base}/passes/new?h=${partner.id}` : null} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AttributesTile tags={evidence.tagAffinities} source={src("urn:tag")} />
        <AudienceTile demo={evidence.demographics} source={src("urn:demographics")} />
        <CrossTile items={evidence.crossDomain} source={evidence.sources.find((s) => (s.requestParams["filter.type"] ?? "").includes("brand"))} />
        <PlacesTile places={evidence.localPlaces} source={src("urn:entity:place")} />
      </div>
      <CompareRanking hypotheses={hypotheses} base={base} mode={evidence.mode} />
    </div>
  );
}
