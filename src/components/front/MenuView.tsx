"use client";
import { useState } from "react";
import { Button, Chip, cx, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { useI18n } from "@/i18n/client";
import type { Move, StorefrontVersion } from "@/lib/front/types";
import { fmtScore, menuWhy, okMoves } from "./evidence";

type Items = StorefrontVersion["items"];

/**
 * Public menu. Both versions arrive from the server; the "Qloo on / off" switch is pure client state (no network).
 * Items that were renamed, re-described or featured carry a "changed" badge (a bare position change is not worth a badge);
 * tapping it opens the reason in the diner's language, with whether it was checked against Qloo's answer.
 * `claim` is only passed when the active TastePass is for a dish on this menu.
 */
export type ClaimLink = { href: string; item: string; price: string };
export function MenuView({ storeName, neighborhood, qloo, baseline, moves, claim, sample, note }: {
  storeName: string; neighborhood: string; qloo: Items | null; baseline: Items; moves: Move[]; claim: ClaimLink | null; sample: boolean; note: string | null;
}) {
  const { t } = useI18n();
  const canSwitch = qloo !== null;
  const [on, setOn] = useState(canSwitch);
  const [openId, setOpenId] = useState<string | null>(null);
  const items = on && qloo ? qloo : baseline;
  const featured = items.filter((i) => i.featured);
  const byItem = new Map<string, Move[]>();
  for (const m of okMoves(moves)) byItem.set(m.itemId, [...(byItem.get(m.itemId) ?? []), m]);
  const price = (c: number) => fmtUsd(c / 100, 2);

  function Badge({ id }: { id: string }) {
    const open = openId === id;
    return (
      <button type="button" data-testid="changed-badge" aria-expanded={open} aria-label={t("front.menu.whyTitle")} onClick={() => setOpenId(open ? null : id)}
        className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold", open ? "bg-coral text-white" : "bg-coral-soft text-coral-ink")}>
        <Icon.info width={12} height={12} />{t("front.menu.changed")}
      </button>
    );
  }
  function Evidence({ item }: { item: Items[number] }) {
    const ms = byItem.get(item.id) ?? [];
    const ev = ms.flatMap((m) => m.evidence);
    const why = menuWhy(ms, t);
    const checked = ms.length > 0 && ms.every((m) => m.verified);
    return (
      <div data-testid="evidence-pop" role="region" aria-label={t("front.menu.whyTitle")} className="mt-2 rounded-xl border border-border bg-surface-2 p-3 text-[12.5px] leading-5">
        <div className="mb-1 flex flex-wrap gap-1">{item.changed.filter((c) => c !== "sortIndex").map((c) => <Chip key={c} tone="neutral" className="bg-surface">{t(`front.menu.what.${c}`)}</Chip>)}</div>
        {why ? (
          <>
            <div>{why}</div>
            <div className={checked ? "text-good-ink" : "text-warn-ink"}>{checked ? `✓ ${t("front.menu.verifiedBy")}` : `⚠ ${t("front.menu.unverifiedBy")}`}</div>
          </>
        ) : ev.length ? ev.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold">{t("front.menu.leans", { tag: e.name })}</span>
            <span className="tabular text-ink-2">{t("front.menu.score", { s: fmtScore(e.score) })}</span>
            <span className="text-ink-2">{t("front.menu.near", { place: neighborhood })}</span>
            <span className={e.verified ? "text-good-ink" : "text-warn-ink"}>{e.verified ? `✓ ${t("front.menu.verified")}` : `⚠ ${t("front.menu.unverified")}`}</span>
          </div>
        )) : <div className="text-ink-2">{t("front.menu.noEvidence")}</div>}
        {!why && ms[0]?.rationale ? <div className="mt-1 text-ink-2">{ms[0].rationale}</div> : null}
      </div>
    );
  }
  function Row({ item, hero }: { item: Items[number]; hero?: boolean }) {
    // a badge only when something a diner can see changed; a bare position change stays quiet
    const changed = on && item.changed.some((c) => c !== "sortIndex");
    return (
      <li data-testid="menu-item" data-featured={item.featured || undefined} className={cx("py-3", hero ? "card p-4" : "hairline first:border-t-0")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold leading-5">{item.name}</span>
              {item.nameEn && item.nameEn !== item.name ? <span className="text-[13px] text-ink-2">{item.nameEn}</span> : null}
              {changed ? <Badge id={item.id} /> : null}
            </div>
            {item.description ? <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{item.description}</p> : null}
          </div>
          <span className="tabular shrink-0 text-[14px] font-semibold">{price(item.priceCents)}</span>
        </div>
        {changed && openId === item.id ? <Evidence item={item} /> : null}
      </li>
    );
  }
  // category heads are computed once per render, outside JSX. A Qloo reorder interleaves categories; then the list is flat (order is the point).
  const rest = items.filter((i) => !i.featured);
  const runs = rest.reduce<Array<{ cat: string } | Items[number]>>((acc, i) => { const prev = acc[acc.length - 1]; const prevCat = prev ? ("cat" in prev ? prev.cat : prev.category) : null; if (i.category !== prevCat) acc.push({ cat: i.category }); acc.push(i); return acc; }, []);
  const contiguous = runs.filter((r) => "cat" in r).length === new Set(rest.map((i) => i.category)).size;
  const rows = contiguous ? runs : rest;
  return (
    <div data-testid="front-menu" data-qloo={on ? "on" : "off"} className="grid gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{storeName}</h1>
          <div className="text-[13px] text-ink-2">{neighborhood}</div>
        </div>
        {canSwitch ? (
          <button type="button" role="switch" aria-checked={on} aria-label={t("front.menu.switchLabel")} data-testid="qloo-switch" onClick={() => { setOn((v) => !v); setOpenId(null); }}
            className={cx("flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold", on ? "border-coral bg-coral text-white" : "border-border bg-surface text-ink-2")}>
            <span className={cx("h-3 w-3 rounded-full", on ? "bg-white" : "bg-border")} aria-hidden />{on ? t("front.menu.qlooOn") : t("front.menu.qlooOff")}
          </button>
        ) : null}
      </header>
      {note ? <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2" role="note">{note}</p> : null}
      {featured.length ? (
        <section aria-label={t("front.menu.featured")} className="grid gap-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-coral-ink">{t("front.menu.featured")}</div>
          <ul className="grid gap-2">{featured.map((i) => <Row key={i.id} item={i} hero />)}</ul>
        </section>
      ) : null}
      {claim ? <Button variant="coral" href={claim.href} className="w-full">{t("front.menu.claimItem", { item: claim.item, price: claim.price })}</Button> : null}
      <ul className="card px-4 py-1">
        {rows.map((r, idx) => ("cat" in r ? <li key={`c-${idx}`} className="pt-3 text-[12px] font-semibold uppercase tracking-wide text-muted">{r.cat}</li> : <Row key={r.id} item={r} />))}
      </ul>
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
        <span className="flex items-center gap-2">{t("front.menu.footer")}{sample ? <Chip tone="warn" title={t("front.sampleTitle")}>{t("front.sample")}</Chip> : null}</span>
        <LocaleSwitch />
      </footer>
    </div>
  );
}
