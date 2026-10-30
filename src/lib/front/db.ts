import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/db/server";
import { DEFAULT_GUARDRAILS, type Brand, type FrontRun, type Guardrails, type Holdout, type MenuItem, type Move, type Store, type StorefrontVersion } from "./types";

type Row = Record<string, unknown>;
const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export const toStore = (r: Row): Store => ({ id: s(r.id), organizationId: s(r.organization_id), brandId: (r.brand_id as string | null) ?? null, restaurantId: (r.restaurant_id as string | null) ?? null, name: s(r.name), slug: s(r.slug), address: s(r.address), lat: n(r.lat), lng: n(r.lng), neighborhood: s(r.neighborhood), city: s(r.city), cuisine: s(r.cuisine), language: (s(r.language, "en") as Store["language"]), qlooEntityId: (r.qloo_entity_id as string | null) ?? null });
export const toItem = (r: Row): MenuItem => ({ id: s(r.id), storeId: s(r.store_id), name: s(r.name), nameEn: (r.name_en as string | null) ?? null, description: (r.description as string | null) ?? null, priceCents: n(r.price_cents), costCents: r.cost_cents === null || r.cost_cents === undefined ? null : n(r.cost_cents), category: s(r.category, "main"), sortIndex: n(r.sort_index), qlooTagIds: (r.qloo_tag_ids as string[]) ?? [], tagCandidates: (r.tag_candidates as MenuItem["tagCandidates"]) ?? [], ambiguous: Boolean(r.ambiguous) });
export const toVersion = (r: Row): StorefrontVersion => ({ id: s(r.id), storeId: s(r.store_id), versionNo: n(r.version_no), generatedBy: s(r.generated_by, "qloo") as StorefrontVersion["generatedBy"], runId: (r.run_id as string | null) ?? null, items: (r.items_json as StorefrontVersion["items"]) ?? [], parentVersionId: (r.parent_version_id as string | null) ?? null, status: s(r.status, "draft") as StorefrontVersion["status"], publishedAt: (r.published_at as string | null) ?? null, rolledBackAt: (r.rolled_back_at as string | null) ?? null, createdAt: s(r.created_at) });
export const toRun = (r: Row): FrontRun => ({ id: s(r.id), storeId: s(r.store_id), mode: s(r.mode, "sample") as FrontRun["mode"], status: s(r.status, "running") as FrontRun["status"], variant: s(r.variant, "qloo") as FrontRun["variant"], events: (r.events as FrontRun["events"]) ?? [], calls: (r.calls as FrontRun["calls"]) ?? [], moves: (r.moves as Move[]) ?? [], caveats: (r.caveats as string[]) ?? [], versionId: (r.version_id as string | null) ?? null, error: (r.error as string | null) ?? null, createdAt: s(r.created_at), finishedAt: (r.finished_at as string | null) ?? null });
export const toHoldout = (r: Row): Holdout => ({ id: s(r.id), storeId: (r.store_id as string | null) ?? null, brandId: (r.brand_id as string | null) ?? null, kind: s(r.kind, "week_alternate") as Holdout["kind"], changeWindow: r.change_window as Holdout["changeWindow"], controlWindow: (r.control_window as Holdout["controlWindow"]) ?? null, assignment: (r.assignment as Holdout["assignment"]) ?? { change: [], control: [], seed: 0 }, createdAt: s(r.created_at) });

