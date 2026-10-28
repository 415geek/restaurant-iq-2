import Link from "next/link";
import { Card, Chip, Empty, H2, fmtDate, fmtUsd, Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { getCampaignsForRestaurant, getCampaignStats } from "@/lib/campaigns";
import { getT } from "@/i18n";

export default async function PassesPage({ params }: PageProps<"/r/[id]/passes">) {
  const { id } = await params; const base = `/r/${id}`;
  const [campaigns, { t, locale }] = await Promise.all([getCampaignsForRestaurant(id), getT()]);
  const stats = await Promise.all(campaigns.map((c) => getCampaignStats(c.id)));
  const labels = { signals: t("steps.signals"), recommend: t("steps.recommend"), execute: t("steps.execute"), prove: t("steps.prove") };
  return (
    <div className="grid gap-5">
      <StepBar current="act" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities` }} />
      <div><h2 className="text-[26px] font-extrabold tracking-[-0.02em]">{t("pass.title")}</h2><p className="mt-1 text-[14.5px] text-ink-2">{t("pass.hint")}</p></div>
      {campaigns.length === 0 ? (
        <Empty title={t("pass.listEmptyT")} body={t("pass.listEmptyB")} action={<Button href={`${base}/opportunities`} variant="coral">{t("pass.listCta")}</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c, i) => (
            <Link key={c.id} href={`${base}/passes/${c.id}`} className="card block p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-coral-soft text-coral"><Icon.ticket width={22} height={22} /></span>
                <Chip tone={c.status === "active" ? "good" : c.status === "draft" ? "warn" : "neutral"}>{t(`pass.status.${c.status}`)}</Chip>
              </div>
              <h3 className="mt-3 text-[17px] font-bold leading-6">{c.offerName}</h3>
              <p className="text-[13px] text-ink-2">{c.menuItem} · {fmtUsd(c.offerPrice, 2)} · {t("pass.contribution").toLowerCase()} {fmtUsd(c.economics.contributionPerRedemption, 2)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(["claims", "redeemed", "views"] as const).map((k) => <div key={k} className="rounded-xl bg-surface-2 py-2"><div className="tabular text-[20px] font-extrabold">{stats[i][k]}</div><div className="text-[11px] text-ink-2">{t(`pass.${k}`)}</div></div>)}
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-muted"><span>{fmtDate(c.createdAt, locale)}</span><Chip tone="neutral">{t(`pass.mode.${c.mode}`)}</Chip></div>
            </Link>
          ))}
        </div>
      )}
      <Card><H2 hint={t("pass.notProve3")}>{t("pass.notProveT")}</H2><ul className="list-disc pl-4 text-[13.5px] text-ink-2"><li>{t("pass.notProve1")}</li><li>{t("pass.notProve2")}</li></ul></Card>
    </div>
  );
}
