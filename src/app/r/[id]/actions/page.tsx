import { notFound } from "next/navigation";
import { Button, Empty } from "@/components/ui";
import { StepBar } from "@/components/shell/StepBar";
import { ActionBoard } from "@/components/actions/ActionBoard";
import { getActions, getRestaurantOverview } from "@/lib/queries";
import { getT } from "@/i18n";

export default async function ActionsPage({ params }: PageProps<"/r/[id]/actions">) {
  const { id } = await params;
  const [overview, actions, { t }] = await Promise.all([getRestaurantOverview(id), getActions(id), getT()]);
  if (!overview) notFound();
  const base = `/r/${id}`;
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act") };
  return (
    <div className="grid gap-5">
      <StepBar current="act" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities` }} />
      <div><h2 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("actions.title")}</h2><p className="mt-1 text-[14.5px] text-ink-2">{t("actions.hint")}</p></div>
      {actions.length ? <ActionBoard actions={actions} /> : <Empty title={t("actions.emptyT")} body={t("actions.emptyB")} action={<Button href={base} variant="secondary">{t("nav.snapshot")}</Button>} />}
    </div>
  );
}
