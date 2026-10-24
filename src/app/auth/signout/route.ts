import { NextResponse } from "next/server";
import { getSsrClient } from "@/lib/db/ssr";

export async function POST(req: Request) {
  const supabase = await getSsrClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", new URL(req.url).origin), { status: 303 });
}
