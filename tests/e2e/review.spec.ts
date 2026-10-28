import { test, expect } from "@playwright/test";

const DEMO = "/r/00000000-0000-4000-8000-000000000101";

/** Prove: a past pass on the demo (scripts/seed-demo-review.ts) is reviewed against the 4 weeks before it, from uploaded sales. */
test("past pass shows a POS experiment review with an honest verdict", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${DEMO}/passes`);
  await page.getByRole("link", { name: /past week/ }).first().click();
  const card = page.getByTestId("experiment-review");
  await expect(card).toBeVisible();
  await expect(card.getByText("Synthetic sample sales")).toBeVisible();
  await expect(page.getByTestId("review-orders")).toBeVisible();
  await expect(page.getByTestId("review-netSales")).toBeVisible();
  await expect(card.getByText(/prior weeks|normal range/).first()).toBeVisible();
  await expect(page.getByTestId("review-next")).toHaveText(/^Next:/);
  await expect(card.getByText(/not why/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a pass with no sales yet asks for an upload instead of guessing", async ({ page }) => {
  await page.goto(`${DEMO}/passes`);
  const live = page.locator("a[href*='/passes/']").filter({ hasNotText: /past week/ }).filter({ hasText: /Live/ });
  test.skip((await live.count()) === 0, "no active demo pass right now");
  await live.first().click();
  await expect(page.getByTestId("review-awaiting")).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload sales data" })).toHaveAttribute("href", /\/data$/);
});
