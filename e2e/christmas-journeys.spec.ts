import { devices, expect, test, type Page } from "@playwright/test";

/**
 * **GoHaveADay Christmas — the owner's customer journeys A–F** (owner brief
 * M1128, "One Beautiful Experience", §13). Each is a person's whole visit,
 * not a button: arrive, be welcomed, find something, open it, come home.
 * With `E2E_ATLAS=1` an Atlas stand-in serves real listings; without it the
 * journeys stop where only listings could take them.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

/** Chips offered for this place, these days and this distance. */
const offered = (page: Page) =>
  page
    .getByTestId("categories")
    .locator('button[data-testid^="chip-"]:not([data-testid="chip-all"])')
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid")!.replace("chip-", "")),
    );

test("A — a first-time visitor is welcomed, finds something nearby, opens it and gets home", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon");
  await expect(page.getByTestId("hearth")).toBeVisible();
  await expect(page.getByTestId("way-stories")).toBeAttached();
  // No account, no questions, before anything is found.
  await expect(
    page.locator("main input, main select").first(),
  ).not.toBeInViewport();
  await expect(page).not.toHaveURL(/\/auth/);
  if (!WITH_ATLAS) return;
  const first = page
    .getByTestId("finder")
    .locator('[data-testid="find-feature"], [data-testid="find-card"]')
    .first();
  await first.scrollIntoViewIfNeeded();
  await first.getByTestId("find-title").click();
  await expect(page).toHaveURL(/\/christmas\/event\//);
  await page.getByTestId("xmas-nav-home").click();
  await expect(page).toHaveURL(/\/christmas(\?|$)/);
  await expect(page.getByTestId("hearth")).toBeVisible();
});

test("B — markets on a chosen day: only available kinds are offered, and an empty day gets suggestions", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon&when=tomorrow#discover");
  await expect(page.getByTestId("when-select")).toHaveValue("tomorrow");
  if (!WITH_ATLAS) return;
  const chips = await offered(page);
  // Every chip offered holds something for tomorrow.
  for (const id of chips)
    await expect(page.getByTestId(`chip-${id}`)).not.toContainText(/\b0$/);
  if (!chips.includes("markets")) {
    // Markets aren't on tomorrow: they are said apart, with their next day,
    // or as further away, or as not listed — never offered as a choice.
    await expect(page.getByTestId("later")).toContainText("Christmas markets");
  }
  // Asking for them anyway is answered by a host, not a dead end.
  await page.goto("/christmas?at=vernon&when=tomorrow&theme=markets#discover");
  const nothing = page.getByTestId("nothing");
  if (await nothing.count()) {
    await expect(nothing).toContainText("your date and distance stay");
    await expect(page.getByTestId("when-select")).toHaveValue("tomorrow");
    await expect(page.getByTestId("nye-banner")).toHaveCount(0);
  }
});

test("C — several interests at once, changed without losing the place or the date", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon#discover");
  if (!WITH_ATLAS) return;
  const want = (await offered(page)).filter((t) =>
    ["markets", "lights", "food"].includes(t),
  );
  for (const t of want) await page.getByTestId(`chip-${t}`).click();
  await expect
    .poll(() =>
      new URL(page.url()).searchParams.get("theme")?.split(",").sort(),
    )
    .toEqual([...want].sort());
  // Every card shown is one of them.
  const labels = /Christmas markets|Holiday lights|Festive food/;
  // Every card shown as a result is one of them (a host's "also near you",
  // when nothing matches, is said apart as something else).
  for (const card of await page
    .getByTestId("finder")
    .locator('[data-testid^="shelf-"] [data-testid="find-card"]')
    .all())
    await expect(card).toContainText(labels);
  // Choosing a day keeps the place and the interests.
  await page.getByTestId("when-select").selectOption("weekend");
  await expect(page).toHaveURL(/when=weekend/);
  await expect(page).toHaveURL(/at=vernon/);
  expect(
    new URL(page.url()).searchParams.get("theme")?.split(",").sort(),
  ).toEqual([...want].sort());
});

