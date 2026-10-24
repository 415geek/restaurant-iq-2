/** Captures desktop + mobile screenshots of the key journeys for docs/evidence. Usage: bun scripts/screenshots.ts [baseURL] */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const DEMO = "/r/00000000-0000-4000-8000-000000000101";
const out = "docs/evidence/screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile-390", { width: 390, height: 844 }]] as const) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [slug, path] of [["landing", "/"], ["snapshot", DEMO], ["taste", `${DEMO}/taste`], ["opportunities", `${DEMO}/opportunities`], ["actions", `${DEMO}/actions`], ["memory", `${DEMO}/memory`], ["login", "/login"]]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${slug}-${name}.png`, fullPage: true });
  }
  await page.goto(base + `${DEMO}/opportunities`, { waitUntil: "networkidle" });
  const href = await page.getByRole("link", { name: "Open workspace →" }).first().getAttribute("href");
  await page.goto(base + href, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/workspace-${name}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(`screenshots written to ${out}`);
