"use client";
import { useState } from "react";
import { Button } from "@/components/ui";

const REASONS: Record<string, string> = {
  wrong_passcode: "That passcode is not right.",
  expired: "This link expired. Start again from the Ring app.",
  no_pending_link: "We could not find this Ring authorization. Start again from the Ring app.",
  ring_error: "Ring did not accept the confirmation. Start again from the Ring app.",
  rate_limited: "Too many attempts. Wait 10 minutes and try again.",
};

export function RingLinkForm({ nonce, time }: { nonce: string; time: string }) {
  const [passcode, setPasscode] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy"); setErr("");
    try {
      const r = await fetch("/api/ring/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nonce, time, passcode }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (j.ok) { setState("done"); return; }
      setErr(REASONS[j.reason ?? ""] ?? "Something went wrong. Start again from the Ring app."); setState("idle");
    } catch { setErr("Network error. Try again."); setState("idle"); }
  }
  if (state === "done") return <p className="rounded-xl bg-good-soft px-3 py-3 text-[14px] font-semibold text-good-ink" role="status" data-testid="ring-linked">Connected. You can return to the Ring app. Person events will appear on your TastePass result pages.</p>;
  return (
    <form onSubmit={submit} className="card grid gap-3 p-4">
      <label className="grid gap-1 text-[13px] font-semibold">Restaurant IQ link passcode
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)} type="password" autoComplete="off" required maxLength={100} className="h-11 rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-[15px] font-normal" />
      </label>
      {err ? <p className="text-[13px] font-semibold text-bad" role="alert">{err}</p> : null}
      <Button type="submit" disabled={state === "busy" || !passcode}>{state === "busy" ? "Connecting…" : "Connect"}</Button>
      <p className="text-[12px] text-muted">You can disconnect any time by removing Restaurant IQ in the Ring app.</p>
    </form>
  );
}
