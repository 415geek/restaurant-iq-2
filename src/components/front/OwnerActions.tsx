"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { HoldButton } from "@/components/ui/HoldButton";
import { useI18n } from "@/i18n/client";

/**
 * Approve (press-and-hold → publish the draft Qloo version) and Roll back (the published one).
 * Both buttons are disabled with a visible reason when there is nothing to act on.
 */
export function OwnerActions({ draft, published }: { draft: { id: string; versionNo: number } | null; published: { id: string; versionNo: number } | null }) {
  const { t } = useI18n(); const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "rollback" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function act(id: string, action: "publish" | "rollback") {
    setBusy(action); setMsg(null);
    try {
      const r = await fetch(`/api/front/versions/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; version?: { versionNo: number } };
      if (r.status === 429) setMsg({ ok: false, text: t("front.owner.rateLimited") });
      else if (!r.ok || !j.ok) setMsg({ ok: false, text: t("front.owner.failed", { m: j.error ?? r.statusText }) });
      else { setMsg({ ok: true, text: action === "publish" ? t("front.owner.approveLive", { v: j.version?.versionNo ?? "" }) : t("front.owner.rolledBack") }); router.refresh(); }
    } catch { setMsg({ ok: false, text: t("common.networkError") }); }
    setBusy(null);
  }
  return (
    <div className="grid gap-3">
      <HoldButton label={t("front.owner.approve")} busyLabel={t("front.owner.approving")} busy={busy === "publish"} disabled={!draft || busy !== null}
        hint={draft ? t("front.owner.approveHint", { v: draft.versionNo }) : t("front.owner.approveNone")} onConfirm={() => draft && act(draft.id, "publish")} />
      <div className="grid gap-1">
        <span data-testid="front-rollback" className="grid"><Button variant="secondary" disabled={!published || busy !== null} title={published ? undefined : t("front.owner.rollbackNone")} onClick={() => published && act(published.id, "rollback")}>{busy === "rollback" ? t("front.owner.rollingBack") : t("front.owner.rollback")}</Button></span>
        {!published ? <span className="text-[12px] text-muted">{t("front.owner.rollbackNone")}</span> : <span className="text-[12px] text-muted">{t("front.owner.approveLive", { v: published.versionNo })}</span>}
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[13px] font-semibold text-good-ink" : "text-[13px] font-semibold text-bad"}>{msg.text}</p> : null}
    </div>
  );
}
