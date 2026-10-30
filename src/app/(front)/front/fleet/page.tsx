import Link from "next/link";
import { ApprovalQueue, type PendingRow } from "@/components/front/ApprovalQueue";
import { FleetMap } from "@/components/front/FleetMap";
import { GuardrailsForm } from "@/components/front/GuardrailsForm";
import { PostButton } from "@/components/front/PostButton";
import { Card, Chip, Empty, H2 } from "@/components/ui";
import { getT } from "@/i18n";
import { SupabaseAnalysisStore } from "@/lib/agents/store";
import { getServiceClient } from "@/lib/db/server";
import { getSsrClient } from "@/lib/db/ssr";
import { currentVersion, getBrandBySlug, getGuardrails, getHoldouts, getItems, getVersions, listBrandStores } from "@/lib/front/db";
import { splitSummary } from "@/lib/front/holdout";
import { CallLog, storeHeat } from "@/lib/front/qloo";
import { settleBrand } from "@/lib/front/settlement";
import { DEMO_ORG_ID, type Settlement } from "@/lib/front/types";
import { createQlooProvider } from "@/lib/providers/qloo";

export const dynamic = "force-dynamic";
const DEFAULT_BRAND = "bamboo-bowl";

/**
 * HQ view for a brand: stores on an SVG scatter colored by Qloo heat for one feature item, guardrails, the approval queue
 * (stores whose latest Qloo version is a draft), and the store-split holdout summary. Heat is the only live Qloo call here.
 */
