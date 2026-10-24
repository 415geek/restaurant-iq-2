import { NextResponse } from "next/server";
import { analysisRequestSchema } from "@/lib/validation/schemas";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { SupabaseAnalysisStore } from "@/lib/agents/store";
import { runAnalysis } from "@/lib/agents/orchestrator";
import { createQlooProvider, QlooError } from "@/lib/providers/qloo";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "restaurantId must be a UUID" }, { status: 400 });
  const { restaurantId } = parsed.data;

  const access = await authorizeRestaurant(restaurantId);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bucket = access.kind === "demo" ? "demo-analysis" : `member-analysis:${access.userId}`;
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket, limit: access.kind === "demo" ? 5 : 20 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached. Try again later.", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

  const store = new SupabaseAnalysisStore(getServiceClient());
  const provider = createQlooProvider(process.env, { store });
  try {
    const res = await runAnalysis({ store, provider, restaurantId, actor: actorLabel(access) });
    return NextResponse.json({ runId: res.runId, traceId: res.traceId, mode: res.mode, viableCount: res.viableCount, noViableOpportunity: res.noViableOpportunity, evidenceFailures: res.evidenceFailures, evaluatorPassed: res.evaluator.passed });
  } catch (err) {
    const errorClass = err instanceof QlooError ? err.errorClass : "internal";
    const status = errorClass === "quota_exceeded" ? 429 : errorClass === "forbidden" || errorClass === "no_key" ? 502 : 500;
    return NextResponse.json({ error: "Analysis failed", errorClass, mode: provider.mode }, { status });
  }
}
