"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const PHASES = ["Intake", "Evidence (Qloo)", "Opportunities", "Finance", "Execution", "Evaluator"];

export function RunAnalysisButton({ restaurantId, hasRun, label }: { restaurantId: string; hasRun: boolean; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  async function run() {
    setState("running"); setMsg("");
    try {
      const res = await fetch("/api/analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId }) });
      const json = await res.json();
      if (!res.ok) { setState("error"); setMsg(json.error ? `${json.error}${json.errorClass ? ` (${json.errorClass})` : ""}${json.retryAfterSeconds ? ` · retry in ${json.retryAfterSeconds}s` : ""}` : "Analysis failed"); return; }
      setState("done");
      setMsg(`${json.mode === "live" ? "Live Qloo" : "Sample"} analysis complete: ${json.viableCount} viable hypothes${json.viableCount === 1 ? "is" : "es"}${json.evidenceFailures?.length ? `, ${json.evidenceFailures.length} evidence step(s) failed` : ""}.`);
      router.refresh();
    } catch { setState("error"); setMsg("Network error"); }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} disabled={state === "running"} variant={hasRun ? "secondary" : "primary"}>
        {state === "running" ? "Running bounded agent workflow…" : label ?? (hasRun ? "Re-run analysis" : "Run analysis")}
      </Button>
      {state === "running" ? (
        <ol className="flex flex-wrap gap-1 text-xs text-muted" aria-live="polite">
          {PHASES.map((p) => <li key={p} className="rounded-full border border-border px-2 py-0.5">{p}</li>)}
        </ol>
      ) : null}
      {msg ? <p className={`text-sm ${state === "error" ? "text-bad" : "text-good"}`} role="status">{msg}</p> : null}
    </div>
  );
}
