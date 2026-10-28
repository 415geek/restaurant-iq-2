import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { MomentsBoard, type MomentItem } from "@/components/moments/MomentsBoard";
import { getHypotheses, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { addDays, isSanFrancisco, localToday, neighborhoodCenter, SF_CENTER, upcomingHolidays } from "@/lib/business/moments";
import { getCommunityEvents, getStreetEvents, type EventsResult } from "@/lib/providers/events/sf-open-data";
import { getT } from "@/i18n";

const HOLIDAY_DAYS = 105;
const EVENT_DAYS = 45;

export default async function MomentsPage({ params }: PageProps<"/r/[id]/moments">) {
  const { id } = await params; const base = `/r/${id}`;
  const [overview, run, { t, locale }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const today = localToday();
  const hyps = run && run.status === "completed" ? await getHypotheses(id, run.id) : [];
  const live = hyps.filter((h) => h.status !== "rejected");
  const hid = (live.find((h) => h.slug === "cross-domain-partnership") ?? live[0])?.id ?? null;
  const { city, neighborhood } = overview.profile;
  const sf = isSanFrancisco(city);
  const center = sf ? neighborhoodCenter(neighborhood) : null;
  const [street, community]: [EventsResult | null, EventsResult | null] = sf
    ? await Promise.all([getStreetEvents(today, addDays(today, EVENT_DAYS), center ?? SF_CENTER), getCommunityEvents(today, addDays(today, EVENT_DAYS), center ?? SF_CENTER)])
    : [null, null];
  const items: MomentItem[] = [
    ...upcomingHolidays(today, HOLIDAY_DAYS).map((h) => ({ id: `h-${h.id}-${h.date}`, kind: "holiday" as const, name: t(`moments.h.${h.id}`), date: h.date, theme: h.theme, where: t(`moments.scope.${h.scope}`), source: "calendar" })),
    ...(street?.events ?? []).map((e) => ({ ...e, source: `DataSF ${street!.datasetId}` })),
    ...(community?.events ?? []).map((e) => ({ ...e, source: `DataSF ${community!.datasetId}` })),
  ];
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act"), prove: t("steps.prove") };
  const stamp = (r: EventsResult) => new Date(r.retrievedAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="grid gap-5">
      <StepBar current="signals" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities`, act: `${base}/passes` }} />
      <div>
        <h2 className="flex items-center gap-2 text-[26px] font-extrabold tracking-[-0.02em]"><Icon.calendar width={26} height={26} className="text-coral" />{t("moments.title")}</h2>
        <p className="mt-1 max-w-3xl text-[14.5px] text-ink-2">{t("moments.hint", { place: neighborhood || city })}</p>
      </div>
      <MomentsBoard restaurantId={id} base={base} hid={hid} today={today} items={items} neighborhood={neighborhood || city} hasGeo={!!center} />
      <Card>
        <div className="grid gap-1.5 text-[12.5px] text-ink-2" data-testid="moments-sources">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("moments.sourcesT")}</div>
          <div><span className="inline-block h-2 w-2 rounded-full bg-coral" /> {t("moments.srcHolidays")}</div>
          {sf ? [street!, community!].map((r) => (
            <div key={r.datasetId}>
              <span className={`inline-block h-2 w-2 rounded-full ${r.datasetId === "v9cz-kk5i" ? "bg-navy" : "bg-good"}`} /> {r.source} · {r.state === "ok" ? t("moments.srcOk", { n: r.total, at: stamp(r) }) : <span className="font-semibold text-bad">{t("moments.srcError", { e: r.errorClass ?? "error" })}</span>}
            </div>
          )) : <div>{t("moments.srcOtherCity", { city })}</div>}
          <div>{t("moments.srcNote")}</div>
        </div>
      </Card>
    </div>
  );
}
