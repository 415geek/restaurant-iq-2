"use client";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-20 text-center"><h1 className="text-[24px] font-extrabold">{t("common.error")}</h1><p className="mt-2 text-ink-2">{t("common.errorBody")}</p><div className="mt-6 flex justify-center gap-3"><Button onClick={reset} variant="coral">{t("common.retry")}</Button><Button href="/demo" variant="secondary">{t("common.openDemo")}</Button></div></main>);
}
