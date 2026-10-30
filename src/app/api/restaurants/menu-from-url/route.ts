import { NextResponse } from "next/server";
import { z } from "zod";
import { getSsrClient } from "@/lib/db/ssr";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { fetchMenuFromUrl, MenuFetchError } from "@/lib/front/menu/fetch";

const bodySchema = z.object({ url: z.string().trim().url().max(300) });

/** Onboarding helper: read a public menu page (restaurant site or delivery-app listing) and return it as editable text lines. Signed-in callers only; SSRF-guarded by the shared menu fetcher. */
export async function POST(req: Request) {
  const supabase = await getSsrClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "menu_import", limit: 10, windowSeconds: 600 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  try {
    const { items, warnings } = await fetchMenuFromUrl(parsed.data.url);
    const text = items.slice(0, 60).map((i) => `${i.name}${i.nameEn && i.nameEn !== i.name ? ` (${i.nameEn})` : ""} | ${i.category.toLowerCase().replace(/\s+/g, "_")} | ${(i.priceCents / 100).toFixed(2)} |`).join("\n");
    return NextResponse.json({ text, n: Math.min(items.length, 60), warnings });
  } catch (e) {
    const code = e instanceof MenuFetchError ? e.message : "fetch_failed";
    return NextResponse.json({ error: code.slice(0, 80) }, { status: 422 });
  }
}
