import { test, expect, type Page } from "@playwright/test";

/** TasteFront smoke: public menu, owner card, HQ fleet. Pages must render their landmarks without console errors. */
function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return errors;
}

test("public menu renders ≥10 items and the Qloo switch flips without a request", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/m/chuan-lane-san-bruno");
  await expect(page.getByTestId("front-menu")).toBeVisible();
  expect(await page.getByTestId("menu-item").count()).toBeGreaterThanOrEqual(10);
  const sw = page.getByTestId("qloo-switch");
  if (await sw.count()) {
    const requests: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
    await sw.click();
    await expect(page.getByTestId("front-menu")).toHaveAttribute("data-qloo", "off");
    await sw.click();
    await expect(page.getByTestId("front-menu")).toHaveAttribute("data-qloo", "on");
    expect(requests).toEqual([]);
    const badge = page.getByTestId("changed-badge").first();
    if (await badge.count()) { await badge.click(); await expect(page.getByTestId("evidence-pop")).toBeVisible(); }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("owner card shows moves, actions and the settlement", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/front");
  await expect(page.getByTestId("front-owner")).toBeVisible();
  await expect(page.getByTestId("front-moves")).toBeVisible();
  await expect(page.getByTestId("hold-confirm")).toBeVisible();
  await expect(page.getByTestId("front-rollback")).toBeVisible();
  await expect(page.getByTestId("front-run")).toBeVisible();
  await expect(page.getByTestId("settle-card")).toBeVisible();
  expect(errors).toEqual([]);
});

test("fleet view renders the map, guardrails, queue and holdout summary", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/front/fleet");
  await expect(page.getByTestId("front-fleet")).toBeVisible();
  await expect(page.getByTestId("fleet-map")).toBeVisible();
  await expect(page.getByTestId("guardrails-form")).toBeVisible();
  await expect(page.getByTestId("approval-queue")).toBeVisible();
  await expect(page.getByTestId("holdout-summary")).toBeVisible();
  expect(errors).toEqual([]);
});
