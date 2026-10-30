"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

/** Owner ↔ HQ link in the /front header: shows the view you are not on. */
export function FrontNav() {
  const { t } = useI18n(); const p = usePathname();
  const fleet = p?.startsWith("/front/fleet");
  return <Link href={fleet ? "/front" : "/front/fleet"} className="text-[12.5px] font-semibold text-coral-ink hover:underline">{fleet ? t("front.ownerView") : t("front.fleetView")} →</Link>;
}
