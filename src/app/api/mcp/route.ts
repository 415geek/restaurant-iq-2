import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { currentVersion, getItems, getMovesForVersion, getRuns, getStoreBySlug, getVersions } from "@/lib/front/db";
import { DEMO_ORG_ID } from "@/lib/front/types";

/**
 * Minimal MCP server (Streamable HTTP, JSON-RPC 2.0, stateless) so a POS assistant can call TasteFront.
 * Tools: storefront_profile(store) and storefront_moves(store). Read-only; demo tenant only (no credentials).
 * Client config: { "mcpServers": { "tastefront": { "url": "https://restaurant-iq-2.vercel.app/api/mcp" } } }
 */
const TOOLS = [
  { name: "storefront_profile", description: "What the neighborhood around a TasteFront store leans toward: top Qloo tags with affinity, demographics, crowd-vs-city lift per menu item, and the current storefront version. Input: { store: slug }.", inputSchema: { type: "object", properties: { store: { type: "string", description: "store slug, e.g. chuan-lane-san-bruno" } }, required: ["store"] } },
  { name: "storefront_moves", description: "The moves in the store's current published storefront (reorder / rename / feature / promote / pass) with before→after, cited Qloo evidence and verification flags. Input: { store: slug }.", inputSchema: { type: "object", properties: { store: { type: "string" } }, required: ["store"] } },
];
const rpc = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(), params: z.unknown().optional() });
const ok = (id: unknown, result: unknown) => NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
const err = (id: unknown, code: number, message: string) => NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (v: unknown) => ({ content: [{ type: "text", text: JSON.stringify(v, null, 1) }] });

async function profile(slug: string) {
  const db = getServiceClient();
  const store = await getStoreBySlug(db, slug);
  if (!store || store.organizationId !== DEMO_ORG_ID) return null;
  const [versions, runs, items] = await Promise.all([getVersions(db, store.id), getRuns(db, store.id, 5), getItems(db, store.id)]);
  const run = runs.find((r) => r.variant === "qloo" && r.status === "completed") ?? null;
  const tagsCall = run?.calls.find((c) => c.purpose === "neighborhood_tags"); const liftCall = run?.calls.find((c) => c.purpose === "rank"); const demo = run?.calls.find((c) => c.purpose === "demographics");
  const cur = currentVersion(versions);
  return {
    store: { slug: store.slug, name: store.name, neighborhood: store.neighborhood, city: store.city, cuisine: store.cuisine, synthetic: true },
    interpretation: "Affinity and lift describe what this crowd leans toward. They are not demand, prediction or proof of sales.",
    neighborhood: { tags: (tagsCall?.facts ?? []).slice(0, 12), retrievedAt: tagsCall?.provenance.retrievedAt ?? null, mode: run?.mode ?? null },
    demographics: demo?.facts ?? [],
    lift: (liftCall?.facts ?? []).slice(0, 20),
    menu: items.map((i) => ({ id: i.id, name: i.name, nameEn: i.nameEn, category: i.category, priceCents: i.priceCents, qlooTagIds: i.qlooTagIds, ambiguous: i.ambiguous })),
    currentVersion: cur ? { versionNo: cur.versionNo, publishedAt: cur.publishedAt, items: cur.items } : null,
    caveats: run?.caveats ?? [],
  };
}
async function moves(slug: string) {
  const db = getServiceClient();
  const store = await getStoreBySlug(db, slug);
  if (!store || store.organizationId !== DEMO_ORG_ID) return null;
  const versions = await getVersions(db, store.id);
  const cur = currentVersion(versions) ?? versions.find((v) => v.generatedBy === "qloo") ?? null;
  if (!cur) return { store: store.slug, version: null, moves: [] };
  const items = await getItems(db, store.id); const nameOf = new Map(items.map((i) => [i.id, i.nameEn ?? i.name]));
  const ms = await getMovesForVersion(db, cur.id);
  return { store: store.slug, version: { versionNo: cur.versionNo, status: cur.status, generatedBy: cur.generatedBy }, moves: ms.map((m) => ({ ...m, item: nameOf.get(m.itemId) ?? m.itemId })) };
}

export async function POST(req: Request) {
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mcp", limit: 60 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return err(null, -32700, "Parse error"); }
  const p = rpc.safeParse(body);
  if (!p.success) return err(null, -32600, "Invalid request");
  const { id, method, params } = p.data;
  switch (method) {
    case "initialize": return ok(id, { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "tastefront", version: "0.1.0" } });
    case "notifications/initialized": case "ping": return ok(id, {});
    case "tools/list": return ok(id, { tools: TOOLS });
    case "tools/call": {
      const call = z.object({ name: z.string(), arguments: z.object({ store: z.string().regex(/^[a-z0-9-]{3,60}$/) }).optional() }).safeParse(params);
      if (!call.success) return err(id, -32602, "Invalid params");
      const slug = call.data.arguments?.store ?? "";
      const r = call.data.name === "storefront_profile" ? await profile(slug) : call.data.name === "storefront_moves" ? await moves(slug) : undefined;
      if (r === undefined) return err(id, -32601, "Unknown tool");
      if (r === null) return ok(id, { ...text({ error: "store not found (demo stores only)" }), isError: true });
      return ok(id, text(r));
    }
    default: return err(id, -32601, "Method not found");
  }
}
export function GET() {
  return NextResponse.json({ name: "tastefront", transport: "streamable-http (stateless, POST JSON-RPC)", tools: TOOLS.map((t) => t.name), config: { mcpServers: { tastefront: { url: "https://restaurant-iq-2.vercel.app/api/mcp" } } } });
}
