"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";
import { ACTION_STATUSES, canTransition, type ActionStatus } from "@/lib/validation/schemas";
import type { ActionView } from "@/lib/queries";

const COLS: ActionStatus[] = ["draft", "needs_approval", "ready", "in_progress", "completed", "canceled"];

/** Status-grouped task list. Mobile: stacked groups; desktop: 3 columns. Text-light cards, one action row. */
export function ActionBoard({ actions }: { actions: ActionView[] }) {
  const { t, lt, locale } = useI18n();
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {COLS.map((col) => {
          const items = visible.filter((a) => a.status === col);
          if (!items.length && (col === "canceled" || col === "completed")) return null;
          return (
            <section key={col} aria-label={t(`actions.cols.${col}`)} className="rounded-2xl bg-surface-2/70 p-2.5">
              <h3 className="mb-2 flex items-center justify-between px-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">{t(`actions.cols.${col}`)}<span className="tabular">{items.length}</span></h3>
              <ul className="grid gap-2">
                {items.map((a) => {
                  const nexts = ACTION_STATUSES.filter((s) => s !== a.status && canTransition(a.status as ActionStatus, s, { requiresApproval: a.requiresApproval, hasApproval: a.status === "needs_approval" }).ok);
                  const primary = a.status === "needs_approval" ? "ready" : nexts.find((n) => n !== "canceled" && n !== "draft");
                  return (
                    <li key={a.id} className="card p-3">
                      <div className="text-[14px] font-semibold leading-5">{lt(a.titleLt ?? a.title)}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">{a.externalSideEffect ? <Chip tone="warn">{t("actions.external")}</Chip> : null}{a.owner ? <Chip>{a.owner}</Chip> : null}{a.dueDate ? <Chip tone="muted">{t("actions.due", { d: a.dueDate })}</Chip> : null}{a.hypothesisSlug ? <Chip tone="coral">{t(`hyp.${a.hypothesisSlug}.title`)}</Chip> : null}</div>
                      {a.approvals.length ? <p className="mt-1.5 text-[11.5px] text-muted"><Icon.check className="mr-1 inline text-good" width={12} height={12} />{t("actions.approvedBy", { who: a.approvals[0].actorLabel })}{a.approvals[0].note ? `: ${a.approvals[0].note}` : ""}</p> : null}
                      <details className="mt-1.5 text-[12.5px] text-ink-2"><summary className="cursor-pointer select-none text-muted">{t("common.more")}</summary><p className="mt-1">{lt(a.descriptionLt ?? a.description)}</p><p className="mt-1 text-[11px] text-muted">{t("actions.updated", { d: new Date(a.updatedAt).toLocaleDateString(locale === "zh" ? "zh-CN" : locale) })}</p></details>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {primary ? <Button size="sm" variant={a.status === "needs_approval" ? "coral" : "primary"} disabled={busy === a.id} onClick={() => move(a, primary)} className={cx("h-8 px-2.5 text-[12px]")}>{a.status === "needs_approval" ? t("actions.approve") : t("actions.moveTo", { s: t(`actions.cols.${primary}`) })}</Button> : null}
                        {nexts.filter((n) => n !== primary).map((n) => <Button key={n} size="sm" variant="ghost" disabled={busy === a.id} onClick={() => move(a, n)} className="h-8 px-2 text-[12px]">{t("actions.moveTo", { s: t(`actions.cols.${n}`) })}</Button>)}
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
