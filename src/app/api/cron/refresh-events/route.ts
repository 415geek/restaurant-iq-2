import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/db/server";
import { refreshArea } from "@/lib/events-store";

export const maxDuration = 60;

/** Daily rolling refresh of local events for every restaurant area. Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const got = Buffer.from(req.headers.get("authorization") ?? ""); const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  const { data } = await db.from("restaurants").select("city, neighborhood").limit(200);
  const areas = new Map<string, { city: string; neighborhood: string | null }>();
  for (const r of data ?? []) { const k = `${String(r.city).toLowerCase()}`; if (!areas.has(k)) areas.set(k, { city: r.city as string, neighborhood: (r.neighborhood as string) ?? null }); }
  const force = new URL(req.url).searchParams.get("force") === "web"; // manual retry after the search quota renews
  const out: Record<string, unknown> = {};
  for (const [k, a] of [...areas].slice(0, 25)) out[k] = await refreshArea(a, { web: true, force });
  return NextResponse.json({ ok: true, areas: out }, { headers: { "Cache-Control": "no-store" } });
}
