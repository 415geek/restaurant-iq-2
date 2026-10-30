"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Chip } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export interface PendingRow { storeId: string; storeName: string; city: string; versionId: string; versionNo: number; moves: number }

/** Stores whose latest Qloo version is still a draft. Per-store approve, or approve all (sequential POSTs, each its own event). */
export function ApprovalQueue({ rows }: { rows: PendingRow[] }) {
  const { t } = useI18n(); const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); const [done, setDone] = useState<Set<string>>(new Set()); const [err, setErr] = useState<string | null>(null);
  async function publish(versionId: string): Promise<boolean> {
    const r = await fetch(`/api/front/versions/${versionId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.status === 429) { setErr(t("front.owner.rateLimited")); return false; }
    if (!r.ok) { setErr(t("front.owner.failed", { m: j.error ?? r.statusText })); return false; }
    setDone((s) => new Set(s).add(versionId)); return true;
  }
  async function one(id: string) { setBusy(id); setErr(null); try { await publish(id); } catch { setErr(t("common.networkError")); } setBusy(null); router.refresh(); }
  async function all() { setBusy("all"); setErr(null); try { for (const r of rows) if (!done.has(r.versionId) && !(await publish(r.versionId))) break; } catch { setErr(t("common.networkError")); } setBusy(null); router.refresh(); }
  const pending = rows.filter((r) => !done.has(r.versionId));
  return (
    <div data-testid="approval-queue" className="grid gap-2">
      {rows.length ? (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.versionId} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0"><div className="truncate text-[14px] font-bold">{r.storeName}</div><div className="text-[12px] text-ink-2">{r.city} · v{r.versionNo} · {t("front.fleet.movesShort", { n: r.moves })}</div></div>
              {done.has(r.versionId) ? <Chip tone="good">{t("front.fleet.approved")}</Chip> : <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => one(r.versionId)}>{busy === r.versionId ? t("front.fleet.approving") : t("front.fleet.approve")}</Button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-ink-2">{t("front.fleet.queueEmpty")}</p>}
      <div className="flex items-center gap-3">
        <Button variant="coral" disabled={busy !== null || pending.length === 0} title={pending.length ? undefined : t("front.fleet.queueEmpty")} onClick={all}>{busy === "all" ? t("front.fleet.approving") : `${t("front.fleet.approveAll")} (${pending.length})`}</Button>
        {err ? <span role="alert" className="text-[12.5px] font-semibold text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
