import { notFound } from "next/navigation";
import { Card, Empty, H2 } from "@/components/ui";
import { Timeline } from "@/components/memory/Timeline";
import { getDecisionEvents, getRestaurantOverview } from "@/lib/queries";
import { getT } from "@/i18n";

export default async function MemoryPage({ params }: PageProps<"/r/[id]/memory">) {
  const { id } = await params;
  const [overview, events, { t }] = await Promise.all([getRestaurantOverview(id), getDecisionEvents(id), getT()]);
  if (!overview) notFound();
  return (
    <div className="grid gap-5">
      <div><h2 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("memory.title")}</h2><p className="mt-1 text-[14.5px] text-ink-2">{t("memory.hint")}</p></div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>{events.length ? <Timeline events={events} /> : <Empty title={t("memory.emptyT")} body={t("memory.emptyB")} />}</Card>
        <Card className="self-start"><H2>{t("memory.whyT")}</H2><p className="text-[14px] text-ink-2">{t("memory.whyB")}</p></Card>
      </div>
    </div>
  );
}
