import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { createQlooProvider } from "@/lib/providers/qloo";
import { SupabaseAnalysisStore } from "@/lib/agents/store";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { authorizeOrg } from "@/lib/front/auth";
import { getStore, updateItemTags, getItems } from "@/lib/front/db";
import { parseMenuCsv, parseMenuText, type ParsedItem } from "@/lib/front/menu/parse";
import { fetchMenuFromUrl } from "@/lib/front/menu/fetch";
import { parseMenuImage } from "@/lib/front/menu/vision";
import { mapMenuTags } from "@/lib/front/menu/tags";

export const maxDuration = 120;
const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("csv"), text: z.string().min(1).max(200_000) }),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(200_000) }),
  z.object({ kind: z.literal("url"), url: z.string().url().max(2000) }),
  z.object({ kind: z.literal("image"), base64: z.string().min(100).max(8_000_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]) }),
  z.object({ kind: z.literal("retag") }),
]);

/**
 * Replace a store's menu from a CSV, pasted text, a public URL or a photo, then map every item to Qloo tags
 * (ambiguous ones are kept out of scoring until resolved). "retag" re-runs the tag mapping on the current menu.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const store = await getStore(db, id);
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeOrg(store.organizationId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "front-menu", limit: 10 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = bodySchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid menu input" }, { status: 400 });
  const warnings: string[] = [];
  let parsed: ParsedItem[] | null = null; let source = "manual";
  try {
    if (p.data.kind === "csv") { const r = parseMenuCsv(p.data.text); parsed = r.items; warnings.push(...r.warnings); source = "csv"; }
    else if (p.data.kind === "text") { const r = parseMenuText(p.data.text); parsed = r.items; warnings.push(...r.warnings); source = "manual"; }
    else if (p.data.kind === "url") { const r = await fetchMenuFromUrl(p.data.url); parsed = r.items; warnings.push(...r.warnings); source = "url"; }
    else if (p.data.kind === "image") { const r = await parseMenuImage({ base64: p.data.base64, mediaType: p.data.mediaType }); parsed = r.items; warnings.push(...r.warnings); source = "photo"; }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Could not read the menu" }, { status: 422 });
  }
  if (parsed && parsed.length === 0) return NextResponse.json({ error: "No menu items found", warnings }, { status: 422 });
  if (parsed) {
    const { data: m, error } = await db.from("front_menus").insert({ store_id: store.id, source }).select("id").single();
    if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
    await db.from("front_menu_items").delete().eq("store_id", store.id);
    const { error: e2 } = await db.from("front_menu_items").insert(parsed.map((i) => ({ menu_id: m.id, store_id: store.id, name: i.name, name_en: i.nameEn, description: i.description, price_cents: i.priceCents, category: i.category, sort_index: i.sortIndex })));
    if (e2) return NextResponse.json({ error: "Could not save items" }, { status: 500 });
  }
  const items = await getItems(db, store.id);
  const provider = createQlooProvider(process.env, { store: new SupabaseAnalysisStore(db), traceId: `front-tags-${store.slug}` });
  const mapped = await mapMenuTags(items, async (q) => (await provider.findTags(q)).data, { concurrency: 4 });
  let ambiguous = 0;
  for (const r of mapped) { const it = items[r.index]; if (!it) continue; await updateItemTags(it.id, { qlooTagIds: r.qlooTagIds, tagCandidates: r.tagCandidates, ambiguous: r.ambiguous }); if (r.ambiguous) ambiguous++; }
  return NextResponse.json({ ok: true, items: items.length, mapped: mapped.filter((r) => r.qlooTagIds.length).length, ambiguous, warnings, mode: provider.mode });
}
