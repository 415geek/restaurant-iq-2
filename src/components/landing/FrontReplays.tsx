"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chip, cx, fmtUsd } from "@/components/ui";
import type { Replay } from "@/lib/front/replays";
import type { StorefrontVersion } from "@/lib/front/types";

/**
 * Home-page replays: a recorded real run plays its agent log at ~10× speed while the menu on the right morphs from the
 * printed order to the published storefront. Nothing is generated client-side; the events, moves and versions are stored runs.
 */
const SPEED = 10; const MAX_MS = 14_000;
const labelFor: Record<string, string> = { resolve_store: "Resolve store", neighborhood_profile: "Neighborhood profile", dish_lift: "Crowd-vs-city lift", rank_features: "Rank features", compare_rival: "Compare rival", propose_moves: "Propose moves", apply_guardrails: "Apply guardrails", draft_version: "Draft storefront" };

function MenuList({ items, names, changedIds }: { items: StorefrontVersion["items"]; names: Record<string, string>; changedIds: Set<string> }) {
  return (
    <ol className="grid gap-1">
      {items.slice(0, 9).map((i) => (
        <li key={i.id} className={cx("flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors duration-500", i.featured ? "bg-coral-soft font-semibold" : changedIds.has(i.id) ? "bg-surface-2" : "")} style={{ viewTransitionName: `r-${i.id}` }}>
          <span className="truncate">{names[i.id] ?? i.name}{i.featured ? <span className="ml-2 rounded-full bg-coral px-1.5 py-px text-[10px] font-bold text-white">Featured</span> : null}</span>
          <span className="tabular-nums text-muted">{fmtUsd(i.priceCents / 100, 0)}</span>
        </li>
      ))}
      {items.length > 9 ? <li className="px-2.5 text-[11.5px] text-muted">+{items.length - 9} more</li> : null}
    </ol>
  );
}

export function FrontReplays({ replays }: { replays: Replay[] }) {
  const [sel, setSel] = useState(0);
  const r = replays[sel];
  if (!r) return null;
  return (
    <div className="grid gap-4" data-testid="front-replays">
      <div className="flex flex-wrap gap-2">
        {replays.map((x, i) => (
          <button key={x.slug} type="button" onClick={() => setSel(i)} aria-pressed={i === sel} data-testid="replay-card" className={cx("card flex-1 min-w-44 p-3 text-left transition-shadow", i === sel ? "ring-2 ring-coral" : "hover:shadow-md")}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{x.storeCount === 1 ? "1 store" : `${x.storeCount}-store ${x.storeCount >= 20 ? "franchise" : "chain"}`}</div>
            <div className="mt-0.5 truncate text-[14px] font-bold">{x.brandName ?? x.name}</div>
            <div className="truncate text-[12px] text-ink-2">{x.cuisine} · {x.neighborhood}, {x.city}</div>
          </button>
        ))}
      </div>
      {/* keyed by store so switching cards restarts the player from a fresh state (no setState inside effects) */}
      <Player key={r.slug} r={r} />
    </div>
  );
}

function Player({ r }: { r: Replay }) {
  const [shown, setShown] = useState(0);
  const done = shown >= r.run.events.length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const ev = r.run.events; let i = 0;
    const step = () => {
      i += 1; setShown(i);
      if (i >= ev.length) return;
      const wait = Math.min(2500, Math.max(350, (ev[i].t - ev[i - 1].t) / SPEED));
      timer.current = setTimeout(step, Math.min(wait, MAX_MS / ev.length));
    };
    timer.current = setTimeout(step, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [r]);
  const changed = new Set(r.after.filter((i) => i.changed.length).map((i) => i.id));
  const kept = r.run.moves.filter((m) => m.guardrail?.ok !== false);
  return (
    <div className="card grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-ink-2">Agent log<Chip tone={r.run.mode === "live" ? "pos" : "warn"}>{r.run.mode === "live" ? "Live Qloo · recorded run" : "Sample dataset"}</Chip><Chip tone="warn">Sample menu</Chip></div>
        <ol className="grid gap-1.5 font-mono text-[11.5px]" data-testid="replay-log" aria-live="polite">
          {r.run.events.slice(0, shown).map((e, i) => (
            <li key={i} className="grid grid-cols-[150px_1fr] gap-2"><span className="text-coral">{labelFor[e.step] ?? e.step}</span><span className="text-ink-2">{e.detail}</span></li>
          ))}
          {!done ? <li className="text-muted">…</li> : null}
        </ol>
        {done ? (
          <div className="mt-3 grid gap-1 text-[12.5px]">
            {kept.slice(0, 4).map((m) => <div key={m.id} className="flex gap-2"><span className={m.verified ? "text-good" : "text-warn"}>{m.verified ? "✓" : "⚠"}</span><span className="text-ink-2"><b className="capitalize">{m.kind}</b> {r.itemNames[m.itemId] ?? ""} — {m.rationale}</span></div>)}
            <div className="mt-1 text-[11.5px] text-muted">Every change cites the Qloo tag or lift term behind it. ✓ = verified against the stored response.</div>
          </div>
        ) : null}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-ink-2"><span>{done ? `Storefront v${r.versionNo ?? "—"}` : "Menu as printed"}</span><span className="text-muted">{done ? `${changed.size} items changed` : ""}</span></div>
        <MenuList items={done ? r.after : r.before} names={r.itemNames} changedIds={done ? changed : new Set()} />
        <div className="mt-3 flex flex-wrap gap-2"><Link href={`/m/${r.slug}`} className="text-[13px] font-semibold text-pos">Open the customer menu →</Link><Link href={`/front?store=${r.slug}`} className="text-[13px] font-semibold text-pos">Owner card →</Link></div>
      </div>
    </div>
  );
}
