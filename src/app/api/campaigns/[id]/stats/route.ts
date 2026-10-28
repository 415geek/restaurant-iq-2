import { NextResponse } from "next/server";
import { getSsrClient } from "@/lib/db/ssr";
import { getCampaignStats } from "@/lib/campaigns";

/** Polled every few seconds by the proof dashboard. Read access is checked through RLS on campaigns. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await getSsrClient();
  const { data } = await supabase.from("campaigns").select("id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stats = await getCampaignStats(id);
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
