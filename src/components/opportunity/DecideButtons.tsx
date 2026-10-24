"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DecideButtons({ hypothesisId, status }: { hypothesisId: string; status: "proposed" | "pursued" | "rejected" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function decide(next: "pursued" | "rejected") {
    setBusy(true); setErr("");
    const res = await fetch(`/api/hypotheses/${hypothesisId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error ?? "Failed"); return; }
    router.refresh();
  }
  if (status !== "proposed") return <p className="text-sm text-ink-2">Decision recorded: <strong>{status}</strong>. See Business memory.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => decide("pursued")} disabled={busy}>Pursue this hypothesis</Button>
      <Button onClick={() => decide("rejected")} disabled={busy} variant="secondary">Reject</Button>
      {err ? <span className="text-sm text-bad" role="alert">{err}</span> : null}
    </div>
  );
}
