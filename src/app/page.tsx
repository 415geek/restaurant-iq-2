import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { Button, Chip } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { getT } from "@/i18n";
import { DEMO_RESTAURANT_ID } from "@/lib/queries";
import { FrontReplays } from "@/components/landing/FrontReplays";
import { loadReplays } from "@/lib/front/replays";
import { getSsrClient } from "@/lib/db/ssr";

export default async function Home() {
  const { t } = await getT();
  const replays = await getSsrClient().then(loadReplays).catch(() => []);
  const steps = [["s1", "signals"], ["s2", "ideas"], ["s3", "ticket"], ["s4", "check"]] as const;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-12 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <Chip tone="coral">{t("landing.kicker")}</Chip>
            <h1 className="mt-4 text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[50px]">{t("landing.h1a")}<br /><span className="text-coral">{t("landing.h1b")}</span></h1>
            <p className="mt-5 max-w-xl text-[17px] text-ink-2">{t("landing.lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3"><Button href="/demo" variant="coral" size="lg">{t("landing.ctaDemo")}<Icon.arrowRight /></Button><Button href="/front" variant="secondary" size="lg">{t("landing.ctaFront")}</Button><Button href="/m/chuan-lane-san-bruno" variant="ghost" size="lg">{t("landing.ctaMenu")}</Button></div>
            <p className="mt-3 text-[13px] text-muted">{t("landing.noAccount")}</p>
          </div>
          {/* product composition: the three acts, built from our own UI pieces (no stored Qloo data) */}
          <div className="relative mx-auto mt-10 w-full max-w-md pb-20 lg:mt-0">
            <div className="card overflow-hidden">
              <div className="bg-navy p-5 text-white"><div className="text-[12px] text-white/70">{t("pass.title")}</div><div className="mt-1 text-[22px] font-extrabold leading-tight">{t("hyp.vegetarian-line.title")}</div><div className="mt-2 flex items-baseline gap-2"><span className="tabular text-[34px] font-extrabold text-coral">$6.00</span><span className="text-[13px] text-white/60 line-through">$7.00</span></div></div>
              <div className="flex items-center justify-between gap-3 p-4"><div className="rounded-xl border-2 border-dashed border-coral bg-coral-soft px-3 py-2 font-mono text-[18px] font-extrabold tracking-[0.15em] text-navy">K7QX·M4RT</div><Chip tone="coral">{t("pass.pub.left", { n: 49, max: 50 })}</Chip></div>
            </div>
            <div className="card absolute -bottom-16 -right-3 w-48 p-4 sm:-right-8" style={{ background: "var(--coral)", color: "white" }}><div className="text-[12px] text-white/80">{t("pass.redeemed")}</div><div className="mt-1 flex items-center gap-2 text-[30px] font-extrabold leading-none"><span className="text-white/60">0</span><Icon.arrowRight /><span>1</span></div><div className="mt-1 text-[11px] text-white/80">{t("pass.result.ok")}</div></div>
            <div className="card absolute -left-3 -top-10 w-44 p-3 sm:-left-10"><div className="flex items-center gap-2 text-[12px] font-semibold"><i className="h-2 w-2 rounded-full bg-good" />{t("common.liveQloo")}</div><div className="text-[11px] text-muted">{t("landing.s1t")}</div></div>
          </div>
        </section>
        {replays.length ? (
          <section className="mx-auto max-w-6xl px-4 pb-6" id="replays">
            <h2 className="text-[24px] font-extrabold tracking-[-0.02em]">{t("landing.replayT")}</h2>
            <p className="mt-1 mb-4 max-w-3xl text-[14px] text-ink-2">{t("landing.replayD")}</p>
            <FrontReplays replays={replays} />
          </section>
        ) : null}
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
