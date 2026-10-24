/** Desktop + mobile screenshots per locale. Usage: bun scripts/screenshots.ts [baseURL] */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000";
const DEMO = "/r/00000000-0000-4000-8000-000000000101";
const out = "docs/evidence/screenshots"; mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const locale of ["en", "zh", "es"]) {
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile-390", { width: 390, height: 844 }]] as const) {
    if (locale !== "en" && name === "desktop") continue;
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: "riq_locale", value: locale, url: base }]);
    const page = await ctx.newPage();
    const pages: Array<[string, string]> = locale === "en" ? [["landing", "/"], ["snapshot", DEMO], ["taste", `${DEMO}/taste`], ["opportunities", `${DEMO}/opportunities`], ["actions", `${DEMO}/actions`], ["memory", `${DEMO}/memory`], ["login", "/login"]] : [["landing", "/"], ["opportunities", `${DEMO}/opportunities`]];
    for (const [slug, path] of pages) { await page.goto(base + path, { waitUntil: "networkidle" }); await page.screenshot({ path: `${out}/${slug}-${locale}-${name}.png`, fullPage: true }); }
    await page.goto(base + `${DEMO}/opportunities`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /See why|看原因|Ver por qué/ }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/sheet-${locale}-${name}.png`, fullPage: false });
    if (locale === "en") { const href = await page.getByRole("link", { name: /^Open$/ }).first().getAttribute("href"); await page.goto(base + href, { waitUntil: "networkidle" }); await page.screenshot({ path: `${out}/workspace-${locale}-${name}.png`, fullPage: true }); }
    await ctx.close();
  }
}
await browser.close(); console.log(`screenshots written to ${out}`);
