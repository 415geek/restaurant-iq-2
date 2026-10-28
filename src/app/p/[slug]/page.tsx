import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Chip, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { PassClaim } from "@/components/campaign/PassClaim";
import { getPublicCampaign, passClosedReason } from "@/lib/campaigns";
import { getServiceClient } from "@/lib/db/server";
import { getT } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublicCampaign(slug);
  return { title: c ? `${c.offerName} · ${c.restaurantName}` : "TastePass", robots: { index: false } };
}

export default async function PublicPassPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const [c, { t, locale }] = await Promise.all([getPublicCampaign(slug), getT()]);
  if (!c) notFound();
  const { count } = await getServiceClient().from("pass_claims").select("id", { count: "exact", head: true }).eq("campaign_id", c.id);
  const claimed = count ?? 0;
  const closed = passClosedReason(c, claimed);
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.02em]"><Image src="/brand/logo-mark.svg" alt="" width={24} height={24} />TastePass</span>
        <LocaleSwitch />
      </header>
      {c.isDemo ? <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] font-semibold text-warn-ink" role="note">{t("pass.pub.demoBanner")}</p> : null}
      <article className="card overflow-hidden">
        <div className="bg-navy px-5 pb-5 pt-5 text-white">
          <div className="text-[13px] text-white/75">{c.restaurantName}{c.neighborhood ? ` · ${c.neighborhood}` : ""}</div>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{c.offerName}</h1>
          <div className="mt-3 flex items-baseline gap-2"><span className="tabular text-[40px] font-extrabold leading-none text-coral">{fmtUsd(c.offerPrice, 2)}</span><span className="text-[14px] text-white/70 line-through">{t("pass.pub.regular", { p: fmtUsd(c.regularPrice, 2) })}</span></div>
          <div className="mt-1 text-[14px] text-white/90">{c.menuItem}</div>
        </div>
        <div className="grid gap-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Chip tone="neutral">{t("pass.pub.validUntil", { date: dateFmt(c.endsAt) })}</Chip>
            <Chip tone="coral">{t("pass.pub.left", { n: Math.max(0, c.maxRedemptions - claimed), max: c.maxRedemptions })}</Chip>
          </div>
          <PassClaim slug={c.slug} active={!closed} closedReason={closed} />
          {c.terms ? <div className="text-[12.5px] text-ink-2"><span className="font-semibold">{t("pass.pub.terms")}: </span>{c.terms}</div> : null}
        </div>
      </article>
      <p className="mt-4 flex items-start gap-2 text-[12px] text-muted"><Icon.shield width={16} height={16} className="mt-0.5 shrink-0" />{t("pass.pub.privacy")}</p>
      <p className="mt-auto pt-8 text-center text-[11.5px] text-muted">{t("pass.pub.poweredBy")}</p>
    </main>
  );
}
