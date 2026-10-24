"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge, EvidenceBadge, cx } from "@/components/ui";
import type { HypothesisView } from "@/lib/queries";

/** With Qloo vs without Qloo: same catalog, two rankings. Shows which returned signal moved each hypothesis. */
export function CompareToggle({ hypotheses, base, mode }: { hypotheses: HypothesisView[]; base: string; mode: "live" | "sample" | null }) {
  const [withQloo, setWithQloo] = useState(true);
  const list = withQloo ? [...hypotheses].sort((a, b) => a.rank - b.rank) : [...hypotheses].sort((a, b) => a.baselineRank - b.baselineRank);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Compare rankings" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button type="button" onClick={() => setWithQloo(false)} aria-pressed={!withQloo} className={cx("h-9 rounded-md px-3 text-sm", !withQloo ? "bg-surface-2 font-medium" : "text-ink-2")}>Without Qloo</button>
          <button type="button" onClick={() => setWithQloo(true)} aria-pressed={withQloo} className={cx("h-9 rounded-md px-3 text-sm", withQloo ? "bg-accent text-white font-medium" : "text-ink-2")}>With Qloo</button>
        </div>
        <p className="text-xs text-muted">{withQloo ? (mode === "live" ? "Ranked with live Qloo evidence." : "Ranked with the illustrative sample fixture (not live Qloo).") : "Generic baseline: operational fit and economics only, no taste evidence."}</p>
      </div>
      <ol className="mt-3 grid gap-2">
        {list.map((h) => {
          const rank = withQloo ? h.rank : h.baselineRank;
          const delta = h.qlooDelta.rankChange;
          return (
            <li key={h.id} className="card flex items-start gap-3 p-3">
              <div className="tabular w-6 shrink-0 pt-0.5 text-center font-mono text-sm text-muted">{rank}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`${base}/opportunities/${h.id}`} className="font-medium hover:underline">{h.title}</Link>
                  {withQloo ? <EvidenceBadge label={h.evidenceLabel} /> : <Badge tone="muted">generic</Badge>}
                  {withQloo && delta !== 0 ? <Badge tone={delta > 0 ? "good" : "bad"}>{delta > 0 ? `↑ ${delta}` : `↓ ${-delta}`} vs baseline</Badge> : null}
                </div>
                <p className="mt-0.5 text-sm text-ink-2">{withQloo ? h.segment : "Segment: unspecified (no taste evidence)"}</p>
                {withQloo && h.qlooDelta.changedBy.length ? (
                  <p className="mt-1 text-xs text-muted">Changed by: {h.qlooDelta.changedBy.map((c) => `${c.name}${c.affinity !== undefined ? ` (${c.affinity.toFixed(2)})` : ""}`).join(", ")}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
