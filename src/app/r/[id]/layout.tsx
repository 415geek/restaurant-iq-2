import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/shell/WorkspaceShell";
import { DataPill } from "@/components/shell/DataPill";
import { TrustPanel } from "@/components/evidence/TrustPanel";
import { Chip } from "@/components/ui";
import { getLatestEvidence, getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { getSessionUser } from "@/lib/db/ssr";
import { getT } from "@/i18n";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/r/[id]">) {
  const { id } = await params;
  const [overview, run, user, { t }] = await Promise.all([getRestaurantOverview(id), getLatestRun(id), getSessionUser(), getT()]);
  if (!overview) notFound();
  const evidence = await getLatestEvidence(id, run?.startedAt ?? null);
  const p = overview.profile; const ca = p.costAssumptions;
  const mode = evidence.mode ?? run?.mode ?? (process.env.QLOO_API_KEY ? "live" : "sample");
  const assumptions = [t("trust.aAvgTicket", { v: ca.avg_ticket ? `$${ca.avg_ticket}` : t("common.unknown") }), t("trust.aFoodCost", { v: ca.food_cost_pct ? `${Math.round(ca.food_cost_pct * 100)}%` : t("common.unknown") }), t("trust.aLabor", { v: `$${ca.labor_cost_per_hour ?? 22}` }), t("trust.aCommission", { v: `${Math.round((ca.delivery_commission_pct ?? 0.25) * 100)}%` }), t("trust.aCard", { v: `${((ca.card_fee_pct ?? 0.029) * 100).toFixed(1)}%` })];
  const unknowns = [overview.menu.some((m) => !m.foodCost) ? t("trust.uFoodCost") : null, !p.hoursSummary ? t("trust.uHours") : null, t("trust.uSales"), t("trust.uChannels")].filter((x): x is string => !!x);
  const header = (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]">{p.name}</h1>
          {overview.isDemo ? <Chip tone="warn" title={t("mode.syntheticBody")}>{t("mode.syntheticDemo")}</Chip> : null}
        </div>
        <p className="mt-0.5 text-[14px] text-ink-2">{p.cuisine} · {[p.neighborhood, p.city].filter(Boolean).join(", ")}</p>
      </div>
      <DataPill mode={mode} sourceCount={evidence.sources.length}>
        <TrustPanel evidence={evidence} run={run} assumptions={assumptions} unknowns={unknowns} />
      </DataPill>
    </div>
  );
  return <WorkspaceShell base={`/r/${id}`} header={header} signedIn={!!user}>{children}</WorkspaceShell>;
}
