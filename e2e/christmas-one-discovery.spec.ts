import { expect, test } from "@playwright/test";

/**
 * **One unified discovery experience** (owner brief M1154). The page answers
 * "what is happening around me this Christmas?" in one order: the place,
 * today, don't miss, coming up, the moods, Explore, the lights, then making
 * it your own — and nothing is said twice.
 *
 * The featured events are decided by the real clock (`featured.ts`), so the
 * checks on them hold only while they are running; the order of the bands
 * that are always there is checked every time.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

const top = (page: import("@playwright/test").Page, id: string) =>
  page
    .getByTestId(id)
    .first()
    .evaluate((e) => e.getBoundingClientRect().top + window.scrollY);

test("the bands read in the owner's order, with the place first and no hero", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon");
  const h1 = page.getByRole("heading", {
    level: 1,
    name: "Christmas around Vernon",
  });
  await expect(h1).toBeVisible();
  // Compact: the controls are on the first screen with room to spare.
  const controls = (await page.getByTestId("discover-controls").boundingBox())!;
  expect(controls.y + controls.height).toBeLessThan(600);
  await expect(page.getByTestId("explore")).toBeAttached();
  await expect(page.getByTestId("christmas-lights")).toBeAttached();
  const order = [
    "discover",
    ...((await page.getByTestId("happening-today").count())
      ? ["happening-today"]
      : []),
    ...((await page.getByTestId("dont-miss").count()) ? ["dont-miss"] : []),
    ...((await page.getByTestId("coming-up").count()) ? ["coming-up"] : []),
    "ways",
    "explore",
    "christmas-lights",
    "surprise-me",
  ];
  const ys: number[] = [];
  for (const id of order) ys.push(await top(page, id));
  expect(ys).toEqual([...ys].sort((a, b) => a - b));
});

test("while it runs, the Bethlehem Star has its own showcase under Don't miss", async ({
  page,
}) => {
  test.skip(
    Date.now() > Date.parse("2026-12-06T19:00:00-08:00"),
    "the Bethlehem Star's last evening is over",
  );
  await page.goto("/christmas?at=vernon");
  const star = page.getByTestId("dont-miss").getByTestId("bethlehem-star");
  await expect(star).toBeVisible();
  await expect(star.getByRole("img")).toHaveAttribute("alt", /Bethlehem/);
  await expect(star.getByRole("link", { name: /Directions/ })).toBeVisible();
});

test("a mood sets Explore's categories and lands on Explore; Everything clears them", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await page.goto("/christmas?at=vernon");
  await page.getByTestId("way-events").click();
  await expect(page).toHaveURL(/theme=.*#explore$/);
  await expect(page.getByTestId("chip-markets")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("chip-all").click();
  await expect(page).not.toHaveURL(/theme=/);
  // A night in has no listings to filter: it opens its own page.
  await page.goto("/christmas?at=vernon");
  await page.getByTestId("way-cozy").click();
  await expect(page).toHaveURL(/\/christmas\/for\/cozy/);
});

test("no event card appears twice on the page", async ({ page }) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await page.goto("/christmas?at=vernon");
  await expect(page.getByTestId("finder")).toBeVisible();
  const titles = await page.getByTestId("find-title").allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([]);
});
