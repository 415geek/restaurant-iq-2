import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/db/server";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { actorLabel } from "@/lib/auth/authorize";
import { authorizeOrg } from "@/lib/front/auth";
import { getStore, publishVersion, rollbackVersion, toVersion } from "@/lib/front/db";

const bodySchema = z.object({ action: z.enum(["publish", "rollback"]) });

/** Publish a draft storefront version (the owner's press-and-hold) or roll a published one back. Both are immutable events. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = bodySchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const db = getServiceClient();
  const { data: v } = await db.from("front_versions").select("*").eq("id", id).maybeSingle();
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const version = toVersion(v);
  const store = await getStore(db, version.storeId);
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeOrg(store.organizationId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  if (version.generatedBy === "baseline") return NextResponse.json({ error: "The Qloo-off baseline is a comparison, not a publishable version" }, { status: 409 });
  try {
    if (p.data.action === "publish") {
      if (version.status !== "draft") return NextResponse.json({ error: `Version is ${version.status}` }, { status: 409 });
      return NextResponse.json({ ok: true, version: await publishVersion(id, actorLabel(access)) });
    }
    if (version.status !== "published") return NextResponse.json({ error: `Version is ${version.status}` }, { status: 409 });
    return NextResponse.json({ ok: true, version: await rollbackVersion(id, actorLabel(access)) });
  } catch {
    return NextResponse.json({ error: "Could not update the version (nothing was saved)" }, { status: 500 });
  }
}
