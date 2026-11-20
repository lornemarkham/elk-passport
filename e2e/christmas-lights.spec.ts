import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * **Pin the Magic** — the Christmas lights map, on a phone.
 *
 * The first test needs nothing but the app: a visitor opens the map-first
 * page (light displays only, clustered, a compact card), opens a display,
 * is told plainly when an area has too little lit, answers the tour's three
 * questions, starts the tour stop by stop, shares it, and plays bingo — the
 * map to Start Tour inside a minute. The second needs the memory store and
 * the test identity (`INSIDERS_STORE=memory INSIDERS_TEST_IDENTITY=on
 * ADMIN_EMAILS=elf@example.test`, then `E2E_LIGHTS_IDENTITY=1`): a family
 * suggests a neighbour's home in three steps, it stays private, a reviewer
 * can't publish it without the homeowner's okay, then does; another family
 * rates and reacts; a privacy report takes it down.
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

test("a visitor finds the lights, builds a tour, starts it, shares it and plays bingo", async ({
  page,
  context,
}) => {
  const started = Date.now();
  await page.goto("/christmas");
  await page.getByTestId("entry-lights").click();
  await expect(page).toHaveURL(/\/christmas\/lights(\?at=vernon)?$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Christmas Lights Map" }),
  ).toBeVisible();
  await mapReady(page);

  // The map is the page on a phone, and draws light displays only.
  const box = await page.getByTestId("lights-map").boundingBox();
  expect(box!.height).toBeGreaterThan(844 * 0.6);
  // …and Build My Lights Tour is on screen without scrolling.
  const cta = await page.getByTestId("cta-tour").boundingBox();
  expect(cta!.y + cta!.height).toBeLessThanOrEqual(844);
  const drawn =
    (await page.getByTestId("map-marker").count()) +
    (await page.getByTestId("map-cluster").count());
  expect(drawn).toBeGreaterThan(0);
  for (const t of await page.getByTestId("map-marker").allInnerTexts())
    expect(t).toMatch(/^(🎄|⭐|❤️)$/u);
  await expect(page.getByTestId("legend")).toContainText("Community favourite");
  await expect(page.getByTestId("cta-tour")).toHaveText(/Build My Lights Tour/);
  await expect(page.getByTestId("pin-the-magic")).toBeVisible();
  // Vernon has few published displays yet (Spirit Square, Coldstream's tree); say so honestly.
  expect(await page.getByTestId("pin-card").count()).toBeGreaterThanOrEqual(1);
  // Markets and shows moved off the map, into their own list.
  await expect(page.getByTestId("other-christmas")).toContainText("Market");
  await expect(page.getByTestId("light-up-vernon")).toContainText(
    "Help us light up Vernon!",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  // Kelowna only; tap a light and its compact card opens over the map.
  await page.getByTestId("town-kelowna").click();
  await expect(page).toHaveURL(/at=kelowna/);
  const cards = page.getByTestId("pin-card");
  await expect(cards.first()).toContainText(/kelowna/i);
  for (const text of await cards.allInnerTexts())
    expect(text).toMatch(/kelowna/i);
  await page.waitForTimeout(400);
  const marker = page.getByTestId("map-marker").first();
  if ((await marker.count()) === 0)
    await page.getByTestId("map-cluster").first().click();
  await page.getByTestId("map-marker").first().click();
  const sheet = page.getByTestId("map-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("sheet-place")).toContainText("Kelowna");
  await expect(sheet.getByTestId("stars")).toBeVisible();
  expect(
    await sheet.getByTestId("sheet-directions").getAttribute("href"),
  ).toContain("google.com/maps/dir/");
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox!.height).toBeLessThan(844 * 0.45);
  // Its buttons are on screen, not under the fold.
  const add = await sheet.getByTestId("sheet-add-to-tour").boundingBox();
  expect(add!.y + add!.height).toBeLessThanOrEqual(844);
  await sheet.getByTestId("sheet-save").click();
  await expect(sheet.getByTestId("sheet-save")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // A display: where it came from; rating and reactions need an account.
  await page.goto("/christmas/lights/seed-kelowna-stuart-park");
  await expect(page.getByTestId("pin-name")).toHaveText(/Stuart Park|Light Up/);
  await expect(page.getByTestId("pin-source")).toContainText(
    "tourismkelowna.com",
  );
  await expect(page.getByTestId("season-badge").first()).toHaveText(
    /Confirmed (this season|for 2026)/,
  );
  await page.getByTestId("star-5").click();
  await expect(page.getByText("Sign in to rate")).toBeVisible();
  await page.getByTestId("react-magical").click();
  await expect(page.getByText("Sign in to react")).toBeVisible();
  await page.getByTestId("detail-add-to-tour").click();
  await expect(page.getByTestId("detail-add-to-tour")).toHaveText(/On my tour/);

  // A prior-year listing says so.
  await page.goto("/christmas/lights/seed-christkindl-kelowna");
  await expect(page.getByTestId("season-badge").first()).toContainText(
    "Last confirmed 2025",
  );

  // Not enough lit in Coldstream that night: said plainly, with the nearest instead.
  await page.goto("/christmas/lights/tour");
  await page.getByTestId("from-coldstream").click();
  await page.locator("summary").click();
  await page.getByTestId("tour-day").fill(NIGHT);
  await page.getByTestId("build-tour").click();
  await expect(page.getByTestId("tour-short")).toContainText("never made up");

  // Three questions: how long, where, what kind.
  await page.getByTestId("time-120").click();
  await page.getByTestId("from-kelowna").click();
  await page.getByTestId("style-best").click();
  await page.getByTestId("mode-walk").click();
  await page.getByTestId("build-tour").click();
  const stops = page.getByTestId("tour-stop");
  await expect(stops.first()).toBeVisible();
  await expect(page.getByTestId("tour-stops")).toContainText(
    "Downtown Kelowna Light Up",
  );
  await expect(page.getByTestId("tour-stops")).not.toContainText("Christkindl");
  await expect(page.getByTestId("tour-stops")).not.toContainText(
    "Craft Culture",
  );
  await expect(page.getByTestId("tour-summary")).toContainText(/km/);
  await expect(page.getByTestId("tour-fits")).toBeVisible();
  const directions = await page
    .getByTestId("tour-directions")
    .getAttribute("href");
  expect(directions).toContain("google.com/maps/dir/");
  expect(directions).toContain("travelmode=walking");
  expect(await page.getByTestId("tour-evening").getAttribute("href")).toMatch(
    /\/christmas\/itinerary\?.*pick=lights%3Amap%3A/,
  );

  // Start Tour: one stop at a time, the phone's map app does the driving.
  const n = await stops.count();
  await page.getByTestId("start-tour").click();
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(page.getByTestId("go-count")).toHaveText(`Stop 1 of ${n}`);
  expect(await page.getByTestId("go-navigate").getAttribute("href")).toContain(
    "destination=",
  );
  await page.getByTestId("go-rate").click();
  await expect(page.getByTestId("rate")).toBeVisible();
  if (n > 1) {
    await page.getByTestId("go-next").click();
    await expect(page.getByTestId("go-count")).toHaveText(`Stop 2 of ${n}`);
  }
  await page.getByTestId("go-save").click();
  await expect(page.getByTestId("go-save")).toHaveText(/Saved/);
  await page.getByTestId("go-end").click();
  await expect(page.getByTestId("tour-done")).toBeVisible();
  await page.getByTestId("tour-back").click();

  if (n > 1) {
    const first = await stops.first().locator("a").first().innerText();
    await stops.first().getByTestId("stop-remove").click();
    await expect(stops).toHaveCount(n - 1);
    expect(await page.getByTestId("tour-stops").innerText()).not.toContain(
      first,
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

  // Adding lights needs an account.
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

  // Three steps: where, a photo, whose — a neighbour's suggestion.
  const started = Date.now();
  await page.goto("/christmas/lights/pin");
  await mapReady(page);
  await page.getByTestId("lights-map").click({ position: { x: 180, y: 120 } });
  await expect(page.getByTestId("pick-said")).toContainText("Pinned");
  await page
    .getByTestId("photo-input")
    .setInputFiles("docs/product/christmas/verification/test-lights.jpg");
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("pin-name-input").fill(name);
  await page.getByTestId("whose-spotted").click();
  await expect(page.getByTestId("spotted-note")).toContainText(
    "private suggestion",
  );
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-done")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(page.getByTestId("pin-done")).toContainText(
    "private suggestion",
  );
  // Details afterwards, never required.
  await page.getByTestId("details-open").click();
  await page.getByTestId("detail-music").click();
  await page.getByTestId("details-hours").fill("Dusk to 10 pm");
  await page.getByTestId("details-save").click();
  await expect(page.getByTestId("details")).toContainText("Saved");
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
  await expect(item).toContainText("neighbour's suggestion");
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
  // How magical was it? Once per account; a second rating replaces the first.
  await theirs.getByTestId("star-3").click();
  await expect(theirs.getByTestId("rate")).toContainText("3★ is counted");
  await theirs.getByTestId("star-5").click();
  await expect(theirs.getByTestId("rate")).toContainText("5★ is counted");
  await theirs.getByTestId("tag-kids").click();
  await theirs.reload();
  await expect(theirs.getByTestId("stars").first()).toContainText("5.0");
  await expect(theirs.getByTestId("stars").first()).toContainText("(1)");
  await expect(theirs.getByTestId("pin-tags")).toContainText("Great for kids");
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

test("a homeowner adds their own lights by address in under a minute, on a small phone", async ({
  browser,
  baseURL,
}) => {
  test.skip(!IDENTITY, "needs the memory store and the test identity");
  const base = baseURL!;
  const owner = await browser.newContext({
    viewport: { width: 360, height: 640 },
  });
  await as(owner, `owner-${RUN}@example.test`, base);
  const page = await owner.newPage();
  // The address search's answer, so the test doesn't call OpenStreetMap.
  await page.route("**/christmas/api/lights/find-address**", (route) =>
    route.fulfill({
      json: {
        found: [
          {
            label: "Example Road, East Hill, Vernon",
            lat: 50.2652,
            lng: -119.2551,
          },
        ],
      },
    }),
  );
  const started = Date.now();
  await page.goto("/christmas/lights/pin");
  await mapReady(page);
  await page.getByTestId("address-input").fill("123 Example Road");
  await page.getByTestId("address-search").click();
  await expect(page.getByTestId("pick-said")).toContainText("Pinned");
  await page
    .getByTestId("photo-camera")
    .setInputFiles("docs/product/christmas/verification/test-lights.jpg");
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("whose-mine").click();
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-done")).toContainText(
    "Your lights are in!",
  );
  expect(Date.now() - started).toBeLessThan(60_000);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);

  // Still private until a reviewer looks; named plainly when no name was given.
  await page.getByTestId("see-my-pin").click();
  await expect(page.getByTestId("pin-name")).toHaveText(
    "Christmas lights in Vernon",
  );
  await expect(page.getByTestId("pending-note")).toBeVisible();
  const id = page.url().split("/").pop()!;
  const visitor = await browser.newContext();
  const api = await visitor.request.get(`${base}/christmas/api/lights`);
  expect(JSON.stringify(await api.json())).not.toContain(id);

  // On the map page it is "your lights", with details to add.
  await page.goto("/christmas/lights");
  await expect(page.getByTestId("my-pins")).toContainText(
    "Christmas lights in Vernon",
  );
  await Promise.all([owner.close(), visitor.close()]);
});
