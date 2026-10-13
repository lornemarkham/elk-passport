import { devices, expect, test } from "@playwright/test";

/**
 * **The ways between Home, Discovery, a subject and Make a Day** (M211).
 *
 * Run against a production build whose `ATLAS_API_URL` is the stand-in serving
 * the committed real Atlas body, with `E2E_ATLAS=1`. The stand-in serves no
 * detail reads, so this proves where a card goes and that `/passport/[id]`
 * renders what Atlas does not compose. Production showed that the Place,
 * Organization and Event pages render (see the release doc).
 *
 * The home page needs no Atlas and always runs.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

const FAIRY_DOORS = "f3d2101f-c59a-4c46-905a-2b2607e5728d"; // Activity
const CARAVAN_FARM = "f54d6acc-91f7-4558-a2ad-6565f318f978"; // Place, not detail-ready

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

    test("Home leads with Make a day, and it opens the Day Builder", async ({
      page,
    }) => {
      await page.goto("/");
      const make = page.getByTestId("home-make-a-day");
      await expect(make).toBeVisible();
      await expect(make).toBeInViewport();
      await make.click();
      await expect(page).toHaveURL(/\/go$/);
      await expect(page.getByTestId("go-say")).toBeVisible();
    });

    test("a Discovery card opens from its picture, its words and the gaps between its buttons", async ({
      page,
    }) => {
      test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
      // Photos are other people's hosts; with no network they pile up pending
      // and can take the tab down. Nothing here is about a photo's pixels.
      await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) =>
        route.abort(),
      );
      await page.goto("/discovery");
      // The first card whose page the stand-in can serve: which kind of card
      // leads Discovery moves with the date (an Event led on 2026-10-13), and
      // the stand-in has no Event composition to open. Every card is hit-tested
      // the same way; this one is also followed.
      const card = page
        .getByTestId("possibility")
        .filter({ has: page.locator('a[href^="/places/"]') })
        .first();
      await expect(card).toBeVisible({ timeout: 60_000 });
      // `elementFromPoint` only sees what is on screen.
      await card.scrollIntoViewIfNeeded();
      const href = await card
        .getByTestId("possibility-link")
        .getAttribute("href");
      expect(href).toMatch(/^\/(places|passport)\/[0-9a-f-]{36}/);
      // Every point that is not one of the card's own controls is the link.
      for (const [fx, fy] of [
        [0.5, 0.15],
        [0.5, 0.5],
        [0.08, 0.75],
        [0.97, 0.97],
      ] as const) {
        const hit = await card.evaluate(
          (el, [fx, fy]) => {
            const box = el.getBoundingClientRect();
            const at = document.elementFromPoint(
              box.left + box.width * fx,
              box.top + box.height * fy,
            );
            const control = at?.closest("a,button");
            return control?.getAttribute("data-testid") ?? control?.tagName;
          },
          [fx, fy] as const,
        );
        expect(["possibility-link", "plan-a-day", "BUTTON"]).toContain(hit);
      }
      await card.click({ position: { x: 20, y: 20 } });
      await expect(page).toHaveURL(new RegExp(href!.split("?")[0]!));
    });

    test("an Activity opens on its own page, from what Discovery holds", async ({
      page,
    }) => {
      test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
      await page.goto(`/passport/${FAIRY_DOORS}?on=2026-10-12&childAge=5`);
      await expect(
        page.getByRole("heading", { name: "Fairy Doors" }),
      ).toBeVisible();
      await expect(page).toHaveTitle(/Fairy Doors/);
      await expect(page.getByText("nothing at this address")).toHaveCount(0);
      await page.getByTestId("lets-do-this").click();
      await expect(page).toHaveURL(
        new RegExp(`/day/${FAIRY_DOORS}\\?on=2026-10-12&childAge=5`),
      );
    });

    test("an old /passport link to a Place goes on to the Place page", async ({
      page,
    }) => {
      test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
      await page.goto(`/passport/${CARAVAN_FARM}?on=2026-10-12`);
      await expect(page).toHaveURL(
        new RegExp(`/places/${CARAVAN_FARM}\\?on=2026-10-12`),
      );
    });
  });
}
