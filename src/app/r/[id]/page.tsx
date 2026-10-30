import { after } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Chip, H2, cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { RunAnalysisButton } from "@/components/demo/RunAnalysisButton";
import { RadarPlays, type PlayCard } from "@/components/radar/RadarPlays";
import { computeScenario } from "@/lib/business/margin";
import { getHypotheses, getLatestEvidence, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getCampaignsForRestaurant, getCampaignStats } from "@/lib/campaigns";
import { listMemories } from "@/lib/brain";
import { loadSales, RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { getSsrClient } from "@/lib/db/ssr";
import { getServiceClient } from "@/lib/db/server";
import { reviewExperiment } from "@/lib/business/experiment";
import { addDays, localToday, milesBetween, neighborhoodCenter, upcomingHolidays } from "@/lib/business/moments";
import { areaStatus, isStale, readAreaEvents, refreshArea, SOURCE_LABEL, WINDOW_DAYS } from "@/lib/events-store";
import { getPublicHolidays } from "@/lib/providers/events/nager";
import { buildPlays, NEAR_MILES, outsideCauses, schoolBreakAhead, weeklyPulse, type HolidayScope, type RadarMoment } from "@/lib/business/radar";
import { DISPLAY_TZ } from "@/lib/display-tz";
import { getT } from "@/i18n";

const DAYS = 21; const CAUSE_DAYS = 14;
const KIND = { sf_street: "street", nyc_permits: "street", chicago_parks: "street", sf_our415: "community", web_google_events: "web" } as const;
const AGENTS = ["IntakeAgent", "EvidenceAgent", "OpportunityAgent", "FinanceAgent", "ExecutionAgent", "Evaluator"] as const;

/** Radar: the owner's home screen. What is happening around the store, why the week may be slow or busy, and the plays the agents costed for it. */
export default async function RadarPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params; const base = `/r/${id}`;
  const [overview, run, { t, locale }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getT()]);
  if (!overview) notFound();
  const p = overview.profile; const done = run?.status === "completed";
  const today = localToday(); const place = p.neighborhood || p.city;
  const sdb = getServiceClient();
  const { data: rr } = await sdb.from("restaurants").select("region, country_code").eq("id", id).maybeSingle();

  let status = await areaStatus(p.city);
  const free = status.filter((s) => s.source !== "web_google_events");
  if (free.length && free.every((s) => s.state === "never")) { await refreshArea({ city: p.city, neighborhood: p.neighborhood }, { web: false }); status = await areaStatus(p.city); }
  else if (status.some(isStale)) after(() => refreshArea({ city: p.city, neighborhood: p.neighborhood }, { web: true }).then(() => undefined));

  const ssr = await getSsrClient();
  const [hyps, stored, nager, sales, campaigns, memories, evidence] = await Promise.all([
    done ? getHypotheses(id, run!.id) : Promise.resolve([]),
    readAreaEvents(p.city, today, addDays(today, WINDOW_DAYS)),
    getPublicHolidays([Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1], (rr?.country_code as string) || "US", (rr?.region as string) || null),
    loadSales(ssr, id).catch(() => []),
    getCampaignsForRestaurant(id).catch(() => []),
    listMemories(id, 50).catch(() => []),
    done ? getLatestEvidence(id, run!.startedAt) : Promise.resolve(null),
  ]);

  const center = neighborhoodCenter(p.neighborhood);
  const ours = upcomingHolidays(today, WINDOW_DAYS); const ourDates = new Set(ours.map((h) => h.date)); const hEnd = addDays(today, WINDOW_DAYS);
  const moments: RadarMoment[] = [
    ...ours.map((h) => ({ id: `h-${h.id}-${h.date}`, kind: "holiday" as const, name: t(`moments.h.${h.id}`), date: h.date, theme: h.theme, scope: h.scope, source: "calendar" })),
    ...nager.holidays.filter((h) => h.date >= today && h.date <= hEnd && !ourDates.has(h.date)).map((h) => ({ id: `n-${h.date}`, kind: "holiday" as const, name: h.name, date: h.date, theme: null, scope: (h.regional ? "ca" : "us") as HolidayScope, source: "Nager.Date" })),
    ...stored.map((e) => ({ id: e.id, kind: KIND[e.source], name: e.name, date: e.date, end: e.end, theme: e.theme, miles: center && e.lat !== undefined && e.lng !== undefined ? milesBetween(center, [e.lat, e.lng]) : undefined, source: SOURCE_LABEL[e.source], link: e.link })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const soon = moments.filter((m) => m.date <= addDays(today, CAUSE_DAYS) && (m.kind === "holiday" || m.miles === undefined || m.miles <= NEAR_MILES));
  const brk = schoolBreakAhead(today, DAYS);
  const causes = outsideCauses(moments, brk, today, CAUSE_DAYS);
  const pulse = weeklyPulse(sales, today, RESTAURANT_TZ);

  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const stamp = (iso: string) => new Date(iso).toLocaleString(locale, { timeZone: DISPLAY_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;

  const plays: PlayCard[] = buildPlays(moments, hyps.map((h) => ({ id: h.id, slug: h.slug, rank: h.rank, evidenceLabel: h.evidenceLabel, status: h.status })), today, DAYS, 4).map((pl) => {
    const h = hyps.find((x) => x.id === pl.hypothesisId)!;
    const cite = [...h.citations].filter((c) => c.kind !== "demographic").sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))[0] ?? h.citations[0] ?? null;
    const m = pl.moment;
    const q = m ? `&mk=${m.kind}&mn=${encodeURIComponent(m.name.slice(0, 90))}&md=${m.date}${m.theme ? `&mt=${m.theme}` : ""}&ms=${encodeURIComponent(m.source.slice(0, 80))}` : "";
    return {
      id: pl.id, hypothesisId: h.id, slug: h.slug, title: t(`hyp.${h.slug}.title`), moment: m, outlook: pl.outlook, matched: pl.matched,
      menuItem: h.playbook?.offering?.menuDependencies?.[0] ?? overview.menu.find((x) => x.isSignature)?.name ?? null,
      contribution: h.defaultScenario ? computeScenario(h.defaultScenario).adjustedIncrementalProfit : null,
      audience: cite ? { name: cite.name, affinity: cite.affinity } : null,
      href: `${base}/passes/new?h=${h.id}${q}`, ideaHref: `${base}/opportunities/${h.id}`,
    };
  });

  const ended = campaigns.filter((c) => c.status === "ended").slice(0, 3);
  const learned = await Promise.all(ended.map(async (c) => {
    const stats = await getCampaignStats(c.id).catch(() => null);
    const r = reviewExperiment({ rows: sales, startsAt: c.startsAt, endsAt: c.endsAt, menuItem: c.menuItem, redeemed: stats?.redeemed ?? 0, tz: RESTAURANT_TZ });
    const pos = r.status === "ready" ? r.metrics.find((m) => m.key === "netSales")?.position ?? null : null;
    return { c, redeemed: stats?.redeemed ?? 0, verdict: pos ?? ("pending" as const) };
  }));
  const tags = (evidence?.tagAffinities ?? []).filter((x) => x.affinity !== undefined).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 6);
  const steps = run?.steps ?? [];
  const labels = { signals: t("steps.signals"), recommend: t("steps.recommend"), execute: t("steps.execute"), prove: t("steps.prove") };
  const dirCls = { up: "bg-good-soft text-good-ink", down: "bg-bad-soft text-bad", mixed: "bg-warn-soft text-warn-ink" } as const;
  const causeRow = (c: (typeof causes)[number]) => <li key={c.key} className={cx("flex items-start gap-2 rounded-xl px-3 py-2 text-[13.5px]", dirCls[c.direction])}><span className="font-extrabold">{c.direction === "up" ? "↑" : c.direction === "down" ? "↓" : "↕"}</span><span>{t(`radar.cause.${c.key}`, { detail: c.key.startsWith("school") ? t(`radar.breaks.${c.detail}`) : c.detail, date: c.date ? date(c.date) : "", n: c.n ?? 0 })}</span></li>;
  const okSteps = steps.filter((x) => x.status === "succeeded").length;
  const agentPills = (<>
          {AGENTS.map((a, i) => { const s = steps.find((x) => x.agent === a); const st = s?.status === "succeeded" ? "ok" : s?.status === "failed" ? "bad" : "todo"; return (
            <span key={a} className={cx("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold", st === "ok" ? "border-border bg-surface text-good-ink" : st === "bad" ? "border-bad/40 bg-bad-soft text-bad" : "border-border bg-surface text-muted")} title={s ? `${s.status}` : ""}>
              <span className={cx("grid h-4 w-4 place-items-center rounded-full text-[10px]", st === "ok" ? "bg-good-soft" : st === "bad" ? "bg-white/60" : "bg-surface-2")}>{st === "ok" ? <Icon.check width={10} height={10} /> : i + 1}</span>{t(`radar.agent.${a}`)}
            </span>); })}
  </>);

  return (
    <div className="grid gap-5">
      <div className="hidden sm:block"><StepBar current="snapshot" labels={labels} hrefs={done ? { signals: `${base}/taste`, choose: `${base}/opportunities`, act: `${base}/passes` } : {}} /></div>
      <div>
        <h2 className="flex items-center gap-2 text-[21px] font-extrabold tracking-[-0.02em] sm:text-[24px]"><Icon.signals width={24} height={24} className="text-coral" />{t("radar.around", { place })}</h2>
        <p className="mt-1 hidden max-w-3xl text-[14px] text-ink-2 sm:block">{t("radar.hint", { place, days: DAYS })}</p>
      </div>

      <Card className="grid grid-cols-3 divide-x divide-border !p-0 sm:hidden" data-testid="radar-strip">
        <Link href={`${base}/moments`} className="grid gap-0.5 px-3 py-3 text-center"><span className="tabular text-[24px] font-extrabold leading-none">{soon.length}</span><span className="text-[11px] font-semibold text-muted">{t("radar.momentsT")}</span></Link>
        <Link href={`${base}/data`} className="grid gap-0.5 px-3 py-3 text-center"><span className={cx("tabular text-[24px] font-extrabold leading-none", pulse.verdict === "down" ? "text-bad" : pulse.verdict === "up" ? "text-good-ink" : "text-ink")}>{pulse.status === "ready" && pulse.pct !== null ? pct(pulse.pct) : "—"}</span><span className="text-[11px] font-semibold text-muted">{t("radar.pulseT")}</span></Link>
        <div className="grid gap-0.5 px-3 py-3 text-center"><span className="text-[15px] font-extrabold leading-tight">{brk ? t(`radar.breaks.${brk.brk.kind}`) : t("radar.schoolNone")}</span><span className="text-[11px] font-semibold text-muted">{t("radar.schoolT")}</span></div>
      </Card>
      <div className="hidden gap-3 sm:grid sm:grid-cols-3" data-testid="radar-tiles">
        <Card className="grid content-start gap-1.5">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("radar.momentsT")} · {t("radar.nextDays", { days: CAUSE_DAYS })}</div>
          <div className="tabular text-[28px] font-extrabold leading-none">{soon.length}</div>
          <div className="text-[13px] text-ink-2">{soon.length ? soon.slice(0, 2).map((m) => `${date(m.date)} ${m.name}`).join(" · ") : t("radar.momentsNone")}</div>
          <Link href={`${base}/moments`} className="text-[13px] font-semibold text-pos">{t("radar.seeMoments")} →</Link>
        </Card>
        <Card className="grid content-start gap-1.5" data-testid="radar-pulse">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("radar.pulseT")}</div>
          {pulse.status === "ready" && pulse.pct !== null ? (<>
            <div className={cx("tabular text-[28px] font-extrabold leading-none", pulse.verdict === "down" ? "text-bad" : pulse.verdict === "up" ? "text-good-ink" : "text-ink")}>{pct(pulse.pct)}</div>
            <div className="text-[13px] text-ink-2">{t("radar.pulseReady", { pct: t(`radar.pulse${pulse.verdict === "up" ? "Up" : pulse.verdict === "down" ? "Down" : "Flat"}`) })} · {t("radar.pulseWindow", { from: date(pulse.from), to: date(pulse.to) })}</div>
          </>) : (<>
            <div className="text-[20px] font-extrabold leading-tight text-muted">—</div>
            <div className="text-[13px] text-ink-2">{pulse.status === "short_history" ? t("radar.pulseShort") : t("radar.pulseNone")}</div>
          </>)}
          <Link href={`${base}/data`} className="text-[13px] font-semibold text-pos">{t("nav.data")} →</Link>
        </Card>
        <Card className="grid content-start gap-1.5">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{t("radar.schoolT")}</div>
          <div className="text-[20px] font-extrabold leading-tight">{brk ? t(brk.state === "in_break" ? "radar.schoolIn" : "radar.schoolSoon", { kind: t(`radar.breaks.${brk.brk.kind}`), date: date(brk.state === "in_break" ? brk.brk.to : brk.brk.from) }) : t("radar.schoolNone")}</div>
          <div className="text-[12px] text-muted">{t("radar.schoolHint")}</div>
        </Card>
      </div>

      <Card data-testid="radar-causes">
        <H2 hint={<span className="hidden sm:inline">{t("radar.causeNote")}</span>}>{t("radar.causesT")}</H2>
        {causes.length ? (
          <ul className="grid gap-2">
            {causes.slice(0, 2).map(causeRow)}
            {causes.length > 2 ? <li><details className="group"><summary className="cursor-pointer list-none text-[13px] font-semibold text-pos group-open:hidden">{t("radar.moreCauses", { n: causes.length - 2 })}</summary><ul className="grid gap-2">{causes.slice(2).map(causeRow)}</ul></details></li> : null}
          </ul>
        ) : <p className="text-[13.5px] text-ink-2">{t("radar.causesNone")}</p>}
      </Card>

      {done && plays.length ? <RadarPlays restaurantId={id} plays={plays} days={DAYS} /> : (
        <Card className="flex flex-wrap items-center justify-between gap-4" data-testid="recommended-experiment">
          <div><div className="text-[18px] font-bold">{t("snapshot.noRunT")}</div><p className="text-[13.5px] text-ink-2">{done ? t("radar.noPlays") : t("snapshot.noRunB")}</p></div>
          <RunAnalysisButton restaurantId={id} hasRun={!!run} />
        </Card>
      )}

      <Card>
        <H2 hint={<span className="hidden sm:inline">{t("radar.agentsHint")}</span>} right={<span className="hidden text-[12.5px] text-muted sm:inline">{run?.startedAt ? t("radar.lastRun", { at: stamp(run.startedAt) }) : t("radar.neverRun")}</span>}>{t("radar.agentsT")}</H2>
        <details className="group sm:hidden"><summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px]"><span className="font-semibold">{t("radar.stepsDone", { d: okSteps, n: AGENTS.length })}</span><span className="text-[12px] text-muted">{run?.startedAt ? stamp(run.startedAt) : t("radar.neverRun")}</span></summary><div className="mt-3 flex flex-wrap items-center gap-2">{agentPills}{done ? <RunAnalysisButton restaurantId={id} hasRun={!!run} variant="secondary" /> : null}</div></details>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {agentPills}
          {done ? <RunAnalysisButton restaurantId={id} hasRun={!!run} variant="secondary" /> : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card data-testid="radar-learn">
          <H2 hint={t("radar.learnHint")}>{t("radar.learnT")}</H2>
          {learned.length ? (
            <ul className="grid gap-2 text-[13.5px]">{learned.map(({ c, redeemed, verdict }) => <li key={c.id}><Link href={`${base}/passes/${c.id}`} className="font-semibold text-pos">{c.offerName}</Link> · {redeemed} {t("pass.redeemed").toLowerCase()} · <Chip tone={verdict === "above" ? "good" : verdict === "below" ? "bad" : "neutral"}>{t(`radar.verdict.${verdict}`)}</Chip></li>)}</ul>
          ) : <p className="text-[13.5px] text-ink-2">{t("radar.learnNone")}</p>}
          <div className="mt-3 flex items-center gap-3 text-[13px]"><span className="text-muted">{t("radar.memories", { n: memories.length })}</span><Link href={`${base}/memory`} className="font-semibold text-pos">{t("radar.seeMemory")} →</Link></div>
        </Card>
        <details className="group sm:hidden lg:col-span-2"><summary className="cursor-pointer list-none rounded-2xl border border-border bg-surface px-4 py-3 text-center text-[14px] font-semibold text-pos group-open:hidden">{t("radar.moreT")}</summary><div className="grid gap-4">        <Card>
          <H2 right={<Link href={`${base}/taste`} className="text-[13px] font-semibold text-pos">{t("radar.seeTaste")} →</Link>}>{t("radar.tasteT")}</H2>
          {tags.length ? <div className="flex flex-wrap gap-1.5">{tags.map((x) => <Chip key={x.name} tone="coral" ring={x.affinity}>{x.name} · {(x.affinity ?? 0).toFixed(2)}</Chip>)}</div> : <p className="text-[13px] text-muted">{done ? t("taste.noneReturned") : t("snapshot.noIdeasYet")}</p>}
          {evidence ? <div className="mt-3 text-[12px] text-muted">{evidence.mode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge")}</div> : null}
        </Card>
        <Card>
          <H2>{t("snapshot.profile")}</H2>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-[13.5px]">
            <dt className="text-muted">{t("snapshot.formats")}</dt><dd className="flex flex-wrap gap-1">{p.serviceFormats.map((f) => <Chip key={f}>{t(`onboarding.formatLabel.${f}`)}</Chip>)}</dd>
            <dt className="text-muted">{t("snapshot.menu")}</dt><dd>{t("snapshot.items", { n: overview.menu.length })}</dd>
            <dt className="text-muted">{t("snapshot.hours")}</dt><dd>{p.hoursSummary ?? t("common.unknown")}</dd>
            <dt className="text-muted">{t("radar.posT")}</dt><dd>{p.posPreference && p.posPreference !== "none" ? t("snapshot.posPlanned", { pos: p.posPreference }) : t("snapshot.posNone")}</dd>
          </dl>
          <p className="mt-2 text-[12px] text-muted">{t("radar.posHint")}</p>
          <div className="mt-3"><Button href={`${base}/opportunities`} variant="secondary" size="sm">{t("snapshot.viewOpps")}</Button></div>
        </Card>
</div></details>
        <div className="hidden gap-4 sm:contents">        <Card>
          <H2 right={<Link href={`${base}/taste`} className="text-[13px] font-semibold text-pos">{t("radar.seeTaste")} →</Link>}>{t("radar.tasteT")}</H2>
          {tags.length ? <div className="flex flex-wrap gap-1.5">{tags.map((x) => <Chip key={x.name} tone="coral" ring={x.affinity}>{x.name} · {(x.affinity ?? 0).toFixed(2)}</Chip>)}</div> : <p className="text-[13px] text-muted">{done ? t("taste.noneReturned") : t("snapshot.noIdeasYet")}</p>}
          {evidence ? <div className="mt-3 text-[12px] text-muted">{evidence.mode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge")}</div> : null}
        </Card>
        <Card>
          <H2>{t("snapshot.profile")}</H2>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-[13.5px]">
            <dt className="text-muted">{t("snapshot.formats")}</dt><dd className="flex flex-wrap gap-1">{p.serviceFormats.map((f) => <Chip key={f}>{t(`onboarding.formatLabel.${f}`)}</Chip>)}</dd>
            <dt className="text-muted">{t("snapshot.menu")}</dt><dd>{t("snapshot.items", { n: overview.menu.length })}</dd>
            <dt className="text-muted">{t("snapshot.hours")}</dt><dd>{p.hoursSummary ?? t("common.unknown")}</dd>
            <dt className="text-muted">{t("radar.posT")}</dt><dd>{p.posPreference && p.posPreference !== "none" ? t("snapshot.posPlanned", { pos: p.posPreference }) : t("snapshot.posNone")}</dd>
          </dl>
          <p className="mt-2 text-[12px] text-muted">{t("radar.posHint")}</p>
          <div className="mt-3"><Button href={`${base}/opportunities`} variant="secondary" size="sm">{t("snapshot.viewOpps")}</Button></div>
        </Card>
</div>
      </div>
    </div>
  );
}
