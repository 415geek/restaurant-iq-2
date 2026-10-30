import Link from "next/link";
import { FrontStepBar, type FrontStage } from "@/components/front/FrontStepBar";
import { MovesList } from "@/components/front/MovesList";
import { OwnerActions } from "@/components/front/OwnerActions";
import { RunConsole } from "@/components/front/RunConsole";
import { SettleCard } from "@/components/front/SettleCard";
import { Card, Chip, Empty, H2, fmtDate } from "@/components/ui";
import { getT } from "@/i18n";
import { getSsrClient } from "@/lib/db/ssr";
import { currentVersion, getHoldouts, getItems, getMovesForVersion, getRuns, getStoreBySlug, getVersions } from "@/lib/front/db";
import { identityItems } from "@/lib/front/moves";
import { settleStore } from "@/lib/front/settlement";
import { DEMO_ORG_ID, type Settlement } from "@/lib/front/types";
import { okMoves } from "@/components/front/evidence";

export const dynamic = "force-dynamic";
const DEFAULT_STORE = "chuan-lane-san-bruno";

/** Owner card: one phone screen. Stage bar, this week's moves with evidence, Approve (hold) / Roll back / Run agent, and the settlement. */
export default async function FrontOwnerPage({ searchParams }: PageProps<"/front">) {
  const sp = await searchParams; const slug = typeof sp.store === "string" && sp.store ? sp.store : DEFAULT_STORE;
  const db = await getSsrClient();
  const [store, { t, locale }] = await Promise.all([getStoreBySlug(db, slug), getT()]);
  if (!store) return <Empty title={t("front.notFound")} body={slug} action={<Link href="/front" className="text-coral-ink font-semibold">/front</Link>} />;
  const [items, versions, runs, holdouts] = await Promise.all([getItems(db, store.id), getVersions(db, store.id), getRuns(db, store.id, 5), getHoldouts(db, { storeId: store.id })]);
  const sample = store.organizationId === DEMO_ORG_ID;
  const published = currentVersion(versions);
  const latestQloo = versions.find((v) => v.generatedBy === "qloo") ?? null;
  const draft = latestQloo?.status === "draft" ? latestQloo : null;
  const shown = draft ?? published ?? latestQloo;                         // the version whose moves the owner is looking at
  let moves = shown ? await getMovesForVersion(db, shown.id) : [];
  if (shown && !moves.length) moves = runs.find((r) => r.id === shown.runId)?.moves ?? [];
  const holdout = holdouts[0] ?? null;
  let settlement: Settlement | null = null;
  if (holdout) { try { settlement = await settleStore(db, store, holdout, published, sample); } catch { settlement = null; } }
  const stage: FrontStage = !runs.length && !latestQloo ? "taste" : !published ? (latestQloo ? "publish" : "rewrite") : settlement?.status === "ready" ? "prove" : "prove";
  const lastRun = runs[0] ?? null;
  const n = okMoves(moves).length;
  return (
    <div data-testid="front-owner" className="grid gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{store.name}</h1>
          {sample ? <Chip tone="warn" title={t("front.sampleTitle")}>{t("front.sample")}</Chip> : null}
          {lastRun ? <Chip tone={lastRun.mode === "live" ? "good" : "warn"}>{lastRun.mode === "live" ? t("front.live") : t("mode.sampleBadge")}</Chip> : null}
        </div>
        <div className="text-[13px] text-ink-2">{store.neighborhood}, {store.city} · <Link href={`/m/${store.slug}`} className="font-semibold text-coral-ink">{t("front.owner.seeMenu")}</Link></div>
      </div>
      <FrontStepBar current={stage} labels={{ taste: t("front.steps.taste"), rewrite: t("front.steps.rewrite"), publish: t("front.steps.publish"), prove: t("front.steps.prove") }} />
      <Card>
        <H2 hint={shown ? `${t("front.owner.version", { v: shown.versionNo })} · ${t(`front.owner.status.${shown.status}`)} · ${fmtDate(shown.createdAt, locale)}` : undefined}
          right={sample ? <Chip tone="warn" title={t("front.sampleTitle")}>{t("front.sample")}</Chip> : null}>{t("front.owner.movesN", { n })}</H2>
        {moves.length ? <MovesList moves={moves} items={shown?.items.length ? shown.items : identityItems(items)} t={t} /> : (
          <div data-testid="front-moves" className="rounded-xl border border-dashed border-border p-4 text-[13px]"><div className="font-semibold">{t("front.owner.noMoves")}</div><p className="text-ink-2">{t("front.owner.noMovesBody")}</p></div>
        )}
      </Card>
      <Card>
        <div className="grid gap-4">
          <OwnerActions draft={draft ? { id: draft.id, versionNo: draft.versionNo } : null} published={published ? { id: published.id, versionNo: published.versionNo } : null} />
          <div className="hairline pt-4"><RunConsole storeId={store.id} /></div>
        </div>
      </Card>
      <SettleCard storeId={store.id} holdout={holdout} settlement={settlement} hasRestaurant={!!store.restaurantId} sample={sample} t={t} locale={locale} />
    </div>
  );
}
