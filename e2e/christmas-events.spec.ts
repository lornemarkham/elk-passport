import { expect, test, type Page } from "@playwright/test";

/**
 * **Newly published Atlas events appear in GoHaveADay Christmas** (owner
 * brief M1046): the Vernon and Silver Star events Atlas mission 1042
 * published, rendered as cards a person can read and act on.
 *
 * Runs against an Atlas stand-in serving those records as they will be once
 * venue linking places them (Atlas mission 1044):
 *
 *   node scripts/critic/atlas-mock.mjs e2e/fixtures/christmas-events/m1042-placed.json 3146 &
 *   ATLAS_API_URL=http://127.0.0.1:3146 … next start -p 3120
 *   E2E_CHRISTMAS_EVENTS=1 E2E_PORT=3120 npx playwright test e2e/christmas-events.spec.ts
 *
 * The records are real; only their place is stood in. Their dates are this
 * season's, so after New Year's Eve 2026 they are over and the spec says so
 * rather than failing.
 */
test.skip(
  process.env.E2E_CHRISTMAS_EVENTS !== "1",
  "needs the M1042 Atlas stand-in (see the header)",
);
test.skip(
  new Date() > new Date("2027-01-01T08:00:00Z"),
  "the M1042 events are this season's and have all happened",
);

const cards = (page: Page) =>
  page.getByTestId("shelf-near").getByTestId("find-card");
const card = (page: Page, title: string) =>
  cards(page).filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });

test("Vernon: the new events are cards, with when, where, what and how to get there", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon");
  const first = await cards(page).count();
  // The shelf opens on its first few; the rest are one tap away.
  await page.getByTestId("more-near").click();
  await expect(page).toHaveURL(/all=near/);
  for (const title of [
    "Frostival 2026 Downtown Vernon",
    "Downtown Vernon Christmas Saturdays",
    "Stars on Ice - 2026 Holiday Tour",
    "Festive Saturday Science",
    "Silver Star Annual Light Up",
    "Santa Ski Day",
    "Christmas Eve Carol Service",
    "Silver Star New Years Eve Celebration",
  ])
    await expect(card(page, title)).toHaveCount(1);
  const frostival = card(page, "Frostival 2026 Downtown Vernon");
  await expect(frostival.getByTestId("find-confidence")).toContainText(
    "dates confirmed",
  );
  await expect(frostival).toContainText("Nov 27");
  await expect(frostival.getByTestId("find-where")).toContainText("Vernon");
  await expect(frostival.getByTestId("find-description")).toContainText(
    "free street festival",
  );
  await expect(frostival.getByTestId("find-directions")).toHaveAttribute(
    "href",
    /google\.com\/maps\/dir\/.*destination=50\.267,-119\.272/,
  );
  await expect(frostival.getByTestId("find-details")).toHaveAttribute(
    "href",
    "/christmas/event/1c99bcd7-3ff4-45ea-b8f9-e7ed67f177aa",
  );
  const shown = await cards(page).count();
  test.info().annotations.push({
    type: "cards",
    description: `${first} event cards on opening, ${shown} after Show all, near Vernon`,
  });
  expect(shown).toBeGreaterThanOrEqual(14);
});

test("Silver Star: the village's own events, from the place picker's new town", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=silverstar&km=5");
  await expect(page.getByTestId("result-count")).toContainText(
    "within 5 km of Silver Star",
  );
  for (const title of [
    "Silver Star Annual Light Up",
    "Salomon Rail Jam",
    "12 Days of Holidays",
  ])
    await expect(card(page, title)).toHaveCount(1);
  await expect(card(page, "Frostival 2026 Downtown Vernon")).toHaveCount(0);
});

test("a date: Christmas Eve offers what is on Christmas Eve", async ({
  page,
}) => {
  await page.goto(
    "/christmas/discover?at=vernon&from=2026-12-24&to=2026-12-24",
  );
  await expect(card(page, "Santa Ski Day")).toHaveCount(1);
  await expect(card(page, "Christmas Eve Carol Service")).toHaveCount(1);
  await expect(card(page, "Frostival 2026 Downtown Vernon")).toHaveCount(0);
});

test("one tap between lights, markets, shows and the rest", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon");
  await page.getByTestId("chip-markets").click();
  await expect(page).toHaveURL(/theme=markets/);
  await expect(
    card(page, "Artsolutely 21st Annual Holiday Artisan Market & Fundraiser"),
  ).toHaveCount(1);
  await page.getByTestId("chip-shows").click();
  await expect(card(page, "Christmas Eve Carol Service")).toHaveCount(1);
  await page.getByTestId("chip-lights").click();
  await expect(card(page, "Silver Star Annual Light Up")).toHaveCount(1);
});
