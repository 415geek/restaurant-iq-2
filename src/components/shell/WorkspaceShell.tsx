"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { LocaleSwitch } from "./LocaleSwitch";

const TABS = [
  { seg: "", key: "nav.snapshot", icon: "snapshot" },
  { seg: "taste", key: "nav.taste", icon: "signals" },
  { seg: "moments", key: "nav.moments", icon: "calendar" },
  { seg: "data", key: "nav.data", icon: "database" },
  { seg: "opportunities", key: "nav.opportunities", icon: "ideas" },
  { seg: "passes", key: "nav.passes", icon: "ticket" },
  { seg: "actions", key: "nav.actions", icon: "board", desktopOnly: true },
  { seg: "memory", key: "nav.memory", icon: "memory" },
] as const;

/** Desktop: 240px left rail. Mobile: bottom tab bar. */
export function WorkspaceShell({ base, children, header, signedIn }: { base: string; children: ReactNode; header: ReactNode; signedIn: boolean }) {
  const path = usePathname();
  const { t } = useI18n();
  const isActive = (seg: string) => (seg ? path.startsWith(`${base}/${seg}`) : path === base);
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 font-extrabold tracking-[-0.02em]">
          <Image src="/brand/logo-mark.svg" alt="" width={28} height={28} />
          <span className="text-[17px]">Restaurant <span className="text-coral">IQ</span></span>
        </Link>
        <nav aria-label="Workspace" className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const I = Icon[tab.icon]; const on = isActive(tab.seg);
            return (
              <Link key={tab.seg} href={tab.seg ? `${base}/${tab.seg}` : base} aria-current={on ? "page" : undefined} className={cx("flex items-center gap-3 rounded-[var(--radius-ctl)] px-3 py-2.5 text-[15px] font-medium", on ? "bg-coral-soft text-coral-ink" : "text-ink-2 hover:bg-surface-2")}>
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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-7">
          {header}
          {children}
        </main>
        <nav aria-label="Workspace" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-border bg-surface/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {TABS.filter((tab) => !("desktopOnly" in tab)).map((tab) => {
            const I = Icon[tab.icon]; const on = isActive(tab.seg);
            return (
              <Link key={tab.seg} href={tab.seg ? `${base}/${tab.seg}` : base} aria-current={on ? "page" : undefined} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold", on ? "text-coral-ink" : "text-muted")}>
                <I width={22} height={22} /><span className="block w-full truncate px-0.5 text-center">{t(tab.key.replace("nav.", "nav.short."))}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
