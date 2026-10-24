import { describe, it, expect } from "vitest";
import en from "@/i18n/en";
import zh from "@/i18n/zh";
import es from "@/i18n/es";
import { makeT, formatLText, interpolate } from "@/i18n/shared";

function leaves(o: unknown, prefix = ""): string[] {
  if (o && typeof o === "object") return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe("i18n", () => {
  it("zh and es mirror the en key set exactly", () => {
    const e = leaves(en).sort();
    expect(leaves(zh).sort()).toEqual(e);
    expect(leaves(es).sort()).toEqual(e);
    expect(e.length).toBeGreaterThan(400);
  });
  it("placeholders match across locales", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const key of leaves(en)) {
      const get = (d: unknown) => key.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], d) as string;
      expect(ph(get(zh)), key).toBe(ph(get(en)));
      expect(ph(get(es)), key).toBe(ph(get(en)));
    }
  });
  it("t interpolates and falls back to key", () => {
    const t = makeT(en);
    expect(t("opps.title", { n: 3 })).toBe("3 ideas worth testing");
    expect(t("nope.missing")).toBe("nope.missing");
    expect(interpolate("a {x} {y}", { x: 1 })).toBe("a 1 {y}");
    expect(formatLText(t, { key: "gen.taskVerifyChannel", params: { name: "X" } })).toBe("Verify channel: X");
    expect(formatLText(t, "plain")).toBe("plain");
  });
});
