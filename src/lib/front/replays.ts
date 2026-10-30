import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRuns, getStoreBySlug, getVersions, getItems, getBrand } from "./db";
import type { FrontRun, StorefrontVersion } from "./types";

/** The three home-page replays: recorded real runs (live Qloo) on the fixture stores sized 1 / 5 / 40. Nothing is synthesized at render time. */
export const REPLAY_STORES = ["chuan-lane-san-bruno", "cloud-nine-daly-city", "bamboo-bowl-01-san-francisco-financial-district"] as const;
export interface Replay { slug: string; name: string; neighborhood: string; city: string; cuisine: string; brandName: string | null; storeCount: number; run: Pick<FrontRun, "events" | "moves" | "caveats" | "mode" | "createdAt">; before: StorefrontVersion["items"]; after: StorefrontVersion["items"]; itemNames: Record<string, string>; versionNo: number | null }

export async function loadReplays(db: SupabaseClient): Promise<Replay[]> {
  const out: Replay[] = [];
  for (const slug of REPLAY_STORES) {
    const store = await getStoreBySlug(db, slug); if (!store) continue;
    const [runs, versions, items] = await Promise.all([getRuns(db, store.id, 10), getVersions(db, store.id), getItems(db, store.id)]);
    const run = runs.find((r) => r.variant === "qloo" && r.status === "completed" && r.versionId); if (!run) continue;
    const after = versions.find((v) => v.id === run.versionId); if (!after) continue;
    const brand = store.brandId ? await getBrand(db, store.brandId) : null;
    const before = [...items].sort((a, b) => a.sortIndex - b.sortIndex).map((i, idx) => ({ id: i.id, name: i.name, nameEn: i.nameEn, description: i.description, priceCents: i.priceCents, category: i.category, sortIndex: idx, featured: false, changed: [] as StorefrontVersion["items"][number]["changed"] }));
    out.push({ slug, name: store.name, neighborhood: store.neighborhood, city: store.city, cuisine: store.cuisine, brandName: brand?.name ?? null, storeCount: brand?.storeCount ?? 1, run: { events: run.events, moves: run.moves, caveats: run.caveats, mode: run.mode, createdAt: run.createdAt }, before, after: after.items, itemNames: Object.fromEntries(items.map((i) => [i.id, i.nameEn ?? i.name])), versionNo: after.versionNo });
  }
  return out;
}
