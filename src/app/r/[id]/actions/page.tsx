import { notFound } from "next/navigation";
import { Button, Empty } from "@/components/ui";
import { StepBar } from "@/components/shell/StepBar";
import { ActionBoard } from "@/components/actions/ActionBoard";
import { getActions, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getT } from "@/i18n";
import { KpiTile, StackedBar } from "@/components/charts";

export default async function ActionsPage({ params }: PageProps<"/r/[id]/actions">) {
  const { id } = await params;
  const [overview, run, { t }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  const actions = await getActions(id, run?.id ?? null);
  if (!overview) notFound();
  const base = `/r/${id}`;
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act") };
  return (
    <div className="grid gap-5">
      <StepBar current="act" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities` }} />
      <div><h2 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("actions.title")}</h2><p className="mt-1 text-[14.5px] text-ink-2">{t("actions.hint")}</p></div>
      {actions.length ? (<div className="grid gap-4 sm:grid-cols-3"><KpiTile label={t("actions.kpiOpen")} value={actions.filter((a) => ["draft", "ready", "in_progress"].includes(a.status)).length} /><KpiTile label={t("actions.kpiApproval")} value={actions.filter((a) => a.status === "needs_approval").length} accent="coral" /><KpiTile label={t("actions.progress")} value={`${Math.round((actions.filter((a) => a.status === "completed").length / actions.length) * 100)}%`} sub={t("actions.kpiDone")} visual={<StackedBar segments={(["draft", "needs_approval", "ready", "in_progress", "completed"] as const).map((k, i) => ({ label: t(`actions.cols.${k}`), value: actions.filter((a) => a.status === k).length, color: ["#9CA3AF", "var(--coral)", "#3B82F6", "#D4A843", "#10B981"][i] })).filter((s) => s.value > 0)} />} /></div>) : null}
      {actions.length ? <ActionBoard actions={actions} /> : <Empty title={t("actions.emptyT")} body={t("actions.emptyB")} action={<Button href={base} variant="secondary">{t("nav.snapshot")}</Button>} />}
    </div>
  );
}
