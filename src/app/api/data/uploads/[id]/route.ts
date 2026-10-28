import { NextResponse } from "next/server";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { brainEvent } from "@/lib/brain";
import { refreshInsights } from "@/lib/ingest/pipeline";

/** Remove one upload and every record it produced. The Brain logs the removal; learned mappings stay. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = getServiceClient();
  const { data: up } = await db.from("data_uploads").select("id, restaurant_id, file_name, imported_count").eq("id", id).maybeSingle();
  if (!up) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await authorizeRestaurant(up.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "data", limit: 40 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  await db.from("data_uploads").delete().eq("id", id);
  const actor = actorLabel(access);
  await brainEvent(db, { restaurantId: up.restaurant_id, kind: "data_deleted", subjectId: id, actor, summary: `Removed upload ${up.file_name} (${up.imported_count} rows)`, lt: { key: "data.evDeleted", params: { name: up.file_name, n: up.imported_count } } });
  await refreshInsights(db, up.restaurant_id, actor);
  return NextResponse.json({ ok: true });
}
