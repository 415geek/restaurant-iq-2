import { NextResponse } from "next/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";

/** Privacy-safe view counter: at most one count per IP-hash per campaign per 30 minutes. Nothing about the visitor is stored. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const db = getServiceClient();
  const { data: c } = await db.from("campaigns").select("id").eq("slug", slug).maybeSingle();
  if (!c) return NextResponse.json({ ok: false }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: `view:${c.id}`, limit: 1, windowSeconds: 1800 });
  if (rl.ok) await db.rpc("bump_campaign_views", { p_campaign: c.id });
  return NextResponse.json({ ok: true, counted: rl.ok });
}
