import { expect, test, type Page } from "@playwright/test";

/**
 * **Choosing where on the Christmas Lights Map** (2026-11-23): the place
 * choice is always on the page — no accordion — and Silver Star and Lake
 * Country are places of their own beside Vernon, Coldstream, East Hill,
 * Lumby, Armstrong and Kelowna. Needs only the app.
 */

test.use({ viewport: { width: 390, height: 844 } });

const PLACES = [
  ["vernon", "Vernon"],
  ["coldstream", "Coldstream"],
  ["east-hill", "East Hill"],
  ["lumby", "Lumby"],
  ["silverstar", "Silver Star"],
  ["armstrong", "Armstrong"],
  ["lake-country", "Lake Country"],
  ["kelowna", "Kelowna"],
] as const;

async function mapReady(page: Page) {
  await expect(page.getByTestId("lights-map").first()).toHaveAttribute(
    "data-ready",
    "1",
    { timeout: 20_000 },
  );
}

test("the place choice is on the page, not in an accordion, and every place is one tap", async ({
  page,
}) => {
  await page.goto("/christmas/lights");
  await mapReady(page);
  await expect(
    page.getByRole("heading", { name: "Explore Christmas Lights Near You" }),
  ).toBeVisible();
  await expect(page.getByTestId("lights-where")).toBeVisible();
  await expect(page.locator("details#lights-where")).toHaveCount(0);
  await expect(page.getByTestId("where-selected")).toContainText(
    "Everywhere on the map",
  );
  for (const [id, label] of PLACES) {
    const chip = page.getByTestId(`town-${id}`);
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText(label);
    const box = await chip.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }
  // A phone never scrolls sideways for it.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

for (const [id, label] of PLACES) {
  test(`${label}: choosing it says so, moves the map and keeps the link`, async ({
    page,
  }) => {
    await page.goto("/christmas/lights");
    await mapReady(page);
    await page.getByTestId(`town-${id}`).click();
    await expect(page).toHaveURL(new RegExp(`at=${id}`));
    await expect(page.getByTestId(`town-${id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("where-selected")).toContainText(label);
    await expect(page.getByTestId("lights-map").first()).toHaveAttribute(
      "aria-label",
      new RegExp(`in ${label}|${label}`),
    );

    // The shared link opens on the same place.
    await page.goto(`/christmas/lights?at=${id}`);
    await mapReady(page);
    await expect(page.getByTestId("where-selected")).toContainText(label);
    await expect(page.getByTestId(`town-${id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Route planning starts from the same place.
    await page.getByTestId("cta-tour").click();
    await expect(page).toHaveURL(
      new RegExp(`/christmas/lights/tour\\?area=${id}`),
    );
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(
      page.getByRole("radio", { name: label }).first(),
    ).toHaveAttribute("aria-checked", "true");
  });
}

test("Silver Star's own light-up is on Silver Star's map, and not on Lumby's", async ({
  page,
}) => {
  await page.goto("/christmas/lights?at=silverstar");
  await mapReady(page);
  await expect(page.getByTestId("lights-map").first()).toContainText("");
  await expect(page.getByTestId("empty-town")).toHaveCount(0);
  await page.goto("/christmas/lights?at=lumby");
  await mapReady(page);
  await expect(page.getByTestId("empty-town")).toHaveCount(1);
});
