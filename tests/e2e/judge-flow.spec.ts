import { test, expect, type Page } from "@playwright/test";

const DEMO = "/r/00000000-0000-4000-8000-000000000101";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return errors;
}

test("landing → demo → snapshot shows data-mode pill and trust drawer", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("storefront tuned");
  await page.getByRole("link", { name: /Try the live demo/ }).click();
  await expect(page).toHaveURL(new RegExp(DEMO));
  await expect(page.getByText("Synthetic demo")).toBeVisible();
  const pill = page.getByRole("button", { name: /(Sample data|Live Qloo) · \d+ sources/ });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(page.getByRole("dialog", { name: "Trust & data" })).toBeVisible();
  await expect(page.getByText("Affinity is Qloo", { exact: false })).toBeVisible();
  expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
});

test("taste signals show provenance and with/without Qloo toggle", async ({ page }) => {
  await page.goto(`${DEMO}/taste`);
  await expect(page.getByRole("heading", { name: "What this audience looks for" })).toBeVisible();
  await page.locator("details summary").first().click();
  await expect(page.getByText(/filter\.type=/).first()).toBeVisible();
  const withBtn = page.getByRole("button", { name: "With Qloo" });
  const withoutBtn = page.getByRole("button", { name: "Without Qloo" });
  await expect(withBtn).toHaveAttribute("aria-pressed", "true");
  await withoutBtn.scrollIntoViewIfNeeded();
  await withoutBtn.click({ timeout: 15000 });
  await expect(withoutBtn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("only the Qloo inputs are removed", { exact: false })).toBeVisible();
  await withBtn.click();
  await expect(page.getByText(/Changed by:/).first()).toBeVisible();
});

test("opportunities: 3 cards, sheet with Why/Numbers/Plan, screened-out reasons", async ({ page }) => {
  await page.goto(`${DEMO}/opportunities`);
  await expect(page.getByRole("heading", { name: /3 ideas worth testing/ })).toBeVisible();
  await page.getByRole("button", { name: "See why" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Why this one?" })).toBeVisible();
  await expect(dialog.getByText("Without Qloo")).toBeVisible();
  await dialog.getByRole("tab", { name: "Numbers" }).click();
  await expect(dialog.getByText("Adjusted profit / wk")).toBeVisible();
  await dialog.getByRole("tab", { name: "Plan" }).click();
  await expect(dialog.getByText("Marketing")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Show reasons" }).click();
  await expect(page.getByText("Not recommended").first()).toBeVisible();
  await expect(page.getByText(/liquor/).first()).toBeVisible();
});

test("decision lab recomputes when inputs change", async ({ page }) => {
  await page.goto(`${DEMO}/opportunities`);
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByRole("heading", { name: "Decision Lab" })).toBeVisible();
  const units = page.getByLabel("Units / week").first();
  const profit = page.getByText("Adjusted profit / wk").first().locator("..").locator("div").nth(1);
  const before = await profit.textContent();
  await units.fill("0");
  await expect(profit).not.toHaveText(before ?? "");
  expect((await profit.textContent())?.startsWith("-")).toBeTruthy();
  await units.fill("300");
  await expect(profit).not.toHaveText(before ?? "");
  await expect(page.getByRole("heading", { name: "Why this one?" })).toBeVisible();
});

test("action board shows approval-gated external task", async ({ page }) => {
  await page.goto(`${DEMO}/actions`);
  await expect(page.getByRole("heading", { name: "Action board" })).toBeVisible();
  await expect(page.getByText("external · approval").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs approval" })).toBeVisible();
});

test("business memory lists the analysis event", async ({ page }) => {
  await page.goto(`${DEMO}/memory`);
  await expect(page.getByRole("heading", { name: "Memory" })).toBeVisible();
  await expect(page.getByText(/Analysis done in (sample|live) mode/).first()).toBeVisible();
});

test("language switch renders Chinese and Spanish", async ({ page }) => {
  await page.goto(`${DEMO}/opportunities`);
  await page.getByRole("button", { name: "中文" }).first().click();
  await expect(page.getByRole("heading", { name: /个值得测试的点子/ })).toBeVisible();
  await expect(page.getByText("植物系小菜单").first()).toBeVisible();
  await page.getByRole("button", { name: "ES" }).first().click();
  await expect(page.getByRole("heading", { name: /ideas que vale la pena probar/ })).toBeVisible();
  await page.getByRole("button", { name: "EN" }).first().click();
  await expect(page.getByRole("heading", { name: /ideas worth testing/ })).toBeVisible();
});

test("protected area redirects to login; health is honest about mode", async ({ page, request }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  const j = await (await request.get("/api/health")).json();
  expect(j.ok).toBe(true);
  expect(["live", "sample"]).toContain(j.qloo);
});

test("no horizontal overflow on workspace pages", async ({ page }) => {
  for (const path of [DEMO, `${DEMO}/taste`, `${DEMO}/opportunities`, `${DEMO}/passes`, `${DEMO}/actions`, `${DEMO}/memory`]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), path).toBe(false);
    const off = await page.evaluate(() => Array.from(document.querySelectorAll("button, a")).filter((el) => { if (el.closest(".scroll-x")) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; }).map((el) => el.textContent?.trim().slice(0, 30)));
    expect(off, path).toEqual([]);
  }
});
