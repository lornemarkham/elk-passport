import { devices, expect, test } from "@playwright/test";

/**
 * **The experiences are findable from the Go Have a Day bar.**
 *
 * Owner decision, 2026-10-15: Passport is the platform, Go Have a Day is the
 * flagship, and Conference, Hockey Night and October are specialised
 * experiences powered by it. One `Experiences` item on the shared bar opens a
 * row with the three existing routes. These drive it on a desktop and on a
 * phone, where the bar scrolls sideways and a floating panel would have been
 * clipped, and they check that each link lands on the real experience with
 * its own access rules intact — signed out, `/hockey` asks you to sign in and
 * remembers where you were going.
 */
for (const [name, device] of [
  ["desktop", devices["Desktop Chrome"]],
  ["phone", devices["Pixel 7"]],
] as const) {
  test.describe(name, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });

    test("Discovery keeps its sections, and Experiences opens beside them", async ({
      page,
    }) => {
      await page.goto("/discovery");
      for (const id of ["discover", "places", "saved"]) {
        await expect(page.getByTestId(`passport-nav-${id}`)).toBeVisible();
      }
      const button = page.getByTestId("passport-nav-experiences");
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId("passport-experiences")).toHaveCount(0);
      await button.click();
      await expect(page.getByTestId("passport-experiences")).toBeVisible();
      await expect(
        page.getByTestId("passport-experiences").getByRole("link"),
      ).toHaveCount(3);
    });

    test("Experiences opens to Conference, Hockey Night and October", async ({
      page,
    }) => {
      await page.goto("/");
      const button = page.getByTestId("passport-nav-experiences");
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const row = page.getByTestId("passport-experiences");
      await expect(row).toBeVisible();
      for (const [id, label, href] of [
        ["conference", "Conference", "/conferences"],
        ["hockey", "Hockey Night", "/hockey"],
        ["october", "October", "/october"],
      ] as const) {
        const link = page.getByTestId(`passport-experience-${id}`);
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
        await expect(link).toHaveText(label);
        await expect(link).toHaveAttribute("href", href);
      }
      await page.keyboard.press("Escape");
      await expect(row).toHaveCount(0);
    });

    // Everything past the first test starts from the homepage, which carries
    // the same bar. Not from Discovery: on this host, a phone-emulated
    // Discovery page crashes headless Chromium's GPU process after a few idle
    // seconds with no interaction at all, which is an environment fact and
    // not something these tests should spend their timeout on. The first
    // test already proves the bar and the open menu on Discovery itself.
    test("Conference opens the existing experience", async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("passport-nav-experiences").click();
      await page.getByTestId("passport-experience-conference").click();
      await expect(page).toHaveURL(/\/conferences$/);
      // Conference decides for itself whether it is open; either answer is
      // the real page, and the bar is still there with Experiences lit.
      await expect(
        page.getByTestId("passport-nav-experiences"),
      ).toHaveAttribute("aria-current", "page");
    });

    test("Hockey Night keeps its sign-in, and remembers where you were going", async ({
      page,
    }) => {
      await page.goto("/");
      await page.getByTestId("passport-nav-experiences").click();
      await page.getByTestId("passport-experience-hockey").click();
      await expect(page).toHaveURL(/\/auth\?next=%2Fhockey$/);
    });

    test("October opens October", async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("passport-nav-experiences").click();
      await page.getByTestId("passport-experience-october").click();
      await expect(page).toHaveURL(/\/october$/);
      // October's own bar, not Passport's: the experience keeps its shell.
      await expect(
        page.getByRole("navigation", { name: "October" }),
      ).toBeVisible();
    });

    // `/places` is not in this list only because the Atlas stand-in serves
    // candidates and legs, not the places index, so the page cannot render
    // here; it carries the same bar as the homepage and Saved.
    test("the bar on the homepage and Saved carries it too", async ({
      page,
    }) => {
      for (const path of ["/", "/saved"]) {
        await page.goto(path);
        const button = page.getByTestId("passport-nav-experiences");
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
      }
    });
  });
}
