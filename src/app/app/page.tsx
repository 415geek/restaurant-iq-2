import { DISPLAY_TZ } from "@/lib/display-tz";
import Link from "next/link";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { Button, Card, Chip, Empty } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { getMyRestaurants } from "@/lib/queries";
import { getT } from "@/i18n";

export const metadata = { title: "My restaurants" };

export default async function AppHome() {
  const [mine, { t, locale }] = await Promise.all([getMyRestaurants(), getT()]);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("dashboard.title")}</h1><p className="text-[14px] text-ink-2">{t("dashboard.body")}</p></div><Button href="/app/restaurants/new" variant="coral">{t("dashboard.add")}<Icon.arrowRight /></Button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((r) => (<Card key={r.id} as="article"><div className="flex items-start justify-between gap-2"><h2 className="text-[17px] font-bold"><Link href={`/r/${r.id}`} className="hover:underline">{r.name}</Link></h2><Chip tone={r.dataMode === "live" ? "good" : "warn"}>{r.dataMode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge")}</Chip></div><p className="mt-1 text-[13.5px] text-ink-2">{r.cuisine} · {[r.neighborhood, r.city].filter(Boolean).join(", ")}</p><p className="mt-3 text-[12px] text-muted">{t("dashboard.created", { date: new Date(r.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : locale, { timeZone: DISPLAY_TZ }) })}</p></Card>))}
        </div>
        {mine.length === 0 ? <div className="mt-6"><Empty title={t("dashboard.emptyT")} body={t("dashboard.emptyB")} action={<Button href="/app/restaurants/new" variant="coral">{t("dashboard.add")}</Button>} /></div> : null}
      </main>
    </>
  );
}
