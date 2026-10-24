import Link from "next/link";
import Image from "next/image";
import { getSessionUser } from "@/lib/db/ssr";
import { getT } from "@/i18n";
import { Button } from "@/components/ui";
import { LocaleSwitch } from "./LocaleSwitch";

export async function SiteHeader() {
  const [user, { t }] = await Promise.all([getSessionUser(), getT()]);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-[-0.02em]">
          <Image src="/brand/logo-mark.svg" alt="" width={28} height={28} priority />
          <span className="text-[17px]">Restaurant <span className="text-coral">IQ</span></span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <LocaleSwitch className="hidden sm:inline-flex" />
          <Button href="/demo" variant="ghost" size="sm">{t("common.liveDemo")}</Button>
          {user ? (
            <>
              <Button href="/app" variant="ghost" size="sm" className="hidden sm:inline-flex">{t("common.myRestaurants")}</Button>
              <form action="/auth/signout" method="post"><Button type="submit" variant="secondary" size="sm">{t("common.signOut")}</Button></form>
            </>
          ) : (
            <Button href="/login" variant="secondary" size="sm">{t("common.signIn")}</Button>
          )}
        </nav>
      </div>
    </header>
  );
}