export default async function FleetPage({ searchParams }: PageProps<"/front/fleet">) {
  const sp = await searchParams; const slug = typeof sp.brand === "string" && sp.brand ? sp.brand : DEFAULT_BRAND;
  const db = await getSsrClient();
  const [brand, { t }] = await Promise.all([getBrandBySlug(db, slug), getT()]);
  if (!brand) return <Empty title={t("front.notFound")} body={slug} action={<Link href="/front/fleet" className="font-semibold text-coral-ink">/front/fleet</Link>} />;
  const stores = await listBrandStores(db, brand.id);
  const sample = brand.organizationId === DEMO_ORG_ID;
  const [guardrails, holdouts, itemsByStore, versionsByStore] = await Promise.all([
    getGuardrails(db, brand.id), getHoldouts(db, { brandId: brand.id }),
    Promise.all(stores.map((s) => getItems(db, s.id))), Promise.all(stores.map((s) => getVersions(db, s.id))),
  ]);
  // feature item for the heat map: ?item=<id>, else the first tagged item of the first store that has one
  const allItems = itemsByStore.flat();
  const tagged = allItems.filter((i) => i.qlooTagIds.length);
  const item = (typeof sp.item === "string" ? tagged.find((i) => i.id === sp.item) : null) ?? tagged[0] ?? null;
  let z: Record<string, number | null> = {}; let heat: Record<string, number | null> = {}; let mapNote: string | null = null; let mapDetail: string | null = null;
  if (!item) mapNote = t("front.fleet.mapTagsFirst");
  else {
    try {
      const provider = createQlooProvider(process.env, { store: new SupabaseAnalysisStore(getServiceClient()), traceId: `front-fleet-${brand.slug}` });
      const r = await storeHeat(provider, stores, item.qlooTagIds, new CallLog(), stores[0]?.cuisine);
      z = r.z; heat = r.heat; if (r.call?.error) { mapNote = t("front.fleet.mapFailed"); mapDetail = r.call.error; }
      else if (!Object.values(r.heat).some((v) => v !== null)) mapNote = t("front.fleet.mapEmpty");
    } catch (e) { mapNote = t("front.fleet.mapFailed"); mapDetail = e instanceof Error ? e.message.slice(0, 80) : "error"; }
  }
  // renamable items are chosen by name at HQ and applied to every store's matching item ids
  const groups = new Map<string, string[]>();
  for (const i of allItems) { const k = i.nameEn ?? i.name; groups.set(k, [...(groups.get(k) ?? []), i.id]); }
  // approval queue: latest Qloo version per store still a draft
  const pending: PendingRow[] = [];
  for (const [idx, s] of stores.entries()) {
    const latest = versionsByStore[idx].find((v) => v.generatedBy === "qloo");
    if (latest?.status === "draft") pending.push({ storeId: s.id, storeName: s.name, city: s.city, versionId: latest.id, versionNo: latest.versionNo, moves: latest.items.filter((i) => i.changed.length).length });
  }
  const holdout = holdouts[0] ?? null; const summary = holdout ? splitSummary(holdout) : null;
  let settlement: Settlement | null = null;
  if (holdout) {
    const featured = versionsByStore.flatMap((vs) => currentVersion(vs)?.items.filter((i) => i.featured).map((i) => i.nameEn ?? i.name) ?? []);
    try { settlement = await settleBrand(db, stores, holdout, Array.from(new Set(featured)), sample); } catch { settlement = null; }
  }
  // small chains: what each store features (published version, else the latest Qloo draft)
  const compare = stores.length <= 8 ? stores.map((s, idx) => { const v = currentVersion(versionsByStore[idx]) ?? versionsByStore[idx].find((x) => x.generatedBy === "qloo") ?? null; return { city: s.city, items: (v?.items ?? []).filter((i) => i.featured).map((i) => i.nameEn ?? i.name) }; }) : null;
  const sampleChip = sample ? <Chip tone="warn" title={t("front.sampleTitle")}>{t("front.sample")}</Chip> : null;
  return (
    <div data-testid="front-fleet" className="grid gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{brand.name}</h1>{sampleChip}</div>
        <div className="text-[13px] text-ink-2">{t("front.fleet.stores", { n: stores.length })} · {t(`front.fleet.size.${brand.sizeClass}`)}</div>
      </div>
      <Card>
        <H2 hint={item ? t("front.fleet.mapTitle", { item: item.nameEn ?? item.name }) : undefined} right={sampleChip}>{t("front.fleetView")}</H2>
        <FleetMap stores={stores} z={z} noHeatLabel={t("front.fleet.noHeat")} />
        {mapNote ? <p className="mt-2 text-[12.5px] text-warn-ink" title={mapDetail ?? undefined}>{mapNote}</p> : <p className="mt-2 text-[12px] text-muted">{t("front.fleet.legend")}</p>}
        {tagged.length > 1 ? (
          <form className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-ink-2" method="get">
            <input type="hidden" name="brand" value={brand.slug} />
            <label className="flex w-full items-center gap-2">{t("front.fleet.pickItem")}
              <select name="item" defaultValue={item?.id} className="h-9 min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-2 text-[13px]">
                {Array.from(new Map(tagged.map((i) => [i.nameEn ?? i.name, i])).values()).map((i) => <option key={i.id} value={i.id}>{i.nameEn ?? i.name}</option>)}
              </select>
            </label>
            <button type="submit" className="h-9 rounded-[10px] bg-surface-2 px-3 text-[13px] font-semibold">OK</button>
          </form>
        ) : null}
      </Card>
      {compare ? (
        <Card>
          <H2>{t("front.fleet.compare")}</H2>
          <ul className="scroll-x -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6" data-testid="fleet-compare">
            {compare.map((c, i) => <li key={i} className="shrink-0 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px]">{c.items.length ? t("front.fleet.features", { city: c.city, item: c.items.join(", ") }) : t("front.fleet.noFeature", { city: c.city })}</li>)}
          </ul>
        </Card>
      ) : null}
      <Card>
        <H2>{t("front.fleet.guardrails")}</H2>
        <GuardrailsForm brandId={brand.id} guardrails={guardrails} groups={[...groups].map(([name, ids]) => ({ name, ids }))} />
      </Card>
      <Card>
        <H2 hint={pending.length ? `${pending.length}` : undefined}>{t("front.fleet.queue")}</H2>
        <ApprovalQueue rows={pending} />
      </Card>
      <Card>
        <H2 right={sampleChip}>{t("front.fleet.holdout")}</H2>
        <div data-testid="holdout-summary" className="grid gap-2">
          <div className="text-[15px] font-bold">{summary ? t("front.fleet.holdoutSummary", { changed: summary.changed, held: summary.heldOut }) : t("front.fleet.holdoutNone")}</div>
          {settlement ? <div className="text-[13px] text-ink-2">{settlement.status === "ready" ? `${t("front.settle.ready", { lift: `${(settlement.netSalesLiftUsd ?? 0) >= 0 ? "+" : ""}$${Math.abs(settlement.netSalesLiftUsd ?? 0).toFixed(0)}` })} · ${settlement.flukeRate === null ? t("front.settle.flukeNone") : t("front.settle.fluke", { f: `${Math.round(settlement.flukeRate * 100)}%` })}` : settlement.status === "short_history" ? t("front.settle.shortHistory") : t("front.settle.waiting")}</div> : null}
          <p className="text-[12px] text-muted">{t("front.fleet.holdoutHint")}</p>
          <PostButton url={`/api/front/brands/${brand.id}/holdout`} body={{ heat }} label={t("front.fleet.createHoldout")} busyLabel={t("front.fleet.creating")} variant="primary" disabled={stores.length < 2} testId="create-holdout" />
        </div>
      </Card>
    </div>
  );
}
