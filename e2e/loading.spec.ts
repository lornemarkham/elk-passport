import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * **Every wait says so, at once** (P1 loading brief, 2026-11-17).
 *
 * Production, measured that morning: picking Kelowna on Christmas left the
 * bar saying "Vernon" for 1.4–8 s with nothing moving, and a place page took
 * 9–11 s to its first byte. These hold the answer in place: the page's own
 * requests are slowed here (the browser's, so this needs no Atlas of its
 * own), and the feedback must arrive well before the results do.
 *
 * Runs against any Atlas — the mock or none — because it asserts the waiting,
 * not what is waited for.
 */
const SLOW_MS = 2_500;

async function slow(route: Route) {
  await new Promise((r) => setTimeout(r, SLOW_MS));
  await route.continue().catch(() => {});
}

async function pickTown(page: Page, id: string) {
  await page.getByTestId("location-change").first().click();
  await page.getByTestId("location-search").fill(id);
  await page.getByTestId(`location-option-${id}`).click();
}

test("Christmas: a new town is named and said to be loading the moment it is picked", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon");
  await expect(page.getByTestId("location-name").first()).toHaveText(/Vernon/);
  await page.route(/\/christmas\?.*at=kelowna/, slow);

  await pickTown(page, "kelowna");
  // Long before the slowed answer can have arrived:
  await expect(page.getByTestId("location-name").first()).toHaveText(
    /Kelowna/,
    { timeout: 1_000 },
  );
  await expect(page.getByTestId("location-loading").first()).toHaveText(
    "Loading…",
    { timeout: 1_000 },
  );
  await expect(page.getByTestId("nav-progress")).toBeVisible({
    timeout: 1_000,
  });
  // The old results stay, dimmed and marked busy — never a blank page.
  const content = page.getByTestId("pending-content");
  await expect(content).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: /Christmas around Vernon/ }),
  ).toBeVisible();

  // Then the answer for Kelowna replaces them, and the waiting stops.
  await expect(
    page.getByRole("heading", { level: 2, name: /Christmas around Kelowna/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(content).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("location-loading").first()).toHaveText("");
  await expect(page.getByTestId("nav-progress")).toHaveCount(0, {
    timeout: 2_000,
  });
  expect(page.url()).toContain("at=kelowna");

  // And back again.
  await page.route(/\/christmas\?.*at=vernon/, slow);
  await pickTown(page, "vernon");
  await expect(page.getByTestId("location-name").first()).toHaveText(/Vernon/, {
    timeout: 1_000,
  });
  await expect(
    page.getByRole("heading", { level: 2, name: /Christmas around Vernon/ }),
  ).toBeVisible({ timeout: 30_000 });
});

test("Christmas: making a plan says so on the button, without a full page reload", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon");
  await page.evaluate(() => {
    (window as unknown as { __same: boolean }).__same = true;
  });
  await page.route(/\/christmas\/itinerary/, slow);
  await page.getByTestId("plan-input").fill("Lights and hot chocolate");
  await page.getByTestId("plan-go").click();
  await expect(page.getByTestId("plan-go")).toHaveText(/Making your plan/, {
    timeout: 1_000,
  });
  await expect(page.getByTestId("nav-progress")).toBeVisible({
    timeout: 1_000,
  });
  await page.waitForURL(/\/christmas\/itinerary\?/, { timeout: 30_000 });
  // The same document: a soft navigation, not a reload.
  expect(
    await page.evaluate(
      () => (window as unknown as { __same?: boolean }).__same,
    ),
  ).toBe(true);
});

test("Discovery: a failed distance reading says so and offers to try again", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/discovery/distance", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/discovery?at=vernon");
  await expect(page.getByTestId("measuring-failed")).toBeVisible({
    timeout: 30_000,
  });
  fail = false;
  await page.getByTestId("measuring-retry").click();
  await expect(page.getByTestId("measuring-failed")).toHaveCount(0, {
    timeout: 30_000,
  });
});

test("Discovery: changing town is answered on the bar at once", async ({
  page,
}) => {
  await page.goto("/discovery?at=vernon");
  await expect(page.getByTestId("location-change").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.route("**/api/discovery/distance", slow);
  await pickTown(page, "kelowna");
  await expect(page.getByTestId("location-name").first()).toHaveText(
    /Kelowna/,
    { timeout: 1_000 },
  );
  await expect(page.getByTestId("location-loading").first()).toHaveText(
    /Finding what.s close/,
    { timeout: 1_000 },
  );
  await expect(page.getByTestId("location-loading").first()).toHaveText("", {
    timeout: 30_000,
  });
});

test("a place page shows its shape at once while Atlas answers", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon");
  const link = page.locator('main a[href^="/places/"]').first();
  test.skip(
    (await link.count()) === 0,
    "no Atlas corpus here, so no place to open",
  );
  await link.scrollIntoViewIfNeeded();
  // Let the router fetch what it prefetches for a link in view first.
  await page.waitForLoadState("networkidle");
  await page.route(/\/places\/[^?]+\?.*_rsc=|\/places\/[^/?]+$/, slow);
  await link.click();
  await expect(
    page.getByTestId("subject-loading").or(page.getByTestId("nav-progress")),
  ).toBeVisible({ timeout: 1_000 });
});

test("the line respects reduced motion: it is drawn still", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/christmas?at=vernon");
  await page.route(/\/christmas\?.*at=kelowna/, slow);
  await pickTown(page, "kelowna");
  const line = page.getByTestId("nav-progress").locator("div");
  await expect(line).toBeVisible({ timeout: 1_000 });
  expect(await line.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "none",
  );
  await context.close();
});
