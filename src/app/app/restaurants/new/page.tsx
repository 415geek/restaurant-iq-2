import { SiteHeader } from "@/components/shell/SiteHeader";
import { RestaurantForm } from "@/components/onboarding/RestaurantForm";
import { getT } from "@/i18n";

export const metadata = { title: "New restaurant" };

export default async function NewRestaurantPage() {
  const { t } = await getT();
  return (<><SiteHeader /><main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8"><h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("onboarding.title")}</h1><p className="mt-1 text-[14px] text-ink-2">{t("onboarding.body")}</p><div className="card mt-6 p-5 sm:p-6"><RestaurantForm /></div></main></>);
}
