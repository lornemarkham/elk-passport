import { expect, test, type Page } from "@playwright/test";

/**
 * **Universal location: nobody picks a city before they can explore.**
 *
 * Runs against a server with an Atlas stand-in that measures distances from
 * the origin it is sent (`E2E_ATLAS=1`), so "changing the place changes the
 * results" is checked against what Atlas was asked, not the label.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

const bar = (page: Page) => page.getByTestId("location-bar").first();
const name = (page: Page) => page.getByTestId("location-name").first();

async function change(page: Page, id: string, query: string) {
  await page.getByTestId("location-change").first().click();
  await expect(page.getByTestId("location-picker")).toBeVisible();
  await page.getByTestId("location-search").fill(query);
  await page.getByTestId(`location-option-${id}`).click();
  await expect(page.getByTestId("location-picker")).toHaveCount(0);
}

/** The cards on screen, in order. */
const cards = (page: Page) =>
  page
    .getByTestId("possibility")
    .evaluateAll((els) =>
      els.slice(0, 40).map((e) => e.querySelector("h3")?.textContent ?? ""),
    );

/** Every geolocation request the page makes — there must be none unasked. */
const countGeolocation = (page: Page) =>
  page.addInitScript(() => {
    (window as unknown as { __geo: number }).__geo = 0;
    const real = navigator.geolocation?.getCurrentPosition?.bind(
      navigator.geolocation,
    );
    if (real)
      navigator.geolocation.getCurrentPosition = (...args) => {
        (window as unknown as { __geo: number }).__geo++;
        return real(...args);
      };
  });
const geoCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __geo: number }).__geo);

