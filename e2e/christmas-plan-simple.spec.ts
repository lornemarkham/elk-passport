import { expect, test } from "@playwright/test";

/**
 * **Plan my Christmas route, simply** (owner brief P1, 2026-11-24), on a
 * phone (390 px, touch), signed out. One box, one button, four starts; the
 * longer planner is behind "Customize my plan". The plan itself is the
 * existing itinerary page — there is no second planner.
 */
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("the plan page is one box, one button and four starts, with the rest folded away", async ({
  page,
}) => {
  await page.goto("/christmas/plan");
  await expect(page.getByLabel("What sounds fun?")).toBeVisible();
  await expect(page.getByTestId("plan-go")).toHaveText(
    /Make My Christmas Plan/,
  );
  const starts = page.getByTestId("quick-starts").getByRole("link");
  await expect(starts).toHaveText([
    /Date Night/,
    /Family Fun/,
    /Christmas Lights/,
    /Christmas Markets/,
  ]);
  const toggle = page.getByTestId("customize-toggle");
  await expect(toggle).toBeVisible();
  await expect(page.getByTestId("customize")).not.toHaveAttribute("open", "");
  // The box, the button and the folded section are all in the first screen.
  for (const id of ["plan-input", "plan-go", "customize-toggle"]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box!.y + box!.height).toBeLessThan(844);
  }
  const scroll = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(scroll).toBeLessThanOrEqual(1);
});

test("Customize my plan opens the detailed planner, and a sentence carried in opens it", async ({
  page,
}) => {
  await page.goto("/christmas/plan");
  await page.getByTestId("customize-toggle").click();
  await expect(page.getByTestId("customize")).toHaveAttribute("open", "");
  // Signed out, the detailed planner offers the account and the no-account day.
  await expect(page.getByTestId("plan-no-account")).toBeVisible();
  await page.goto("/christmas/plan?shape=weekend&say=lights");
  await expect(page.getByTestId("customize")).toHaveAttribute("open", "");
});

test("a sentence becomes a plan; accessibility and a finish time are said back", async ({
  page,
}) => {
  await page.goto("/christmas/plan?at=kelowna");
  await page
    .getByTestId("plan-input")
    .fill("Christmas lights on Dec 12, grandma uses a wheelchair, home by 9");
  await page.getByTestId("plan-go").click();
  await expect(page).toHaveURL(/\/christmas\/itinerary\?/);
  await expect(page.getByTestId("itinerary")).toBeVisible();
  await expect(page.getByTestId("itinerary-access")).toContainText(
    /wheelchair.*can't confirm/,
  );
  await expect(page.getByTestId("itinerary-home-by")).toContainText(
    /Home by 9/,
  );
});

test("a quick start makes a plan in one tap", async ({ page }) => {
  await page.goto("/christmas/plan?at=kelowna");
  await page.getByTestId("quick-markets").click();
  await expect(page).toHaveURL(/\/christmas\/itinerary\?/);
  await expect(page.getByTestId("itinerary")).toBeVisible();
  // No day was said: one question, and the day it was planned for is named.
  await expect(page.getByTestId("itinerary-question")).toContainText(
    /Which day\?.*Planned for/,
  );
});
