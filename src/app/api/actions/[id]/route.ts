import { NextResponse } from "next/server";
import { actionPatchSchema, canTransition, type ActionStatus } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";


export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = actionPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  const db = getServiceClient();
  const { data: a } = await db.from("action_items").select("id, restaurant_id, title, status, requires_approval, external_side_effect").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeRestaurant(a.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.owner !== undefined) patch.owner = parsed.data.owner;
  if (parsed.data.dueDate !== undefined) patch.due_date = parsed.data.dueDate;
  const events: Array<{ kind: string; summary: string; payload: unknown }> = [];

  if (parsed.data.status && parsed.data.status !== a.status) {
    const from = a.status as ActionStatus;
    const to = parsed.data.status;
    let hasApproval = false;
    if (from === "needs_approval" && to === "ready") {
      // approval is recorded now, by the acting human
      const { error } = await db.from("approvals").insert({ action_item_id: a.id, restaurant_id: a.restaurant_id, approved_by: access.kind === "member" ? access.userId : null, actor_label: actorLabel(access), decision: "approved", note: parsed.data.approvalNote ?? null });
      if (error) return NextResponse.json({ error: "Approval failed" }, { status: 500 });
      hasApproval = true;
      events.push({ kind: "action_approved", summary: `Approved "${a.title}"${parsed.data.approvalNote ? `: ${parsed.data.approvalNote}` : ""}`, payload: { actionId: a.id, externalSideEffect: a.external_side_effect } });
    }
    const t = canTransition(from, to, { requiresApproval: a.requires_approval, hasApproval });
    if (!t.ok) return NextResponse.json({ error: t.reason }, { status: 409 });
    patch.status = to;
    events.push({ kind: "action_status_changed", summary: `"${a.title}" moved ${from.replace("_", " ")} → ${to.replace("_", " ")}`, payload: { actionId: a.id, from, to } });
  }
  if (Object.keys(patch).length) {
    const { error } = await db.from("action_items").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  if (events.length) await db.from("decision_events").insert(events.map((e) => ({ restaurant_id: a.restaurant_id, kind: e.kind, subject_id: a.id, summary: e.summary, payload: e.payload, actor: actorLabel(access) })));
  return NextResponse.json({ ok: true, status: patch.status ?? a.status });
}
