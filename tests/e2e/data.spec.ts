import { test, expect } from "@playwright/test";

const DEMO = "/r/00000000-0000-4000-8000-000000000101";

/** Upload a synthetic Spanish spreadsheet → rules map it → personal data dropped → import → the Brain logs it → remove it again. */
test("sales data upload: map, drop personal data, import, brain, remove", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "writes data; runs once from the desktop project");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${DEMO}/data`);
  await expect(page.getByRole("heading", { name: "Sales data", exact: true })).toBeVisible();
  await page.getByTestId("sample-ventas-muestra.xlsx").click();
  const card = page.getByTestId("file-card").first();
  await expect(card.getByTestId("mapping-table")).toBeVisible({ timeout: 20_000 });
  await expect(card.getByLabel("Teléfono del cliente")).toHaveValue("pii");
  await expect(card.getByLabel("Fecha")).toHaveValue("ordered_date");
  await expect(card.getByTestId("preview-table")).toContainText("Pickup");
  await card.getByRole("button", { name: "Import", exact: true }).click();
  await expect(card.getByTestId("import-done")).toContainText("117 rows imported", { timeout: 30_000 });
  await expect(page.getByTestId("sales-kpis")).toBeVisible();
  await expect(page.getByTestId("brain-panel")).toContainText("ventas-muestra.xlsx");
  // clean up so the run is repeatable
  const row = page.getByTestId("uploads-list").locator("li", { hasText: "ventas-muestra.xlsx" });
  await row.getByRole("button", { name: "Remove" }).click();
  await row.getByRole("button", { name: "Remove rows" }).click();
  await expect(page.getByTestId("uploads-list")).not.toContainText("ventas-muestra.xlsx", { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("sales data page renders on phones without overflow", async ({ page }) => {
  await page.goto(`${DEMO}/data`);
  await expect(page.getByTestId("dropzone")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
