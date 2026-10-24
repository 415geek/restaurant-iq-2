import { NextResponse } from "next/server";
import { hasServiceCredentials } from "@/lib/db/server";


export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    supabase: hasServiceCredentials() ? "configured" : "missing",
    qloo: process.env.QLOO_API_KEY ? "live" : "sample",
    llm: process.env.ANTHROPIC_API_KEY ? "configured" : "off",
  });
}
