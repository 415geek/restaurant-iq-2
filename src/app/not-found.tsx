import { SiteHeader } from "@/components/shell/SiteHeader";
import { Button } from "@/components/ui";
import { getT } from "@/i18n";

export default async function NotFound() {
  const { t } = await getT();
  return (<><SiteHeader /><main className="mx-auto w-full max-w-6xl flex-1 px-4 py-20 text-center"><h1 className="text-[28px] font-extrabold">{t("common.notFound")}</h1><p className="mt-2 text-ink-2">{t("common.notFoundBody")}</p><div className="mt-6 flex justify-center gap-3"><Button href="/demo" variant="coral">{t("common.openDemo")}</Button><Button href="/" variant="secondary">{t("common.home")}</Button></div></main></>);
}
