import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";
import { getDictionary, makeT } from "./shared";

export * from "./locales";
export { getDictionary, makeT, formatLText } from "./shared";

/** Resolve the request locale: cookie → Accept-Language → default. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = (await headers()).get("accept-language") ?? "";
  if (/^zh|,zh/i.test(al)) return "zh";
  if (/^es|,es/i.test(al)) return "es";
  return DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(getDictionary(locale)), dict: getDictionary(locale) };
}
