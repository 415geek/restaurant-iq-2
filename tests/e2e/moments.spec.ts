import { test, expect } from "@playwright/test";

const DEMO = "/r/00000000-0000-4000-8000-000000000101";

/** Moments: calendar + local events → Qloo crowd fit → a pass timed to that day. */
test("moments calendar → who it draws → timed pass form", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${DEMO}/moments`);
  await expect(page.getByRole("heading", { name: "Moments", exact: true })).toBeVisible();
  await expect(page.getByTestId("moments-calendar")).toBeVisible();
  await expect(page.getByTestId("moments-sources")).toContainText("DataSF");
  const rows = page.getByTestId("moment-row");
  await expect(rows.first()).toBeVisible();
  // no horizontal overflow on phones
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (info.project.name !== "desktop") return;

  // owner-added event → live Qloo crowd fit
  await page.getByTestId("manual-name").fill("Sample school fair");
  await page.getByTestId("manual-theme").selectOption("kids");
  await page.getByRole("button", { name: "Add and check" }).click();
  const panel = page.getByTestId("fit-panel").first();
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByTestId("fit-level")).toHaveText(/overlap|Different crowd/);
  await expect(panel).toContainText("not a forecast");

  // plan a pass for it: the form is pre-timed to that date
  await panel.getByRole("link", { name: /Plan a pass for/ }).click();
  await expect(page.getByTestId("pass-moment")).toContainText("Sample school fair");
  expect(errors).toEqual([]);
});
