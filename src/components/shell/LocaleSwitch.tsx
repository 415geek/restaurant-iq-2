"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/i18n/locales";
import { useI18n } from "@/i18n/client";
import { cx } from "@/components/ui";

export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(l: Locale) {
    if (l === locale || busy) return;
    setBusy(true);
    await fetch("/api/locale", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: l }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div role="group" aria-label={t("common.language")} className={cx("inline-flex rounded-[var(--radius-ctl)] bg-surface-2 p-1", className)}>
      {LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => set(l)} aria-pressed={l === locale} className={cx("h-8 min-w-11 rounded-lg px-2 text-[13px] font-semibold", l === locale ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink-2")}>
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
