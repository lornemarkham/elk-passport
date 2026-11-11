import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * **Pin the Magic** — the Christmas lights map, on a phone.
 *
 * The first test needs nothing but the app: a visitor browses the researched
 * public displays, opens one, adds it to a tour, builds a walking tour,
 * opens it from its shared link, and plays bingo. The second needs the
 * memory store and the test identity (`INSIDERS_STORE=memory
 * INSIDERS_TEST_IDENTITY=on ADMIN_EMAILS=elf@example.test`, then
 * `E2E_LIGHTS_IDENTITY=1`): a family pins a home, it stays private, a
 * reviewer can't publish it without the owner's okay, then does; another
 * family reacts; a privacy report takes it down.
 */

test.use({ viewport: { width: 390, height: 844 } });

const IDENTITY = process.env.E2E_LIGHTS_IDENTITY === "1";
const RUN = Date.now().toString(36);
const NIGHT = "2026-12-05";

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

test("a visitor finds the lights, builds a tour, shares it and plays bingo", async ({
  page,
  context,
}) => {
  await page.goto("/christmas");
  await page.getByTestId("cta-lights").click();
  await expect(page).toHaveURL(/\/christmas\/lights$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Christmas Lights Map" }),
  ).toBeVisible();
  await mapReady(page);
  expect(await page.getByTestId("map-marker").count()).toBeGreaterThan(5);
  expect(await page.getByTestId("pin-card").count()).toBeGreaterThan(5);
  await expect(page.getByTestId("pin-the-magic")).toBeVisible();

  // Kelowna only.
  await page.getByTestId("town-kelowna").click();
  const cards = page.getByTestId("pin-card");
  for (const text of await cards.allInnerTexts())
    expect(text).toMatch(/kelowna/i);

  // A display: where it came from, and reactions need an account.
  await page.goto("/christmas/lights/seed-kelowna-stuart-park");
  await expect(page.getByTestId("pin-name")).toHaveText(/Stuart Park|Light Up/);
  await expect(page.getByTestId("pin-source")).toContainText(
    "tourismkelowna.com",
  );
  await expect(page.getByTestId("season-badge").first()).toHaveText(
    /Confirmed (this season|for 2026)/,
  );
  await page.getByTestId("react-magical").click();
  await expect(page.getByText("Sign in to react")).toBeVisible();
  await page.getByTestId("detail-add-to-tour").click();
  await expect(page.getByTestId("detail-add-to-tour")).toHaveText(/On my tour/);

  // A prior-year listing says so.
  await page.goto("/christmas/lights/seed-christkindl-kelowna");
  await expect(page.getByTestId("season-badge").first()).toContainText(
    "Last confirmed 2025",
  );

  // The tour, on a night things are lit.
  await page.goto("/christmas/lights/tour");
  await page.getByTestId("from-kelowna").click();
  await page.getByTestId("mode-walk").click();
  await page.getByTestId("tour-day").fill(NIGHT);
  await page.getByTestId("build-tour").click();
  const stops = page.getByTestId("tour-stop");
  await expect(stops.first()).toBeVisible();
  await expect(page.getByTestId("tour-stops")).toContainText(
    "Downtown Kelowna Light Up",
  );
  await expect(page.getByTestId("tour-stops")).not.toContainText("Christkindl");
  const directions = await page
    .getByTestId("tour-directions")
    .getAttribute("href");
  expect(directions).toContain("google.com/maps/dir/");
  expect(directions).toContain("travelmode=walking");
  const n = await stops.count();
  if (n > 1) {
    const first = await stops.first().innerText();
    await stops.first().getByTestId("stop-remove").click();
    await expect(stops).toHaveCount(n - 1);
    expect(await page.getByTestId("tour-stops").innerText()).not.toContain(
      first.split("\n")[1] ?? "§",
    );
  }

  // Shared: anyone opening the link sees the same stops.
  const link = (await page.getByTestId("tour-link").innerText()).replace(
    "Tour link: ",
    "",
  );
  const listed = await page.getByTestId("tour-stops").innerText();
  const other = await context
    .browser()!
    .newPage({ viewport: { width: 390, height: 844 } });
  await other.goto(link.trim());
  await expect(other.getByTestId("tour-stops")).toBeVisible();
  expect(await other.getByTestId("tour-stops").innerText()).toBe(listed);
  await other.close();

  // Saving needs an account; the tour is kept meanwhile.
  await page.getByTestId("tour-save").click();
  await expect(page.getByTestId("tour-sign-in")).toBeVisible();

  // Pinning needs an account.
  await page.goto("/christmas/lights");
  await page.getByTestId("pin-the-magic").click();
  await expect(page.getByTestId("pin-sign-in")).toBeVisible();

  // Bingo: the middle row through the free square.
  await page.goto("/christmas/lights/bingo");
  const squares = page.getByTestId("bingo-square");
  await expect(squares).toHaveCount(25);
  for (const i of [10, 11, 13, 14]) await squares.nth(i).click();
  await expect(page.getByTestId("bingo-win")).toBeVisible();
});

