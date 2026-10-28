import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { brainEvent, remember } from "@/lib/brain";
import { MAX_FILE_BYTES, parseFile } from "@/lib/ingest/parse";
import { applyMapping } from "@/lib/ingest/transform";
import { headerFingerprint, mappingGaps } from "@/lib/ingest/rules";
import { mappingInputSchema, PLATFORMS, type NormalizedRecord } from "@/lib/ingest/schema";
import { RESTAURANT_TZ, refreshInsights } from "@/lib/ingest/pipeline";

export const maxDuration = 60;
const planSchema = z.object({ sheet: z.string().max(120), platform: z.enum(PLATFORMS), mapping: mappingInputSchema, edited: z.boolean().default(false) });

/** Upload row + rows in one database transaction; overlapping rows (same dedupe key) are skipped and counted. */
async function importAtomic(db: ReturnType<typeof getServiceClient>, upload: Record<string, unknown>, records: NormalizedRecord[]) {
  const { data, error } = await db.rpc("import_sales", { p_upload: upload, p_rows: records });
  if (error) return { ok: false as const, reason: error.code === "23505" ? "duplicate" : "db_write" };
  const r = data as { ok: boolean; reason?: string; upload_id?: string; inserted?: number; overlapping?: number };
  return r.ok ? { ok: true as const, uploadId: r.upload_id!, inserted: r.inserted ?? 0, overlapping: r.overlapping ?? 0 } : { ok: false as const, reason: r.reason ?? "db_write" };
}

