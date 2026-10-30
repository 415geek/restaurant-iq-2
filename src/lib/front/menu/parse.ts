import Papa from "papaparse";

/**
 * TasteFront menu ingestion — pure parsing, no network, no model. Three inputs land here: a CSV export, pasted/plain text,
 * and text pulled out of a menu web page (fetch.ts). Each becomes ParsedItem[] in reading order; sortIndex is that order.
 * Names stay in the source language; `nameEn` is only filled when the source makes the English explicit (a column, or a
 * CJK + Latin line such as "麻婆豆腐 Mapo Tofu 14.50"). Nothing here invents prices: a line without one is a section or a description.
 */
export interface ParsedItem { name: string; nameEn: string | null; description: string | null; priceCents: number; category: string; sortIndex: number }
export interface ParsedMenu { items: ParsedItem[]; warnings: string[] }

export const DEFAULT_CATEGORY = "Menu";
const MAX_ITEMS = 500;

/* ---------- text helpers ---------- */

/** lowercase, NFKC (full-width → ASCII), punctuation → space, collapse spaces. Used as the identity for dedupe and tag matching. */
export function normalizeItemName(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

const CJK_CLASS = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\u3000-\\u303f\\uff00-\\uffef";
const CJK_RE = new RegExp(`[${CJK_CLASS}]`, "u");
const CJK_RUN_RE = new RegExp(`[${CJK_CLASS}][${CJK_CLASS}\\s]*`, "gu");
const LATIN_RE = /[A-Za-z]/;
export const hasCjk = (s: string): boolean => CJK_RE.test(s);

/** "麻婆豆腐 Mapo Tofu" → { name: "麻婆豆腐", nameEn: "Mapo Tofu" }; a name without both scripts is returned unchanged with nameEn null. */
export function splitBilingualName(raw: string): { name: string; nameEn: string | null } {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!hasCjk(s) || !LATIN_RE.test(s)) return { name: s, nameEn: null };
  const cjk = (s.match(CJK_RUN_RE) ?? []).map((p) => p.trim()).filter(Boolean).join(" ");
  const latin = s.replace(CJK_RUN_RE, " ").replace(/^[\s\-–—/|()（）:：,，、.]+|[\s\-–—/|()（）:：,，、.]+$/g, "").replace(/\s+/g, " ").trim();
  if (!cjk || !/[A-Za-z]{2,}/.test(latin)) return { name: s, nameEn: null };
  return { name: cjk, nameEn: latin };
}

/**
 * "$12.50" → 1250, "12,5" → 1250, "1,234.00" → 123400, "12" → 1200, "¥38" → 3800, "12.50 USD" → 1250. Null when no number.
 * A single comma followed by 1–2 digits is a decimal comma; otherwise commas are thousands separators.
 */
export function parsePriceCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  const s = raw.normalize("NFKC").replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  let num: string;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) num = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) num = s.replace(",", ".");
  else num = s.replace(/,/g, "");
  const m = num.match(/\d+(\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

const countWords = (s: string): number => {
  // a CJK run counts as one word; Latin words split on whitespace
  const latin = s.replace(CJK_RUN_RE, " ").split(/\s+/).filter(Boolean).length;
  const cjk = (s.match(CJK_RUN_RE) ?? []).length;
  return latin + cjk;
};

/* ---------- CSV ---------- */

const HEADER_SYNONYMS: Record<"name" | "nameEn" | "description" | "price" | "category", RegExp> = {
  nameEn: /^(name[ _-]?en|en[ _-]?name|english([ _-]?name)?|item[ _-]?en|english[ _-]?title|英文名?|英文名称)$/i,
  name: /^(name|item|dish|menu[ _-]?item|item[ _-]?name|dish[ _-]?name|title|product|product[ _-]?name|plato|nombre|菜名|名称|品名|菜品|商品名?)$/i,
  description: /^(desc|description|details?|notes?|ingredients?|descripci[oó]n|描述|说明|简介)$/i,
  price: /^(price|prices|unit[ _-]?price|amount|cost|precio|价格|售价|单价|\$|usd)$/i,
  category: /^(category|categories|section|group|menu[ _-]?section|course|type|categor[ií]a|secci[oó]n|分类|类别|类型|菜系)$/i,
};
const normHeader = (h: string): string => h.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}$]+/gu, " ").trim().replace(/\s+/g, "_");

