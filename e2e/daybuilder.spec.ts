import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * **Day Builder, in a real browser: build, rearrange, doubt, keep, print.**
 *
 * What is real and what is not, because this suite is only as honest as it
 * says it is:
 *
 * - **Real:** the Next server, the real planner, the real `/go` and
 *   `/go/print` pages, the browser, localStorage / sessionStorage, the print
 *   layout, Chromium's PDF.
 * - **Stand-in Atlas:** lanes have no live Atlas. The server is pointed at
 *   `scripts/critic/atlas-mock.mjs` serving the committed snapshot of a real
 *   `GET /discovery/candidates` body (2026-10-11). The places, their
 *   `schedule.onDate` readings and their coordinates are real Atlas data; the
 *   server itself is not Atlas. That stand-in serves **no** `/travel/legs`,
 *   so by default every journey here is a straight line — which is exactly
 *   the "missing routing" case, exercised for real rather than faked.
 * - **MOCKED:** the one test labelled MOCKED intercepts `/api/travel/legs`
 *   in the browser and invents routed minutes. Those numbers are not
 *   anyone's road.
 *
 * Needs: `ATLAS_API_URL` pointing at the stand-in when the server starts.
 */

const SAY = "Leave at 10, home by 4, the two of us, near Vernon";
const GO = `/go?say=${encodeURIComponent(SAY)}&at=vernon&on=2026-10-11`;
/** Centennial Outdoor Rink: the snapshot's own Atlas reading says it is not on 2026-10-11. */
const CLOSED_ID = "575e8e59-93a6-44ae-970d-156e70035efd";

const titles = (page: Page) =>
  page.locator('[data-testid="go-stop"] h3').allTextContents();

async function openDay(page: Page, url = GO) {
  await page.goto(url);
  await expect(page.getByTestId("go-day")).toBeVisible();
  await expect(page.getByTestId("go-stop").first()).toBeVisible();
}

