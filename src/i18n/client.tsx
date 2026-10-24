"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "./en";
import { makeT, formatLText, type TFn } from "./shared";
import type { LText, Locale } from "./locales";

const Ctx = createContext<{ locale: Locale; dict: Dictionary; t: TFn } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  return <Ctx.Provider value={{ locale, dict, t: makeT(dict) }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return { ...v, lt: (x: LText | undefined | null) => formatLText(v.t, x) };
}
