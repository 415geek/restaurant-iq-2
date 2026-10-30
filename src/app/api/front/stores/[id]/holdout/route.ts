import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { authorizeOrg } from "@/lib/front/auth";
import { getStore, saveHoldout } from "@/lib/front/db";
import { scheduleHoldout } from "@/lib/front/holdout";

const bodySchema = z.object({ startsAt: z.string().datetime().optional() });

/** Single store: alternate weeks (change week, then control week), same local weekdays and hours. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const store = await getStore(db, id);
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeOrg(store.organizationId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  let body: unknown = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const p = bodySchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const plan = scheduleHoldout({ kind: "week_alternate", storeId: store.id, startsAt: p.data.startsAt ?? new Date().toISOString(), tz: RESTAURANT_TZ });
  return NextResponse.json({ ok: true, holdout: await saveHoldout(plan) });
}
