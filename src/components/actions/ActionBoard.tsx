"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { ACTION_STATUSES, canTransition, type ActionStatus } from "@/lib/validation/schemas";
import type { ActionView } from "@/lib/queries";

const COLS: ActionStatus[] = ["draft", "needs_approval", "ready", "in_progress", "completed", "canceled"];

/** Status-grouped task list. Mobile: stacked groups; desktop: 3 columns. Text-light cards, one action row. */
export function ActionBoard({ actions }: { actions: ActionView[] }) {
  const { t, lt } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const slugs = Array.from(new Set(actions.map((a) => a.hypothesisSlug).filter((x): x is string => !!x)));
  const visible = filter === "all" ? actions : actions.filter((a) => a.hypothesisSlug === filter);
  async function move(a: ActionView, to: ActionStatus) {
    setBusy(a.id); setErr("");
    let approvalNote: string | undefined;
    if (a.status === "needs_approval" && to === "ready") approvalNote = window.prompt(t("actions.approvalNote")) ?? undefined;
    const res = await fetch(`/api/actions/${a.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to, approvalNote }) });
    const j = await res.json().catch(() => ({})); setBusy(null);
    if (!res.ok) { setErr(j.error ?? t("actions.failed")); return; }
    router.refresh();
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label htmlFor="filter" className="text-muted">{t("actions.filter")}</label>
        <select id="filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-[var(--radius-ctl)] border border-border bg-surface px-2 text-[13px]"><option value="all">{t("actions.all")}</option>{slugs.map((s) => <option key={s} value={s}>{t(`hyp.${s}.title`)}</option>)}</select>
        {err ? <span className="text-bad" role="alert">{err}</span> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {COLS.map((col) => {
          const items = visible.filter((a) => a.status === col);
          if (!items.length && (col === "canceled" || col === "completed")) return null;
          return (
            <section key={col} aria-label={t(`actions.cols.${col}`)} className="rounded-2xl bg-surface-2/70 p-2.5">
              <h3 className="mb-2 flex items-center justify-between px-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">{t(`actions.cols.${col}`)}<span className="tabular">{items.length}</span></h3>
              <ul className="grid gap-1.5">
                {items.map((a) => {
                  const nexts = ACTION_STATUSES.filter((s) => s !== a.status && canTransition(a.status as ActionStatus, s, { requiresApproval: a.requiresApproval, hasApproval: a.status === "needs_approval" }).ok);
                  const primary = a.status === "needs_approval" ? "ready" : nexts.find((n) => n !== "canceled" && n !== "draft");
                  return (
                    <li key={a.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold leading-5">{lt(a.titleLt ?? a.title)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">{a.hypothesisSlug ? <Chip tone="coral">{t(`hyp.${a.hypothesisSlug}.title`)}</Chip> : null}{a.externalSideEffect ? <Chip tone="warn">{t("actions.external")}</Chip> : null}{a.owner ? <span>{a.owner}</span> : null}{a.dueDate ? <span>· {t("actions.due", { d: a.dueDate })}</span> : null}{a.approvals.length ? <span className="text-good-ink">· {t("actions.approvedBy", { who: a.approvals[0].actorLabel })}</span> : null}</div>
                      </div>
                      <div className="flex max-w-full shrink-0 flex-wrap gap-1 sm:max-w-[50%]">
                        {primary ? <Button size="sm" variant={a.status === "needs_approval" ? "coral" : "primary"} disabled={busy === a.id} onClick={() => move(a, primary)} className="h-8 px-2.5 text-[12px]">{a.status === "needs_approval" ? t("actions.approve") : t("actions.moveTo", { s: t(`actions.cols.${primary}`) })}</Button> : null}
                        {nexts.filter((n) => n !== primary).map((n) => <Button key={n} size="sm" variant="ghost" disabled={busy === a.id} onClick={() => move(a, n)} className="h-8 px-2 text-[12px]" title={lt(a.descriptionLt ?? a.description)}>{t("actions.moveTo", { s: t(`actions.cols.${n}`) })}</Button>)}
                      </div>
                    </li>
                  );
                })}
                {items.length === 0 ? <li className="px-1.5 py-2 text-[12px] text-muted">—</li> : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