/** Read side. Any Supabase client works (RLS applies to anon/SSR; the service role bypasses it). */
export async function getStoreBySlug(db: SupabaseClient, slug: string): Promise<Store | null> {
  const { data } = await db.from("front_stores").select("*").eq("slug", slug).maybeSingle();
  return data ? toStore(data) : null;
}
export async function getStore(db: SupabaseClient, id: string): Promise<Store | null> {
  const { data } = await db.from("front_stores").select("*").eq("id", id).maybeSingle();
  return data ? toStore(data) : null;
}
export async function listBrandStores(db: SupabaseClient, brandId: string): Promise<Store[]> {
  const { data } = await db.from("front_stores").select("*").eq("brand_id", brandId).order("name");
  return (data ?? []).map(toStore);
}
export async function listBrands(db: SupabaseClient, organizationId: string): Promise<Brand[]> {
  const { data } = await db.from("front_brands").select("id, organization_id, name, slug, size_class, front_stores(count)").eq("organization_id", organizationId).order("created_at");
  return (data ?? []).map((r) => ({ id: s(r.id), organizationId: s(r.organization_id), name: s(r.name), slug: s(r.slug), sizeClass: s(r.size_class, "single") as Brand["sizeClass"], storeCount: n((r.front_stores as Array<{ count: number }> | null)?.[0]?.count) }));
}
export async function getBrand(db: SupabaseClient, id: string): Promise<Brand | null> {
  const { data } = await db.from("front_brands").select("id, organization_id, name, slug, size_class, front_stores(count)").eq("id", id).maybeSingle();
  return data ? { id: s(data.id), organizationId: s(data.organization_id), name: s(data.name), slug: s(data.slug), sizeClass: s(data.size_class, "single") as Brand["sizeClass"], storeCount: n((data.front_stores as Array<{ count: number }> | null)?.[0]?.count) } : null;
}
export async function getBrandBySlug(db: SupabaseClient, slug: string): Promise<Brand | null> {
  const { data } = await db.from("front_brands").select("id").eq("slug", slug).maybeSingle();
  return data ? getBrand(db, s(data.id)) : null;
}
export async function getGuardrails(db: SupabaseClient, brandId: string | null): Promise<Guardrails> {
  if (!brandId) return DEFAULT_GUARDRAILS;
  const { data } = await db.from("front_guardrails").select("*").eq("brand_id", brandId).maybeSingle();
  if (!data) return DEFAULT_GUARDRAILS;
  return { renamableItemIds: (data.renamable_item_ids as string[]) ?? [], priceBandPct: n(data.price_band_pct), bannedTerms: (data.banned_terms as string[]) ?? [], tone: s(data.tone, "plain") as Guardrails["tone"] };
}
export async function getItems(db: SupabaseClient, storeId: string): Promise<MenuItem[]> {
  const { data } = await db.from("front_menu_items").select("*").eq("store_id", storeId).order("sort_index");
  return (data ?? []).map(toItem);
}
export async function getVersions(db: SupabaseClient, storeId: string): Promise<StorefrontVersion[]> {
  const { data } = await db.from("front_versions").select("*").eq("store_id", storeId).order("version_no", { ascending: false });
  return (data ?? []).map(toVersion);
}
/** The storefront customers see: the highest published version that was not rolled back. */
export function currentVersion(versions: StorefrontVersion[]): StorefrontVersion | null {
  return versions.find((v) => v.status === "published") ?? null;
}
export async function getRun(db: SupabaseClient, id: string): Promise<FrontRun | null> {
  const { data } = await db.from("front_runs").select("*").eq("id", id).maybeSingle();
  return data ? toRun(data) : null;
}
export async function getRuns(db: SupabaseClient, storeId: string, limit = 10): Promise<FrontRun[]> {
  const { data } = await db.from("front_runs").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map(toRun);
}
export async function getMovesForVersion(db: SupabaseClient, versionId: string): Promise<Move[]> {
  const { data } = await db.from("front_moves").select("*").eq("version_id", versionId).order("created_at");
  return (data ?? []).map((r) => ({ id: s(r.id), kind: s(r.kind) as Move["kind"], itemId: s(r.item_id), risk: s(r.risk, "low") as Move["risk"], before: (r.before_json as Move["before"]) ?? {}, after: (r.after_json as Move["after"]) ?? {}, evidence: (r.evidence_json as Move["evidence"]) ?? [], verified: Boolean(r.verified), rationale: s((r.after_json as Row | null)?.rationale ?? ""), ...((r.after_json as Row | null)?.why ? { why: (r.after_json as Row).why as Move["why"] } : {}), guardrail: { ok: s(r.status) !== "rejected" } }));
}
export async function getHoldouts(db: SupabaseClient, where: { storeId?: string; brandId?: string }): Promise<Holdout[]> {
  let q = db.from("front_holdouts").select("*").order("created_at", { ascending: false });
  if (where.storeId) q = q.eq("store_id", where.storeId);
  if (where.brandId) q = q.eq("brand_id", where.brandId);
  const { data } = await q;
  return (data ?? []).map(toHoldout);
}

