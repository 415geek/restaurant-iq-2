"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function DecideButtons({ hypothesisId, status, onDone }: { hypothesisId: string; status: "proposed" | "pursued" | "rejected"; onDone?: () => void }) {
  const { t } = useI18n(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function decide(next: "pursued" | "rejected") {
    setBusy(true); setErr("");
    const res = await fetch(`/api/hypotheses/${hypothesisId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    const j = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setErr(j.error ?? t("common.error")); return; }
    onDone?.(); router.refresh();
  }
  if (status !== "proposed") return <p className="text-[13px] text-ink-2">{t("opps.sheet.decided", { status: t(`opps.status.${status}`) })}</p>;
  return (<div className="flex flex-wrap items-center gap-2"><Button onClick={() => decide("pursued")} disabled={busy} variant="coral">{t("opps.sheet.pursue")}</Button><Button onClick={() => decide("rejected")} disabled={busy} variant="secondary">{t("opps.sheet.reject")}</Button>{err ? <span className="text-[13px] text-bad" role="alert">{err}</span> : null}</div>);
}
