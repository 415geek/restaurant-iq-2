import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Chip, H2 } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StepBar } from "@/components/shell/StepBar";
import { ActivateForm, type ActivateDefaults } from "@/components/campaign/ActivateForm";
import { getHypothesis, getRestaurantOverview } from "@/lib/queries";
import { getActiveCampaignForHypothesis } from "@/lib/campaigns";
import { getT, formatLText } from "@/i18n";

const half = (n: number) => Math.round(n * 2) / 2;

export default async function NewPassPage({ params, searchParams }: PageProps<"/r/[id]/passes/new">) {
  const { id } = await params; const sp = await searchParams; const base = `/r/${id}`;
  const hid = typeof sp.h === "string" ? sp.h : undefined;
  if (!hid) redirect(`${base}/opportunities`);
  const [data, overview, existing, { t }] = await Promise.all([getHypothesis(hid), getRestaurantOverview(id), getActiveCampaignForHypothesis(hid), getT()]);
  if (!data || data.restaurantId !== id || !overview) notFound();
  if (existing && existing.status === "active") redirect(`${base}/passes/${existing.id}`);
  const h = data.hypothesis; const s = h.defaultScenario;
  const lt = (x: Parameters<typeof formatLText>[1]) => formatLText(t, x);
  const dep = h.playbook?.offering?.menuDependencies?.[0];
  const menuItem = dep ?? overview.menu.find((m) => m.isSignature)?.name ?? overview.menu[0]?.name ?? "";
  const mi = overview.menu.find((m) => m.name === menuItem);
  const regular = Number(mi?.price ?? s.salePrice ?? 15);
  const variable = Number(mi?.foodCost ?? s.foodCostPerUnit ?? 0) + Number(s.packagingPerUnit ?? 0) + Number(s.otherVariableCostPerUnit ?? 0);
  const defaults: ActivateDefaults = {
    offerName: t(`hyp.${h.slug}.title`).slice(0, 80), menuItem: menuItem.slice(0, 80), regularPrice: regular,
    offerPrice: half(regular * 0.85), variableCost: Math.round(variable * 100) / 100, feePct: Math.round(Number(s.cardFeePct ?? 0.029) * 1000) / 10,
    fixedSpend: 40, maxRedemptions: 50, days: 14, terms: t("pass.termsDefault"),
  };
  const labels = { snapshot: t("steps.snapshot"), signals: t("steps.signals"), choose: t("steps.choose"), decide: t("steps.decide"), act: t("steps.act"), prove: t("steps.prove") };
  return (
    <div className="grid gap-5">
      <StepBar current="act" labels={labels} hrefs={{ snapshot: base, signals: `${base}/taste`, choose: `${base}/opportunities`, decide: `${base}/opportunities/${h.id}` }} />
      <div>
        <Link href={`${base}/opportunities/${h.id}`} className="inline-flex items-center gap-1 text-[13px] text-pos"><Icon.arrowLeft width={16} height={16} />{t("pass.fromIdea")}: {t(`hyp.${h.slug}.title`)}</Link>
        <h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.02em]">{t("pass.formTitle")}</h2>
        <p className="mt-1 text-[14.5px] text-ink-2">{t("pass.formHint")}</p>
      </div>
      <Card><ActivateForm restaurantId={id} hypothesisId={h.id} defaults={defaults} /></Card>
      <Card>
        <H2 hint={t("pass.whyHint")}>{t("pass.whyT")}</H2>
        <ul className="grid gap-2 sm:grid-cols-2">{h.citations.slice(0, 4).map((c) => <li key={c.id + c.kind} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-[13.5px]"><div className="min-w-0"><div className="truncate font-semibold">{c.name}</div><div className="text-[12px] text-ink-2">{lt(c.note)}</div></div>{c.affinity !== undefined ? <Chip tone="coral" ring={c.kind === "demographic" ? undefined : c.affinity}>{c.affinity.toFixed(2)}</Chip> : null}</li>)}</ul>
      </Card>
    </div>
  );
}
