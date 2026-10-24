import { NextResponse } from "next/server";
import { scenarioRequestSchema } from "@/lib/validation/schemas";
import { computeScenario, scenarioAssumptionsSchema } from "@/lib/business/margin";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";


export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = scenarioRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid scenario request" }, { status: 400 });
  const assumptions = scenarioAssumptionsSchema.safeParse(Object.fromEntries(Object.entries(parsed.data.assumptions).map(([k, v]) => [k, typeof v === "string" && k !== "periodLabel" ? Number(v) : v])));
  if (!assumptions.success) return NextResponse.json({ error: "Invalid assumptions", issues: assumptions.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const db = getServiceClient();
  const { data: h } = await db.from("opportunity_hypotheses").select("id, restaurant_id, title, slug").eq("id", parsed.data.hypothesisId).maybeSingle();
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await authorizeRestaurant(h.restaurant_id);
  if (access.kind === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "mutations" });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const results = computeScenario(assumptions.data);
  const { data: row, error } = await db.from("scenarios").insert({ hypothesis_id: h.id, restaurant_id: h.restaurant_id, label: parsed.data.label, assumptions: assumptions.data, results, created_by: access.kind === "member" ? access.userId : null }).select("id").single();
  if (error) return NextResponse.json({ error: "Save failed" }, { status: 500 });
  await db.from("decision_events").insert({
    restaurant_id: h.restaurant_id, kind: "scenario_saved", subject_id: h.id,
    summary: `Saved scenario "${parsed.data.label}" for "${h.title}": adjusted weekly contribution ${results.adjustedIncrementalProfit >= 0 ? "+" : "-"}$${Math.abs(results.adjustedIncrementalProfit).toFixed(0)}`,
    payload: { lt: { key: "gen.evScenario", params: { label: parsed.data.label, title: { key: `hyp.${h.slug}.title` }, v: `${results.adjustedIncrementalProfit >= 0 ? "+" : "-"}$${Math.abs(results.adjustedIncrementalProfit).toFixed(0)}` } }, scenarioId: row.id, assumptions: assumptions.data, results }, actor: actorLabel(access),
  });
  return NextResponse.json({ ok: true, scenarioId: row.id, results });
}
