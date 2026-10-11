import { test, expect, type Page } from "@playwright/test";

/**
 * **The printable adventure, in a real browser and on real paper sizes.**
 *
 * The unit tests cover what the page says. These cover what only a browser
 * can check: that the page fits a phone, that print mode hides the controls
 * and spends no ink on backgrounds, and that Chromium can lay it out as an A4
 * and a Letter PDF.
 *
 * `/adventure/sample` is used because it needs no Atlas. It is built from a
 * fixed pool by the real planner, so it is the same on every machine.
 */

const SAMPLE = "/adventure/sample";

/** Pixels at 96 dpi for a millimetre width. */
const mm = (n: number) => Math.floor((n / 25.4) * 96);

/** Elements that would put ink on the page through a background. */
async function inkedBackgrounds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const clear = new Set([
      "rgba(0, 0, 0, 0)",
      "transparent",
      "rgb(255, 255, 255)",
    ]);
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // A hairline accent rule is a mark, not a fill. Anything the size of
      // a button or a band is what drains a cartridge.
      if (rect.width * rect.height < 400) continue;
      if (!clear.has(style.backgroundColor) || style.backgroundImage !== "none")
        out.push(
          `${el.tagName.toLowerCase()}.${el.className}: ${style.backgroundColor} ${style.backgroundImage}`,
        );
    }
    return out;
  });
}

test.describe("printable adventure", () => {
  test("the sample has a clear print action and every section", async ({
    page,
  }) => {
    await page.goto(SAMPLE);
    await expect(
      page.getByRole("button", { name: "Print Your Adventure" }),
    ).toBeVisible();
    await expect(page.getByTestId("adventure-sample-note")).toBeVisible();
    await expect(page.getByTestId("adventure-glance")).toBeVisible();
    await expect(page.getByTestId("adventure-prep")).toBeVisible();
    expect(await page.getByTestId("guide-stop").count()).toBeGreaterThan(1);
    await expect(page.getByTestId("adventure-quests")).toBeVisible();
    await expect(page.getByTestId("adventure-memories")).toBeVisible();
    // The field guide: the route, the sky, and a card to carry.
    await expect(page.getByTestId("adventure-route")).toBeVisible();
    await expect(page.getByTestId("adventure-weather")).toBeVisible();
    await expect(page.getByTestId("adventure-forecast-blank")).toBeVisible();
    await expect(page.getByTestId("adventure-pocket")).toBeVisible();
  });

  test("the pocket card and every leg survive print mode", async ({ page }) => {
    await page.goto(SAMPLE);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("adventure-pocket")).toBeVisible();
    await expect(page.getByTestId("adventure-legs")).toBeVisible();
    // The sample starts in Vernon and has no positions: every leg is there,
    // home included, and not one of them has a distance or a time.
    const legs = page.getByTestId("adventure-leg");
    expect(await legs.count()).toBeGreaterThan(2);
    await expect(legs.last()).toContainText("(home)");
    for (const text of await legs.allTextContents()) {
      expect(text).toContain("Not measured");
      expect(text).not.toMatch(/\d+\s*min/);
    }
  });

  test("fits a phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(SAMPLE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const button = page.getByRole("button", { name: "Print Your Adventure" });
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  for (const [paper, widthMm] of [
    ["A4", 210],
    ["Letter", 216],
  ] as const) {
    test(`print mode on ${paper}: no controls, no ink-heavy backgrounds, nothing wider than the paper`, async ({
      page,
    }) => {
      // The printable width inside the 14 mm @page margins.
      await page.setViewportSize({
        width: mm(widthMm - 28),
        height: 1000,
      });
      await page.goto(SAMPLE);
      await page.emulateMedia({ media: "print" });

      await expect(
        page.getByRole("button", { name: "Print Your Adventure" }),
      ).toBeHidden();
      expect(await inkedBackgrounds(page)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test(`lays out as a ${paper} PDF`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "page.pdf is Chromium-only");
      await page.goto(SAMPLE);
      const pdf = await page.pdf({ format: paper, printBackground: false });
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      // Long enough to be the whole guide, short enough to carry.
      expect(pdf.length).toBeGreaterThan(10_000);
    });
  }

  test("print CSS is in the server HTML, not waiting on JavaScript", async ({
    browser,
  }) => {
    // Found by printing it: the rules were injected on hydration, so a page
    // printed before the script ran printed its own toolbar. With scripts
    // off, nothing can hydrate, and one check with no retry has to pass.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(SAMPLE);
    await page.emulateMedia({ media: "print" });
    expect(
      await page
        .getByRole("button", { name: "Print Your Adventure" })
        .isVisible(),
    ).toBe(false);
    await context.close();
  });

  test("/go/print with nothing chosen sends you to build a day", async ({
    page,
  }) => {
    await page.goto("/go/print");
    await expect(
      page.getByRole("link", { name: /build a day first/i }),
    ).toHaveAttribute("href", "/go");
  });
});
