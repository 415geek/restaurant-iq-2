import { NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales";

/** POST { locale } → sets the locale cookie (1 year). */
export async function POST(req: Request) {
  let body: { locale?: unknown } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (!isLocale(body.locale)) return NextResponse.json({ error: "bad locale" }, { status: 400 });
  const res = NextResponse.json({ ok: true, locale: body.locale });
  res.cookies.set(LOCALE_COOKIE, body.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
