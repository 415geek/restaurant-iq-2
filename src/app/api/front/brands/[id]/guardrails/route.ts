import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { authorizeOrg } from "@/lib/front/auth";
import { getBrand, getGuardrails } from "@/lib/front/db";

const bodySchema = z.object({
  renamableItemIds: z.array(z.string().uuid()).max(500).optional(),
  priceBandPct: z.number().min(0).max(100).optional(),
  bannedTerms: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  tone: z.enum(["warm", "plain", "playful", "premium"]).optional(),
});

/** HQ guardrails for a brand: what stores may rename, the price band, banned terms, tone. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const brand = await getBrand(db, id);
  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeOrg(brand.organizationId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = bodySchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid guardrails" }, { status: 400 });
  const row: Record<string, unknown> = { brand_id: id, updated_at: new Date().toISOString() };
  if (p.data.renamableItemIds) row.renamable_item_ids = p.data.renamableItemIds;
  if (p.data.priceBandPct !== undefined) row.price_band_pct = p.data.priceBandPct;
  if (p.data.bannedTerms) row.banned_terms = p.data.bannedTerms;
  if (p.data.tone) row.tone = p.data.tone;
  const { error } = await db.from("front_guardrails").upsert(row);
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true, guardrails: await getGuardrails(db, id) });
}
