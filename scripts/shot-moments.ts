import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3000";
const out = process.argv[2] ?? ".";
const DEMO = `${base}/r/00000000-0000-4000-8000-000000000101`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${DEMO}/moments`);
  await p.getByTestId("moments-calendar").waitFor();
  await p.screenshot({ path: `${out}/moments-desktop.png`, fullPage: false });
  const row = p.getByTestId("moment-row").filter({ hasText: /12th Ave/i }).first();
  const target = (await row.count()) ? row : p.getByTestId("moment-row").filter({ hasText: /Farmers/i }).first();
  await target.getByRole("button", { name: "Who does it draw?" }).click();
  await p.getByTestId("fit-panel").first().waitFor({ timeout: 30000 });
  await p.getByTestId("fit-panel").first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/moments-fit.png` });
  const fm = p.getByTestId("moment-row").filter({ hasText: /Farmers Market/i }).first();
  if (await fm.count()) { await fm.getByRole("button", { name: "Who does it draw?" }).click(); await p.getByTestId("fit-panel").nth(0).waitFor(); await fm.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/moments-fit-market.png` }); }
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await m.context().addCookies([{ name: "locale", value: "zh", url: base }]);
  await m.goto(`${DEMO}/moments`);
  await m.getByTestId("moments-calendar").waitFor();
  await m.screenshot({ path: `${out}/moments-mobile-zh.png` });
  await b.close();
})();
