"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { LocaleSwitch } from "./LocaleSwitch";

const TABS = [
  { seg: "", key: "nav.snapshot", icon: "snapshot", primary: true },
  { seg: "moments", key: "nav.moments", icon: "calendar", primary: true },
  { seg: "opportunities", key: "nav.opportunities", icon: "ideas", primary: true },
  { seg: "passes", key: "nav.passes", icon: "ticket", primary: true },
  { seg: "taste", key: "nav.taste", icon: "signals", primary: false },
  { seg: "data", key: "nav.data", icon: "database", primary: false },
  { seg: "actions", key: "nav.actions", icon: "board", primary: false },
  { seg: "memory", key: "nav.memory", icon: "memory", primary: false },
] as const;
const RAIL_ORDER = ["", "taste", "moments", "data", "opportunities", "passes", "actions", "memory"];

/** Desktop: 240px left rail with every section. Phone: four tabs (Radar · Moments · Ideas · Pass) plus "More", which opens a sheet with the rest. */
export function WorkspaceShell({ base, children, header, signedIn }: { base: string; children: ReactNode; header: ReactNode; signedIn: boolean }) {
  const path = usePathname();
  const { t } = useI18n();
  const [more, setMore] = useState(false);
  const isActive = (seg: string) => (seg ? path.startsWith(`${base}/${seg}`) : path === base);
  const href = (seg: string) => (seg ? `${base}/${seg}` : base);
  const rail = RAIL_ORDER.map((s) => TABS.find((x) => x.seg === s)!);
  const primary = TABS.filter((x) => x.primary); const secondary = TABS.filter((x) => !x.primary);
  const moreOn = secondary.some((x) => isActive(x.seg));
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 font-extrabold tracking-[-0.02em]">
          <Image src="/brand/logo-mark.svg" alt="" width={28} height={28} />
          <span className="text-[17px]">Restaurant <span className="text-coral">IQ</span></span>
        </Link>
        <nav aria-label="Workspace" className="flex flex-col gap-1">
          {rail.map((tab) => {
            const I = Icon[tab.icon]; const on = isActive(tab.seg);
            return (
              <Link key={tab.seg} href={href(tab.seg)} aria-current={on ? "page" : undefined} className={cx("flex items-center gap-3 rounded-[var(--radius-ctl)] px-3 py-2.5 text-[15px] font-medium", on ? "bg-coral-soft text-coral-ink" : "text-ink-2 hover:bg-surface-2")}>
                <I width={20} height={20} />{t(tab.key)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {signedIn ? <Link href="/app" className="px-3 text-[13px] text-ink-2 hover:text-ink">{t("common.myRestaurants")}</Link> : <Link href="/login" className="px-3 text-[13px] text-ink-2 hover:text-ink">{t("common.signIn")}</Link>}
          <LocaleSwitch />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2 font-extrabold"><Image src="/brand/logo-mark.svg" alt="" width={24} height={24} /><span>Restaurant <span className="text-coral">IQ</span></span></Link>
          <LocaleSwitch />
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 sm:px-6 lg:pb-10 lg:pt-7">
          {header}
          {children}
        </main>
        {more ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label={t("nav.more")}>
            <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-ink/30" onClick={() => setMore(false)} />
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] shadow-[0_-12px_40px_rgba(17,24,39,.12)]">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <div className="grid grid-cols-2 gap-2">
                {secondary.map((tab) => { const I = Icon[tab.icon]; const on = isActive(tab.seg); return (
                  <Link key={tab.seg} href={href(tab.seg)} onClick={() => setMore(false)} className={cx("flex h-14 items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold", on ? "bg-coral-soft text-coral-ink" : "bg-surface-2 text-ink")}><I width={22} height={22} />{t(tab.key)}</Link>); })}
              </div>
              <div className="mt-3 flex items-center justify-between px-1 text-[13px]">
                {signedIn ? <Link href="/app" className="text-ink-2">{t("common.myRestaurants")}</Link> : <Link href="/login" className="text-ink-2">{t("common.signIn")}</Link>}
                <LocaleSwitch />
              </div>
            </div>
          </div>
        ) : null}
        <nav aria-label="Workspace" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {primary.map((tab) => {
            const I = Icon[tab.icon]; const on = isActive(tab.seg) && !more;
            return (
              <Link key={tab.seg} href={href(tab.seg)} onClick={() => setMore(false)} aria-current={on ? "page" : undefined} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", on ? "text-coral-ink" : "text-muted")}>
                <I width={22} height={22} /><span className="block w-full truncate px-0.5 text-center">{t(tab.key.replace("nav.", "nav.short."))}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", more || moreOn ? "text-coral-ink" : "text-muted")}>
            <Icon.menu width={22} height={22} /><span>{t("nav.more")}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
