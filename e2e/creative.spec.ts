import { devices, expect, test, type Page } from "@playwright/test";

/**
 * **The ELK Creative Archive at /creative: it loads, it searches, its drawers
 * open, and every original it offers to open actually works.**
 *
 * "Works" is more than a 200. Each linked original is opened in a real
 * browser and must render content, throw no uncaught error, and not be a
 * Next error or not-found page. A few originals that the archive exists to
 * keep findable are checked for their own content.
 *
 * Which originals link depends on the environment (Atlas, the Labs gates),
 * so this reads the page rather than assuming the list. Run with `E2E_ATLAS=1`
 * and `ATLAS_API_URL` at the stand-in for the Atlas-made ones to link.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

const BROKEN =
  /This page could not be found|Application error|Something went wrong|Internal Server Error/i;

async function expectRealPage(page: Page, href: string) {
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  page.on("pageerror", onError);
  const res = await page.goto(href);
  expect(res?.status(), href).toBeLessThan(400);
  await page.waitForLoadState("load");
  // Some originals are authored to open on darkness and speak on a schedule
  // (October's scenes hold black for over a second), and some say almost
  // nothing at all — a door in a dark room, one video card. So "it rendered"
  // means words or something to look at or press, asked for a while rather
  // than of the first frame.
  const bodyText = async () => (await page.locator("body").innerText()).trim();
  const rendered = async () =>
    (await bodyText()).length > 10 ||
    (await page
      .locator("body :is(img, video, canvas, svg, button):visible")
      .count()) > 0;
  await expect
    .poll(rendered, { message: `${href} rendered nothing`, timeout: 10_000 })
    .toBe(true);
  const text = await bodyText();
  expect(text, href).not.toMatch(BROKEN);
  // Let a client component finish mounting and throw, if it is going to.
  await page.waitForTimeout(400);
  page.off("pageerror", onError);
  expect(errors, `${href} threw`).toEqual([]);
}

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

    test("the archive loads, with every drawer and its originals", async ({
      page,
    }) => {
      await page.goto("/creative");
      await expect(
        page.getByRole("heading", { level: 1, name: "ELK Creative Archive" }),
      ).toBeVisible();
      for (const drawer of [
        "Experiences",
        "October",
        "Christmas",
        "Discovery",
        "Design Evolution",
        "Brainstorming",
        "Product Philosophy",
      ]) {
        await expect(
          page.getByRole("heading", { level: 2, name: new RegExp(drawer) }),
        ).toBeVisible();
      }
      await expect(
        page.getByTestId("creative-card-christmas-passport-html"),
      ).toBeVisible();
    });

    test("the page does not scroll sideways", async ({ page }) => {
      await page.goto("/creative");
      await page.getByTestId("creative-category-october").click();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("search narrows the vault to what matches", async ({ page }) => {
      await page.goto("/creative");
      await page.getByTestId("creative-search").fill("christmas");
      await expect(
        page.getByTestId("creative-card-christmas-passport-html"),
      ).toBeVisible();
      await expect(
        page.getByTestId("creative-card-experiment-01-bachelor-party"),
      ).toHaveCount(0);
      await expect(page).toHaveURL(/[?&]q=christmas/);

      // Commits and source paths are searchable too.
      await page.getByTestId("creative-search").fill("974e1d6");
      await expect(
        page.getByTestId("creative-card-hockey-night-original"),
      ).toBeVisible();

      await page.getByTestId("creative-search").fill("zzzz-nothing");
      await expect(
        page.getByText(/Nothing in the vault matches/),
      ).toBeVisible();
    });

    test("a drawer shows only its own originals, and the URL keeps it", async ({
      page,
    }) => {
      await page.goto("/creative");
      await page.getByTestId("creative-category-october").click();
      await expect(page).toHaveURL(/[?&]c=october/);
      await expect(
        page.getByTestId("creative-card-october-witching-hour"),
      ).toBeVisible();
      await expect(
        page.getByTestId("creative-card-christmas-passport-html"),
      ).toHaveCount(0);

      await page.reload();
      await expect(
        page.getByTestId("creative-category-october"),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByTestId("creative-card-christmas-passport-html"),
      ).toHaveCount(0);
    });

    test("what needs restoring is marked, and offers no link", async ({
      page,
    }) => {
      await page.goto("/creative");
      await page.getByTestId("creative-status-missing").click();
      const cards = page.locator("article[data-testid^='creative-card-']");
      await expect(cards.first()).toBeVisible();
      for (const status of await cards.evaluateAll((as) =>
        as.map((a) => a.getAttribute("data-status")),
      )) {
        expect(status).toBe("missing");
      }
      await expect(
        page.getByTestId("creative-card-future-passport-experience"),
      ).toBeVisible();
      await expect(page.locator("[data-testid^='creative-open-']")).toHaveCount(
        0,
      );
    });

    test("Labs has a way into the archive", async ({ page }) => {
      await page.goto("/labs");
      await page.getByTestId("labs-creative-archive").click();
      await expect(page).toHaveURL(/\/creative$/);
    });
  });
}

test.describe("the originals", () => {
  test("the original Christmas HTML opens as itself", async ({ page }) => {
    await page.goto("/creative?c=christmas");
    await page.getByTestId("creative-open-christmas-passport-html").click();
    await expect(page).toHaveURL(
      /\/labs\/discovery-space\/christmas-passport\.html$/,
    );
    await expect(page).toHaveTitle(/CHRISTMAS/);
  });

  test("the original Hockey Night opens onto the lab fixture", async ({
    page,
  }) => {
    await page.goto("/creative");
    await page.getByTestId("creative-open-hockey-night-original").click();
    await expect(page).toHaveURL(/\/labs\/experience\/sycle-hockey-night$/);
    await expect(page.getByText(/Canucks/).first()).toBeVisible();
  });

  test("an October original first served in Labs still arrives", async ({
    page,
  }) => {
    await expectRealPage(page, "/labs/october/witching-hour");
    await expect(page).toHaveURL(/\/october\/witching-hour$/);
  });

  test("every original the archive links opens onto a working page", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/creative");
    const hrefs = await page
      .locator("a[data-testid^='creative-open-']")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs).toContain("/labs/discovery-space/christmas-passport.html");
    expect(hrefs).toContain("/october/sketchbook");
    if (WITH_ATLAS)
      expect(hrefs).toContain("/labs/design/v4/one-hell-of-a-day");
    // Every link is tried, so a failure names all the broken originals at
    // once rather than only the first.
    const broken: string[] = [];
    for (const href of new Set(hrefs)) {
      try {
        await expectRealPage(page, href);
      } catch (e) {
        broken.push(`${href}: ${(e as Error).message.split("\n")[0]}`);
      }
    }
    console.log(
      `checked ${new Set(hrefs).size} originals, ${broken.length} broken`,
    );
    expect(broken).toEqual([]);
  });
});
