"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** One-shot POST then refresh the server-rendered page. Shows the API's error text; 429 maps to the rate-limit copy. */
export function PostButton({ url, body, label, busyLabel, disabled, title, variant = "secondary", testId, className, onDone }: {
  url: string; body?: unknown; label: string; busyLabel: string; disabled?: boolean; title?: string; variant?: "primary" | "coral" | "secondary" | "ghost"; testId?: string; className?: string; onDone?: () => void;
}) {
  const { t } = useI18n(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 429) setErr(t("front.owner.rateLimited"));
      else if (!r.ok) setErr(t("front.owner.failed", { m: j.error ?? r.statusText }));
      else { onDone?.(); router.refresh(); }
    } catch { setErr(t("common.networkError")); }
    setBusy(false);
  }
  return (
    <span className="grid gap-1" data-testid={testId}>
      <Button variant={variant} disabled={disabled || busy} title={title} onClick={go} className={className}>{busy ? busyLabel : label}</Button>
      {err ? <span role="alert" className="text-[12px] font-semibold text-bad">{err}</span> : null}
    </span>
  );
}
