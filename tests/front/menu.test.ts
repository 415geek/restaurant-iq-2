import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { extractTextFromHtml, normalizeItemName, parseMenuCsv, parseMenuText, parsePriceCents, splitBilingualName, splitPriceFromLine } from "@/lib/front/menu/parse";
import { buildQueries, chooseTags, mapMenuTags } from "@/lib/front/menu/tags";
import { assertSafeMenuUrl, fetchMenuFromUrl, MenuFetchError } from "@/lib/front/menu/fetch";
import { parseMenuImage, parseMenuJson } from "@/lib/front/menu/vision";
import type { TagSignal } from "@/lib/providers/qloo/types";
import type Anthropic from "@anthropic-ai/sdk";

const tag = (tagId: string, name: string, subtype?: string): TagSignal => ({ tagId, name, ...(subtype ? { subtype } : {}) });

describe("prices and names", () => {
  it("parses currency, decimal comma, thousands and bare integers to cents", () => {
    expect(parsePriceCents("$12.50")).toBe(1250);
    expect(parsePriceCents("12,5")).toBe(1250);
    expect(parsePriceCents("12")).toBe(1200);
    expect(parsePriceCents("1,234.00")).toBe(123400);
    expect(parsePriceCents("¥38")).toBe(3800);
    expect(parsePriceCents("market price")).toBeNull();
    expect(parsePriceCents(9.99)).toBe(999);
  });
  it("normalizes names for matching", () => {
    expect(normalizeItemName("  Mapo-Tofu (Spicy)! ")).toBe("mapo tofu spicy");
    expect(normalizeItemName("Ｍａｐｏ Tofu")).toBe("mapo tofu");
  });
  it("splits CJK + Latin names in either order", () => {
    expect(splitBilingualName("麻婆豆腐 Mapo Tofu")).toEqual({ name: "麻婆豆腐", nameEn: "Mapo Tofu" });
    expect(splitBilingualName("Mapo Tofu (麻婆豆腐)")).toEqual({ name: "麻婆豆腐", nameEn: "Mapo Tofu" });
    expect(splitBilingualName("Mapo Tofu")).toEqual({ name: "Mapo Tofu", nameEn: null });
    expect(splitBilingualName("麻婆豆腐")).toEqual({ name: "麻婆豆腐", nameEn: null });
  });
  it("keeps 'Combo 2' as text but reads 'Mapo Tofu 14' and 'Mapo Tofu ... $14' as priced", () => {
    expect(splitPriceFromLine("Combo 2").priceCents).toBeNull();
    expect(splitPriceFromLine("Mapo Tofu 14")).toEqual({ text: "Mapo Tofu", priceCents: 1400 });
    expect(splitPriceFromLine("Mapo Tofu ...... $14")).toEqual({ text: "Mapo Tofu", priceCents: 1400 });
    expect(splitPriceFromLine("Tea  3.50")).toEqual({ text: "Tea", priceCents: 350 });
  });
});

describe("parseMenuCsv", () => {
  it("reads $ prices, section-header rows and an explicit category column", () => {
    const csv = ["Item,Description,Price", "Starters,,", "Spring Rolls,crispy; two per order,\"$6.50\"", "Mains,,", "Mapo Tofu,silken tofu in chili bean sauce,\"$14.00\"", "Kung Pao Chicken,,\"12,5\""].join("\n");
    const { items, warnings } = parseMenuCsv(csv);
    expect(items.map((i) => [i.name, i.priceCents, i.category, i.sortIndex])).toEqual([
      ["Spring Rolls", 650, "Starters", 0],
      ["Mapo Tofu", 1400, "Mains", 1],
      ["Kung Pao Chicken", 1250, "Mains", 2],
    ]);
    expect(items[1].description).toBe("silken tofu in chili bean sauce");
    expect(items.every((i) => i.nameEn === null)).toBe(true);
    expect(warnings.some((w) => /category/i.test(w))).toBe(true);
  });
  it("uses name_en and category columns when present, and tolerates a missing price", () => {
    const csv = ["菜名,name_en,价格,分类", "麻婆豆腐,Mapo Tofu,38,川菜", "酸辣汤,Hot and Sour Soup,,汤"].join("\n");
    const { items, warnings } = parseMenuCsv(csv);
    expect(items[0]).toMatchObject({ name: "麻婆豆腐", nameEn: "Mapo Tofu", priceCents: 3800, category: "川菜" });
    expect(items[1]).toMatchObject({ name: "酸辣汤", nameEn: "Hot and Sour Soup", priceCents: 0, category: "汤" });
    expect(warnings.some((w) => /no readable price/.test(w))).toBe(true);
  });
  it("returns a warning, not an exception, for empty input", () => {
    expect(parseMenuCsv("")).toEqual({ items: [], warnings: ["CSV is empty"] });
  });
});

