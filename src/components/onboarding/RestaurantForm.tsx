"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { SERVICE_FORMATS } from "@/lib/validation/schemas";

const SAMPLE_MENU = `Beef Noodle Soup | noodles | 18.5 | 6.4
Dan Dan Noodles | noodles | 15 | 4.1
Scallion Pancake | small_plates | 8 | 1.9
Vegetarian Mapo Tofu | mains | 15.5 | 3.9
Boba Milk Tea | drinks | 6.5 | 1.4`;

export function RestaurantForm() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [err, setErr] = useState("");
  const [formats, setFormats] = useState<string[]>(["dine_in", "takeout"]);
  const [more, setMore] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("saving"); setErr("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    body.serviceFormats = formats;
    body.useSampleData = fd.get("useSampleData") === "on";
    for (const k of ["priceLevel", "avgTicket", "foodCostPct", "laborCostPerHour", "deliveryCommissionPct"]) if (body[k] === "") delete body[k];
    const res = await fetch("/api/restaurants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("error"); setErr(j.issues ? j.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") : j.error ?? "Failed"); return; }
    router.push(`/r/${j.restaurantId}`);
  }
  const input = "mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-base";
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Restaurant name<input name="name" required maxLength={120} className={input} placeholder="Golden Gate Noodle House" /></label>
        <label className="text-sm font-medium">Cuisine<input name="cuisine" required maxLength={80} className={input} placeholder="Taiwanese / Chinese noodles" /></label>
        <label className="text-sm font-medium">Neighborhood<input name="neighborhood" maxLength={80} className={input} placeholder="Inner Sunset" /></label>
        <label className="text-sm font-medium">City<input name="city" defaultValue="San Francisco" maxLength={80} className={input} /></label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Service formats</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {SERVICE_FORMATS.map((f) => (
            <label key={f} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${formats.includes(f) ? "border-accent bg-accent-soft text-accent-ink" : "border-border"}`}>
              <input type="checkbox" className="sr-only" checked={formats.includes(f)} onChange={() => setFormats((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]))} />{f.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Objective<input name="objective" maxLength={300} className={input} placeholder="grow weekday lunch without adding staff" /></label>
        <label className="text-sm font-medium">Constraints (comma separated)<input name="constraints" maxLength={500} className={input} placeholder="no liquor license, 2 cooks on weekdays" /></label>
      </div>
      <label className="text-sm font-medium">Menu items (one per line: name | category | price | food cost)
        <textarea name="menuText" rows={6} maxLength={4000} className="mt-1 w-full rounded-lg border border-border bg-surface p-3 font-mono text-sm" placeholder={SAMPLE_MENU} />
      </label>
      <button type="button" onClick={() => setMore((m) => !m)} className="text-left text-sm text-accent-ink underline">{more ? "Hide" : "Show"} cost assumptions, hours, price level, POS</button>
      {more ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Average ticket ($)<input name="avgTicket" type="number" step="0.5" min="1" defaultValue={24} className={input} /></label>
          <label className="text-sm font-medium">Food cost % (0–1)<input name="foodCostPct" type="number" step="0.01" min="0.05" max="0.8" defaultValue={0.32} className={input} /></label>
          <label className="text-sm font-medium">Labor $/hour<input name="laborCostPerHour" type="number" step="1" min="5" defaultValue={22} className={input} /></label>
          <label className="text-sm font-medium">Delivery commission (0–1)<input name="deliveryCommissionPct" type="number" step="0.01" min="0" max="0.5" defaultValue={0.25} className={input} /></label>
          <label className="text-sm font-medium">Hours summary<input name="hoursSummary" maxLength={160} className={input} placeholder="Tue–Sun 11:00–21:00" /></label>
          <label className="text-sm font-medium">Price level (1–4)<input name="priceLevel" type="number" min="1" max="4" className={input} /></label>
          <label className="text-sm font-medium">Menu URL<input name="menuUrl" type="url" className={input} placeholder="https://" /></label>
          <label className="text-sm font-medium">POS (optional, not connected)<input name="posPreference" maxLength={40} className={input} placeholder="Toast, Square, Clover…" /></label>
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="useSampleData" /> Use the labeled sample dataset even if live Qloo is configured</label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving" || formats.length === 0}>{state === "saving" ? "Saving…" : "Create workspace"}</Button>
        {err ? <span className="text-sm text-bad" role="alert">{err}</span> : null}
      </div>
    </form>
  );
}