/** Write side: service role only, called from server routes after authorization. */
export async function createRun(input: { storeId: string; mode: FrontRun["mode"]; variant: FrontRun["variant"]; actor: string }): Promise<string> {
  const { data, error } = await getServiceClient().from("front_runs").insert({ store_id: input.storeId, mode: input.mode, variant: input.variant, status: "running", actor: input.actor }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
export async function updateRun(id: string, patch: Partial<Pick<FrontRun, "status" | "events" | "calls" | "moves" | "caveats" | "versionId" | "error" | "finishedAt">>): Promise<void> {
  const row: Row = {};
  if (patch.status) row.status = patch.status; if (patch.events) row.events = patch.events; if (patch.calls) row.calls = patch.calls; if (patch.moves) row.moves = patch.moves;
  if (patch.caveats) row.caveats = patch.caveats; if (patch.versionId !== undefined) row.version_id = patch.versionId; if (patch.error !== undefined) row.error = patch.error; if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;
  const { error } = await getServiceClient().from("front_runs").update(row).eq("id", id);
  if (error) throw error;
}
/** Inserts a draft version (next version_no) and its moves. Baseline versions are drafts that are never published. */
export async function createVersion(input: { storeId: string; generatedBy: StorefrontVersion["generatedBy"]; runId: string | null; items: StorefrontVersion["items"]; parentVersionId: string | null; moves: Move[] }): Promise<StorefrontVersion> {
  const db = getServiceClient();
  const { data: last } = await db.from("front_versions").select("version_no").eq("store_id", input.storeId).order("version_no", { ascending: false }).limit(1).maybeSingle();
  const versionNo = (last ? n(last.version_no) : 0) + 1;
  const { data, error } = await db.from("front_versions").insert({ store_id: input.storeId, version_no: versionNo, generated_by: input.generatedBy, run_id: input.runId, items_json: input.items, parent_version_id: input.parentVersionId, status: "draft" }).select("*").single();
  if (error) throw error;
  if (input.moves.length) {
    const { error: e2 } = await db.from("front_moves").insert(input.moves.map((m) => ({ version_id: data.id, store_id: input.storeId, kind: m.kind, item_id: m.itemId, before_json: m.before, after_json: { ...m.after, rationale: m.rationale, ...(m.why ? { why: m.why } : {}) }, evidence_json: m.evidence, verified: m.verified, risk: m.risk, status: m.guardrail && !m.guardrail.ok ? "rejected" : "proposed" })));
    if (e2) throw e2;
  }
  return toVersion(data);
}
export async function publishVersion(versionId: string, actor: string): Promise<StorefrontVersion> {
  const db = getServiceClient();
  const { data, error } = await db.from("front_versions").update({ status: "published", published_at: new Date().toISOString() }).eq("id", versionId).eq("status", "draft").select("*").single();
  if (error) throw error;
  await db.from("front_moves").update({ status: "approved" }).eq("version_id", versionId).eq("status", "proposed");
  await logEvent(toVersion(data).storeId, "front_version_published", versionId, `Storefront v${data.version_no} published`, { lt: { key: "front.evPublished", params: { v: String(data.version_no) } }, versionNo: data.version_no }, actor);
  return toVersion(data);
}
export async function rollbackVersion(versionId: string, actor: string): Promise<StorefrontVersion> {
  const db = getServiceClient();
  const { data, error } = await db.from("front_versions").update({ status: "rolled_back", rolled_back_at: new Date().toISOString() }).eq("id", versionId).eq("status", "published").select("*").single();
  if (error) throw error;
  await logEvent(toVersion(data).storeId, "front_version_rolled_back", versionId, `Storefront v${data.version_no} rolled back`, { lt: { key: "front.evRolledBack", params: { v: String(data.version_no) } }, versionNo: data.version_no }, actor);
  return toVersion(data);
}
export async function saveHoldout(h: Omit<Holdout, "id" | "createdAt">): Promise<Holdout> {
  const { data, error } = await getServiceClient().from("front_holdouts").insert({ store_id: h.storeId, brand_id: h.brandId, kind: h.kind, change_window: h.changeWindow, control_window: h.controlWindow, assignment: h.assignment }).select("*").single();
  if (error) throw error;
  return toHoldout(data);
}
export async function updateItemTags(itemId: string, patch: { qlooTagIds: string[]; tagCandidates: MenuItem["tagCandidates"]; ambiguous: boolean }): Promise<void> {
  await getServiceClient().from("front_menu_items").update({ qloo_tag_ids: patch.qlooTagIds, tag_candidates: patch.tagCandidates, ambiguous: patch.ambiguous }).eq("id", itemId);
}
/** Immutable event log, reused from the rest of Restaurant IQ. Stores link to a restaurant only on the demo tenant; otherwise events go under the store's organization restaurant if any. */
export async function logEvent(storeId: string, kind: string, subjectId: string | null, summary: string, payload: Record<string, unknown>, actor: string): Promise<void> {
  const db = getServiceClient();
  const { data: st } = await db.from("front_stores").select("restaurant_id").eq("id", storeId).maybeSingle();
  const restaurantId = (st?.restaurant_id as string | null) ?? null;
  if (!restaurantId) return; // no restaurant workspace to attach the memory to
  await db.from("decision_events").insert({ restaurant_id: restaurantId, kind, subject_id: subjectId, summary, payload: { ...payload, storeId }, actor });
}
