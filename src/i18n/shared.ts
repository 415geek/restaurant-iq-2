import en, { type Dictionary } from "./en";
import zh from "./zh";
import es from "./es";
import type { LParam, LText, Locale } from "./locales";

const DICTS: Record<Locale, Dictionary> = { en, zh, es };

export function getDictionary(locale: Locale): Dictionary {
  return DICTS[locale] ?? en;
}

/** Dotted-path lookup with `{param}` interpolation. Unknown keys return the key itself (visible in QA). */
export function lookup(dict: Dictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), dict);
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export type TFn = (key: string, params?: Record<string, string | number>) => string;

export function makeT(dict: Dictionary): TFn {
  return (key, params) => {
    const v = lookup(dict, key);
    if (typeof v !== "string") return key;
    return interpolate(v, params);
  };
}

/** Render localizable generated content: a plain string (legacy) or {key, params}. Params may themselves be LText. */
export function formatLText(t: TFn, text: LText | undefined | null): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  const render = (v: LParam): string | number =>
    typeof v === "string" || typeof v === "number" ? v : Array.isArray(v) ? v.map((x) => formatLText(t, x)).join("; ") : formatLText(t, v);
  const params = text.params ? Object.fromEntries(Object.entries(text.params).map(([k, v]) => [k, render(v)])) : undefined;
  return t(text.key, params);
}
