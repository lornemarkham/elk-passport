import { test, expect, devices, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * **Discovery cards that carry Atlas's labelled picture keep their name.**
 *
 * Runs against `next start` whose `ATLAS_API_URL` serves a body holding the
 * real production records (Fall Pumpkin Patch at Aldor Acres, Pumpkin Patch at
 * Green Croft Gardens, Spookley Meet & Greet, ...), with `E2E_ATLAS=1`.
 * `SHOTS_DIR=<dir>` writes a screenshot per form; the same spec run against
 * the code before the fix produces the "before" set (and fails).
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";
const SHOTS = process.env.SHOTS_DIR;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _browser, ...PIXEL } = devices["Pixel 7"];
const forms = [
  { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  { name: "mobile", use: PIXEL },
] as const;

const TITLES = [
  "Fall Pumpkin Patch",
  "Pumpkin Patch",
  "Aldor Acres Family Farm",
  "Green Croft Gardens",
];

async function open(page: Page, q = "pumpkin patch") {
  await page.goto(`/discovery?q=${encodeURIComponent(q)}`);
  await expect(page.getByTestId("possibility").first()).toBeVisible({
    timeout: 60_000,
  });
}

for (const form of forms) {
  test.describe(`card titles — ${form.name}`, () => {
    test.use(form.use);
    test.skip(!WITH_ATLAS, "needs a server with Atlas candidates");

    test("every real production example shows its name and nothing overflows", async ({
      page,
    }) => {
      await open(page);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({
          path: `${SHOTS}/${form.name}-page.png`,
          fullPage: false,
        });
      }

      for (const title of TITLES) {
        // By its own name: one search leads with at most six name matches
        // (ADR 006), and Green Croft only says "pumpkin patch" in its
        // description.
        await open(page, title);
        const named = page.getByTestId("possibility").filter({
          has: page
            .getByRole("heading", { name: title, exact: true })
            .or(page.getByRole("link", { name: title, exact: true })),
        });
        // Aldor Acres is in Langley, and a local page holds other areas back
        // until the reader asks for them (`area.ts`), as a reader would.
        const further = page.getByTestId("further-afield");
        if (!(await named.count()) && (await further.count()))
          await further.first().click();
        // The picture card when the corpus has two of one name, so the
        // before-the-fix bug (a picture and no heading) is what is looked at.
        for (let i = 0; i < 10 && !(await named.count()); i++) {
          const more = page.getByTestId("show-more-results");
          if (!(await more.count())) break;
          await more.click();
        }
        const pictured = named.filter({ has: page.locator("img") });
        const card = ((await pictured.count()) ? pictured : named).first();
        await card.scrollIntoViewIfNeeded();
        if (SHOTS)
          await card.screenshot({
            path: `${SHOTS}/${form.name}-${title.replace(/\W+/g, "-")}.png`,
          });
        await expect
          .soft(
            card.getByRole("heading", { name: title, exact: true }),
            `${title} has a heading`,
          )
          .toBeVisible();
      }
    });

    test("Spookley Meet & Greet, with no picture at all, leads with its name and kind", async ({
      page,
    }) => {
      await open(page, "Spookley");
      const card = page
        .getByTestId("possibility")
        .filter({ hasText: "Spookley Meet & Greet" })
        .first();
      await card.scrollIntoViewIfNeeded();
      if (SHOTS)
        await card.screenshot({ path: `${SHOTS}/${form.name}-Spookley.png` });
      await expect(card.getByRole("heading")).toHaveText(
        "Spookley Meet & Greet",
      );
      await expect(card.getByTestId("possibility-text-lead")).toContainText(
        "Meet & Greet",
      );
    });

    test("a label never leaves its picture, and no card scrolls sideways", async ({
      page,
    }) => {
      await open(page);
      const cards = page.getByTestId("possibility");
      const n = await cards.count();
      for (let i = 0; i < n; i++) {
        const card = cards.nth(i);
        const over = await card.evaluate(
          (el) => el.scrollWidth - el.clientWidth,
        );
        expect
          .soft(over, `card ${i} overflows sideways`)
          .toBeLessThanOrEqual(1);
        const label = card.getByTestId("possibility-presented-label");
        if (await label.count()) {
          const l = (await label.boundingBox())!;
          const img = (await card.locator("img").first().boundingBox())!;
          expect.soft(l.x).toBeGreaterThanOrEqual(img.x);
          expect
            .soft(l.x + l.width)
            .toBeLessThanOrEqual(img.x + img.width + 0.5);
          expect
            .soft(l.y + l.height)
            .toBeLessThanOrEqual(img.y + img.height + 0.5);
        }
      }
    });

    test("an illustrative photo is not repeated within a row", async ({
      page,
    }) => {
      await open(page);
      const lists = page.locator("ul:has(> [data-testid='possibility'])");
      for (let i = 0; i < (await lists.count()); i++) {
        const srcs = await lists
          .nth(i)
          .locator(
            "[data-testid='possibility'] img[data-relationship='category'], [data-testid='possibility'] img[data-relationship='representative']",
          )
          .evaluateAll((imgs) => imgs.map((e) => (e as HTMLImageElement).src));
        expect(new Set(srcs).size, `row ${i} repeats a photo`).toBe(
          srcs.length,
        );
      }
    });
  });
}
