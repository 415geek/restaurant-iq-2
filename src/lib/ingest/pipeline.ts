import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recall } from "@/lib/brain";
import { aiConfigured, aiMapColumns, AiUnavailable } from "./ai";
import { applyMapping } from "./transform";
import { detectPlatform, headerFingerprint, mappingGaps, ruleMapping } from "./rules";
import type { Table } from "./parse";
import type { ColumnMapping, Platform } from "./schema";

export const RESTAURANT_TZ = "America/Los_Angeles";

export interface Proposal {
  sheet: string; headers: string[]; platform: Platform; fingerprint: string; mapping: ColumnMapping[]; method: "memory" | "rules" | "ai";
  gaps: string[]; stats: { rows: number; sampleImported: number; sampleRejected: number }; preview: ReturnType<typeof applyMapping>["records"];
  ai: "used" | "not_needed" | "unavailable" | "failed"; memoryUses?: number;
  samples: Record<string, string[]>; // up to 3 example values per column; personal-data columns are masked
}

/** Brain first (a mapping learned from the same header layout), then rules, then Claude for what the rules could not place. */
export async function propose(db: SupabaseClient, restaurantId: string, fileName: string, t: Table, allowAi: boolean): Promise<Proposal> {
  const fingerprint = headerFingerprint(t.headers);
  let platform = detectPlatform(fileName, t.headers);
  let mapping: ColumnMapping[]; let method: Proposal["method"] = "rules"; let ai: Proposal["ai"] = "not_needed"; let memoryUses: number | undefined;
  const mem = await recall<{ mapping: ColumnMapping[]; platform: Platform }>(db, restaurantId, "mapping", fingerprint);
  if (mem && Array.isArray(mem.content.mapping)) {
    mapping = mem.content.mapping.map((m) => ({ ...m, method: "memory" as const, confidence: 1 })); platform = mem.content.platform ?? platform; method = "memory"; memoryUses = mem.uses;
  } else {
    mapping = ruleMapping(t.headers, t.rows);
    const unknown = mapping.filter((m) => m.target === "ignore" && m.confidence < 0.5).length;
    if ((mappingGaps(mapping).length || unknown >= 2)) {
      if (!aiConfigured() || !allowAi) ai = "unavailable";
      else {
        try {
          const r = await aiMapColumns({ fileName, headers: t.headers, sample: t.rows.slice(0, 5), rules: mapping });
          // Personal data stays dropped if either the rules or Claude flagged it.
          mapping = r.mapping.map((m) => (mapping.find((x) => x.column === m.column)?.target === "pii" ? { ...m, target: "pii" as const } : m));
          if (platform === "other") platform = r.platform; method = "ai"; ai = "used";
        } catch (e) { ai = e instanceof AiUnavailable && e.reason === "no_key" ? "unavailable" : "failed"; }
      }
    }
  }
  const sample = t.rows.slice(0, 500);
  const res = applyMapping(sample, t.headers, mapping, { platform, tz: RESTAURANT_TZ });
  const samples = Object.fromEntries(t.headers.map((h, i) => [h, mapping.find((m) => m.column === h)?.target === "pii" ? ["•••"] : [...new Set(t.rows.slice(0, 40).map((r) => r[i]).filter(Boolean))].slice(0, 3).map((v) => v.slice(0, 40))]));
  return { samples, sheet: t.name, headers: t.headers, platform, fingerprint, mapping, method, gaps: mappingGaps(mapping), stats: { rows: t.rows.length, sampleImported: res.records.length, sampleRejected: res.rejected.length }, preview: res.records.slice(0, 5), ai, memoryUses };
}

import { analyzeSales, suggestActions, type SalesRow } from "./analyze";
import { brainEvent, remember } from "@/lib/brain";

export async function loadSales(db: SupabaseClient, restaurantId: string): Promise<SalesRow[]> {
  const out: SalesRow[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data } = await db.from("sales_records").select("platform, channel, order_id, ordered_at, item_name, quantity, gross_sales, net_sales, platform_fees, payout, discounts, status").eq("restaurant_id", restaurantId).order("id").range(from, from + 999);
    const rows = (data ?? []).map((r) => ({ ...r, quantity: r.quantity === null ? null : Number(r.quantity), gross_sales: r.gross_sales === null ? null : Number(r.gross_sales), net_sales: r.net_sales === null ? null : Number(r.net_sales), platform_fees: r.platform_fees === null ? null : Number(r.platform_fees), payout: r.payout === null ? null : Number(r.payout), discounts: r.discounts === null ? null : Number(r.discounts) })) as SalesRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Recompute the operating picture after data changes and let the Brain remember what it concluded. */
export async function refreshInsights(db: SupabaseClient, restaurantId: string, actor: string) {
  const a = analyzeSales(await loadSales(db, restaurantId), RESTAURANT_TZ);
  const actions = suggestActions(a);
  await remember(db, { restaurantId, kind: "insight", key: "operating-summary", title: `${a.orders} orders · $${a.netSales.toLocaleString("en-US")} net`, content: { orders: a.orders, netSales: a.netSales, avgTicket: a.avgTicket, from: a.from, to: a.to, slow: a.slow, peak: a.peak, byPlatform: a.byPlatform, topItems: a.topItems }, source: "analyze.ts (deterministic)" });
  for (const act of actions) await remember(db, { restaurantId, kind: "action", key: act.kind, title: act.kind, content: act.params, source: "suggestActions (rules)" });
  await brainEvent(db, { restaurantId, kind: "insight_generated", actor, summary: `Recomputed operating insights: ${a.orders} orders, ${actions.length} suggested actions`, lt: { key: "data.evInsights", params: { n: a.orders, k: actions.length } }, payload: { actions: actions.map((x) => x.kind) } });
  return { analysis: a, actions };
}
