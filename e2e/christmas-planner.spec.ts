import { expect, test, type Page } from "@playwright/test";

/**
 * **Christmas Experience 2.0 — describe it, get a plan** (owner brief,
 * 2026-11-14), on a phone (390 px, touch). Signed out: the plan needs no
 * account. With `E2E_ATLAS=1` the critic's mock serves Atlas's committed
 * corpus of 2026-10-24; lights come from the lights map's researched seed.
 * Dates are said in the sentence so the run doesn't depend on today.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

async function editing(page: Page) {
  const edit = page.getByTestId("action-edit");
  if ((await edit.getAttribute("aria-pressed")) !== "true") await edit.click();
  await expect(edit).toHaveAttribute("aria-pressed", "true");
}

async function planFor(page: Page, say: string, at = "kelowna") {
  await page.goto(`/christmas?at=${at}`);
  await page.getByTestId("plan-input").fill(say);
  await page.getByTestId("plan-go").click();
  await expect(page).toHaveURL(/\/christmas\/itinerary\?/);
  await expect(page.getByTestId("itinerary")).toBeVisible();
}

test("the front page keeps the sentence box beside the six ways, and real Christmas below", async ({
  page,
}) => {
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your Christmas Starts Here",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Tell us what you'd love to do")).toBeVisible();
  await expect(page.getByTestId("plan-go")).toHaveText(
    /Make my Christmas plan/,
  );
  // The six ways took the quick starts' place (owner brief, 2026-11-17).
  await expect(page.getByTestId("ways").getByRole("link")).toHaveCount(6);
  await expect(page.getByTestId("browse")).toBeVisible();
  // Nothing sideways on a phone.
  const scroll = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(scroll).toBeLessThanOrEqual(1);
});

test("1 · romantic lights, dinner and a movie — each part is a real place, in a sensible order", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await planFor(page, "Romantic night of lights, dinner and a movie on Dec 12");
  await expect(page.getByTestId("itinerary-title")).toHaveText(
    "Our romantic Christmas evening",
  );
  await expect(page.getByTestId("itinerary-question")).toHaveCount(0);
  const stops = page.getByTestId("itinerary-stops").locator(":scope > li");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(0)).toContainText("Romantic dinner");
  await expect(stops.nth(1)).toContainText("Christmas lights");
  await expect(stops.nth(2)).toContainText("Movie");
  await expect(stops.nth(0).getByTestId("stop-time")).toHaveText("5:30 PM");
  await expect(stops.nth(2).getByTestId("stop-note")).toContainText(
    "Showtimes aren't listed",
  );
  await expect(stops.nth(0).getByTestId("stop-directions")).toHaveAttribute(
    "href",
    /google\.com\/maps\/dir/,
  );
  await expect(page.getByTestId("itinerary-duration")).toContainText("hr");
  await expect(page.getByTestId("itinerary-distance")).toContainText("km");
});

test("6 · what can't be confirmed is said, with the honest ways on", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await planFor(
    page,
    "Romantic night of lights, dinner and a movie on Dec 5",
    "vernon",
  );
  const movie = page.locator(
    '[data-testid="stop-unresolved"][data-need="movie"]',
  );
  await expect(movie).toContainText("no cinema within 30 km of Vernon");
  await expect(movie.getByTestId("stop-take-nearest")).toContainText(
    "Bernie's",
  );
  await expect(page.getByTestId("itinerary-count")).toContainText(
    "couldn't be confirmed",
  );
  // Taking the nearest real option is a choice, said as further away.
  await movie.getByTestId("stop-take-nearest").click();
  await expect(
    page.locator('[data-testid="stop"][data-need="movie"]'),
  ).toContainText(/further than the rest/);
});

test("5 · changing plans: remove, replace, re-time, add — then start the day and change it halfway", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await planFor(page, "Romantic night of lights, dinner and a movie on Dec 12");
  await editing(page);
  // Remove the movie.
  await page
    .locator('[data-testid="stop"][data-need="movie"]')
    .getByTestId("stop-remove")
    .click();
  await expect(page).toHaveURL(/drop=movie/);
  await expect(page.locator('[data-need="movie"]')).toHaveCount(0);
  // Replace dinner.
  const dinner = page.locator('[data-testid="stop"][data-need="dinner"]');
  const before = await dinner.getByTestId("stop-name").textContent();
  await dinner.getByTestId("stop-replace").click();
  await dinner.getByTestId("stop-alternative").first().click();
  await expect(page).toHaveURL(/pick=dinner/);
  await expect(dinner.getByTestId("stop-name")).not.toHaveText(before!);
  // Move dinner to 6:00.
  await editing(page);
  await dinner.getByTestId("stop-change-time").click();
  await dinner.getByTestId("stop-time-input").fill("18:00");
  await dinner.getByTestId("stop-time-save").click();
  await expect(page).toHaveURL(/t=dinner%3A1800|t=dinner:1800/);
  await expect(
    page
      .getByTestId("itinerary-stops")
      .locator(":scope > li")
      .first()
      .getByTestId("stop-time"),
  ).toHaveText("6:00 PM");
  // Add a hot chocolate.
  await editing(page);
  await page.getByTestId("add-coffee").click();
  await expect(page.locator('[data-need="coffee"]')).toHaveCount(1);

  // Start the day: what's next, then halfway, running late and a skip.
  await page.getByTestId("action-start").click();
  await expect(page.getByTestId("live-current")).toContainText(
    "Romantic dinner",
  );
  await expect(page.getByTestId("live-directions")).toBeVisible();
  await expect(page.getByTestId("live-next-stop")).toBeVisible();
  await expect(page.getByTestId("live-travel")).toContainText("min");
  await page.getByTestId("live-next").click();
  await page.getByTestId("live-running-late").click();
  await expect(page.getByTestId("live-late")).toContainText("15 min behind");
  await page.getByTestId("live-skip").click();
  // The day survives a reload on this phone.
  await page.reload();
  await page.getByTestId("action-start").click();
  await expect(page.getByTestId("live-late")).toContainText("15 min behind");
  while (await page.getByTestId("live-next").isVisible())
    await page.getByTestId("live-next").click();
  await expect(page.getByTestId("after-day")).toBeVisible();
  await page.getByTestId("after-love").first().click();
  await page.getByTestId("after-star").nth(4).click();
  await expect(page.getByTestId("after-love").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("after-keep")).toHaveAttribute(
    "href",
    /\/auth\?next=/,
  );
});

test("2 · a family with two kids and $100 — said back, no bar, kids' challenges", async ({
  page,
}) => {
  await planFor(page, "Family with two kids and $100 on Dec 12");
  await expect(page.getByTestId("itinerary-who")).toContainText(
    "Family · 2 kids",
  );
  await expect(page.getByTestId("itinerary-budget")).toContainText(
    "Budget $100",
  );
  await expect(page.getByTestId("moments")).toHaveAttribute(
    "data-kind",
    "family",
  );
  await expect(page.getByTestId("itinerary")).not.toContainText(
    /\b(Pub|Lounge)\b/,
  );
});

test("3 · friends at the Christmas markets — vote together", async ({
  page,
}) => {
  await planFor(page, "Friends visiting Christmas markets on Nov 28", "vernon");
  await expect(page.getByTestId("itinerary-title")).toHaveText(
    "A Christmas day with friends",
  );
  await expect(
    page.locator('[data-testid="stop"][data-need="market"]'),
  ).toBeVisible();
  await expect(page.getByTestId("moments")).toHaveAttribute(
    "data-kind",
    "friends",
  );
});

test("4 · a lights driving tour — several displays, one route, the map's own tour", async ({
  page,
}) => {
  // The quick start's own sentence (QUICK_STARTS "lights").
  await page.goto(
    "/christmas/itinerary?say=A+Christmas+lights+tour+after+dark&at=kelowna",
  );
  await expect(page.getByTestId("itinerary-question")).toBeVisible();
  // Answer the one question with a date the displays are lit.
  await page.goto(`${page.url()}&day=2026-12-12`);
  const lights = page.locator('[data-testid="stop"][data-need="lights"]');
  await expect(
    lights.getByTestId("stop-displays").locator("li"),
  ).not.toHaveCount(0);
  await expect(lights.getByTestId("stop-directions")).toHaveAttribute(
    "href",
    /waypoints|destination/,
  );
  await expect(lights.getByTestId("stop-tour")).toHaveAttribute(
    "href",
    /\/christmas\/lights\/tour\?/,
  );
  await expect(page.getByTestId("moments")).toHaveAttribute(
    "data-kind",
    "lights",
  );
});

test("7 · the action bar stays reachable and the share link opens the same plan", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await planFor(
    page,
    "Christmas markets and a hot chocolate on Nov 28",
    "vernon",
  );
  for (const id of ["action-edit", "action-share", "action-start"])
    await expect(page.getByTestId(id)).toBeInViewport();
  const url = page.url();
  const friend = await context.newPage();
  await friend.goto(url);
  await expect(friend.getByTestId("itinerary-title")).toHaveText(
    (await page.getByTestId("itinerary-title").textContent())!,
  );
  await friend.close();
});
