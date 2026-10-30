import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuView } from "@/components/front/MenuView";
import { getT } from "@/i18n";
import { getCampaignsForRestaurant } from "@/lib/campaigns";
import { getSsrClient } from "@/lib/db/ssr";
import { currentVersion, getItems, getMovesForVersion, getRun, getStoreBySlug, getVersions } from "@/lib/front/db";
import { identityItems } from "@/lib/front/moves";
import { DEMO_ORG_ID } from "@/lib/front/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(await getSsrClient(), slug);
  return { title: store ? `${store.name} · TasteFront` : "TasteFront" };
}

/**
 * Public menu for a store. Server loads the published Qloo version and the Qloo-off baseline (latest baseline draft, or the
 * menu as printed); the client switch flips between them without a network call. Moves back the evidence popovers.
 */
export default async function PublicMenuPage({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const db = await getSsrClient();
  const [store, { t }] = await Promise.all([getStoreBySlug(db, slug), getT()]);
  if (!store) notFound();
  const [items, versions] = await Promise.all([getItems(db, store.id), getVersions(db, store.id)]);
  const published = currentVersion(versions);
  const baselineVersion = versions.find((v) => v.generatedBy === "baseline") ?? null;
  const baseline = baselineVersion?.items.length ? baselineVersion.items : identityItems(items);
  // moves: the version's rows, else the run's stored moves (older runs wrote moves only on the run)
  let moves = published ? await getMovesForVersion(db, published.id) : [];
  if (published && !moves.length && published.runId) moves = (await getRun(db, published.runId))?.moves ?? [];
  const campaigns = store.restaurantId ? await getCampaignsForRestaurant(store.restaurantId) : [];
  const active = campaigns.find((c) => c.status === "active") ?? null;
  const note = !versions.length ? t("front.menu.noVersions") : !published ? t("front.menu.notPublished") : null;
  return (
    <MenuView storeName={store.name} neighborhood={`${store.neighborhood}, ${store.city}`} qloo={published?.items ?? null} baseline={baseline} moves={moves}
      claimHref={active ? `/p/${active.slug}` : null} sample={store.organizationId === DEMO_ORG_ID} note={note} />
  );
}
