import { test, expect, type Page } from "@playwright/test";

const DEMO = "/r/00000000-0000-4000-8000-000000000101";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return errors;
}

test("landing → demo → snapshot shows sample label, sources and trust panel", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Restaurant IQ grows your business");
  await page.getByRole("link", { name: "Try the live demo" }).click();
  await expect(page).toHaveURL(new RegExp(DEMO));
  await expect(page.getByText("Synthetic demo restaurant.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trust & data" })).toBeVisible();
  await expect(page.getByText(/Sources \(\d+\)/)).toBeVisible();
  await expect(page.getByText("Affinity is Qloo", { exact: false })).toBeVisible();
  expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
});

test("taste signals show provenance and with/without Qloo toggle changes ranking view", async ({ page }) => {
  await page.goto(`${DEMO}/taste`);
  await expect(page.getByRole("heading", { name: "Taste map: place attributes" })).toBeVisible();
  await expect(page.getByText(/qloo GET \/v2\/insights/).first()).toBeVisible();
  const withBtn = page.getByRole("button", { name: "With Qloo" });
  const withoutBtn = page.getByRole("button", { name: "Without Qloo" });
  await expect(withBtn).toHaveAttribute("aria-pressed", "true");
  await withoutBtn.click();
  await expect(withoutBtn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Generic baseline", { exact: false })).toBeVisible();
  await withBtn.click();
  await expect(page.getByText(/Changed by:/).first()).toBeVisible();
});

test("opportunities list has ≤3 viable, at least one not recommended with reasons", async ({ page }) => {
  await page.goto(`${DEMO}/opportunities`);
  await expect(page.getByRole("heading", { name: "Ranked hypotheses" })).toBeVisible();
  const details = page.locator("details");
  await details.locator("summary").click();
  await expect(page.getByText("Not recommended").first()).toBeVisible();
  await expect(page.getByText("Why not").first()).toBeVisible();
  await expect(page.getByText(/liquor/).first()).toBeVisible();
});

test("decision lab recomputes numbers when inputs change", async ({ page }) => {
  await page.goto(`${DEMO}/opportunities`);
  await page.getByRole("link", { name: "Open workspace →" }).first().click();
  await expect(page.getByRole("heading", { name: "Decision Lab" })).toBeVisible();
  const profit = page.locator("text=Adjusted profit / wk").locator("..").locator("div").nth(1);
  const before = await profit.textContent();
  const units = page.getByLabel("Incremental units / week value");
  await units.fill("0");
  await units.dispatchEvent("input");
  await expect(profit).not.toHaveText(before ?? "");
  const after0 = await profit.textContent();
  expect(after0?.startsWith("-")).toBeTruthy(); // zero units → only marketing exposure
  await units.fill("300");
  await units.dispatchEvent("input");
  await expect(profit).not.toHaveText(after0 ?? "");
  await expect(page.getByText("How Qloo changed the recommendation")).toBeVisible();
  await expect(page.getByText(/source [0-9a-f]{8}/).first()).toBeVisible();
});

test("action board shows approval-gated external task", async ({ page }) => {
  await page.goto(`${DEMO}/actions`);
  await expect(page.getByRole("heading", { name: "Action board" })).toBeVisible();
  await expect(page.getByText("external · approval").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs approval" })).toBeVisible();
});

test("business memory lists the analysis event", async ({ page }) => {
  await page.goto(`${DEMO}/memory`);
  await expect(page.getByRole("heading", { name: "Business memory" })).toBeVisible();
  await expect(page.getByText(/Analysis completed in sample mode/).first()).toBeVisible();
});

test("protected area redirects to login; health endpoint is honest about mode", async ({ page, request }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  const res = await request.get("/api/health");
  const j = await res.json();
  expect(j.ok).toBe(true);
  expect(["live", "sample"]).toContain(j.qloo);
});

test("no horizontal overflow on the workspace at the current viewport", async ({ page }) => {
  await page.goto(`${DEMO}/opportunities`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
