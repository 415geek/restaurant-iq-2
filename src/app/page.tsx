import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { Button, Chip } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { getT } from "@/i18n";
import { DEMO_RESTAURANT_ID } from "@/lib/queries";

export default async function Home() {
  const { t } = await getT();
  const steps = [["s1", "snapshot"], ["s2", "signals"], ["s3", "ideas"], ["s4", "memory"]] as const;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-12 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <Chip tone="coral">{t("landing.kicker")}</Chip>
            <h1 className="mt-4 text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[56px]">{t("landing.h1a")}<br /><span className="text-coral">{t("landing.h1b")}</span></h1>
            <p className="mt-5 max-w-xl text-[17px] text-ink-2">{t("landing.lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3"><Button href="/demo" variant="coral" size="lg">{t("landing.ctaDemo")}<Icon.arrowRight /></Button><Button href="/login" variant="secondary" size="lg">{t("landing.ctaOwn")}</Button></div>
            <p className="mt-3 text-[13px] text-muted">{t("landing.noAccount")}</p>
          </div>
          {/* product composition: three real-looking cards, no screenshot */}
          <div className="relative mx-auto mt-10 w-full max-w-md pb-8 lg:mt-0">
            <div className="card p-5"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-coral-soft text-coral-ink"><Icon.leaf width={22} height={22} /></div><div className="text-[18px] font-bold">{t("hyp.vegetarian-line.title")}</div><div className="text-[13px] text-ink-2">{t("hyp.vegetarian-line.segment")}</div><div className="mt-3 flex gap-1.5"><Chip ring={0.84}>{t("opps.taste", { v: "0.84" })}</Chip><Chip tone="good">{t("opps.lowEffort")}</Chip></div><div className="mt-4 text-[28px] font-extrabold tracking-[-0.02em]">$362 <span className="text-[13px] font-medium text-muted">{t("common.perWeek")}</span></div></div>
            <div className="card absolute -bottom-8 -right-3 w-56 p-4 sm:-right-8"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t("taste.withoutQloo")} → {t("taste.withQloo")}</div><div className="mt-1 flex items-center gap-2 text-[26px] font-extrabold"><span className="text-muted">#4</span><Icon.arrowRight className="text-coral" /><span className="text-coral-ink">#2</span></div><div className="text-[12px] text-ink-2">{t("hyp.boba-study-pairing.title")}</div></div>
            <div className="card absolute -left-3 -top-12 w-44 p-3 sm:-left-10"><div className="flex items-center gap-2 text-[12px] font-semibold"><i className="h-2 w-2 rounded-full bg-warn" />{t("common.sampleData")}</div><div className="text-[11px] text-muted">{t("common.sources", { n: 5 })}</div></div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10">
          <h2 className="text-[24px] font-extrabold tracking-[-0.02em]">{t("landing.how")}</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([k, icon], i) => { const I = Icon[icon]; return (<li key={k} className="card p-5"><div className="flex items-center gap-2 text-[12px] font-bold text-coral-ink"><I width={18} height={18} />0{i + 1}</div><div className="mt-2 text-[16px] font-bold">{t(`landing.${k}t`)}</div><p className="mt-1 text-[13.5px] text-ink-2">{t(`landing.${k}d`)}</p></li>); })}
          </ol>
        </section>
        <section className="mx-auto max-w-6xl px-4 pb-16"><div className="card grid gap-4 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><h2 className="text-[24px] font-extrabold tracking-[-0.02em]">{t("landing.compareT")}</h2><p className="mt-2 max-w-3xl text-[14.5px] text-ink-2">{t("landing.compareD")}</p></div><Button href={`/r/${DEMO_RESTAURANT_ID}/taste`} variant="primary">{t("taste.compareT")}<Icon.arrowRight /></Button></div></section>
        <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-6 text-[12px] text-muted"><span className="flex items-center gap-2"><Image src="/brand/logo-mark.svg" alt="" width={18} height={18} />Restaurant IQ 2.0</span><span>{t("landing.footer")}</span><Link href="https://docs.qloo.com/" target="_blank" rel="noreferrer" className="underline">Qloo API</Link></footer>
      </main>
    </>
  );
}
