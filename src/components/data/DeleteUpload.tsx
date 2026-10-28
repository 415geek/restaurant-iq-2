"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

/** Two-step inline confirm (no browser dialog). */
export function DeleteUpload({ id }: { id: string }) {
  const { t } = useI18n(); const router = useRouter();
  const [armed, setArmed] = useState(false); const [busy, setBusy] = useState(false);
  async function go() { setBusy(true); await fetch(`/api/data/uploads/${id}`, { method: "DELETE" }); setBusy(false); setArmed(false); router.refresh(); }
  return armed
    ? <span className="inline-flex gap-2 text-[12px]"><button type="button" disabled={busy} onClick={go} className="font-semibold text-bad">{t("data.confirmDelete")}</button><button type="button" onClick={() => setArmed(false)} className="text-muted">{t("data.cancel")}</button></span>
    : <button type="button" onClick={() => setArmed(true)} className="text-[12px] text-muted hover:text-bad">{t("data.delete")}</button>;
}
