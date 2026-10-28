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

async function insertRecords(db: ReturnType<typeof getServiceClient>, restaurantId: string, uploadId: string, records: NormalizedRecord[]) {
  for (let i = 0; i < records.length; i += 1000) {
    const { error } = await db.from("sales_records").insert(records.slice(i, i + 1000).map((r) => ({ ...r, restaurant_id: restaurantId, upload_id: uploadId })));
    if (error) return false;
  }
  return true;
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
    if (!(await insertRecords(db, restaurantId, up.id, records))) return NextResponse.json({ error: "db_write" }, { status: 500 });
    await db.from("data_uploads").update({ status: "imported", imported_count: records.length, staged_rows: null }).eq("id", up.id);
    await brainEvent(db, { restaurantId, kind: "data_imported", subjectId: up.id, actor, summary: `Imported ${records.length} rows read by AI from ${up.file_name}`, lt: { key: "data.evImported", params: { name: up.file_name, n: records.length, r: 0 } }, payload: { method: "ai_document" } });
    const ins = await refreshInsights(db, restaurantId, actor);
    return NextResponse.json({ ok: true, imported: records.length, rejected: 0, orders: ins.analysis.orders });
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
  const { data: up, error } = await db.from("data_uploads").insert({
    restaurant_id: restaurantId, file_name: `${file.name}${parsed.kind === "table" && parsed.tables.length > 1 ? ` · ${table.name}` : ""}`.slice(0, 200), file_type: file.name.split(".").pop()?.toLowerCase().slice(0, 40) ?? "file",
    size_bytes: file.size, sha256: key, platform: plan.platform, status: "imported", row_count: table.rows.length, imported_count: records.length, rejected_count: rejected.length,
    mapping: stored, mapping_method: method, header_fingerprint: fingerprint, created_by: actor,
  }).select("id").single();
  if (error || !up) return NextResponse.json({ error: error?.code === "23505" ? "duplicate" : "db_write" }, { status: error?.code === "23505" ? 409 : 500 });
  if (!(await insertRecords(db, restaurantId, up.id, records))) { await db.from("data_uploads").delete().eq("id", up.id); return NextResponse.json({ error: "db_write" }, { status: 500 }); }

  const learned = await remember(db, { restaurantId, kind: "mapping", key: fingerprint, title: `${plan.platform} · ${table.headers.length} columns (${file.name.slice(0, 60)})`, content: { mapping: stored.filter((m) => m.target !== "pii").concat(stored.filter((m) => m.target === "pii")), platform: plan.platform, headers: table.headers.slice(0, 80) }, source: method });
  await remember(db, { restaurantId, kind: "dataset", key: up.id, title: `${file.name.slice(0, 80)}: ${records.length} rows`, content: { platform: plan.platform, rows: table.rows.length, imported: records.length, rejected: rejected.length, droppedPii: stored.filter((m) => m.target === "pii").map((m) => m.column) }, source: "import" });
  await brainEvent(db, { restaurantId, kind: "data_imported", subjectId: up.id, actor, summary: `Imported ${records.length} rows from ${file.name} (${rejected.length} rejected, mapping by ${method})`, lt: { key: "data.evImported", params: { name: file.name, n: records.length, r: rejected.length } }, payload: { platform: plan.platform, method, droppedPii: stored.filter((m) => m.target === "pii").length } });
  if (learned.isNew || plan.edited) await brainEvent(db, { restaurantId, kind: "brain_learned", subjectId: up.id, actor, summary: `Brain ${learned.isNew ? "learned" : "updated"} a column mapping for this ${plan.platform} layout; next upload with the same columns maps automatically`, lt: { key: learned.isNew ? "data.evLearned" : "data.evRelearned", params: { platform: plan.platform } }, payload: { fingerprint } });
  const ins = await refreshInsights(db, restaurantId, actor);
  return NextResponse.json({ ok: true, uploadId: up.id, imported: records.length, rejected: rejected.length, rejectReasons: { no_date: rejected.filter((r) => r.reason === "no_date").length, no_amount: rejected.filter((r) => r.reason === "no_amount").length }, orders: ins.analysis.orders, learned: learned.isNew });
}
