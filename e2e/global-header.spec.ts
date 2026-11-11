import { devices, expect, test } from "@playwright/test";

/**
 * **Every experience keeps the Go Have a Day header.** Owner brief P0,
 * 2026-11-10: one shared header, mounted by the root layout, that no
 * experience's own layout can replace or hide. The experience keeps its theme
 * *below* it.
 */
const PAGES = [
  ["Conference", "/conferences", "conference"],
  ["Hockey Night", "/hockey", "hockey"],
  ["October", "/october", "october"],
  ["Christmas", "/christmas", "christmas"],
  ["Snow Day", "/snow", "snow"],
  ["Sesh Wars", "/snow/sesh-wars", "sesh-wars"],
  ["Date Night", "/datenight", "date-night"],
  ["Badminton Game Night", "/badminton", "badminton"],
] as const;

for (const [name, device] of [
  ["desktop", devices["Desktop Chrome"]],
  ["phone", devices["Pixel 7"]],
] as const) {
  test.describe(`global header · ${name}`, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });

    for (const [label, path, id] of PAGES) {
      test(`${label} wears it, lit, with the logo home`, async ({ page }) => {
        await page.goto(path);
        const header = page.getByTestId("global-header");
        await expect(header).toHaveCount(1);
        await expect(header).toBeVisible();
        const logo = header
          .getByRole("link", { name: /go have a day/i })
          .first();
        await expect(logo).toBeVisible();
        await expect(logo).toHaveAttribute("href", "/");

        const menu = page.getByTestId("passport-nav-experiences");
        await expect(menu).toBeVisible();
        await expect(menu).toHaveAttribute("aria-current", "page");
        await menu.click();
        await expect(
          page.getByTestId(`passport-experience-${id}`),
        ).toHaveAttribute("aria-current", "page");
        await expect(
          page.getByTestId("passport-experiences").getByRole("link"),
        ).toHaveCount(PAGES.length);
      });
    }

    test("the menu moves between experiences, and the logo goes home", async ({
      page,
    }) => {
      await page.goto("/snow");
      for (const [, path, id] of PAGES.filter(([, , i]) => i !== "snow")) {
        await page.getByTestId("passport-nav-experiences").click();
        await page.getByTestId(`passport-experience-${id}`).click();
        // Sesh Wars asks Supabase whether its tables exist first (slow on a placeholder).
        await expect(page).toHaveURL(new RegExp(`${path}`), {
          timeout: 20_000,
        });
        await expect(page.getByTestId("global-header")).toBeVisible();
      }
      await page
        .getByTestId("global-header")
        .getByRole("link", { name: /go have a day/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/$/);
    });
  });
}
