import { expect, test, type Page } from "@playwright/test";

/**
 * **One place page for every place** (owner brief M1041, "GoHaveADay shared
 * place details overhaul"), on a desktop and on a phone, for the brief's
 * three acceptance examples:
 *
 *   Long John's Pub — its own photographs, kept, credited, in a wide hero;
 *   Alexander's Beach Pub — no photograph, so a drawn lake, never a stock one;
 *   The Roster Sports Club — a text-heavy record turned into Food & drink,
 *   Things to do and Amenities, with the website text folded into Sources.
 *
 * All three are the same template: the same four actions (Add to My Day,
 * Save, Directions, Call), the same visitor column, the same folded Sources
 * & accuracy. Needs the place-details Atlas stand-in
 * (`e2e/support/place-details-standin.mjs`, `E2E_PLACE_DETAILS=1`); The
 * Roster is a labelled fixture (`e2e/fixtures/place-details/README.md`).
 * Long John's photographs load from the pub's own host: needs the internet.
 */
const WITH_STANDIN = process.env.E2E_PLACE_DETAILS === "1";
const SHOTS = "docs/product/place-details/screenshots";

const EXAMPLES = [
  {
    slug: "long-johns",
    path: "/favourites/long-johns-pub",
    name: "Long John's Pub",
    id: "a0c4c529-8cf6-4431-afdd-c559f0a63195",
    photo: true,
  },
  {
    slug: "alexanders",
    path: "/favourites/alexanders-beach-pub",
    name: "Alexander's Beach Pub",
    id: "f7f3967e-4eaf-4311-982f-572d2f4d1e70",
    photo: false,
  },
  {
    slug: "roster",
    path: "/passport/e2e-roster-sports-club?kind=Organization",
    name: "The Roster Sports Club Bar & Grill",
    id: "e2e-roster-sports-club",
    photo: false,
  },
] as const;

async function fitsTheScreen(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function theSharedPage(page: Page, e: (typeof EXAMPLES)[number]) {
  await page.goto(e.path);
  const details = page.getByTestId("place-details");
  await expect(
    details.getByRole("heading", { level: 1, name: e.name }),
  ).toBeVisible();
  // The four things a person does next.
  await expect(details.getByTestId("place-add-to-day")).toHaveAttribute(
    "href",
    `/go?with=${e.id}`,
  );
  await expect(
    details.getByTestId("place-actions").getByRole("button", { name: "Save" }),
  ).toBeVisible();
  await expect(details.getByTestId("place-directions")).toHaveAttribute(
    "href",
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/,
  );
  await expect(details.getByTestId("place-call")).toHaveAttribute(
    "href",
    /^tel:\+?\d{10,11}$/,
  );
  // What a visitor checks, kept together.
  await expect(details.getByTestId("place-hours")).toBeVisible();
  await expect(details.getByTestId("place-location")).toBeVisible();
  // Provenance is there, and folded.
  const sources = details.getByTestId("place-sources");
  await expect(sources).not.toHaveAttribute("open", "");
  await expect(sources).toContainText("Sources & accuracy");
  if (e.photo) {
    const img = details.getByTestId("place-hero").locator("img").first();
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  } else {
    await expect(details.getByTestId("place-hero-drawn")).toBeVisible();
  }
  await fitsTheScreen(page);
  return details;
}

for (const viewport of [
  { label: "desktop", width: 1440, height: 900, isMobile: false },
  { label: "phone", width: 390, height: 844, isMobile: true },
] as const) {
  test.describe(`the shared place page, ${viewport.label}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    test.skip(!WITH_STANDIN, "needs the place-details stand-in");

    for (const e of EXAMPLES) {
      test(`${e.name} is drawn on the shared template`, async ({ page }) => {
        const details = await theSharedPage(page, e);
        if (viewport.label === "desktop") {
          // A rich layout: the visitor column sits beside the story.
          const main = await details.getByTestId("place-about").boundingBox();
          const aside = await details
            .getByTestId("place-visitor")
            .boundingBox();
          expect(aside!.x).toBeGreaterThan(main!.x + main!.width - 1);
        }
        await page.screenshot({
          path: `${SHOTS}/${e.slug}-${viewport.label}.png`,
        });
        await page.screenshot({
          path: `${SHOTS}/${e.slug}-${viewport.label}-full.png`,
          fullPage: true,
        });
      });
    }

    test("The Roster's website text becomes sections, and its full text waits in Sources", async ({
      page,
    }) => {
      const details = await theSharedPage(page, EXAMPLES[2]);
      await expect(
        details.getByTestId("place-section-food-drink"),
      ).toContainText("Local craft beer on tap");
      await expect(
        details.getByTestId("place-section-activities"),
      ).toContainText("Uneekor simulators");
      await expect(
        details.getByTestId("place-section-amenities"),
      ).toContainText("Dog-friendly patio");
      // Contact holds the number and the site; the sections don't repeat them.
      await expect(details.getByTestId("place-contact")).toContainText(
        "(250) 549-0444",
      );
      await expect(details.getByTestId("place-website")).toHaveText(
        "rostersvernon.com",
      );
      // The long passage is folded until somebody asks for it.
      const sources = details.getByTestId("place-sources");
      const full = sources.getByText(/Leagues run through the fall/);
      await expect(full).toBeHidden();
      await sources.getByText("Sources & accuracy").click();
      await expect(full).toBeVisible();
      await expect(sources).toContainText("rostersvernon.com");
    });

    test("an Atlas Place page shares the same frame (Kalamalka Lake)", async ({
      page,
    }) => {
      await page.goto("/places/dd65260a-277c-4fc4-b9c8-404c4464f6d6");
      const details = page.getByTestId("place-details");
      await expect(
        details.getByRole("heading", { level: 1, name: "Kalamalka Lake" }),
      ).toBeVisible();
      await expect(details.getByTestId("place-add-to-day")).toHaveAttribute(
        "href",
        "/go?with=dd65260a-277c-4fc4-b9c8-404c4464f6d6",
      );
      await expect(details.getByTestId("place-directions")).toBeVisible();
      await expect(details.getByTestId("place-sources")).toContainText(
        "1 source",
      );
      // The raw list the old page led with is gone: no coordinates printed.
      await expect(details).not.toContainText("Coordinates");
      await fitsTheScreen(page);
      await page.screenshot({
        path: `${SHOTS}/kalamalka-lake-${viewport.label}-full.png`,
        fullPage: true,
      });
    });

    test("Close by offers other places from Discovery's pool", async ({
      page,
    }) => {
      const details = await theSharedPage(page, EXAMPLES[1]);
      const nearby = details.getByTestId("place-nearby");
      await expect(nearby).toBeVisible();
      await expect(nearby.getByRole("link").first()).toHaveAttribute(
        "href",
        /^\/(places|passport)\//,
      );
    });
  });
}