test("a family pins a home; it stays private until the owner's okay is recorded", async ({
  browser,
  baseURL,
}) => {
  test.skip(!IDENTITY, "needs the memory store and the test identity");
  const base = baseURL!;
  const name = `Reindeer House ${RUN}`;
  const family = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(family, `family-${RUN}@example.test`, base);
  const page = await family.newPage();

  await page.goto("/christmas/lights/pin");
  await mapReady(page);
  await page.getByTestId("lights-map").click({ position: { x: 180, y: 150 } });
  await expect(page.getByTestId("pick-said")).toContainText("Pinned");
  await page
    .getByTestId("photo-input")
    .setInputFiles("docs/product/christmas/verification/test-lights.jpg");
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("kind-home").click();
  await page.getByTestId("pin-name-input").fill(name);
  await page.getByTestId("hours-input").fill("Dusk to 10 pm");
  await page.getByTestId("consent-i-live-here").check();
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-done")).toBeVisible();
  await expect(page.getByTestId("pin-status")).toHaveText(
    /waiting for a reviewer/,
  );
  await page.getByTestId("see-my-pin").click();
  await expect(page.getByTestId("pending-note")).toContainText("owner");
  await expect(page.getByTestId("pin-photo")).toBeVisible();
  const id = page.url().split("/").pop()!;

  // Nobody else sees it, or its photo, or roughly where it is.
  const visitor = await browser.newContext();
  const api = await visitor.request.get(`${base}/christmas/api/lights`);
  expect(JSON.stringify(await api.json())).not.toContain(id);
  expect(
    (
      await visitor.request.get(`${base}/christmas/api/lights/${id}/photo`)
    ).status(),
  ).toBe(404);
  expect(
    (await visitor.request.get(`${base}/christmas/lights/${id}`)).status(),
  ).toBe(404);

  // The reviewer can't publish a home on the submitter's word alone.
  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(elf, "elf@example.test", base);
  const review = await elf.newPage();
  await review.goto("/christmas/lights/review");
  const item = review.locator(`[data-testid="review-item"][data-id="${id}"]`);
  await expect(item).toContainText("their home");
  await item.getByTestId("review-approve").click();
  await expect(item.getByRole("alert")).toContainText("owner's consent");
  await item.getByTestId("basis-owner").check();
  await item.getByTestId("review-approve").click();
  await expect(
    review.locator(`[data-testid="review-waiting"] [data-id="${id}"]`),
  ).toHaveCount(0);

  // Published: another family reacts, once per reaction.
  const friends = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(friends, `friends-${RUN}@example.test`, base);
  const theirs = await friends.newPage();
  await theirs.goto(`/christmas/lights/${id}`);
  const magical = theirs.getByTestId("react-magical");
  await magical.click();
  await expect(magical).toHaveAttribute("aria-pressed", "true");
  await expect(magical).toContainText("1");
  await magical.click();
  await expect(magical).toHaveAttribute("aria-pressed", "false");
  await expect(magical).toContainText("0");
  await theirs.getByTestId("react-family").click();
  await expect(theirs.getByTestId("react-family")).toContainText("1");
  await theirs.getByTestId("check-on").click();
  await expect(theirs.getByTestId("checks")).toContainText("Thank you");
  await theirs.getByTestId("detail-add-to-tour").click();

  // The owner — no account needed — takes it down; it goes at once.
  const owner = await visitor.newPage();
  await owner.goto(`/christmas/lights/${id}`);
  await owner.getByTestId("report-open").click();
  await owner.getByLabel("This is my home — please take it down").check();
  await owner.getByTestId("report-send").click();
  await expect(owner.getByTestId("report")).toContainText("hidden now");
  expect(
    (await visitor.request.get(`${base}/christmas/lights/${id}`)).status(),
  ).toBe(404);
  await review.reload();
  await expect(
    review.locator(`[data-testid="review-hidden"] [data-id="${id}"]`),
  ).toHaveCount(1);

  await Promise.all([
    family.close(),
    visitor.close(),
    elf.close(),
    friends.close(),
  ]);
});
