import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parsePriceCents, splitBilingualName, DEFAULT_CATEGORY, type ParsedItem } from "./parse";

/**
 * Menu photo → items, via Claude vision. The model transcribes; it never prices, totals or invents anything (the prompt says so,
 * and anything without a name is dropped here). Cents are computed in parsePriceCents, not by the model.
 * The photo is owner-supplied data: it goes in the user turn only, and there is no system prompt to inject into.
 */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export type MenuImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const PROMPT = `This is a photo of a restaurant menu. Transcribe every menu item you can read, in reading order (top to bottom, left column before right column).
Return ONLY a JSON array, no prose, where each element is {"name": string, "name_en": string|null, "description": string|null, "price": number|null, "category": string|null}.
Rules:
- Keep "name" exactly in the language printed on the menu. Put an English name in "name_en" only if the menu prints one; otherwise null.
- "price" is the number printed next to the item (no currency symbol). If no price is printed, use null. Never guess or invent a price or an item.
- "category" is the section heading the item sits under, or null if there is none.
- Skip headings, phone numbers, addresses and marketing text. If the image is not a menu or is unreadable, return [].`;

const rawItem = z.object({
  name: z.string().optional().nullable(),
  name_en: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.union([z.number(), z.string()]).optional().nullable(),
  category: z.string().optional().nullable(),
}).loose();
const rawItems = z.array(z.unknown());

/** Find the first balanced JSON array in free text (fences, prose around it, etc.). Returns null when none parses. */
export function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") { depth--; if (depth === 0) { try { const v = JSON.parse(text.slice(start, i + 1)) as unknown; return Array.isArray(v) ? v : null; } catch { return null; } } }
  }
  return null;
}

/** Pure: model text → items + warnings. Exported for tests; parseMenuImage is the only caller in production. */
export function parseMenuJson(text: string): { items: ParsedItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const arr = extractJsonArray(text);
  if (!arr) return { items: [], warnings: ["The model did not return a JSON array"] };
  const parsed = rawItems.safeParse(arr);
  if (!parsed.success) return { items: [], warnings: ["The model's JSON array could not be read"] };
  const items: ParsedItem[] = [];
  let dropped = 0;
  for (const raw of parsed.data) {
    const r = rawItem.safeParse(raw);
    const name = r.success ? (r.data.name ?? "").replace(/\s+/g, " ").trim() : "";
    if (!r.success || !name) { dropped++; continue; }
    const price = parsePriceCents(r.data.price ?? null);
    if (price === null) warnings.push(`"${name}": no price printed; recorded as 0`);
    const split = r.data.name_en ? { name, nameEn: r.data.name_en.trim() || null } : splitBilingualName(name);
    items.push({ name: split.name, nameEn: split.nameEn, description: r.data.description?.trim() || null, priceCents: price ?? 0, category: r.data.category?.trim() || DEFAULT_CATEGORY, sortIndex: items.length });
  }
  if (dropped) warnings.push(`${dropped} unnamed entr${dropped === 1 ? "y was" : "ies were"} dropped`);
  if (!items.length) warnings.push("No menu items were read from the photo");
  return { items, warnings };
}

export async function parseMenuImage(input: { base64: string; mediaType: MenuImageMediaType }, client?: Anthropic): Promise<{ items: ParsedItem[]; warnings: string[]; source: "photo" }> {
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  const c = client ?? new Anthropic();
  const res = await c.messages.create({
    model: MODEL, max_tokens: 16000,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64.replace(/\s+/g, "") } },
      { type: "text", text: PROMPT },
    ] }],
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
  const out = parseMenuJson(text);
  if (res.stop_reason === "max_tokens") out.warnings.unshift("The transcription was cut off; the last items may be missing");
  if (res.stop_reason === "refusal") out.warnings.unshift("The model declined to read this image");
  return { ...out, source: "photo" };
}
