"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function EndButton({ campaignId }: { campaignId: string }) {
  const { t } = useI18n(); const router = useRouter(); const [busy, setBusy] = useState(false);
  return <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); await fetch(`/api/campaigns/${campaignId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end" }) }); setBusy(false); router.refresh(); }}>{t("pass.end")}</Button>;
}
