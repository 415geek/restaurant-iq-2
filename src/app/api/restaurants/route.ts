import { NextResponse } from "next/server";
import { restaurantInputSchema, parseMenuText } from "@/lib/validation/schemas";
import { getSsrClient } from "@/lib/db/ssr";
import { getServiceClient } from "@/lib/db/server";


/** Create a restaurant inside the caller's organization (creates the org on first use). RLS-authorized via the user session. */
export async function POST(req: Request) {
  const supabase = await getSsrClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = restaurantInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  const d = parsed.data;

  let orgId: string | undefined;
  const { data: m } = await supabase.from("organization_memberships").select("organization_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (m) orgId = m.organization_id;
  else {
    const { data: created, error } = await supabase.rpc("create_organization", { org_name: `${auth.user.email ?? "My"} workspace` });
    if (error) return NextResponse.json({ error: "Could not create workspace" }, { status: 500 });
    orgId = created as string;
  }

  const { data: r, error: rErr } = await supabase.from("restaurants").insert({
    organization_id: orgId, name: d.name, neighborhood: d.neighborhood || null, city: d.city, cuisine: d.cuisine, service_formats: d.serviceFormats,
    hours_summary: d.hoursSummary || null, price_level: d.priceLevel ?? null, menu_url: d.menuUrl || null,
    cost_assumptions: { avg_ticket: d.avgTicket, food_cost_pct: d.foodCostPct, labor_cost_per_hour: d.laborCostPerHour, delivery_commission_pct: d.deliveryCommissionPct, card_fee_pct: 0.029, packaging_per_order: 0.85 },
    objectives: { primary: d.objective || undefined, constraints: (d.constraints || "").split(",").map((s) => s.trim()).filter(Boolean) },
    pos_preference: d.posPreference || null, data_mode: process.env.QLOO_API_KEY && !d.useSampleData ? "live" : "sample",
  }).select("id").single();
  if (rErr || !r) return NextResponse.json({ error: "Could not save restaurant" }, { status: 500 });

  const items = parseMenuText(d.menuText || undefined);
  if (items.length) {
    await supabase.from("menu_items").insert(items.map((i, idx) => ({ restaurant_id: r.id, name: i.name, category: i.category, price: i.price, food_cost: i.foodCost, source: "manual", is_signature: idx === 0 })));
  }
  await getServiceClient().from("decision_events").insert({ restaurant_id: r.id, kind: "restaurant_created", summary: `Workspace created for ${d.name}${items.length ? ` with ${items.length} menu items` : ""}`, payload: { lt: { key: "gen.evCreated", params: { name: d.name, menu: items.length ? { key: "gen.evCreatedMenu", params: { n: items.length } } : "" } }, menuItems: items.length, dataMode: process.env.QLOO_API_KEY ? "live" : "sample" }, actor: `user:${auth.user.id}` });
  return NextResponse.json({ ok: true, restaurantId: r.id });
}
