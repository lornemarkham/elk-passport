import { expect, test } from "@playwright/test";

/**
 * **Christmas movies, the season's best, and a list that names things**
 * (owner brief M1064), on a phone. `E2E_ATLAS=1` means an Atlas stand-in
 * serves real listings (the production corpus of 2026-11-23 was used).
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("movie night: who's watching, three picks, tonight's plan, a shareable link", async ({
  page,
  browser,
}) => {
  await page.goto("/christmas/movies?at=vernon");
  for (const shelf of ["family", "comedy", "romance", "classic", "animated"])
    await expect(page.getByTestId(`shelf-${shelf}`)).toBeVisible();
  await expect(page.getByTestId("no-streaming")).toContainText(
    "we won't guess",
  );
  await page.getByTestId("who-family").click();
  const three = page.getByTestId("three").getByTestId("film");
  await expect(three).toHaveCount(3);
  const first = await three.first().getAttribute("data-film");
  await page.getByTestId("three-more").click();
  await expect(three.first()).not.toHaveAttribute("data-film", first!);
  await page.getByTestId("three").getByTestId("choose-film").first().click();
  await expect(page.getByTestId("tonight")).toBeVisible();
  expect(page.url()).toMatch(/film=/);
  // The link is the plan: a stranger opening it sees the same night.
  const other = await (await browser.newContext()).newPage();
  await other.goto(page.url());
  await expect(other.getByTestId("tonight")).toHaveAttribute(
    "data-film",
    (await page.getByTestId("tonight").getAttribute("data-film"))!,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Christmas names the season's best and reaches movies and Advent from the front", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in");
  await page.goto("/christmas?at=vernon");
  await expect(page.getByTestId("pill-advent")).toBeInViewport();
  const best = page.getByTestId("seasons-best");
  await expect(best).toBeVisible();
  for (const id of ["lights", "santa", "markets", "shows", "festivals", "free"])
    await expect(best.getByTestId(`best-${id}`)).toContainText(/within \d+ km/);
  await best.getByTestId("best-movies").click();
  await expect(page).toHaveURL(/\/christmas\/movies/);
});

test("My Christmas List names what was added on this phone, and lets it go", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in");
  await page.goto("/christmas?at=vernon");
  const card = page.locator("article:has([data-testid=pick-find])").first();
  const title = (await card.locator("h3").innerText()).trim();
  await card.getByTestId("pick-find").click();
  await page.goto("/christmas/list");
  const added = page.getByTestId("list-added-item");
  await expect(added).toHaveCount(1);
  await expect(added).toContainText(title);
  await page.getByTestId("list-added-remove").click();
  await expect(added).toHaveCount(0);
});