for (const [label, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test.describe(`${label}`, () => {
    test.use({
      viewport,
      ...(label === "phone" ? { hasTouch: true, isMobile: true } : {}),
    });

    test("first-time visitor: a place is assumed, labelled approximate, and nothing is asked", async ({
      page,
    }) => {
      await countGeolocation(page);
      await page.goto("/discovery");
      await expect(name(page)).toContainText(/^Around .*, BC$/);
      await expect(bar(page)).toContainText("approximate");
      await expect(page.getByTestId("location-change").first()).toBeVisible();
      // No city-selection screen, no giant row of town pills, no prompt.
      await expect(page.getByTestId("location-picker")).toHaveCount(0);
      expect(await geoCalls(page)).toBe(0);
      if (WITH_ATLAS)
        await expect(page.getByTestId("possibility").first()).toBeVisible({
          timeout: 30_000,
        });
    });

    test("Change opens a searchable picker; choosing is remembered by a returning visitor", async ({
      page,
    }) => {
      await page.goto("/discovery");
      await change(page, "kelowna", "kelow");
      await expect(name(page)).toHaveText("Kelowna, BC");
      await expect(bar(page)).not.toContainText("approximate");

      await page.reload();
      await expect(name(page)).toHaveText("Kelowna, BC");
      // And every other experience opens on it too.
      await page.goto("/snow/mountains");
      await expect(name(page)).toHaveText("Kelowna, BC");
      await page.goto("/go");
      await expect(name(page)).toHaveText("Kelowna, BC");
    });

    test("an unknown city is said, not guessed", async ({ page }) => {
      await page.goto("/discovery");
      await page.getByTestId("location-change").first().click();
      await page.getByTestId("location-search").fill("zzzzqq");
      await expect(page.getByTestId("location-results")).toContainText(
        "doesn't know a place called",
      );
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("location-picker")).toHaveCount(0);
    });

    test("Vernon → Kelowna → Vancouver: Discovery's results actually change", async ({
      page,
    }) => {
      test.skip(!WITH_ATLAS, "needs the Atlas stand-in");
      test.setTimeout(120_000);
      const asked: number[] = [];
      page.on("request", (r) => {
        if (r.url().endsWith("/api/discovery/distance"))
          asked.push(JSON.parse(r.postData() ?? "{}").longitude);
      });
      await page.goto("/discovery");
      const seen: Record<string, string[]> = {};
      for (const [id, query, lng] of [
        ["vernon", "vernon", -119.27],
        ["kelowna", "kelowna", -119.49],
        ["vancouver", "vancouver", -123.12],
      ] as const) {
        await change(page, id, query);
        // Atlas was asked from this place (not merely relabelled).
        await expect
          .poll(() => asked.some((x) => Math.abs(x - lng) < 0.5), {
            timeout: 30_000,
          })
          .toBe(true);
        await expect(page.getByTestId("possibility").first()).toBeVisible();
        // Wait for the measured reading to land on the cards.
        await expect(page.getByText(/Measuring from/).first()).toHaveCount(0, {
          timeout: 30_000,
        });
        seen[id] = await cards(page);
        expect(seen[id]!.length).toBeGreaterThan(0);
      }
      // Different places, different cards — not the same list relabelled.
      expect(seen["vernon"]).not.toEqual(seen["vancouver"]);
      expect(seen["kelowna"]).not.toEqual(seen["vancouver"]);
    });

    test("Christmas: the address carries the place, and a change re-asks Atlas", async ({
      page,
    }) => {
      await page.goto("/christmas");
      await expect(page).toHaveURL(/at=[a-z-]+/, { timeout: 15_000 });
      await expect(page.getByTestId("town-chips")).toHaveCount(0);
      await expect(name(page)).toContainText("Around");
      await change(page, "kelowna", "kelowna");
      await expect(page).toHaveURL(/at=kelowna/);
      await expect(page.getByTestId("cta-discover")).toContainText("Kelowna");
      await change(page, "vancouver", "vancouver");
      await expect(page).toHaveURL(/at=vancouver/);
      await expect(page.getByTestId("cta-discover")).toContainText("Vancouver");
      // "Explore another destination" is only for Christmas.
      await page.getByTestId("location-change").first().click();
      await page.getByTestId("location-only-here").check();
      await page.getByTestId("location-search").fill("vernon");
      await page.getByTestId("location-option-vernon").click();
      await expect(bar(page)).toContainText("just for Christmas");
      await page.goto("/snow/mountains");
      await expect(name(page)).toHaveText("Vancouver, BC");
    });

    test("Snow: mountains are nearest-first from the shared place", async ({
      page,
    }) => {
      await page.goto("/snow/mountains");
      await change(page, "vancouver", "vancouver");
      await expect(
        page.getByTestId("mountain-list").getByRole("listitem").first(),
      ).toContainText("Grouse");
      await change(page, "kelowna", "kelowna");
      await expect(
        page.getByTestId("mountain-list").getByRole("listitem").first(),
      ).not.toContainText("Grouse");
    });

    test("Go: the day starts from the place on the bar, no 'where?' gate", async ({
      page,
    }) => {
      await page.goto("/go");
      await change(page, "kelowna", "kelowna");
      await page
        .getByRole("textbox")
        .first()
        .fill("A few hours outside this afternoon");
      await page.getByTestId("go-build").click();
      await expect(page.getByTestId("go-where")).toHaveCount(0);
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Kelowna",
      );
    });
  });
}

test.describe("permission", () => {
  test("already granted: opens on the browser's position, with no prompt", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      permissions: ["geolocation"],
      geolocation: { latitude: 49.2827, longitude: -123.1207 },
    });
    const page = await context.newPage();
    await page.goto("/discovery");
    await expect(name(page)).toContainText("Vancouver");
    await expect(name(page)).not.toContainText("Around");
    await context.close();
  });

  test("denied: never asked again, falls back to the region and says so", async ({
    browser,
  }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await countGeolocation(page);
    await page.goto("/discovery");
    await expect(name(page)).toContainText("Around");
    expect(await geoCalls(page)).toBe(0);
    // The person asks: the browser says no, and Passport says so plainly.
    await context.grantPermissions([]);
    await page.getByTestId("location-change").first().click();
    await page.getByTestId("location-use-mine").click();
    await expect(page.getByRole("status")).toContainText(/location|city/);
    await context.close();
  });

  test("Use my location, when they ask: nearest covered town, no longer approximate", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      geolocation: { latitude: 50.2, longitude: -119.3 },
      permissions: ["geolocation"],
    });
    const page = await context.newPage();
    await page.goto("/discovery");
    await change(page, "vancouver", "vancouver");
    await page.getByTestId("location-change").first().click();
    await page.getByTestId("location-use-mine").click();
    await expect(name(page)).not.toContainText("Vancouver");
    await expect(bar(page)).not.toContainText("approximate");
    await context.close();
  });
});
