import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSales, RESTAURANT_TZ } from "@/lib/ingest/pipeline";
import { settleWeek } from "./settle";
import type { Holdout, Settlement, Store, StorefrontVersion } from "./types";

/** Settlement for one store: sales come from the linked restaurant workspace's uploads. No link → waiting for sales data. */
export async function settleStore(db: SupabaseClient, store: Store, holdout: Holdout, current: StorefrontVersion | null, synthetic: boolean): Promise<Settlement> {
  const featured = (current?.items ?? []).filter((i) => i.featured).map((i) => i.nameEn ?? i.name);
  const rows = store.restaurantId ? await loadSales(db, store.restaurantId) : [];
  return settleWeek({ kind: "week_alternate", rows, changeWindow: holdout.changeWindow, controlWindow: holdout.controlWindow ?? holdout.changeWindow, tz: RESTAURANT_TZ, featuredItems: featured, synthetic });
}

/** Brand settlement over a store split: each store's sales come from its linked restaurant (most demo stores have none → waiting). */
export async function settleBrand(db: SupabaseClient, stores: Store[], holdout: Holdout, featured: string[], synthetic: boolean): Promise<Settlement> {
  const rowsByStore: Record<string, Awaited<ReturnType<typeof loadSales>>> = {};
  for (const s of stores) rowsByStore[s.id] = s.restaurantId ? await loadSales(db, s.restaurantId) : [];
  return settleWeek({ kind: "store_split", rowsByStore, assignment: holdout.assignment, changeWindow: holdout.changeWindow, tz: RESTAURANT_TZ, featuredItems: featured, synthetic });
}