/** Step 2: the owner confirmed (or edited) the mapping. Re-read the file, convert every row, store unified records, and teach the Brain. */
export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "invalid_form" }, { status: 400 }); }
  const restaurantId = String(form.get("restaurantId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  const access = await authorizeRestaurant(restaurantId);
  if (access.kind === "none") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "data", limit: 40 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const db = getServiceClient(); const actor = actorLabel(access);

  // AI-read document staged earlier
  const uploadId = String(form.get("uploadId") ?? "");
  if (uploadId) {
    const { data: up } = await db.from("data_uploads").select("id, file_name, staged_rows, status, sha256").eq("id", uploadId).eq("restaurant_id", restaurantId).maybeSingle();
    if (!up || up.status !== "staged") return NextResponse.json({ error: "not_staged" }, { status: 409 });
    const { data: dup } = await db.from("data_uploads").select("id").eq("restaurant_id", restaurantId).eq("sha256", up.sha256).eq("status", "imported").maybeSingle();
    if (dup) return NextResponse.json({ error: "duplicate" }, { status: 409 });
    const records = (up.staged_rows ?? []) as NormalizedRecord[];
    const res = await importAtomic(db, { id: up.id, restaurant_id: restaurantId, rejected_count: 0 }, records);
    if (!res.ok) return NextResponse.json({ error: res.reason }, { status: res.reason === "not_staged" ? 409 : 500 });
    await brainEvent(db, { restaurantId, kind: "data_imported", subjectId: up.id, actor, summary: `Imported ${res.inserted} rows read by AI from ${up.file_name} (${res.overlapping} already present)`, lt: { key: "data.evImported", params: { name: up.file_name, n: res.inserted, r: 0 } }, payload: { method: "ai_document", overlapping: res.overlapping } });
    const ins = await refreshInsights(db, restaurantId, actor);
    return NextResponse.json({ ok: true, imported: res.inserted, overlapping: res.overlapping, rejected: 0, orders: ins.analysis.orders });
  }

  const file = form.get("file"); const planRaw = String(form.get("plan") ?? "");
  if (!(file instanceof File) || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  let plan: z.infer<typeof planSchema>;
  try { plan = planSchema.parse(JSON.parse(planRaw)); } catch { return NextResponse.json({ error: "invalid_plan" }, { status: 400 }); }
  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const parsed = parseFile(file.name, file.type, buf);
  const table = parsed.kind === "table" ? parsed.tables.find((t) => t.name === plan.sheet) ?? parsed.tables[0] : null;
  if (!table) return NextResponse.json({ error: "unreadable" }, { status: 422 });
  const mapping = plan.mapping.filter((m) => table.headers.includes(m.column));
  if (mappingGaps(mapping).length) return NextResponse.json({ error: "mapping_incomplete", gaps: mappingGaps(mapping) }, { status: 422 });
  // one import per identical file; workbooks with several sheets dedupe per sheet
  const key = parsed.kind === "table" && parsed.tables.length > 1 ? createHash("sha256").update(`${sha256}:${table.name}`).digest("hex") : sha256;
  const { data: dup } = await db.from("data_uploads").select("id").eq("restaurant_id", restaurantId).eq("sha256", key).eq("status", "imported").maybeSingle();
  if (dup) return NextResponse.json({ error: "duplicate" }, { status: 409 });

  const { records, rejected } = applyMapping(table.rows, table.headers, mapping, { platform: plan.platform, tz: RESTAURANT_TZ });
  const fingerprint = headerFingerprint(table.headers);
  const method = plan.edited ? "owner" : mapping[0]?.method ?? "rules";
  const stored = mapping.map(({ column, target, confidence, method: m }) => ({ column, target, confidence, method: m }));
  const res = await importAtomic(db, {
    restaurant_id: restaurantId, file_name: `${file.name}${parsed.kind === "table" && parsed.tables.length > 1 ? ` · ${table.name}` : ""}`.slice(0, 200), file_type: file.name.split(".").pop()?.toLowerCase().slice(0, 40) ?? "file",
    size_bytes: file.size, sha256: key, platform: plan.platform, row_count: table.rows.length, rejected_count: rejected.length,
    mapping: stored, mapping_method: method, header_fingerprint: fingerprint, created_by: actor,
  }, records);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: res.reason === "duplicate" ? 409 : 500 });
  const up = { id: res.uploadId };
  const learned = await remember(db, { restaurantId, kind: "mapping", key: fingerprint, title: `${plan.platform} · ${table.headers.length} columns (${file.name.slice(0, 60)})`, content: { mapping: stored.filter((m) => m.target !== "pii").concat(stored.filter((m) => m.target === "pii")), platform: plan.platform, headers: table.headers.slice(0, 80) }, source: method });
  await remember(db, { restaurantId, kind: "dataset", key: up.id, title: `${file.name.slice(0, 80)}: ${res.inserted} rows`, content: { platform: plan.platform, rows: table.rows.length, imported: res.inserted, overlapping: res.overlapping, rejected: rejected.length, droppedPii: stored.filter((m) => m.target === "pii").map((m) => m.column) }, source: "import" });
  await brainEvent(db, { restaurantId, kind: "data_imported", subjectId: up.id, actor, summary: `Imported ${res.inserted} rows from ${file.name} (${rejected.length} rejected, ${res.overlapping} already present, mapping by ${method})`, lt: { key: "data.evImported", params: { name: file.name, n: res.inserted, r: rejected.length } }, payload: { platform: plan.platform, method, overlapping: res.overlapping, droppedPii: stored.filter((m) => m.target === "pii").length } });
  if (learned.isNew || plan.edited) await brainEvent(db, { restaurantId, kind: "brain_learned", subjectId: up.id, actor, summary: `Brain ${learned.isNew ? "learned" : "updated"} a column mapping for this ${plan.platform} layout; next upload with the same columns maps automatically`, lt: { key: learned.isNew ? "data.evLearned" : "data.evRelearned", params: { platform: plan.platform } }, payload: { fingerprint } });
  const ins = await refreshInsights(db, restaurantId, actor);
  return NextResponse.json({ ok: true, uploadId: up.id, imported: res.inserted, overlapping: res.overlapping, rejected: rejected.length, rejectReasons: { no_date: rejected.filter((r) => r.reason === "no_date").length, no_amount: rejected.filter((r) => r.reason === "no_amount").length }, orders: ins.analysis.orders, learned: learned.isNew });
}
