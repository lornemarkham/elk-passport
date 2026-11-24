import { expect, test } from "@playwright/test";

/**
 * The front doors of People's Pulse and Pulse Check (M1073): a question worth
 * asking opens the form with its words in, and a claim pasted on /check lands
 * in the wizard. Needs no stored Pulses.
 */

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("a starter question opens the form with its words filled in", async ({
  page,
}) => {
  await page.goto("/labs/pulse/new?q=Is%20a%20hot%20dog%20a%20sandwich%3F");
  await expect(page.locator("textarea").first()).toHaveValue(
    "Is a hot dog a sandwich?",
  );
});

test("the landing page does not scroll sideways", async ({ page }) => {
  await page.goto("/labs/pulse");
  const [w, vw] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(w).toBeLessThanOrEqual(vw);
});

test("a claim pasted on Pulse Check arrives in the wizard", async ({
  page,
}) => {
  await page.goto("/check");
  await page
    .getByLabel(/Is this true/)
    .fill("The hospital is at 147% capacity.");
  await page.getByTestId("check-start").click();
  await expect(page).toHaveURL(/\/check\/new\?q=/);
  await expect(page.locator("textarea").first()).toHaveValue(
    "The hospital is at 147% capacity.",
  );
});

test("a pasted link arrives as the link, not as the claim", async ({
  page,
}) => {
  await page.goto("/check/new?q=https%3A%2F%2Fexample.com%2Fstory");
  await expect(page.locator('input[type="url"], input').first()).toHaveValue(
    "https://example.com/story",
  );
});
