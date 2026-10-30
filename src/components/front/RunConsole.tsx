"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Chip } from "@/components/ui";
import { useI18n } from "@/i18n/client";

type Line = { variant: string; text: string; tone?: "ok" | "bad" };
type Msg =
  | { type: "start"; variant: string; runId: string; mode: string }
  | { type: "event"; variant: string; t: number; step: string; detail: string; callId?: string }
  | { type: "done"; variant: string; versionNo: number; moves: unknown[]; caveats: string[]; mode: string; modelUsed?: string }
  | { type: "error"; variant: string; message: string };

/** Streams the agent's NDJSON log live (Qloo on, then the Qloo-off baseline). After "done" the page is refreshed so the moves re-render. */
export function RunConsole({ storeId }: { storeId: string }) {
  const { t } = useI18n(); const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]); const [busy, setBusy] = useState(false); const [mode, setMode] = useState<string | null>(null);
  const box = useRef<HTMLOListElement>(null);
  const push = (l: Line) => { setLines((xs) => [...xs, l]); requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight })); };
  function handle(m: Msg) {
    if (m.type === "start") { setMode(m.mode); push({ variant: m.variant, text: `start · ${m.mode}` }); }
    else if (m.type === "event") push({ variant: m.variant, text: `${(m.t / 1000).toFixed(1)}s ${m.step}: ${m.detail}${m.callId ? ` [${m.callId}]` : ""}` });
    else if (m.type === "done") { push({ variant: m.variant, text: t("front.owner.runDone", { v: m.versionNo, n: m.moves.length }), tone: "ok" }); for (const c of m.caveats) push({ variant: m.variant, text: c }); }
    else push({ variant: m.variant, text: t("front.owner.failed", { m: m.message }), tone: "bad" });
  }
  async function run() {
    setBusy(true); setLines([]);
    try {
      const r = await fetch(`/api/front/stores/${storeId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variant: "both" }) });
      if (r.status === 429) { const j = (await r.json().catch(() => ({}))) as { error?: string }; push({ variant: "-", text: j.error ?? t("front.owner.rateLimited"), tone: "bad" }); }
      else if (!r.ok || !r.body) { const j = (await r.json().catch(() => ({}))) as { error?: string }; push({ variant: "-", text: t("front.owner.failed", { m: j.error ?? r.statusText }), tone: "bad" }); }
      else {
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
        const feed = (s: string) => { if (!s.trim()) return; try { handle(JSON.parse(s) as Msg); } catch { push({ variant: "-", text: s }); } };
        for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const parts = buf.split("\n"); buf = parts.pop() ?? ""; parts.forEach(feed); }
        feed(buf);
        router.refresh();
      }
    } catch { push({ variant: "-", text: t("common.networkError"), tone: "bad" }); }
    setBusy(false);
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span data-testid="front-run" className="grid"><Button variant="primary" disabled={busy} onClick={run}>{busy ? t("front.owner.running") : t("front.owner.run")}</Button></span>
        {mode ? <Chip tone={mode === "live" ? "good" : "warn"}>{mode === "live" ? t("front.live") : t("mode.sampleBadge")}</Chip> : null}
      </div>
      <span className="text-[12px] text-muted">{t("front.owner.runHint")}</span>
      {lines.length ? (
        <ol ref={box} data-testid="run-log" aria-label={t("front.owner.runLog")} aria-live="polite" className="max-h-56 overflow-y-auto rounded-xl bg-navy p-3 font-mono text-[11.5px] leading-5 text-white/90">
          {lines.map((l, i) => <li key={i} className={l.tone === "ok" ? "text-good" : l.tone === "bad" ? "text-coral" : undefined}><span className="text-white/50">[{l.variant}] </span>{l.text}</li>)}
        </ol>
      ) : null}
    </div>
  );
}
