import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { authorizeRestaurant, actorLabel } from "@/lib/auth/authorize";
import { checkDemoRateLimit, clientIp } from "@/lib/demo/rate-limit";
import { getServiceClient } from "@/lib/db/server";
import { brainEvent } from "@/lib/brain";
import { MAX_FILE_BYTES, parseFile } from "@/lib/ingest/parse";
import { propose, RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { aiConfigured, aiExtractDocument, AiUnavailable } from "@/lib/ingest/ai";
import { normalizeChannel, toUtcIso, withDedupeKeys } from "@/lib/ingest/transform";
import type { NormalizedRecord } from "@/lib/ingest/schema";

export const maxDuration = 60;
const UUID = /^[0-9a-f-]{36}$/;

/**
 * Step 1 of an upload: read one file, recognize its columns, and return a proposal for the owner to confirm.
 * Nothing is imported here. Spreadsheet contents are not stored; AI-read documents are staged (normalized rows only) for review.
 */
export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "invalid_form" }, { status: 400 }); }
  const restaurantId = String(form.get("restaurantId") ?? ""); const file = form.get("file");
  if (!UUID.test(restaurantId) || !(file instanceof File)) return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "too_large", maxBytes: MAX_FILE_BYTES }, { status: 413 });
  const access = await authorizeRestaurant(restaurantId);
  if (access.kind === "none") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "data", limit: 40 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const name = file.name.slice(0, 200);
  const db = getServiceClient(); const actor = actorLabel(access);
  const { data: dup } = await db.from("data_uploads").select("id, created_at").eq("restaurant_id", restaurantId).eq("sha256", sha256).eq("status", "imported").maybeSingle();
  const parsed = parseFile(name, file.type, buf);

  if (parsed.kind === "unsupported") return NextResponse.json({ fileName: name, sha256, kind: "unsupported", reason: parsed.reason });
  if (parsed.kind === "document") {
    if (!aiConfigured()) return NextResponse.json({ fileName: name, sha256, kind: "document", ai: "unavailable" });
    const aiRl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "ai_docs", limit: 10 });
    if (!aiRl.ok) return NextResponse.json({ fileName: name, sha256, kind: "document", ai: "rate_limited" });
    try {
      const out = await aiExtractDocument({ fileName: name, mediaType: parsed.mediaType, data: buf });
      const grain: NormalizedRecord["grain"] = out.kind === "daily_summary" ? "day" : out.rows.some((r) => r.item_name) ? "line" : "order";
      const unkeyed = out.rows.flatMap((r, i) => {
        const at = toUtcIso(r.date, r.time ?? undefined, RESTAURANT_TZ); if (!at) return [];
        const net = r.net_sales ?? (r.gross_sales !== null ? Math.round((r.gross_sales - Math.abs(r.discounts ?? 0)) * 100) / 100 : null);
        return [{ platform: out.platform, channel: normalizeChannel(r.channel ?? undefined, out.platform), order_id: r.order_id, ordered_at: at, item_name: r.item_name, quantity: r.quantity, gross_sales: r.gross_sales, discounts: r.discounts === null ? null : Math.abs(r.discounts), net_sales: net, tax: r.tax, tip: r.tip, platform_fees: r.platform_fees === null ? null : Math.abs(r.platform_fees), payout: r.payout, refunds: r.refunds, status: /refund/i.test(r.status ?? "") ? "refunded" as const : /cancel|void/i.test(r.status ?? "") ? "cancelled" as const : "completed" as const, row_ref: i + 1, grain, has_time: !!r.time }];
      });
      const records: NormalizedRecord[] = withDedupeKeys(unkeyed, RESTAURANT_TZ);
      const { data: up } = await db.from("data_uploads").insert({ restaurant_id: restaurantId, file_name: name, file_type: parsed.mediaType, size_bytes: file.size, sha256, platform: out.platform, status: "staged", row_count: out.rows.length, mapping: [], mapping_method: "ai_document", staged_rows: records, created_by: actor }).select("id").single();
      await brainEvent(db, { restaurantId, kind: "data_analyzed", subjectId: up?.id, actor, summary: `Read document ${name} with AI: ${records.length} rows staged for review`, lt: { key: "data.evDocRead", params: { name, n: records.length } }, payload: { method: "ai_document", kind: out.kind } });
      return NextResponse.json({ fileName: name, sha256, kind: "document", ai: "used", docKind: out.kind, uploadId: up?.id, platform: out.platform, preview: records.slice(0, 5), stats: { rows: out.rows.length, sampleImported: records.length, sampleRejected: out.rows.length - records.length }, duplicate: !!dup });
    } catch (e) {
      return NextResponse.json({ fileName: name, sha256, kind: "document", ai: e instanceof AiUnavailable ? e.reason : "failed" });
    }
  }

  const aiRl = await checkDemoRateLimit({ ip: clientIp(req), bucket: "ai_map", limit: 30 });
  const proposals = await Promise.all(parsed.tables.slice(0, 5).map((t) => propose(db, restaurantId, name, t, aiRl.ok)));
  await brainEvent(db, {
    restaurantId, kind: "data_analyzed", actor, summary: `Analyzed ${name}: ${proposals.map((p) => `${p.sheet} (${p.stats.rows} rows, ${p.method})`).join(", ")}`,
    lt: { key: "data.evAnalyzed", params: { name, n: proposals.reduce((s, p) => s + p.stats.rows, 0), method: proposals[0]?.method ?? "rules" } },
    payload: { sha256, sheets: proposals.map((p) => ({ sheet: p.sheet, method: p.method, platform: p.platform, gaps: p.gaps, ai: p.ai })) },
  });
  return NextResponse.json({ fileName: name, sha256, kind: "table", proposals, duplicate: !!dup, aiConfigured: aiConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
