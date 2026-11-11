import { devices, expect, test } from "@playwright/test";

/**
 * **Sesh Wars ships demo-capable** (M737). Its tables are a proposal in
 * `docs/product/snow/sesh-wars-migration.sql`, so on a Passport without them
 * `/snow/sesh-wars` says it is warming up and opens the demo, and the demo
 * mountain is fully playable on the visitor's own device. The full journey,
 * and the real thing on a local stack, are
 * `docs/product/snow/verification/sesh.spec.ts`.
 */
for (const [label, device] of [
  ["desktop", devices["Desktop Chrome"]],
  ["phone", devices["Pixel 7"]],
] as const) {
  test.describe(label, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });

    test("Snow → Sesh Wars → the demo mountain, under the one header", async ({
      page,
    }) => {
      await page.goto("/snow");
      await page
        .getByRole("main")
        .getByRole("link", { name: /Sesh Wars/ })
        .first()
        .click();
      // The real page asks Supabase whether its tables exist first; against a
      // placeholder Supabase that takes several seconds.
      await expect(page).toHaveURL(/\/snow\/sesh-wars$/, { timeout: 20_000 });
      await expect(page.getByTestId("global-header")).toHaveCount(1);

      const demo = page.getByRole("link", {
        name: /Play the demo|Try the demo mountain/,
      });
      await demo.first().click();
      await expect(page).toHaveURL(/\/snow\/sesh-wars\/demo$/);
      await expect(page.getByText("Demo mode").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Every feature has a champion/i }),
      ).toBeVisible();
      await expect(page.getByTestId("global-header")).toHaveCount(1);

      await page.getByRole("link", { name: /SilverStar.*features/ }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "SilverStar" }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: /Starlight Rail/ })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Starlight Rail" }),
      ).toBeVisible();
      await expect(page.getByText("Today's Champion")).toBeVisible();
    });
  });
}
