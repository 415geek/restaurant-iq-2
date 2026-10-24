import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/db/ssr";
import { createQlooProvider } from "@/lib/providers/qloo";
import { getServiceClient } from "@/lib/db/server";
import { SupabaseAnalysisStore } from "@/lib/agents/store";


/** Live Qloo verification: signed-in users only (prevents anonymous quota burn). Logs sanitized usage. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to run live verification" }, { status: 401 });
  const provider = createQlooProvider(process.env, { store: new SupabaseAnalysisStore(getServiceClient()), traceId: `verify-${Date.now()}` });
  const result = await provider.verifyLive();
  return NextResponse.json(result);
}