test("D — a romantic Christmas evening: dinner and the lights, replaced, started and lived", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await page.goto("/christmas?at=vernon");
  await page.getByTestId("way-date").click();
  await expect(page).toHaveURL(/\/christmas\/for\/date/);
  await page.getByTestId("plan-idea").first().click();
  await expect(page).toHaveURL(/\/christmas\/itinerary\?/);
  const dinner = page.locator('[data-testid="stop"][data-need="dinner"]');
  await expect(dinner).toBeVisible();
  // A stop's picture never stands for the evening unless it is the place's
  // own or one Atlas is sure of; the count says nothing technical.
  await expect(page.getByTestId("itinerary-count")).not.toContainText(
    /parts planned/,
  );
  await page.getByTestId("action-edit").click();
  const before = await dinner.getByTestId("stop-name").textContent();
  await dinner.getByTestId("stop-replace").click();
  const alt = dinner.getByTestId("stop-alternative").first();
  if (await alt.count()) {
    await alt.click();
    await expect(dinner.getByTestId("stop-name")).not.toHaveText(before!);
  }
  await page.getByTestId("action-start").click();
  await expect(page.getByTestId("live-current")).toBeVisible();
  await expect(page.getByTestId("live-directions")).toBeVisible();
  await expect(page.getByTestId("live-running-late")).toBeVisible();
  await expect(page.getByTestId("live-skip")).toBeVisible();
  while (await page.getByTestId("live-next").isVisible())
    await page.getByTestId("live-next").click();
  // A few moments to remember, at the end.
  await expect(page.getByTestId("after-day")).toBeVisible();
});

test("E — Home, Lights Map, Advent and My Christmas, with Back and Forward keeping place and scroll", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon&km=20#discover");
  await page.waitForLoadState("load");
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(300);
  await page.getByTestId("xmas-nav-lights").click();
  await expect(page).toHaveURL(/\/christmas\/lights/);
  await page.getByTestId("xmas-nav-advent").click();
  await expect(page).toHaveURL(/\/christmas\/advent/);
  await page.getByTestId("xmas-nav-list").click();
  await expect(page).toHaveURL(/\/christmas\/list/);
  // Back, back, back: the same discovery, place, distance and scroll.
  await page.goBack();
  await expect(page).toHaveURL(/\/christmas\/advent/);
  await page.goBack();
  await expect(page).toHaveURL(/\/christmas\/lights/);
  await page.goForward();
  await expect(page).toHaveURL(/\/christmas\/advent/);
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/km=20/);
  await expect(page.getByTestId("km-select")).toHaveValue("20");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(300);
  // Home, from anywhere, comes back to this same discovery.
  await page.getByTestId("xmas-nav-lights").click();
  await expect(page).toHaveURL(/\/christmas\/lights/);
  await page.getByTestId("xmas-nav-home").click();
  await expect(page).toHaveURL(/\/christmas\?.*at=vernon/);
  await expect(page).toHaveURL(/km=20/);
});

test.describe("F — a phone, from a business card's QR code", () => {
  const { defaultBrowserType: _unused, ...phone } = devices["iPhone 13"];
  void _unused;
  test.use(phone);
  test("opens fast, says where it is, and finds something without an account", async ({
    page,
  }) => {
    const t0 = Date.now();
    await page.goto("/christmas?utm_source=card");
    await expect(page.getByTestId("hearth")).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(8000);
    await expect(page.getByTestId("christmas-nav")).toBeVisible();
    await expect(page.getByTestId("xmas-nav-home")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    if (WITH_ATLAS) {
      await page.getByTestId("discover").scrollIntoViewIfNeeded();
      await expect(
        page
          .getByTestId("finder")
          .locator('[data-testid="find-feature"], [data-testid="find-card"]')
          .first(),
      ).toBeVisible();
    }
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