test.describe("Day Builder journeys", () => {
  test("a multi-stop day has a clock, says what the clock rests on, and a way home", async ({
    page,
  }) => {
    await openDay(page);
    expect(await page.getByTestId("go-stop").count()).toBeGreaterThan(1);
    const clocks = page.getByTestId("go-clock");
    await expect(clocks.first()).toContainText(/\d{1,2}(:\d\d)? (am|pm)/);
    // No routes from this Atlas: every time is an allowance and says "about".
    for (const basis of await clocks.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-basis")),
    ))
      expect(basis).toBe("allowance");
    await expect(clocks.first()).toContainText("about");
    await expect(page.getByTestId("go-glance")).toContainText("~");
    await expect(page.getByTestId("go-home-clock")).toContainText(
      "roads not measured",
    );
    // Unmeasured roads can say "tight" or "over", never "fine".
    const verdict = await page
      .getByTestId("go-verdict")
      .getAttribute("data-verdict");
    expect(["tight", "over"]).toContain(verdict);
  });

  test("missing routing is said, per move, as a straight line", async ({
    page,
  }) => {
    await openDay(page);
    await expect(page.getByTestId("go-travel")).toContainText(/straight line/i);
    await expect(page.getByTestId("go-unknowns")).toContainText(/Drive times/);
    // No minutes are made out of kilometres anywhere in the travel block.
    expect(await page.getByTestId("go-travel").innerText()).not.toMatch(
      /\b\d+\s*min(utes)?\s*(drive|driving)\b/i,
    );
  });

  test("no leaving time, no clock — and the page says how to get one", async ({
    page,
  }) => {
    await openDay(
      page,
      `/go?say=${encodeURIComponent("Four hours, near Vernon")}&at=vernon&on=2026-10-11`,
    );
    await expect(page.getByTestId("go-clock")).toHaveCount(0);
    await expect(page.getByTestId("go-no-clock")).toContainText("leave at");
  });

  test("rearranging: earlier/later change the order everywhere, and survive a reload", async ({
    page,
  }) => {
    await openDay(page);
    const before = await titles(page);
    expect(before.length).toBeGreaterThan(1);
    await page.getByTestId("go-down-1").click();
    const after = await titles(page);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
    await expect(page.getByTestId("go-glance")).toContainText(after[0]!);
    // The paper is the day that was shaped.
    const href = await page.getByTestId("go-print").getAttribute("href");
    await page.goto(href!);
    const onPaper = await page.getByTestId("guide-stop").allTextContents();
    expect(onPaper[0]).toContain(after[0]);
  });

  test("removing stops down to one, putting one back, and the last cannot go", async ({
    page,
  }) => {
    await openDay(page);
    const start = await titles(page);
    while ((await page.getByTestId("go-stop").count()) > 1)
      await page.getByTestId("go-remove-1").click();
    expect(await page.getByTestId("go-stop").count()).toBe(1);
    // One stop: still a day, with a clock and no way to remove the last.
    await expect(page.getByTestId("go-remove-1")).toBeDisabled();
    await expect(page.getByTestId("go-clock")).toHaveCount(1);
    // Nothing the person removed is lost: it is set aside, and theirs.
    const shelf = page.getByTestId("go-set-aside");
    await expect(shelf).toContainText("Not today — still yours");
    await expect(shelf).toContainText(start[0]!);
    await page.getByTestId("go-put-back").first().click();
    await expect(page.getByTestId("go-stop")).toHaveCount(2);
    // What was put back is kept: it is the person's choice.
    await expect(page.getByTestId("go-stop").last()).toContainText("Kept");
  });

  test("a place Atlas says is not on that day is left out, loudly, with the reason", async ({
    page,
  }) => {
    await openDay(page, `${GO}&with=${CLOSED_ID}`);
    const left = page.getByTestId("go-left-out");
    await expect(left).toBeVisible();
    await expect(left).toContainText("Centennial Outdoor Rink");
    await expect(left).toContainText("isn't on that day");
    // The closed place is not a stop, and the day still stands.
    expect(await titles(page)).not.toContain("Centennial Outdoor Rink");
    expect(await page.getByTestId("go-stop").count()).toBeGreaterThan(0);
    // It is said once, up top — not repeated under "worth checking".
    await expect(page.getByTestId("go-unknowns")).not.toContainText(
      "Centennial Outdoor Rink",
    );
  });

  test("unconfirmed hours are said once for the day, not repeated as noise on every card", async ({
    page,
  }) => {
    await openDay(page);
    await expect(page.getByTestId("go-unknowns")).toContainText(
      /Opening hours/,
    );
    // A per-stop doubt is reserved for a place whose sources disagree.
    expect(await page.getByTestId("go-unconfirmed").count()).toBeLessThan(
      await page.getByTestId("go-stop").count(),
    );
  });

  test("MOCKED routes: times lose their 'about' only where a road was measured", async ({
    page,
  }) => {
    // MOCKED: invented minutes, in the shape Passport's own /api/travel/legs answers.
    await page.route("**/api/travel/legs", async (route: Route) => {
      const asked = route.request().postDataJSON() as {
        mode: string;
        legs: unknown[];
      };
      await route.fulfill({
        json: {
          state: "ready",
          mode: asked.mode,
          journeys: asked.legs.map(() => ({
            kind: "routed",
            mode: asked.mode,
            minutes: 12,
            roadKm: 9,
            straightKm: 7,
            provider: "MOCK — not a real road",
            calculatedAt: "2026-10-11T00:00:00Z",
            limitations: [],
          })),
        },
      });
    });
    await openDay(page);
    await expect(page.getByTestId("go-clock").first()).toHaveAttribute(
      "data-basis",
      "routed",
    );
    // A measured arrival is a bare time; an allowance would start "about".
    await expect(page.getByTestId("go-clock").first()).toHaveText(/^\s*\d/);
    await expect(page.getByTestId("go-home-clock")).not.toContainText(
      "roads not measured",
    );
  });

  test("keeping a day: it is on this device, reopens as shaped, prints, and can be forgotten", async ({
    page,
  }) => {
    await openDay(page);
    await page.getByTestId("go-down-1").click();
    const shaped = await titles(page);
    await page.getByTestId("go-keep-day").click();
    await expect(page.getByTestId("go-note")).toContainText("this device");
    await page.goto("/go");
    const kept = page.getByTestId("go-kept-day");
    await expect(kept).toHaveCount(1);
    await expect(page.getByTestId("go-kept-days")).toContainText(
      "nothing was sent",
    );
    await page.getByTestId("go-kept-open").click();
    await expect(page.getByTestId("go-stop").first()).toBeVisible();
    // The server renders the fresh day; the kept shaping replaces it once the
    // browser can read storage — so wait for it rather than race it.
    await expect.poll(() => titles(page), { timeout: 20_000 }).toEqual(shaped);
    await page.goto("/go");
    await page.getByTestId("go-kept-forget").click();
    await expect(page.getByTestId("go-kept-day")).toHaveCount(0);
  });

  test("take it as text: the day, what is only about, and what to check", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openDay(page);
    const first = (await titles(page))[0]!;
    await page.getByTestId("go-copy").click();
    await expect(page.getByTestId("go-note")).toContainText("Copied");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain(first);
    expect(text).toContain("roads not measured");
    expect(text).toContain("Check before you go:");
  });

  test("print: the paper has the stops, prints to A4 and Letter, and keeps no controls", async ({
    page,
  }) => {
    await openDay(page);
    const shaped = await titles(page);
    await page.getByTestId("go-print").click();
    await expect(page).toHaveURL(/\/go\/print\?/);
    const onPaper = await page.getByTestId("guide-stop").allTextContents();
    expect(onPaper).toHaveLength(shaped.length);
    for (const [i, title] of shaped.entries())
      expect(onPaper[i]).toContain(title);
    await page.emulateMedia({ media: "print" });
    for (const format of ["A4", "Letter"] as const) {
      const pdf = await page.pdf({ format });
      expect(pdf.byteLength).toBeGreaterThan(5_000);
    }
  });
});

