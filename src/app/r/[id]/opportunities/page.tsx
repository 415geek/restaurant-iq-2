import { notFound } from "next/navigation";
import { Empty } from "@/components/ui";
import { StepBar } from "@/components/shell/StepBar";
import { Deck } from "@/components/opportunity/Deck";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { getHypotheses, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getT } from "@/i18n";

export default async function OpportunitiesPage({ params }: PageProps<"/r/[id]/opportunities">) {
  const { id } = await params;
  const [overview, run, { t }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const base = `/r/${id}`;
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act"), prove: t("steps.prove") };
  if (!run || run.status !== "completed") return <div className="grid gap-5"><StepBar current="choose" labels={labels} hrefs={{ snapshot: base }} /><Empty title={t("taste.emptyT")} body={t("taste.emptyB")} action={<RunAnalysisButton restaurantId={id} hasRun={!!run} />} /></div>;
  const hs = await getHypotheses(id, run.id);
  const viable = hs.filter((h) => h.evidenceLabel !== "not_recommended").slice(0, 3);
  const rest = hs.filter((h) => !viable.includes(h));
  return (
    <div className="grid gap-5">
      <StepBar current="choose" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, act: `${base}/passes` }} />
      <Deck viable={viable} rest={rest} base={base} noViable={viable.length === 0} total={hs.length} />
      <div className="flex justify-end"><RunAnalysisButton restaurantId={id} hasRun /></div>
    </div>
  );
}
