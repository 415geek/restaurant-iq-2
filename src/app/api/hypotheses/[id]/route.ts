import { NextResponse } from "next/server";
import { hypothesisStatusSchema } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";


export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = hypothesisStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "status must be pursued or rejected" }, { status: 400 });
  const db = getServiceClient();
  const { data: h } = await db.from("opportunity_hypotheses").select("id, restaurant_id, title, status").eq("id", id).maybeSingle();
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeRestaurant(h.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  if (h.status !== "proposed") return NextResponse.json({ error: `Hypothesis already ${h.status}` }, { status: 409 });
  const { error } = await db.from("opportunity_hypotheses").update({ status: parsed.data.status }).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  await db.from("decision_events").insert({
    restaurant_id: h.restaurant_id, kind: parsed.data.status === "pursued" ? "hypothesis_pursued" : "hypothesis_rejected", subject_id: id,
    summary: `${parsed.data.status === "pursued" ? "Pursuing" : "Rejected"} "${h.title}"${parsed.data.note ? `: ${parsed.data.note}` : ""}`,
    payload: { note: parsed.data.note ?? null }, actor: actorLabel(access),
  });
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
