import { test, expect, devices } from "@playwright/test";

const DEMO = "/r/00000000-0000-4000-8000-000000000101";

/**
 * The showpiece: owner approves a TastePass on desktop, a guest claims it on a phone,
 * the owner redeems the code at the counter, and the proof counters move without a reload.
 */
test("approve → claim on phone → redeem once → counters update live", async ({ page, browser, browserName }, info) => {
  test.skip(info.project.name !== "desktop", "cross-device flow runs once, from the desktop project");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${DEMO}/opportunities`);
  const href = await page.locator(`a[href*="/opportunities/"]`).first().getAttribute("href");
  const hid = href!.split("/").pop()!;

  // a previous run may have left a live pass for this idea: end it so we exercise the form
  await page.goto(`${DEMO}/passes/new?h=${hid}`);
  if (/\/passes\/[0-9a-f-]{36}$/.test(page.url())) {
    await page.getByRole("button", { name: "End TastePass" }).click();
    await expect(page.getByText("Ended", { exact: true }).first()).toBeVisible();
    await page.goto(`${DEMO}/passes/new?h=${hid}`);
  }
  await expect(page.getByRole("heading", { name: "Activate a TastePass" })).toBeVisible();

  // deterministic NO-GO: price below food cost blocks approval
  const price = page.getByTestId("offer-price");
  const original = await price.inputValue();
  await price.fill("1");
  await expect(page.getByText("NO-GO", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve TastePass" })).toBeDisabled();
  await price.fill(original);
  await expect(page.getByText(/^GO/).first()).toBeVisible();
  await page.getByRole("button", { name: "Approve TastePass" }).click();
  await expect(page).toHaveURL(/\/passes\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.getByTestId("stat-claims")).toHaveText("0");
  const publicUrl = await page.getByTestId("public-link").textContent();
  const slugPath = new URL(publicUrl!).pathname;

  // guest on a phone
  const phone = await browser.newContext({ ...devices["Pixel 7"] });
  const guest = await phone.newPage();
  await guest.goto(slugPath);
  await expect(guest.getByText("Demo offer from a fictional restaurant", { exact: false })).toBeVisible();
  await expect(guest.getByRole("button", { name: "Claim my pass" })).toBeDisabled();
  await guest.getByTestId("consent").check();
  await guest.getByRole("button", { name: "Claim my pass" }).click();
  const token = (await guest.getByTestId("pass-token").textContent())!.replace(/[^A-Z0-9]/g, "");
  expect(token).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  const overflow = await guest.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await phone.close();

  // owner's dashboard picks it up by polling, no reload
  await expect(page.getByTestId("stat-claims")).toHaveText("1", { timeout: 10_000 });

  // redeem once
  await page.getByTestId("redeem-token").fill(token.toLowerCase());
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(page.getByTestId("redeem-result")).toContainText("Redeemed. Counted once.");
  await expect(page.getByTestId("stat-redeemed")).toHaveText("1", { timeout: 10_000 });

  // second redemption of the same code is refused and not counted
  await page.getByTestId("redeem-token").fill(token);
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(page.getByTestId("redeem-result")).toContainText("Already redeemed");
  await page.getByTestId("redeem-token").fill("ZZZZ2222");
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(page.getByTestId("redeem-result")).toContainText("No pass with this code");
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("stat-redeemed")).toHaveText("1");

  // memory keeps the chain
  await page.goto(`${DEMO}/memory`);
  await expect(page.getByText(/Approved TastePass/).first()).toBeVisible();
  await expect(page.getByText(/Redeemed pass/).first()).toBeVisible();
  expect(errors).toEqual([]);
  void browserName;
});

test("cultural anchor resolves through Qloo and offers a fan pass", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one live Qloo lookup per run is enough");
  test.setTimeout(90_000);
  await page.goto(`${DEMO}/taste`);
  await page.getByRole("button", { name: "Mitski" }).click();
  const result = page.getByTestId("anchor-result");
  await expect(result).toBeVisible({ timeout: 45_000 });
  await expect(result.getByText(/Where .* fans eat in/)).toBeVisible();
  await expect(result.getByText("Overlap in taste, not foot traffic", { exact: false })).toBeVisible();
  await result.getByRole("link", { name: /Make a pass for/ }).click();
  await expect(page.getByRole("heading", { name: "Activate a TastePass" })).toBeVisible();
  await expect(page.locator("input").first()).toHaveValue(/fans/);
  // the anchor's own Qloo evidence (not the original idea's) is what the pass will be created from
  const basis = page.getByTestId("decision-basis");
  await expect(basis).toContainText("Cultural anchor");
  await expect(basis).toContainText(/Where .* fans eat nearby/);
  await expect(basis).toContainText("Considered, not chosen");
});

test("worst-case loss counts the fixed spend when nobody redeems", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "form math runs once");
  await page.goto(`${DEMO}/opportunities`);
  const href = await page.locator(`a[href*="/opportunities/"]`).first().getAttribute("href");
  await page.goto(`${DEMO}/passes/new?h=${href!.split("/").pop()}&anchor=x&aid=invalid`);
  const fixed = page.getByLabel(/Fixed test spend/);
  await fixed.fill("100");
  await expect(page.getByTestId("exposure")).toHaveText("$100");
});
