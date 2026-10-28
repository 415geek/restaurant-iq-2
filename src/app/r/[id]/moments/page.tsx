import { after } from "next/server";
import { DISPLAY_TZ } from "@/lib/display-tz";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { MomentsBoard, type MomentItem } from "@/components/moments/MomentsBoard";
import { getHypotheses, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getServiceClient } from "@/lib/db/server";
import { addDays, localToday, milesBetween, neighborhoodCenter, upcomingHolidays } from "@/lib/business/moments";
import { areaStatus, feedsForCity, isStale, readAreaEvents, refreshArea, SOURCE_LABEL, WINDOW_DAYS, type SourceStatus } from "@/lib/events-store";
import { getPublicHolidays } from "@/lib/providers/events/nager";
import { getT } from "@/i18n";

const HOLIDAY_DAYS = 105;
const KIND = { sf_street: "street", nyc_permits: "street", chicago_parks: "street", sf_our415: "community", web_google_events: "web" } as const;

export default async function MomentsPage({ params }: PageProps<"/r/[id]/moments">) {
  const { id } = await params; const base = `/r/${id}`;
  const [overview, run, { t, locale }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const today = localToday();
  const { city, neighborhood } = overview.profile;
  const { data: rr } = await getServiceClient().from("restaurants").select("region, country_code").eq("id", id).maybeSingle();

  // Rolling snapshot: first visit fills it inline from the free feeds; a stale snapshot refreshes after the response.
  let status = await areaStatus(city);
  const free = status.filter((s) => s.source !== "web_google_events");
  if (free.length && free.every((s) => s.state === "never")) { await refreshArea({ city, neighborhood }, { web: false }); status = await areaStatus(city); }
  else if (status.some(isStale)) after(() => refreshArea({ city, neighborhood }, { web: true }).then(() => undefined));

  const [hyps, stored, nager] = await Promise.all([
    run && run.status === "completed" ? getHypotheses(id, run.id) : Promise.resolve([]),
    readAreaEvents(city, today, addDays(today, WINDOW_DAYS)),
    getPublicHolidays([Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1], (rr?.country_code as string) || "US", (rr?.region as string) || null),
  ]);
  const live = hyps.filter((h) => h.status !== "rejected");
  const hid = (live.find((h) => h.slug === "cross-domain-partnership") ?? live[0])?.id ?? null;
  const center = neighborhoodCenter(neighborhood);
  const ours = upcomingHolidays(today, HOLIDAY_DAYS);
  const ourDates = new Set(ours.map((h) => h.date));
  const holidayEnd = addDays(today, HOLIDAY_DAYS);
  const items: MomentItem[] = [
    ...ours.map((h) => ({ id: `h-${h.id}-${h.date}`, kind: "holiday" as const, name: t(`moments.h.${h.id}`), date: h.date, theme: h.theme, where: t(`moments.scope.${h.scope}`), source: "calendar" })),
    ...nager.holidays.filter((h) => h.date >= today && h.date <= holidayEnd && !ourDates.has(h.date)).map((h) => ({ id: `n-${h.date}-${h.name}`, kind: "holiday" as const, name: h.name, date: h.date, theme: null, where: h.regional ? t("moments.scope.ca") : t("moments.scope.us"), source: "Nager.Date" })),
    ...stored.map((e) => ({
      id: e.id, kind: KIND[e.source], name: e.name, date: e.date, start: e.start, end: e.end, where: e.where, org: e.org, theme: e.theme, link: e.link,
      miles: center && e.lat !== undefined && e.lng !== undefined ? milesBetween(center, [e.lat, e.lng]) : undefined, source: SOURCE_LABEL[e.source],
    })),
  ];
  const labels = { signals: t("steps.signals"), recommend: t("steps.recommend"), execute: t("steps.execute"), prove: t("steps.prove") };
  const stamp = (iso?: string) => (iso ? new Date(iso).toLocaleString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  const dot = (s: SourceStatus) => (s.source === "web_google_events" ? "bg-ink-2" : s.source === "sf_our415" ? "bg-good" : "bg-navy");
  const line = (s: SourceStatus) => {
    if (s.state === "never") return t("moments.srcNever");
    if (s.state === "ok" || (s.state === "skipped" && s.lastOkAt)) return t("moments.srcOk", { n: s.count, at: stamp(s.lastOkAt ?? s.ranAt) });
    const e = s.errorClass ?? "error";
    if (e === "quota_exhausted") return <span className="font-semibold text-warn-ink">{t("moments.srcQuota")}</span>;
    if (e === "not_configured") return t("moments.srcWebOff");
    if (e === "daily_cap") return t("moments.srcDailyCap");
    return <span className="font-semibold text-bad">{t("moments.srcError", { e })}</span>;
  };
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
          <div><span className="inline-block h-2 w-2 rounded-full bg-coral" /> {t("moments.srcHolidays")} {nager.state === "ok" ? t("moments.srcNager") : <span className="text-bad">{t("moments.srcError", { e: `Nager.Date ${nager.errorClass}` })}</span>}</div>
          {feedsForCity(city).length === 0 ? <div>{t("moments.srcOtherCity", { city })}</div> : null}
          {status.map((s) => <div key={s.source} data-source={s.source}><span className={`inline-block h-2 w-2 rounded-full ${dot(s)}`} /> {SOURCE_LABEL[s.source]} · {line(s)}</div>)}
          <div>{t("moments.srcRolling", { days: WINDOW_DAYS })}</div>
          <div>{t("moments.srcNote")}</div>
        </div>
      </Card>
    </div>
  );
}
