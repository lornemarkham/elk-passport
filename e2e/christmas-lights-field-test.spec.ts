import { expect, test, type Page } from "@playwright/test";

/**
 * **Lights Map field test (owner, 2026-11-22):** the owner drives round
 * Vernon photographing displays. On a phone, with synthetic displays only:
 *
 *   short map-first page → submit (no account) → private → administrator
 *   link → approve → public map → add several to the tour → directions.
 *
 * Needs the memory store and the test identity, exactly like the community
 * spec: `INSIDERS_STORE=memory INSIDERS_TEST_IDENTITY=on
 * ADMIN_EMAILS=elf@example.test`, then `E2E_LIGHTS_COMMUNITY=1`.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });
test.skip(
  process.env.E2E_LIGHTS_COMMUNITY !== "1",
  "needs the memory store and the test identity",
);

const RUN = Date.now().toString(36);
const A = `Field Test Reindeer ${RUN}`;
const B = `Field Test Snowmen ${RUN}`;
const PHOTO = "docs/product/christmas/verification/test-lights.jpg";
const SHOTS = "docs/product/christmas/screenshots";
const ids: Record<string, string> = {};

async function mapReady(page: Page) {
  await expect(page.getByTestId("lights-map").first()).toHaveAttribute(
    "data-ready",
    "1",
    { timeout: 20_000 },
  );
}

async function submit(page: Page, name: string, x: number, y: number) {
  await page.goto("/christmas/lights/pin");
  await mapReady(page);
  await page.getByTestId("lights-map").click({ position: { x, y } });
  await expect(page.getByTestId("pick-said")).toContainText("Pinned");
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("what-home").click();
  await page.getByTestId("pin-name-input").fill(name);
  await page.getByTestId("pin-about-input").fill("Synthetic test display");
  await page.getByTestId("photo-ok").check();
  await page.waitForTimeout(2600);
}

test("the map page is short, map-first, and has no administration link for a visitor", async ({
  page,
}) => {
  await page.goto("/christmas/lights");
  await mapReady(page);
  const box = await page.getByTestId("lights-map").boundingBox();
  expect(box!.height).toBeGreaterThan(844 * 0.6);
  await expect(page.getByTestId("cta-tour")).toBeVisible();
  await expect(page.getByTestId("pin-the-magic")).toBeVisible();
  await expect(page.getByTestId("admin-link")).toHaveCount(0);
  // Short: the map, one row of actions, a footer — not a feed.
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  expect(height).toBeLessThan(844 * 1.6);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${SHOTS}/field-01-map-page.png` });
  await page.screenshot({
    path: `${SHOTS}/field-01b-map-page-full.png`,
    fullPage: true,
  });
});

test("two visitors' displays are submitted with no account; a double tap makes one", async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await submit(page, A, 100, 60);
  await page.screenshot({ path: `${SHOTS}/field-02-submit-form.png` });
  // A weak signal and a double tap: two sends, one pending listing.
  await page.getByTestId("pin-submit").dblclick();
  await expect(page.getByTestId("pin-done")).toBeVisible();
  await expect(page.getByTestId("pin-done")).toContainText(
    "We check every display before it appears on the public map",
  );
  await page.screenshot({ path: `${SHOTS}/field-03-submitted.png` });
  await submit(page, B, 220, 140);
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-done")).toBeVisible();

  // Private: nowhere a stranger can look.
  const stranger = await browser.newContext();
  const text = JSON.stringify(
    await (
      await stranger.request.get(`${baseURL}/christmas/api/lights`)
    ).json(),
  );
  expect(text).not.toContain(A);
  expect(text).not.toContain(B);
  await Promise.all([ctx.close(), stranger.close()]);
});

test("the administrator finds the link on the map page, reviews, and approves", async ({
  browser,
  baseURL,
}) => {
  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await elf.addCookies([
    {
      name: "insiders-as",
      value: encodeURIComponent("elf@example.test"),
      url: baseURL!,
    },
  ]);
  const page = await elf.newPage();
  await page.goto("/christmas/lights");
  await mapReady(page);
  await expect(page.getByTestId("admin-link")).toContainText(/waiting/);
  await page.screenshot({ path: `${SHOTS}/field-04-admin-link.png` });
  await page.getByTestId("admin-link").click();
  await expect(page).toHaveURL(/\/christmas\/lights\/review/);
  for (const name of [A, B]) {
    const item = page.locator('[data-testid="review-item"]', { hasText: name });
    // No duplicate: exactly one card, however many times it was sent.
    await expect(item).toHaveCount(1);
    ids[name] = (await item.getAttribute("data-id"))!;
    await expect(item.getByTestId("review-photo")).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/field-05-review.png` });
  for (const name of [A, B]) {
    const item = page.locator(
      `[data-testid="review-item"][data-id="${ids[name]}"]`,
    );
    await item.getByTestId("review-approve").click();
    await expect(item.getByTestId("review-status")).toHaveText("Published");
  }
  await elf.close();
});

test("approved displays are public, go on a tour, and open driving directions", async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const api = await (
    await ctx.request.get(`${baseURL}/christmas/api/lights`)
  ).text();
  expect(api).toContain(A);
  expect(api).toContain(B);
  expect(api.split(A).length - 1).toBe(1);

  for (const name of [A, B]) {
    await page.goto(`/christmas/lights?pin=${ids[name]}`);
    await mapReady(page);
    const sheet = page.getByTestId("map-sheet");
    await expect(sheet).toContainText(name);
    expect(
      await sheet.getByTestId("sheet-directions").getAttribute("href"),
    ).toContain("google.com/maps/dir/");
    await sheet.getByTestId("sheet-add-to-tour").click();
    await expect(sheet.getByTestId("sheet-add-to-tour")).toHaveText(
      /On my tour/,
    );
    if (name === A)
      await page.screenshot({ path: `${SHOTS}/field-06-card.png` });
  }
  // One marker per approved display, no repeats.
  const markerIds = await page
    .locator('[data-testid="map-marker"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(new Set(markerIds).size).toBe(markerIds.length);

  await page.goto("/christmas/lights");
  await mapReady(page);
  await expect(page.getByTestId("cta-tour")).toContainText(/My Lights Tour/);
  await page.getByTestId("cta-tour").click();
  await expect(page).toHaveURL(/\/christmas\/lights\/tour/);
  await expect(page.getByText(/Your \d+ picks?/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/field-07-tour-picks.png` });
  await page.getByTestId("build-tour").click();
  const stops = page.getByTestId("tour-stops");
  await expect(stops).toContainText(A);
  await expect(stops).toContainText(B);
  const directions = await page
    .getByTestId("tour-directions")
    .getAttribute("href");
  expect(directions).toContain("google.com/maps/dir/");
  await page.screenshot({ path: `${SHOTS}/field-08-tour.png` });
  await ctx.close();
});
