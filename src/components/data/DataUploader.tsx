"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, cx, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/client";

type Target = "ordered_at" | "ordered_date" | "ordered_time" | "order_id" | "platform" | "channel" | "item_name" | "quantity" | "gross_sales" | "discounts" | "net_sales" | "tax" | "tip" | "platform_fees" | "payout" | "refunds" | "status" | "ignore" | "pii";
const TARGETS: Target[] = ["ordered_at", "ordered_date", "ordered_time", "order_id", "item_name", "quantity", "gross_sales", "discounts", "net_sales", "tax", "tip", "platform_fees", "payout", "refunds", "status", "channel", "platform", "ignore", "pii"];
const PLATFORMS = ["square", "toast", "clover", "doordash", "ubereats", "grubhub", "other"] as const;
type Mapping = { column: string; target: Target; confidence: number; method: "memory" | "rules" | "ai" | "owner"; reason?: string };
type Rec = { platform: string; channel: string; order_id: string | null; ordered_at: string; item_name: string | null; quantity: number | null; gross_sales: number | null; net_sales: number | null; platform_fees: number | null; payout: number | null; status: string };
type Proposal = { sheet: string; headers: string[]; platform: string; mapping: Mapping[]; method: "memory" | "rules" | "ai"; gaps: string[]; stats: { rows: number; sampleImported: number; sampleRejected: number }; preview: Rec[]; ai: string; memoryUses?: number; samples: Record<string, string[]> };
type Analyze = { fileName: string; kind: "table" | "document" | "unsupported"; reason?: string; proposals?: Proposal[]; duplicate?: boolean; ai?: string; uploadId?: string; platform?: string; preview?: Rec[]; stats?: Proposal["stats"]; docKind?: string };
type Item = { key: string; file: File; status: "reading" | "ready" | "importing" | "done" | "error" | "skipped"; res?: Analyze; sheet: number; mapping?: Mapping[]; platform?: string; edited: boolean; result?: { imported: number; rejected: number; learned?: boolean }; error?: string };

const ACCEPT = ".csv,.tsv,.txt,.json,.xlsx,.xlsm,.xls,.ods,.numbers,.pdf,.png,.jpg,.jpeg,.webp";
const SAMPLES = ["square-item-sales-sample.csv", "doordash-orders-sample.csv", "ventas-muestra.xlsx"];
const MAX = 4 * 1024 * 1024;
const gapsOf = (m: Mapping[]) => { const has = (t: Target) => m.some((c) => c.target === t); const g: string[] = []; if (!has("ordered_at") && !has("ordered_date")) g.push("no_date"); if (!has("gross_sales") && !has("net_sales") && !has("payout")) g.push("no_amount"); return g; };

export function DataUploader({ restaurantId }: { restaurantId: string }) {
  const { t, locale } = useI18n(); const router = useRouter();
  const [items, setItems] = useState<Item[]>([]); const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const patch = (key: string, p: Partial<Item>) => setItems((s) => s.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function analyze(it: Item) {
    if (it.file.size > MAX) { patch(it.key, { status: "error", error: t("data.tooLarge") }); return; }
    const fd = new FormData(); fd.set("restaurantId", restaurantId); fd.set("file", it.file);
    const r = await fetch("/api/data/analyze", { method: "POST", body: fd });
    const j = (await r.json().catch(() => ({ error: "network" }))) as Analyze & { error?: string };
    if (!r.ok) { patch(it.key, { status: "error", error: j.error === "rate_limited" ? t("anchor.rateLimited") : t("data.failed", { e: j.error ?? r.status }) }); return; }
    const sheet = Math.max(0, j.proposals?.findIndex((p) => p.gaps.length === 0) ?? 0);
    const p = j.proposals?.[sheet];
    patch(it.key, { status: "ready", res: j, sheet, mapping: p?.mapping, platform: p?.platform ?? j.platform });
  }
  async function add(files: File[]) {
    const fresh = files.slice(0, 10).map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, status: "reading" as const, sheet: 0, edited: false }));
    setItems((s) => [...fresh, ...s]);
    for (const it of fresh) await analyze(it); // one file per request keeps each body under the host's limit
  }
  async function loadSample(name: string) {
    const b = await fetch(`/samples/${name}`).then((r) => r.blob());
    await add([new File([b], name, { type: b.type })]);
  }
  async function doImport(it: Item) {
    patch(it.key, { status: "importing" });
    const fd = new FormData(); fd.set("restaurantId", restaurantId);
    if (it.res?.kind === "document") fd.set("uploadId", it.res.uploadId ?? "");
    else { fd.set("file", it.file); fd.set("plan", JSON.stringify({ sheet: it.res?.proposals?.[it.sheet]?.sheet ?? "", platform: it.platform ?? "other", mapping: it.mapping, edited: it.edited })); }
    const r = await fetch("/api/data/import", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({ error: "network" }));
    if (!r.ok) { patch(it.key, { status: j.error === "duplicate" ? "skipped" : "ready", error: j.error === "duplicate" ? t("data.duplicate") : t("data.failed", { e: j.error ?? r.status }) }); return; }
    patch(it.key, { status: "done", result: { imported: j.imported, rejected: j.rejected, learned: j.learned }, error: undefined });
    router.refresh();
  }
  const ready = items.filter((x) => x.status === "ready" && (x.res?.kind === "document" ? !!x.res.uploadId : x.mapping && gapsOf(x.mapping).length === 0));

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void add([...e.dataTransfer.files]); }}
        className={cx("grid place-items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-coral bg-coral-soft" : "border-border bg-surface")}
        data-testid="dropzone"
      >
        <Icon.upload width={28} height={28} className="text-coral" />
        <div className="text-[15px] font-semibold">{t("data.dropT")}</div>
        <div className="max-w-xl text-[12.5px] text-ink-2">{t("data.dropB")}</div>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" data-testid="file-input" onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <Button variant="primary" onClick={() => input.current?.click()}>{t("data.choose")}</Button>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] text-muted">{t("data.trySamples")}:{SAMPLES.map((s) => <button key={s} type="button" onClick={() => void loadSample(s)} className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-2 hover:bg-border" data-testid={`sample-${s}`}>{s}</button>)}</div>
      </div>
      {ready.length > 1 ? <div><Button variant="coral" onClick={() => { for (const it of ready) void doImport(it); }}>{t("data.importAll", { n: ready.length })}</Button></div> : null}
      {items.map((it) => <FileCard key={it.key} it={it} locale={locale} onSheet={(i) => patch(it.key, { sheet: i, mapping: it.res?.proposals?.[i]?.mapping, platform: it.res?.proposals?.[i]?.platform, edited: false })} onMap={(col, tg) => patch(it.key, { edited: true, mapping: it.mapping?.map((m) => (m.column === col ? { ...m, target: tg, method: "owner", confidence: 1 } : m)) })} onPlatform={(p) => patch(it.key, { platform: p, edited: true })} onImport={() => void doImport(it)} onSkip={() => patch(it.key, { status: "skipped" })} />)}
    </div>
  );
}

