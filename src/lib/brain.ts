import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSsrClient } from "@/lib/db/ssr";
import type { LText } from "@/i18n/locales";

/**
 * Business Brain: the product's own memory (stored in this app's database, never in the developer GBrain).
 * - memories: durable, keyed facts it can recall and reuse (learned column mappings, dataset profiles, insights, actions)
 * - events: an immutable log of everything the integration does (decision_events), shown on the Memory page
 */
export type BrainKind = "mapping" | "dataset" | "insight" | "action";
export async function remember(db: SupabaseClient, m: { restaurantId: string; kind: BrainKind; key: string; title: string; content: Record<string, unknown>; source: string }): Promise<{ isNew: boolean; uses: number }> {
  const { data: prev } = await db.from("brain_memories").select("id, uses").eq("restaurant_id", m.restaurantId).eq("kind", m.kind).eq("key", m.key).maybeSingle();
  if (prev) {
    const uses = Number(prev.uses) + 1;
    await db.from("brain_memories").update({ title: m.title.slice(0, 200), content: m.content, source: m.source, uses, updated_at: new Date().toISOString() }).eq("id", prev.id);
    return { isNew: false, uses };
  }
  await db.from("brain_memories").insert({ restaurant_id: m.restaurantId, kind: m.kind, key: m.key.slice(0, 200), title: m.title.slice(0, 200), content: m.content, source: m.source });
  return { isNew: true, uses: 1 };
}
export async function recall<T = Record<string, unknown>>(db: SupabaseClient, restaurantId: string, kind: BrainKind, key: string): Promise<{ content: T; uses: number; updatedAt: string } | null> {
  const { data } = await db.from("brain_memories").select("content, uses, updated_at").eq("restaurant_id", restaurantId).eq("kind", kind).eq("key", key).maybeSingle();
  return data ? { content: data.content as T, uses: Number(data.uses), updatedAt: data.updated_at as string } : null;
}
export async function brainEvent(db: SupabaseClient, e: { restaurantId: string; kind: string; summary: string; lt: LText; payload?: Record<string, unknown>; actor: string; subjectId?: string | null }) {
  await db.from("decision_events").insert({ restaurant_id: e.restaurantId, kind: e.kind, subject_id: e.subjectId ?? null, summary: e.summary.slice(0, 500), payload: { lt: e.lt, ...(e.payload ?? {}) }, actor: e.actor });
}

export interface BrainMemory { id: string; kind: BrainKind; key: string; title: string; content: Record<string, unknown>; source: string; uses: number; updatedAt: string }
/** Read through RLS. */
export async function listMemories(restaurantId: string, limit = 30): Promise<BrainMemory[]> {
  const supabase = await getSsrClient();
  const { data } = await supabase.from("brain_memories").select("id, kind, key, title, content, source, uses, updated_at").eq("restaurant_id", restaurantId).order("updated_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ id: r.id as string, kind: r.kind as BrainKind, key: r.key as string, title: r.title as string, content: r.content as Record<string, unknown>, source: r.source as string, uses: Number(r.uses), updatedAt: r.updated_at as string }));
}