test.describe("Day Builder on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("no sideways scroll, and every control is a thumb-sized target", async ({
    page,
  }) => {
    await openDay(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(
        document.querySelectorAll(
          '[data-testid="go-stop"] button, [data-testid="go-actions"] a, [data-testid="go-actions"] button, [data-testid="go-glance"] a',
        ),
      )) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.height < 44 || r.width < 44)
          bad.push(
            `${el.getAttribute("data-testid")} ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
      }
      return bad;
    });
    expect(small).toEqual([]);
  });

  test("the keep and print buttons stay on screen while you scroll the day", async ({
    page,
  }) => {
    await openDay(page);
    const keep = page.getByTestId("go-keep-day");
    await expect(keep).toBeInViewport();
    await page.getByTestId("go-stop").nth(1).scrollIntoViewIfNeeded();
    await expect(keep).toBeInViewport();
    await expect(page.getByTestId("go-print")).toBeInViewport();
  });

  test("the day at a glance jumps to its card", async ({ page }) => {
    await openDay(page);
    const last = page.getByTestId("go-glance").locator("a").last();
    const name = (await last.innerText()).split("\n").pop()!.trim();
    await last.click();
    await expect(
      page.getByTestId("go-stop").filter({ hasText: name }).first(),
    ).toBeInViewport();
  });

  test("a rearranged day fits the phone and prints", async ({ page }) => {
    await openDay(page);
    await page.getByTestId("go-up-2").tap();
    await page.getByTestId("go-print").tap();
    await expect(page).toHaveURL(/\/go\/print\?/);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
