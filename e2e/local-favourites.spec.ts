import { expect, test, type Page } from "@playwright/test";

/**
 * **Local favourites** (owner brief M1007, "Feature two early local
 * supporters"), on a phone:
 *
 *   each pub's own page: the photo (or the drawn lake), the label that says
 *   it is our pick, directions to the stated point, the phone, the website,
 *   honest hours, where every fact came from, nothing that says partner or
 *   sponsored, nothing wider than the screen → the Atlas record forwards to
 *   it → Christmas near Vernon offers both as optional stops after the
 *   Christmas shelves, Kelowna offers neither → Discovery in Vernon shows the
 *   cards between the shelves → Sesh Wars at SilverStar ends with Long
 *   John's, Big White does not.
 *
 * Photos load from the pub's own host, so that one check needs the internet.
 */
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const LJ_ATLAS = "a0c4c529-8cf6-4431-afdd-c559f0a63195";
const SHOTS = "docs/product/local-favourites/screenshots";

async function fitsTheScreen(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("Long John's has a destination page worth stopping for", async ({
  page,
}) => {
  // The shared place page since M1041: the same facts, the same honesty.
  await page.goto("/favourites/long-johns-pub");
  const pageEl = page.getByTestId("place-details");
  await expect(
    pageEl.getByRole("heading", { level: 1, name: "Long John's Pub" }),
  ).toBeVisible();
  await expect(pageEl.getByTestId("place-badge")).toHaveText(
    "Local favourite · our pick",
  );
  await expect(pageEl).toContainText("Main Street, SilverStar village");
  await expect(pageEl.getByTestId("place-directions")).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=50.35934,-119.059306",
  );
  await expect(pageEl.getByTestId("place-call")).toHaveAttribute(
    "href",
    "tel:+12505492992",
  );
  await expect(pageEl.getByTestId("place-website")).toHaveAttribute(
    "href",
    "https://www.longjohnspub.com/",
  );
  await expect(pageEl.getByTestId("place-hours")).toContainText(
    "aren't confirmed",
  );
  // The pub's own photograph, credited, actually drawn.
  const hero = pageEl.getByTestId("place-hero").locator("img").first();
  await expect(hero).toHaveAttribute("alt", /Long John's sign/);
  await expect
    .poll(() => hero.evaluate((i: HTMLImageElement) => i.naturalWidth), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  await expect(pageEl.getByTestId("place-hero")).toContainText(
    "Photo: Long John's Pub",
  );

  await expect(
    page.getByRole("heading", { name: "Make a day of it" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Sesh Wars at SilverStar/ }),
  ).toHaveAttribute("href", "/snow/sesh-wars/m/silverstar");
  await page.getByText("Sources & accuracy").click();
  await expect(
    page.getByTestId("place-sources").getByText("longjohnspub.com").first(),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    /partner|sponsored|official/i,
  );
  await fitsTheScreen(page);
  await page.screenshot({ path: `${SHOTS}/long-johns-phone.png` });
  await page.screenshot({
    path: `${SHOTS}/long-johns-phone-full.png`,
    fullPage: true,
  });
});

test("Alexander's has a page without a borrowed photo", async ({ page }) => {
  await page.goto("/favourites/alexanders-beach-pub");
  const pageEl = page.getByTestId("place-details");
  await expect(
    pageEl.getByRole("heading", { level: 1, name: "Alexander's Beach Pub" }),
  ).toBeVisible();
  await expect(pageEl).toContainText("Kal Beach, Kalamalka Lake, Vernon");
  await expect(pageEl.getByTestId("place-hero")).toHaveCount(0);
  await expect(pageEl.getByTestId("place-hero-drawn")).toBeVisible();
  await expect(pageEl.getByTestId("place-directions")).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=50.23019,-119.26374",
  );
  await expect(pageEl.getByTestId("place-call")).toHaveAttribute(
    "href",
    "tel:+12505453131",
  );
  // No website exists that we could verify, so none is offered.
  await expect(pageEl.getByTestId("place-website")).toHaveCount(0);
  await expect(pageEl.getByTestId("place-hours")).toContainText("Call ahead");
  await expect(page.locator("main")).not.toContainText(
    /partner|sponsored|official|trivia|live music/i,
  );
  await fitsTheScreen(page);
  await page.screenshot({ path: `${SHOTS}/alexanders-phone.png` });
  await page.screenshot({
    path: `${SHOTS}/alexanders-phone-full.png`,
    fullPage: true,
  });
});

test("the Atlas record forwards to the destination page", async ({ page }) => {
  await page.goto(`/passport/${LJ_ATLAS}?kind=Organization`);
  await expect(page).toHaveURL(/\/favourites\/long-johns-pub$/);
});

test("Christmas near Vernon offers both as optional stops, after Christmas", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon&km=30");
  const stops = page.getByTestId("favourite-stops");
  await expect(stops).toBeVisible();
  await expect(stops).toContainText("Warm up before or after");
  await expect(
    stops.getByTestId("favourite-stop-alexanders-beach-pub"),
  ).toContainText("Before or after the lights");
  await expect(
    stops.getByTestId("favourite-stop-long-johns-pub"),
  ).toContainText("km (straight line)");
  await fitsTheScreen(page);
  await stops.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/christmas-vernon-phone.png` });

  await page.goto("/christmas/discover?at=kelowna&km=30");
  await expect(page.getByTestId("favourite-stops")).toHaveCount(0);
});

test("Discovery in Vernon shows the cards between the shelves", async ({
  page,
}) => {
  await page.goto("/discovery?at=vernon");
  const section = page.getByTestId("local-favourites");
  await expect(section).toBeVisible({ timeout: 30_000 });
  await expect(section.getByTestId("favourite-long-johns-pub")).toBeVisible();
  await expect(
    section.getByTestId("favourite-alexanders-beach-pub"),
  ).toBeVisible();
  await fitsTheScreen(page);
  // The shelves settle as distances arrive, and the interlude moves with
  // them: shoot once it holds still.
  await expect(async () => {
    await page.getByTestId("local-favourites").screenshot({
      path: `${SHOTS}/discovery-vernon-phone.png`,
      timeout: 3_000,
    });
  }).toPass({ timeout: 20_000 });
});

test("Sesh Wars at SilverStar ends with Long John's; Big White does not", async ({
  page,
}) => {
  await page.goto("/snow/sesh-wars/demo/m/silverstar");
  const stops = page.getByTestId("favourite-stops");
  await expect(stops).toContainText("After the sesh");
  const stop = stops.getByTestId("favourite-stop-long-johns-pub");
  await expect(stop).toBeVisible();
  await stops.scrollIntoViewIfNeeded();
  // The pub's own photo, drawn as the thumbnail.
  await expect
    .poll(
      () =>
        stop.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await fitsTheScreen(page);
  await page.screenshot({ path: `${SHOTS}/sesh-wars-silverstar-phone.png` });

  await page.goto("/snow/sesh-wars/demo/m/big-white");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("favourite-stops")).toHaveCount(0);
});

test("a SilverStar snow day offers Long John's for après", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/snow/new");
  await page
    .getByLabel("Tell Passport about the day (optional)")
    .fill("SilverStar on Saturday, two of us skiing.");
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByRole("button", { name: "Skiing" }).click();
  await page.getByRole("button", { name: "Make us an awesome day" }).click();
  await expect(page.getByTestId("hero-mountain")).toHaveText("SilverStar");
  const apres = page.getByTestId("card-apres");
  if ((await apres.getAttribute("aria-expanded")) !== "true")
    await apres.click();
  const panel = page.locator("#card-panel-apres");
  const stops = panel.getByTestId("favourite-stops");
  await expect(stops).toContainText("Après in the village");
  await expect(
    stops.getByTestId("favourite-stop-long-johns-pub"),
  ).toContainText("on SilverStar's Main Street");
  await fitsTheScreen(page);
  await stops.screenshot({ path: `${SHOTS}/snow-apres-phone.png` });
});
