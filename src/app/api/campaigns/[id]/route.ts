import { NextResponse } from "next/server";
import { campaignPatchSchema } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { campaignCanTransition } from "@/lib/business/tastepass";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = campaignPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const db = getServiceClient();
  const { data: c } = await db.from("campaigns").select("id, restaurant_id, offer_name, status, decision").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeRestaurant(c.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const t = campaignCanTransition(c.status, "ended", c.decision);
  if (!t.ok) return NextResponse.json({ error: t.reason }, { status: 409 });
  await db.from("campaigns").update({ status: "ended" }).eq("id", id);
  await db.from("decision_events").insert({ restaurant_id: c.restaurant_id, kind: "campaign_ended", subject_id: id, summary: `Ended TastePass "${c.offer_name}"`, payload: { lt: { key: "pass.evEnded", params: { name: c.offer_name } } }, actor: actorLabel(access) });
  return NextResponse.json({ ok: true, status: "ended" });
}
