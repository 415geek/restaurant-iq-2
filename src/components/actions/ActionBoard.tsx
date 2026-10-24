"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, cx } from "@/components/ui";
import { ACTION_STATUSES, canTransition, type ActionStatus } from "@/lib/validation/schemas";
import type { ActionView } from "@/lib/queries";

const COLS: Array<{ key: ActionStatus; label: string }> = [
  { key: "draft", label: "Draft" }, { key: "needs_approval", label: "Needs approval" }, { key: "ready", label: "Ready" }, { key: "in_progress", label: "In progress" }, { key: "completed", label: "Completed" }, { key: "canceled", label: "Canceled" },
];

export function ActionBoard({ actions }: { actions: ActionView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string>("");
  const [filter, setFilter] = useState<string>("all");
  const titles = Array.from(new Set(actions.map((a) => a.hypothesisTitle).filter((x): x is string => !!x)));
  const visible = filter === "all" ? actions : actions.filter((a) => a.hypothesisTitle === filter);

  async function move(a: ActionView, to: ActionStatus) {
    setBusy(a.id); setErr("");
    let approvalNote: string | undefined;
    if (a.status === "needs_approval" && to === "ready") {
      approvalNote = window.prompt("Approval note (optional). Approving allows this external action to proceed.") ?? undefined;
    }
    const res = await fetch(`/api/actions/${a.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to, approvalNote }) });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setErr(j.error ?? "Transition failed"); return; }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted" htmlFor="filter">Hypothesis</label>
        <select id="filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
          <option value="all">All</option>
          {titles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {err ? <span className="text-bad" role="alert">{err}</span> : null}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[72rem] grid-cols-6 gap-3">
          {COLS.map((col) => {
            const items = visible.filter((a) => a.status === col.key);
            return (
              <section key={col.key} aria-label={col.label} className="rounded-lg bg-surface-2/60 p-2">
                <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted">{col.label}<span className="tabular">{items.length}</span></h3>
                <ul className="grid gap-2">
                  {items.map((a) => {
                    const nexts = ACTION_STATUSES.filter((s) => s !== a.status && canTransition(a.status as ActionStatus, s, { requiresApproval: a.requiresApproval, hasApproval: a.status === "needs_approval" }).ok);
                    return (
                      <li key={a.id} className="card p-3 text-sm">
                        <div className="font-medium leading-5">{a.title}</div>
                        {a.description ? <p className="mt-1 line-clamp-3 text-xs text-ink-2">{a.description}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.externalSideEffect ? <Badge tone="warn">external · approval</Badge> : null}
                          {a.owner ? <Badge>{a.owner}</Badge> : null}
                          {a.dueDate ? <Badge tone="muted">due {a.dueDate}</Badge> : null}
                          {a.evidenceIds.length ? <Badge tone="accent">{a.evidenceIds.length} source{a.evidenceIds.length === 1 ? "" : "s"}</Badge> : null}
                        </div>
                        {a.approvals.length ? <p className="mt-1 text-[11px] text-muted">Approved by {a.approvals[0].actorLabel}{a.approvals[0].note ? `: ${a.approvals[0].note}` : ""}</p> : null}
                        <p className="mt-1 text-[11px] text-muted">{a.hypothesisTitle ?? "General"} · updated {new Date(a.updatedAt).toLocaleDateString()}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {nexts.map((n) => (
                            <Button key={n} size="sm" variant={n === "canceled" ? "ghost" : n === "ready" && a.status === "needs_approval" ? "primary" : "secondary"} disabled={busy === a.id} onClick={() => move(a, n)} className={cx("h-8 px-2 text-xs")}>
                              {n === "ready" && a.status === "needs_approval" ? "Approve → ready" : `→ ${n.replace("_", " ")}`}
                            </Button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                  {items.length === 0 ? <li className="px-1 py-3 text-xs text-muted">Empty</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
