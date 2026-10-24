export const LOCALES = ["en", "zh", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "riq_locale";
export const LOCALE_LABEL: Record<Locale, string> = { en: "EN", zh: "中文", es: "ES" };
export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
/** Text that can be rendered in any locale: a plain string (legacy/English) or a key + params. Params may nest LText (or lists of LText, joined by "; "). */
export type LParam = string | number | LText | LText[];
export type LText = string | { key: string; params?: Record<string, LParam> };
