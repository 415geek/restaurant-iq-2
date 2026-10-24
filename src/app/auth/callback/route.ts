import { NextResponse } from "next/server";
import { getSsrClient } from "@/lib/db/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  if (code) {
    const supabase = await getSsrClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/app", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