function detectColumns(headers: string[]): Partial<Record<keyof typeof HEADER_SYNONYMS, number>> {
  const out: Partial<Record<keyof typeof HEADER_SYNONYMS, number>> = {};
  const norm = headers.map(normHeader);
  // exact synonym first (nameEn before name so "name_en" is not swallowed by "name"), then a loose contains-match
  for (const key of ["nameEn", "name", "description", "price", "category"] as const) {
    const i = norm.findIndex((h, idx) => HEADER_SYNONYMS[key].test(h) && !Object.values(out).includes(idx));
    if (i >= 0) out[key] = i;
  }
  const loose: Array<[keyof typeof HEADER_SYNONYMS, RegExp]> = [["nameEn", /english|name_en|en_name/], ["price", /price|价格/], ["description", /desc|描述/], ["category", /categor|section|分类/], ["name", /name|item|dish|菜/]];
  for (const [key, re] of loose) {
    if (out[key] !== undefined) continue;
    const i = norm.findIndex((h, idx) => re.test(h) && !Object.values(out).includes(idx));
    if (i >= 0) out[key] = i;
  }
  return out;
}

export function parseMenuCsv(text: string): ParsedMenu {
  const warnings: string[] = [];
  const items: ParsedItem[] = [];
  const clean = text.replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(clean, { skipEmptyLines: "greedy", delimiter: "" });
  const rows = parsed.data.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim()) : [])).filter((r) => r.some(Boolean));
  if (!rows.length) return { items, warnings: ["CSV is empty"] };

  const headers = rows[0];
  const cols = detectColumns(headers);
  let body = rows.slice(1);
  if (cols.name === undefined) {
    // no recognizable header row: treat every row as data, column 0 = name, and look for a price-shaped column
    warnings.push("No name column found in the header; using the first column as the item name");
    body = rows;
    cols.name = 0;
  }
  if (cols.price === undefined) {
    const sample = body.slice(0, 50);
    const widths = Math.max(...sample.map((r) => r.length), 0);
    let best = -1, bestHits = 0;
    for (let c = 0; c < widths; c++) {
      if (c === cols.name || c === cols.nameEn || c === cols.category) continue;
      const hits = sample.filter((r) => r[c] && parsePriceCents(r[c]) !== null && /^[^A-Za-z]*\d[\d.,]*[^A-Za-z]*$/.test(r[c])).length;
      if (hits > bestHits) { best = c; bestHits = hits; }
    }
    if (best >= 0 && bestHits >= Math.max(1, Math.ceil(sample.length * 0.5))) { cols.price = best; warnings.push(`No price header; using column ${best + 1} ("${headers[best] ?? ""}") as price`); }
    else warnings.push("No price column found; items are recorded with price 0");
  }
  if (cols.category === undefined) warnings.push("No category column; section rows (name only, no price) are used as categories");

  const cell = (r: string[], i: number | undefined) => (i === undefined ? "" : (r[i] ?? ""));
  let section = DEFAULT_CATEGORY;
  body.forEach((r, rowIdx) => {
    const name = cell(r, cols.name);
    if (!name) return; // nothing to name the item by
    const priceRaw = cell(r, cols.price);
    const price = parsePriceCents(priceRaw);
    const rest = [cell(r, cols.description), cell(r, cols.nameEn)].some(Boolean);
    const catCell = cell(r, cols.category);
    if (price === null && !rest && !priceRaw) { section = name; return; } // a name-only row is a section header
    if (items.length >= MAX_ITEMS) { if (items.length === MAX_ITEMS) warnings.push(`Only the first ${MAX_ITEMS} items were kept`); return; }
    if (price === null) warnings.push(`Row ${rowIdx + 2}: "${name}" has no readable price${priceRaw ? ` ("${priceRaw}")` : ""}; recorded as 0`);
    const nameEn = cell(r, cols.nameEn) || null;
    items.push({ name, nameEn, description: cell(r, cols.description) || null, priceCents: price ?? 0, category: catCell || section, sortIndex: items.length });
  });
  if (!items.length) warnings.push("No menu items found in the CSV");
  return { items, warnings };
}

/* ---------- plain text ---------- */

