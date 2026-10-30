"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cx } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { SERVICE_FORMATS } from "@/lib/validation/schemas";

const SAMPLE_MENU = `Beef Noodle Soup | noodles | 18.5 | 6.4\nScallion Pancake | small_plates | 8 | 1.9\nVegetarian Mapo Tofu | mains | 15.5 | 3.9\nBoba Milk Tea | drinks | 6.5 | 1.4`;

function L({ k, children }: { k: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return <label className="block text-[13px] font-semibold">{t(k)}{children}</label>;
}
function Step({ k }: { k: string }) { const { t } = useI18n(); return <h3 className="text-[12px] font-bold uppercase tracking-wide text-coral-ink">{t(k)}</h3>; }

/** Store setup in three short steps: the store, the menu (typed or imported from a link), optional costs. */
export function RestaurantForm() {
  const { t } = useI18n(); const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [err, setErr] = useState("");
  const [formats, setFormats] = useState<string[]>(["dine_in", "takeout"]);
  const [more, setMore] = useState(false);
  const [menuUrl, setMenuUrl] = useState("");
  const [menuText, setMenuText] = useState("");
  const [imp, setImp] = useState<{ state: "idle" | "busy" | "done" | "fail"; n?: number; e?: string }>({ state: "idle" });
  async function importMenu() {
    if (!menuUrl) return;
    setImp({ state: "busy" });
    const res = await fetch("/api/restaurants/menu-from-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: menuUrl }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.text) { setImp({ state: "fail", e: j.error ?? String(res.status) }); return; }
    setMenuText(j.text); setImp({ state: "done", n: j.n });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState("saving"); setErr("");
    const fd = new FormData(e.currentTarget); const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    body.serviceFormats = formats; body.useSampleData = fd.get("useSampleData") === "on"; body.menuText = menuText; body.menuUrl = menuUrl;
    for (const k of ["priceLevel", "avgTicket", "foodCostPct", "laborCostPerHour", "deliveryCommissionPct"]) if (body[k] === "") delete body[k];
    const res = await fetch("/api/restaurants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("error"); setErr(j.issues ? j.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") : j.error ?? t("common.error")); return; }
    router.push(`/r/${j.restaurantId}`);
  }
  const input = "mt-1 h-12 w-full rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-base";
  return (
    <form onSubmit={submit} className="grid gap-6">
      <section className="grid gap-4">
        <Step k="onboarding.stepStore" />
        <div className="grid gap-4 sm:grid-cols-2">
          <L k="onboarding.name"><input name="name" required maxLength={120} className={input} /></L>
          <L k="onboarding.cuisine"><input name="cuisine" required maxLength={80} className={input} /></L>
          <L k="onboarding.neighborhood"><input name="neighborhood" maxLength={80} className={input} /></L>
          <L k="onboarding.city"><input name="city" defaultValue="San Francisco" maxLength={80} className={input} /></L>
        </div>
        <fieldset><legend className="text-[13px] font-semibold">{t("onboarding.formats")}</legend><div className="mt-2 flex flex-wrap gap-2">{SERVICE_FORMATS.map((f) => (<label key={f} className={cx("cursor-pointer rounded-full border px-3.5 py-2 text-[13.5px] font-semibold", formats.includes(f) ? "border-coral bg-coral-soft text-coral-ink" : "border-border")}><input type="checkbox" className="sr-only" checked={formats.includes(f)} onChange={() => setFormats((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]))} />{t(`onboarding.formatLabel.${f}`)}</label>))}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><L k="onboarding.objective"><input name="objective" maxLength={300} className={input} /></L><L k="onboarding.constraints"><input name="constraints" maxLength={500} className={input} /></L></div>
      </section>
      <section className="grid gap-3">
        <Step k="onboarding.stepMenu" />
        <p className="-mt-1 text-[13px] text-ink-2">{t("onboarding.menuHelp")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1 text-[13px] font-semibold">{t("onboarding.menuUrl")}<input type="url" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} placeholder="https://" className={input} /></label>
          <Button type="button" variant="secondary" onClick={importMenu} disabled={!menuUrl || imp.state === "busy"}>{imp.state === "busy" ? t("onboarding.importing") : t("onboarding.importUrl")}</Button>
        </div>
        {imp.state === "done" ? <p className="text-[13px] font-semibold text-good-ink" role="status">{t("onboarding.importDone", { n: imp.n ?? 0 })}</p> : null}
        {imp.state === "fail" ? <p className="text-[13px] text-bad" role="alert">{t("onboarding.importFail", { e: imp.e ?? "" })}</p> : null}
        <L k="onboarding.menu"><textarea value={menuText} onChange={(e) => setMenuText(e.target.value)} rows={6} maxLength={4000} className="mt-1 w-full rounded-[var(--radius-ctl)] border border-border bg-surface p-3 font-mono text-[13px]" placeholder={SAMPLE_MENU} /></L>
        <p className="text-[12px] text-muted">{t("onboarding.photoHint")}</p>
      </section>
      <section className="grid gap-3">
        <Step k="onboarding.stepCosts" />
        <button type="button" onClick={() => setMore((m) => !m)} className="text-left text-[13px] font-semibold text-pos">{more ? "−" : "+"} {t("onboarding.moreFields")}</button>
        {more ? (<div className="grid gap-4 sm:grid-cols-2">
          <L k="onboarding.avgTicket"><input name="avgTicket" type="number" step="0.5" min="1" defaultValue={24} className={input} /></L>
          <L k="onboarding.foodCostPct"><input name="foodCostPct" type="number" step="0.01" min="0.05" max="0.8" defaultValue={0.32} className={input} /></L>
          <L k="onboarding.labor"><input name="laborCostPerHour" type="number" step="1" min="5" defaultValue={22} className={input} /></L>
          <L k="onboarding.commission"><input name="deliveryCommissionPct" type="number" step="0.01" min="0" max="0.5" defaultValue={0.25} className={input} /></L>
          <L k="onboarding.hours"><input name="hoursSummary" maxLength={160} className={input} /></L>
          <L k="onboarding.priceLevel"><input name="priceLevel" type="number" min="1" max="4" className={input} /></L>
          <L k="onboarding.pos"><input name="posPreference" maxLength={40} className={input} /></L>
        </div>) : null}
      </section>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="useSampleData" /> {t("onboarding.useSample")}</label>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="coral" disabled={state === "saving" || formats.length === 0}>{state === "saving" ? t("common.saving") : t("onboarding.submit")}</Button>{err ? <span className="text-[13px] text-bad" role="alert">{err}</span> : null}</div>
    </form>
  );
}
