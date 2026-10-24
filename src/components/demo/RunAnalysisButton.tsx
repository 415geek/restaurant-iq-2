"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";

export function RunAnalysisButton({ restaurantId, hasRun, variant = "coral" }: { restaurantId: string; hasRun: boolean; variant?: "coral" | "secondary" | "primary" }) {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function run() {
    setState("running"); setMsg("");
    try {
      const res = await fetch("/api/analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId }) });
      const j = await res.json();
      if (!res.ok) { setState("error"); setMsg(res.status === 429 ? t("common.rateLimited", { s: j.retryAfterSeconds ?? 60 }) : `${j.error ?? t("common.error")}${j.errorClass ? ` (${j.errorClass})` : ""}`); return; }
      setState("done");
      setMsg(`${t("snapshot.runDone", { mode: j.mode === "live" ? t("mode.liveBadge") : t("mode.sampleBadge"), n: j.viableCount })}${j.evidenceFailures?.length ? ` ${t("snapshot.runFailedSteps", { n: j.evidenceFailures.length })}` : ""}`);
      router.refresh();
    } catch { setState("error"); setMsg(t("common.networkError")); }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} disabled={state === "running"} variant={hasRun ? "secondary" : variant}>
        {state === "running" ? <Icon.refresh className="animate-spin" /> : hasRun ? <Icon.refresh /> : <Icon.play />}
        {state === "running" ? t("snapshot.running") : hasRun ? t("snapshot.rerun") : t("snapshot.run")}
      </Button>
      {msg ? <p className={`text-[13px] ${state === "error" ? "text-bad" : "text-good-ink"}`} role="status">{msg}</p> : null}
    </div>
  );
}