// trailing price: optional separator run (dots, dashes, tabs, pipes, 2+ spaces), optional currency, number, optional currency/unit
// groups (tsconfig targets ES2017, so no named groups): 1 = leading currency, 2 = number, 3 = trailing currency/unit
const PRICE_TAIL = /(?:^|\s|[.…·\-–—|]|\t)[\s.…·\-–—|]*(?:([$€£¥￥]|usd|rmb|hkd)\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s*([$€£¥￥]|usd|rmb|hkd|元|dollars?|€)?\s*$/iu;
const SEPARATOR_BEFORE = /(?:[.…·]{2,}|[\-–—]|\||\t|\s{2,}|\s[$€£¥￥])\s*[$€£¥￥]?\s*[\d.,]+\s*[^\d\s]*\s*$/u;
const DESC_SPLIT = /\s+[\-–—|:：]\s+|\s*[–—]\s*|\s+-\s+/u;

/**
 * Pull "<name> ... $14" apart. A bare integer with only a single space before it is accepted when it is a plausible price
 * (3..999) — "Mapo Tofu 14" is a priced line, "Combo 2" / "Section 1" stay section names. Currency symbols, decimals or a
 * separator run (dots, dash, tab, 2+ spaces) always mark a price.
 */
export function splitPriceFromLine(line: string): { text: string; priceCents: number | null } {
  const m = line.match(PRICE_TAIL);
  if (!m) return { text: line, priceCents: null };
  const [, sym, num, unit] = m;
  const hasCurrency = !!sym || !!unit;
  const hasDecimal = /[.,]\d{1,2}$/.test(num);
  const plausibleBare = /^\d{1,3}$/.test(num) && Number(num) >= 3;
  if (!hasCurrency && !hasDecimal && !SEPARATOR_BEFORE.test(line) && !plausibleBare) return { text: line, priceCents: null };
  const price = parsePriceCents(num);
  if (price === null) return { text: line, priceCents: null };
  const text = line.slice(0, m.index ?? 0).replace(/[\s.…·\-–—|:：]+$/u, "").trim();
  if (!text) return { text: line, priceCents: null };
  return { text, priceCents: price };
}

const looksLikeHeader = (line: string): boolean => {
  if (/[.!?。！？]$/.test(line)) return false; // sentence punctuation → prose
  if (countWords(line) > 4) return false;
  return true;
};

export function parseMenuText(text: string): ParsedMenu {
  const warnings: string[] = [];
  const items: ParsedItem[] = [];
  let section = DEFAULT_CATEGORY;
  let last: ParsedItem | null = null;
  // tabs and runs of spaces become exactly two spaces: still a separator for splitPriceFromLine, but never wider
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[\t ]/g, "  ").replace(/ {2,}/g, "  ").trim());
  for (const line of lines) {
    if (!line) { last = null; continue; } // a blank line closes the previous item's description
    const { text: body, priceCents } = splitPriceFromLine(line);
    if (priceCents !== null) {
      if (items.length >= MAX_ITEMS) { if (items.length === MAX_ITEMS) warnings.push(`Only the first ${MAX_ITEMS} items were kept`); continue; }
      const [head, ...tail] = body.split(DESC_SPLIT);
      const { name, nameEn } = splitBilingualName(head.trim());
      const inline = tail.join(" ").trim();
      last = { name, nameEn, description: inline || null, priceCents, category: section, sortIndex: items.length };
      items.push(last);
      continue;
    }
    if (looksLikeHeader(line)) { section = line.replace(/[:：]$/, "").trim(); last = null; continue; }
    if (last) { last.description = last.description ? `${last.description} ${line}` : line; continue; }
    // prose before any item (e.g. a restaurant blurb): ignored but counted so the owner can see what was skipped
    warnings.push(`Skipped line: "${line.slice(0, 60)}${line.length > 60 ? "…" : ""}"`);
  }
  if (!items.length) warnings.push("No priced lines found; nothing parsed");
  return { items, warnings: warnings.slice(0, 40) };
}

/* ---------- HTML → text ---------- */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", bull: "•", middot: "·",
  yen: "¥", euro: "€", pound: "£", cent: "¢", copy: "©", reg: "®", trade: "™", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
};
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,8});/gi, (all, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[body.toLowerCase()] ?? all;
  });
}

const DROP_TAGS = ["script", "style", "noscript", "template", "svg", "iframe", "nav", "footer", "head", "form", "button", "select"];
const BLOCK_TAGS = "p|div|li|ul|ol|tr|table|section|article|aside|main|h[1-6]|br|hr|dt|dd|dl|blockquote|pre|figure|figcaption|summary|details";

/**
 * Regex-based stripper (cheerio is not installed): drops scripts/styles/nav/footer, turns block boundaries into newlines and
 * table cells into double spaces (so "Mapo Tofu  14" still reads as a priced line), decodes entities, and squeezes whitespace.
 * Output is untrusted text: callers never put it in a system prompt.
 */
export function extractTextFromHtml(html: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, " ");
  for (const t of DROP_TAGS) s = s.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?<\\/${t}\\s*>`, "gi"), " ");
  s = s.replace(/<(?:header)\b[^>]*>[\s\S]*?<\/header\s*>/gi, " "); // site header = navigation; a <header> inside the menu is rare and only costs its title
  s = s.replace(/<\/?(?:td|th)\b[^>]*>/gi, "\t"); // cell boundary → tab, becomes the double-space price separator below
  s = s.replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*\\/?>`, "gi"), "\n");
  s = s.replace(/<[^>]+>/g, " "); // every other tag is inline
  s = decodeEntities(s).replace(/ /g, " ");
  // squeeze spaces to one, then each tab run (with any spaces around it) to exactly two spaces
  return s.split("\n").map((l) => l.replace(/ +/g, " ").replace(/ ?\t[\t ]*/g, "  ").trim()).filter(Boolean).join("\n");
}
