import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { authorizeOrg } from "@/lib/front/auth";
import { getBrand, listBrandStores, saveHoldout } from "@/lib/front/db";
import { scheduleHoldout } from "@/lib/front/holdout";

const bodySchema = z.object({ startsAt: z.string().datetime().optional(), heat: z.record(z.string(), z.number().nullable()).optional(), seed: z.number().int().optional() });

/** Brand: random half of the stores change, half hold out, stratified by heat z-score; the seed makes it reproducible. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const brand = await getBrand(db, id);
  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeOrg(brand.organizationId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  let body: unknown = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const p = bodySchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const stores = await listBrandStores(db, id);
  if (stores.length < 2) return NextResponse.json({ error: "A store split needs at least 2 stores" }, { status: 409 });
  const plan = scheduleHoldout({ kind: "store_split", brandId: id, startsAt: p.data.startsAt ?? new Date().toISOString(), tz: RESTAURANT_TZ, stores: stores.map((s) => ({ id: s.id, heat: p.data.heat?.[s.id] ?? null })), seed: p.data.seed });
  return NextResponse.json({ ok: true, holdout: await saveHoldout(plan) });
}