function FileCard({ it, locale, onSheet, onMap, onPlatform, onImport, onSkip }: { it: Item; locale: string; onSheet: (i: number) => void; onMap: (c: string, t: Target) => void; onPlatform: (p: string) => void; onImport: () => void; onSkip: () => void }) {
  const { t } = useI18n();
  const r = it.res; const p = r?.proposals?.[it.sheet]; const gaps = it.mapping ? gapsOf(it.mapping) : [];
  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <Icon.file width={18} height={18} className="text-ink-2" />
      <span className="min-w-0 truncate text-[14.5px] font-semibold">{it.file.name}</span>
      <span className="text-[12px] text-muted">{(it.file.size / 1024).toFixed(0)} KB</span>
      {it.status === "reading" ? <Chip>{t("data.reading")}</Chip> : null}
      {it.status === "importing" ? <Chip>{t("data.importing")}</Chip> : null}
      {it.status === "done" ? <Chip tone="good" className="ml-auto"><span data-testid="import-done">{t("data.done", { n: it.result!.imported, r: it.result!.rejected })}</span></Chip> : null}
      {it.status === "skipped" ? <Chip className="ml-auto">{it.error ?? t("data.skipped")}</Chip> : null}
      {p ? <Chip tone={p.method === "memory" ? "good" : p.method === "ai" ? "coral" : "neutral"} className="ml-auto" title={p.method === "memory" ? t("data.memoryHint", { n: p.memoryUses ?? 1 }) : undefined}><span data-testid="map-method">{t(`data.method.${p.method}`)}</span></Chip> : null}
    </div>
  );
  if (it.status === "error") return <div className="card p-4">{head}<p role="alert" className="mt-2 text-[13px] text-bad">{it.error}</p></div>;
  if (!r || it.status === "reading") return <div className="card p-4">{head}</div>;
  if (r.kind === "unsupported") return <div className="card p-4">{head}<p className="mt-2 text-[13px] text-ink-2">{t(`data.unsupported.${r.reason ?? "unreadable"}`)}</p></div>;
  if (r.kind === "document") {
    return (
      <div className="card grid gap-3 p-4" data-testid="doc-card">{head}
        {r.ai !== "used" ? <p className="rounded-xl bg-warn-soft p-3 text-[13px] text-warn-ink">{t(`data.docAi.${r.ai === "unavailable" || r.ai === "no_key" ? "unavailable" : r.ai === "rate_limited" ? "rate_limited" : "failed"}`)}</p> : (
          <><p className="text-[13px] text-ink-2">{t("data.docRead", { n: r.stats?.sampleImported ?? 0, kind: r.docKind ?? "" })}</p><Preview rows={r.preview ?? []} locale={locale} />
            {it.status === "ready" ? <div className="flex gap-2"><Button variant="coral" onClick={onImport} disabled={!r.uploadId}>{t("data.import")}</Button><Button variant="ghost" onClick={onSkip}>{t("data.skip")}</Button></div> : null}</>
        )}
      </div>
    );
  }
  return (
    <div className="card grid gap-3 p-4" data-testid="file-card">
      {head}
      {r.duplicate ? <p className="text-[12.5px] text-warn-ink">{t("data.duplicate")}</p> : null}
      {(r.proposals?.length ?? 0) > 1 ? <div className="flex flex-wrap gap-1.5">{r.proposals!.map((x, i) => <button key={x.sheet} type="button" onClick={() => onSheet(i)} className={cx("rounded-full px-2.5 py-1 text-[12px] font-semibold", i === it.sheet ? "bg-navy text-white" : "bg-surface-2 text-ink-2")}>{x.sheet} · {x.stats.rows}</button>)}</div> : null}
      {p ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-2">
            <span>{t("data.rows", { n: p.stats.rows })}</span>
            <label className="inline-flex items-center gap-1">{t("data.platform")}<select value={it.platform} onChange={(e) => onPlatform(e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-[12.5px] text-ink">{PLATFORMS.map((x) => <option key={x} value={x}>{t(`data.platforms.${x}`)}</option>)}</select></label>
            {p.ai === "unavailable" ? <span className="text-warn-ink">{t("data.aiOff")}</span> : p.ai === "failed" ? <span className="text-warn-ink">{t("data.aiFailed")}</span> : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-[12.5px]" data-testid="mapping-table">
              <thead className="bg-surface-2 text-left text-[11.5px] uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">{t("data.colYour")}</th><th className="px-3 py-2">{t("data.colExample")}</th><th className="px-3 py-2">{t("data.colBecomes")}</th></tr></thead>
              <tbody className="divide-y divide-border">
                {it.mapping?.map((m) => (
                  <tr key={m.column} className={cx(m.target === "pii" && "bg-bad/5", m.target === "ignore" && "text-muted")}>
                    <td className="px-3 py-1.5 font-semibold">{m.column}</td>
                    <td className="max-w-[220px] truncate px-3 py-1.5 text-ink-2">{(p.samples[m.column] ?? []).join(" · ")}</td>
                    <td className="px-3 py-1.5">
                      <select aria-label={m.column} value={m.target} onChange={(e) => onMap(m.column, e.target.value as Target)} disabled={it.status !== "ready"} className={cx("h-8 rounded-lg border bg-surface px-2 text-[12.5px]", m.target === "pii" ? "border-bad/40 text-bad" : "border-border")}>
                        {TARGETS.map((x) => <option key={x} value={x}>{t(`data.targets.${x}`)}</option>)}
                      </select>
                      {m.method !== "owner" && m.target !== "ignore" ? <span className="ml-1.5 text-[11px] text-muted">{t(`data.method.${m.method}`)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {gaps.length ? <p role="alert" className="text-[13px] font-semibold text-bad">{gaps.map((g) => t(`data.gaps.${g}`)).join(" ")}</p> : <Preview rows={p.preview} locale={locale} />}
          <p className="text-[12px] text-muted">{t("data.piiNote")}</p>
          {it.status === "ready" ? <div className="flex flex-wrap gap-2"><Button variant="coral" onClick={onImport} disabled={gaps.length > 0} title={gaps.length ? t("data.gaps.fix") : undefined}>{t("data.import")}</Button><Button variant="ghost" onClick={onSkip}>{t("data.skip")}</Button></div> : null}
          {it.status === "done" && it.result?.learned ? <p className="text-[12.5px] text-good-ink">{t("data.learned")}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function Preview({ rows, locale }: { rows: Rec[]; locale: string }) {
  const { t } = useI18n();
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-muted">{t("data.previewT")}</div>
      <table className="w-full min-w-[520px] text-[12px] tabular" data-testid="preview-table">
        <thead className="text-left text-muted"><tr><th className="py-1 pr-3">{t("data.targets.ordered_at")}</th><th className="pr-3">{t("data.platform")}</th><th className="pr-3">{t("data.targets.channel")}</th><th className="pr-3">{t("data.targets.item_name")}</th><th className="pr-3 text-right">{t("data.targets.net_sales")}</th><th className="pr-3 text-right">{t("data.targets.platform_fees")}</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border"><td className="py-1 pr-3">{new Date(r.ordered_at).toLocaleString(locale, { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td className="pr-3">{t(`data.platforms.${r.platform}`)}</td><td className="pr-3">{t(`data.channels.${r.channel}`)}</td><td className="max-w-[180px] truncate pr-3">{r.item_name ?? "—"}</td><td className="pr-3 text-right">{r.net_sales === null ? "—" : fmtUsd(r.net_sales, 2)}</td><td className="pr-3 text-right">{r.platform_fees === null ? "—" : fmtUsd(r.platform_fees, 2)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
