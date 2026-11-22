import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * **"Your lights" — field test, 2026-11-22.** A family pins a display; the
 * administrator approves it; the family edits its details on the phone; the
 * public keeps the approved words until the administrator approves the change.
 * A pending display stays invisible to any other account.
 *
 * Needs the memory store and the test identity:
 *
 *   INSIDERS_STORE=memory INSIDERS_TEST_IDENTITY=on ADMIN_EMAILS=elf@example.test
 *
 * then `E2E_LIGHTS_IDENTITY=1 E2E_PORT=… npx playwright test christmas-your-lights`.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });
const IDENTITY = process.env.E2E_LIGHTS_IDENTITY === "1";
test.skip(!IDENTITY, "needs the memory store and the test identity");

const RUN = Date.now().toString(36);
const OWNER = `family-${RUN}@example.test`;
const OTHER = `neighbour-${RUN}@example.test`;
const ADMIN = "elf@example.test";
const NAME = `Elm Street Reindeer ${RUN}`;
const EDITED_NAME = `Elm Street Reindeer Lane ${RUN}`;
const PHOTO = "docs/product/christmas/verification/test-lights.jpg";

let id = "";

async function as(context: BrowserContext, email: string, baseURL: string) {
  await context.addCookies([
    { name: "insiders-as", value: encodeURIComponent(email), url: baseURL },
  ]);
}

async function mapReady(page: Page) {
  await expect(page.getByTestId("lights-map").first()).toHaveAttribute(
    "data-ready",
    "1",
    { timeout: 20_000 },
  );
}

/** The community form's step 3: what it is, and the photo promise. */
async function describeAndPromise(page: Page) {
  await page.getByTestId("what-home").click();
  await page.getByTestId("photo-ok").check();
  // The form refuses a send that comes faster than a person could type it.
  await page.waitForTimeout(2600);
}

test("a family pins a display, and an administrator publishes it", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const family = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(family, OWNER, base);
  const page = await family.newPage();
  await page.goto("/christmas/lights/pin?at=coldstream");
  await mapReady(page);
  await page.getByTestId("lights-map").click();
  await expect(page.getByTestId("pick-said")).toContainText("Pinned");
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("pin-name-input").fill(NAME);
  await describeAndPromise(page);
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-done")).toBeVisible();
  await page.getByTestId("see-my-pin").click();
  await page.waitForURL(/[?&]pin=/);
  id = new URL(page.url()).searchParams.get("pin")!;
  expect(id).toBeTruthy();
  await family.close();

  // Pending: another signed-in account cannot see it — not on the map, the API or the page.
  const neighbour = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(neighbour, OTHER, base);
  const api = await (
    await neighbour.request.get(`${base}/christmas/api/lights`)
  ).text();
  expect(api).not.toContain(id);
  expect(api).not.toContain(NAME);
  const np = await neighbour.newPage();
  await np.goto(`/christmas/lights/${id}`);
  await expect(np.getByTestId("pin-name")).toHaveCount(0);
  expect(await np.content()).not.toContain(NAME);
  await neighbour.close();

  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(elf, ADMIN, base);
  const review = await elf.newPage();
  await review.goto("/christmas/lights/review");
  const item = review.locator(`[data-testid="review-item"][data-id="${id}"]`);
  await item.getByTestId("review-approve").click();
  await expect(item.getByTestId("review-status")).toHaveText("Published");
  await elf.close();
});

test("the family edits a published display; the public keeps the approved words until the change is approved", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const family = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(family, OWNER, base);
  const page = await family.newPage();
  await page.goto("/christmas/lights");

  // Your lights says where it is and when it was pinned, so same-named displays can be told apart.
  const mine = page.locator('[data-testid="my-pin"]', { hasText: NAME });
  await expect(mine.getByTestId("my-pin-where")).toContainText("Coldstream");
  await expect(mine.getByTestId("my-pin-where")).toContainText("pinned");

  await mine.getByTestId("details-open").click();
  await mine.getByTestId("details-name").fill(EDITED_NAME);
  await mine.getByTestId("details-hours").fill("Dusk to 10 pm");
  await mine.getByTestId("details-save").click();

  // Collapses after saving, says so, and says the change waits for review.
  await expect(mine.getByTestId("details-saved")).toContainText(
    "Changes saved",
  );
  await expect(mine.getByTestId("details")).toHaveCount(0);
  await expect(mine.getByTestId("details-open")).toHaveText("Edit details");
  await expect(mine.getByTestId("my-pin-waiting")).toBeVisible();
  await family.close();

  // The public keeps the approved words.
  const visitor = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await visitor.newPage();
  await p.goto(`/christmas/lights/${id}`);
  await expect(p.getByTestId("pin-name")).toHaveText(NAME);
  expect(await p.content()).not.toContain("Dusk to 10 pm");
  await visitor.close();

  // The administrator sees the change beside the words, and approves it.
  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(elf, ADMIN, base);
  const review = await elf.newPage();
  await review.goto("/christmas/lights/review");
  const item = review.locator(`[data-testid="review-item"][data-id="${id}"]`);
  const change = item.getByTestId("review-change");
  await expect(change).toContainText(EDITED_NAME);
  await expect(change).toContainText("Dusk to 10 pm");
  await change.getByTestId("review-approve-change").click();
  await expect(item.getByTestId("review-change")).toHaveCount(0);
  await elf.close();

  const after = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const q = await after.newPage();
  await q.goto(`/christmas/lights/${id}`);
  await expect(q.getByTestId("pin-name")).toHaveText(EDITED_NAME);
  await expect(q.getByText("Dusk to 10 pm")).toBeVisible();
  await after.close();
});