describe("parseMenuText", () => {
  it("splits CJK + English names, assigns sections and attaches description lines", () => {
    const text = ["Mains", "麻婆豆腐 Mapo Tofu 14.50", "Silken tofu, pork, chili bean paste.", "", "Drinks", "Jasmine Tea ... $3"].join("\n");
    const { items } = parseMenuText(text);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "麻婆豆腐", nameEn: "Mapo Tofu", priceCents: 1450, category: "Mains", description: "Silken tofu, pork, chili bean paste.", sortIndex: 0 });
    expect(items[1]).toMatchObject({ name: "Jasmine Tea", nameEn: null, priceCents: 300, category: "Drinks", sortIndex: 1 });
  });
  it("treats a short unpriced line as a header and an inline dash as a description", () => {
    const { items } = parseMenuText("Lunch Specials\nPad Thai - rice noodles, egg, peanuts - $11\nCombo 2\nGreen Curry $12");
    expect(items.map((i) => [i.name, i.category, i.description])).toEqual([["Pad Thai", "Lunch Specials", "rice noodles, egg, peanuts"], ["Green Curry", "Combo 2", null]]);
  });
});

describe("extractTextFromHtml", () => {
  it("drops scripts/styles/nav/footer, decodes entities and keeps item lines", () => {
    const html = `<html><head><title>Menu</title><style>.x{}</style></head><body><nav><a href="/">Home</a></nav>
      <script>alert(1)</script><h2>Mains</h2><ul><li>Mapo Tofu &hellip; &#36;14</li><li><span>Kung Pao</span> Chicken &amp; Peanuts - $12.50</li></ul>
      <table><tr><td>Fried Rice</td><td>9</td></tr></table><footer>&copy; 2026 Example</footer></body></html>`;
    const text = extractTextFromHtml(html);
    expect(text).not.toMatch(/alert|Home|Example|\.x\{/);
    expect(text.split("\n")).toEqual(expect.arrayContaining(["Mains", "Mapo Tofu … $14", "Kung Pao Chicken & Peanuts - $12.50", "Fried Rice  9"]));
    const { items } = parseMenuText(text);
    expect(items.map((i) => [i.name, i.priceCents])).toEqual([["Mapo Tofu", 1400], ["Kung Pao Chicken & Peanuts", 1250], ["Fried Rice", 900]]);
  });
});

describe("chooseTags", () => {
  it("picks the place-scoped exact match over partial and non-place tags", () => {
    const out = chooseTags([
      tag("urn:tag:genre:music:jazz", "Jazz"),
      tag("urn:tag:specialty_dish:place:mapo_tofu", "Mapo Tofu", "urn:tag:specialty_dish:place"),
      tag("urn:tag:specialty_dish:place:mapo_tofu_rice", "Mapo Tofu Rice Bowl"),
      tag("urn:tag:keyword:place:tofu", "tofu"),
    ], "Mapo Tofu");
    expect(out.qlooTagIds).toEqual(["urn:tag:specialty_dish:place:mapo_tofu", "urn:tag:specialty_dish:place:mapo_tofu_rice"]);
    expect(out.ambiguous).toBe(false);
    expect(out.tagCandidates[0]).toEqual({ id: "urn:tag:specialty_dish:place:mapo_tofu", name: "Mapo Tofu", type: "urn:tag:specialty_dish:place" });
  });
  it("flags the five-Jazz case as ambiguous with no ids but keeps candidates", () => {
    const five = ["urn:tag:genre:music:jazz", "urn:tag:genre:media:jazz", "urn:tag:keyword:book:jazz", "urn:tag:genre:podcast:jazz", "urn:tag:style:artist:jazz"].map((id) => tag(id, "Jazz"));
    const out = chooseTags(five, "Jazz");
    expect(out).toMatchObject({ qlooTagIds: [], ambiguous: true });
    expect(out.tagCandidates).toHaveLength(5);
    expect(out.tagCandidates.map((c) => c.id)).toEqual(five.map((t) => t.tagId));
  });
  it("prefers the place-scoped Jazz when one exists among the duplicates", () => {
    const out = chooseTags([tag("urn:tag:genre:music:jazz", "Jazz"), tag("urn:tag:genre:place:jazz", "Jazz"), tag("urn:tag:keyword:book:jazz", "Jazz")], "jazz");
    expect(out).toMatchObject({ qlooTagIds: ["urn:tag:genre:place:jazz"], ambiguous: false });
  });
  it("returns empty for no match and for empty candidate lists", () => {
    expect(chooseTags([tag("urn:tag:specialty_dish:place:pho", "Pho")], "Mapo Tofu")).toEqual({ qlooTagIds: [], tagCandidates: [], ambiguous: false });
    expect(chooseTags([], "Mapo Tofu")).toEqual({ qlooTagIds: [], tagCandidates: [], ambiguous: false });
  });
  it("requires ≥4 chars for a partial match so 'tea' does not grab 'Steak'", () => {
    expect(chooseTags([tag("urn:tag:specialty_dish:place:steak", "Steak")], "tea").qlooTagIds).toEqual([]);
    expect(chooseTags([tag("urn:tag:cuisine:thai", "Thai")], "Thai Green Curry").qlooTagIds).toEqual(["urn:tag:cuisine:thai"]);
  });
});

describe("mapMenuTags", () => {
  const item = (name: string, nameEn: string | null = null) => ({ name, nameEn, description: null, priceCents: 1000, category: "Menu", sortIndex: 0 });
  it("builds 1–2 queries and dedupes identical queries across items", async () => {
    expect(buildQueries(item("Spicy Mapo Tofu"))).toEqual(["Spicy Mapo Tofu", "tofu"]);
    expect(buildQueries(item("麻婆豆腐", "Mapo Tofu"))).toEqual(["Mapo Tofu"]);
    expect(buildQueries(item("Lunch Combo Plate"))).toEqual(["Lunch Combo Plate"]);
    const calls: string[] = [];
    const lookup = vi.fn(async (q: string) => { calls.push(q); return [tag("urn:tag:specialty_dish:place:jasmine_tea", "Jasmine Tea")]; });
    const items = [item("Jasmine Tea"), item("jasmine tea"), item("Jasmine Tea (large)", "Jasmine Tea"), item("Mapo Tofu")];
    const out = await mapMenuTags(items, lookup, { concurrency: 2 });
    expect(lookup).toHaveBeenCalledTimes(2); // "Jasmine Tea" (three spellings) + "Mapo Tofu"
    expect(new Set(calls.map((q) => q.toLowerCase()))).toEqual(new Set(["jasmine tea", "mapo tofu"]));
    expect(out.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(out.slice(0, 3).every((r) => r.qlooTagIds[0] === "urn:tag:specialty_dish:place:jasmine_tea")).toBe(true);
    expect(out[3]).toMatchObject({ qlooTagIds: [], ambiguous: false, queries: ["Mapo Tofu"] });
  });
  it("never passes an ambiguous tag downstream, even when a second query would match", async () => {
    const lookup = vi.fn(async (q: string) => (q === "Jazz Fusion Bowl"
      ? [tag("urn:tag:genre:music:jazz_fusion_bowl", "Jazz Fusion Bowl"), tag("urn:tag:keyword:book:jazz_fusion_bowl", "Jazz Fusion Bowl")]
      : [tag("urn:tag:specialty_dish:place:bowl", "Bowl")]));
    const [r] = await mapMenuTags([item("Jazz Fusion Bowl")], lookup);
    expect(r.ambiguous).toBe(true);
    expect(r.qlooTagIds).toEqual([]);
    expect(r.tagCandidates).toHaveLength(2);
    expect(lookup).toHaveBeenCalledTimes(1); // ambiguity is decisive: the fallback query is not tried
  });
  it("records a lookup failure as unmapped rather than throwing", async () => {
    const lookup = vi.fn(async () => { throw new Error("429"); });
    const [r] = await mapMenuTags([item("Pho")], lookup);
    expect(r).toMatchObject({ qlooTagIds: [], ambiguous: false, error: "429" });
  });
});

describe("fetchMenuFromUrl", () => {
  it("rejects non-http schemes and private hosts without calling fetch", async () => {
    const fetchImpl = vi.fn();
    for (const u of ["ftp://example.com/menu", "file:///etc/passwd", "http://localhost/menu", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest", "http://[::1]/", "not a url"]) {
      await expect(fetchMenuFromUrl(u, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(MenuFetchError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(assertSafeMenuUrl("https://example.com/menu").hostname).toBe("example.com");
  });
  it("parses an HTML page from an injected fetch and refuses non-text content", async () => {
    const html = "<html><body><h2>Mains</h2><p>Mapo Tofu ... $14</p></body></html>";
    const ok = vi.fn(async () => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
    const out = await fetchMenuFromUrl("https://example.com/menu", ok as unknown as typeof fetch);
    expect(out.source).toBe("url");
    expect(out.items.map((i) => [i.name, i.priceCents, i.category])).toEqual([["Mapo Tofu", 1400, "Mains"]]);
    const pdf = vi.fn(async () => new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } }));
    await expect(fetchMenuFromUrl("https://example.com/menu.pdf", pdf as unknown as typeof fetch)).rejects.toMatchObject({ reason: "bad_content_type" });
  });
  it("re-validates redirect targets so a public URL cannot bounce into the private network", async () => {
    const redirect = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    await expect(fetchMenuFromUrl("https://example.com/menu", redirect as unknown as typeof fetch)).rejects.toMatchObject({ reason: "blocked_host" });
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});

describe("vision", () => {
  it("throws a clear error when no key and no client are configured", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try { await expect(parseMenuImage({ base64: "AAAA", mediaType: "image/png" })).rejects.toThrow("ANTHROPIC_API_KEY is not configured"); }
    finally { if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev; }
  });
  it("parses the first JSON array in the model text, coerces prices, drops unnamed items", () => {
    const { items, warnings } = parseMenuJson('Here you go:\n```json\n[{"name":"麻婆豆腐","name_en":"Mapo Tofu","price":"14.50","category":"Mains"},{"name":"","price":3},{"name":"Rice","price":null}]\n```');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "麻婆豆腐", nameEn: "Mapo Tofu", priceCents: 1450, category: "Mains", sortIndex: 0 });
    expect(items[1]).toMatchObject({ name: "Rice", priceCents: 0, category: "Menu", sortIndex: 1 });
    expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/Rice.*no price/), "1 unnamed entry was dropped"]));
    expect(parseMenuJson("I cannot read this image.").items).toEqual([]);
  });
  it("uses an injected client with a base64 image block and never touches the network", async () => {
    const create = vi.fn(async (req: unknown) => ({ content: [{ type: "text", text: req ? '[{"name":"Pho","price":12}]' : "[]" }], stop_reason: "end_turn" }));
    const client = { messages: { create } } as unknown as Anthropic;
    const out = await parseMenuImage({ base64: "AAAA", mediaType: "image/jpeg" }, client);
    expect(out).toMatchObject({ source: "photo", items: [{ name: "Pho", priceCents: 1200 }] });
    const req = create.mock.calls[0][0] as { model: string; max_tokens: number; messages: Array<{ content: Array<{ type: string; source?: { media_type: string } }> }> };
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.max_tokens).toBe(16000);
    expect(req.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
  });
});
