import { devices, expect, test } from "@playwright/test";

/**
 * **Passport Labs: a LABS link in the bar, and a door for each experiment that
 * can actually be played.** Desktop and phone.
 *
 * The page decides what is open from its environment, so this reads the page
 * rather than assuming: every card that links must open onto something that
 * renders, and every card that does not link must say it is blocked. Run with
 * `E2E_ATLAS=1` and `ATLAS_API_URL` at the stand-in to exercise the Atlas
 * experiences too.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

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

    test("a LABS link sits in the bar and opens /labs", async ({ page }) => {
      await page.goto("/discovery");
      const link = page.getByTestId("passport-nav-labs");
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      await expect(link).toHaveText("Labs");
      await link.click();
      await expect(page).toHaveURL(/\/labs$/);
      await expect(
        page.getByRole("heading", { name: /playing with/i }),
      ).toBeVisible();
    });

    test("the page does not scroll sideways", async ({ page }) => {
      await page.goto("/labs");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("every door that links opens onto a page that renders", async ({
      page,
    }) => {
      await page.goto("/labs");
      const hrefs = await page
        .locator("a[data-testid^='labs-door-']")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs).toContain("/labs/experience/sycle-hockey-night");
      for (const href of hrefs) {
        const res = await page.goto(href);
        expect(res?.status(), href).toBeLessThan(400);
        await expect(page.locator("body"), href).not.toContainText(
          /application error|internal server error/i,
        );
        await expect(page.locator("h1, h2").first(), href).toBeVisible();
      }
    });

    test("a blocked experiment has no link and says so", async ({ page }) => {
      await page.goto("/labs");
      const shared = page.getByTestId("labs-door-hockey-shared");
      await expect(shared).toBeVisible();
      await expect(shared).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByTestId("labs-status-hockey-shared")).toHaveText(
        "Blocked",
      );
      expect(await shared.evaluate((n) => n.tagName)).not.toBe("A");
    });

    test("Atlas experiences follow whether Atlas is there", async ({
      page,
    }) => {
      await page.goto("/labs");
      const status = page.getByTestId("labs-status-go-have-a-day");
      await expect(status).toHaveText(WITH_ATLAS ? "Playable" : "Blocked");
    });

    test("October is not a Labs experiment", async ({ page }) => {
      await page.goto("/labs");
      await expect(page.locator("main")).not.toContainText(/october/i);
    });
  });
}
