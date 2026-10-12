import { test, expect, devices, type Page } from "@playwright/test";

/**
 * **GO HAVE A DAY understands what people want — in a real browser.**
 *
 * The M200 audit's sentences, typed into `/go`, on a desktop and a phone.
 *
 * ## What this runs against
 *
 * Needs an Atlas that serves places. It does not mock the app: start `next
 * start` with `ATLAS_API_URL` pointing at an Atlas **or at a stand-in serving
 * a body Atlas really served** (the committed critic fixture,
 * `docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz`), then
 *
 *   E2E_ATLAS=1 E2E_PORT=3120 npx playwright test e2e/go-intent.spec.ts
 *
 * Without `E2E_ATLAS` the file skips itself — a green run on an Atlas-less
 * server would prove nothing. `E2E_ATLAS_DOWN=1` (against a server whose
 * Atlas answers 503) runs the outage test instead.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";
const ATLAS_DOWN = process.env.E2E_ATLAS_DOWN === "1";

// A phone's viewport, touch and user agent — not `defaultBrowserType`, which
// cannot change inside a describe.
const { defaultBrowserType: _browser, ...PIXEL } = devices["Pixel 7"];

const forms = [
  { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  { name: "mobile", use: PIXEL },
] as const;

async function open(page: Page, path = "/go") {
  await page.goto(path);
  await expect(page.getByTestId("go-say")).toBeVisible();
  // Let the page hydrate before typing: a controlled input loses early keys.
  await page.waitForLoadState("networkidle");
}

async function say(page: Page, sentence: string) {
  await page.getByTestId("go-say").fill(sentence);
  await page.getByTestId("go-build").click();
}

const stops = (page: Page) => page.locator('[data-testid="go-stop"] h3');

for (const form of forms) {
  test.describe(`GO HAVE A DAY intent — ${form.name}`, () => {
    test.use(form.use);
    test.skip(!WITH_ATLAS || ATLAS_DOWN, "needs a server with Atlas places");

    test("“Scuba diving with sharks tonight” is said back, not replaced", async ({
      page,
    }) => {
      await open(page, "/go?at=kelowna");
      await say(page, "Scuba diving with sharks tonight");
      await expect(page.getByTestId("go-not-found")).toBeVisible();
      await expect(page.getByTestId("go-not-found-says")).toContainText(
        /Nothing Atlas holds says it offers sharks/,
      );
      // Atlas has scuba diving near Kelowna but nothing about sharks: the day
      // is built around what exists, and the missing part is said first.
      await expect(stops(page).first()).toBeVisible();
      // The request is still on the page.
      await expect(page.getByTestId("go-working-from")).toContainText(/sharks/);
      await expect(page.getByTestId("go-say")).toHaveValue(
        "Scuba diving with sharks tonight",
      );
    });

    test("a request nothing offers builds no day at all", async ({ page }) => {
      await open(page, "/go?at=kelowna");
      await say(page, "Shark diving tonight");
      await expect(page.getByTestId("go-not-found")).toBeVisible();
      await expect(stops(page)).toHaveCount(0);
      await expect(page.getByTestId("go-say")).toHaveValue(
        "Shark diving tonight",
      );
    });

    test("“I have two hours free” is two hours, and not a $0 budget", async ({
      page,
    }) => {
      await open(page, "/go?at=vernon");
      await say(page, "I have two hours free");
      const from = page.getByTestId("go-working-from");
      await expect(from).toContainText("2 hours");
      await expect(from).not.toContainText(/\bFree\b/);
    });

    test("“I'll drive two hours for something special” is travel, not a short day", async ({
      page,
    }) => {
      await open(page, "/go?at=kelowna");
      await say(page, "I'll drive two hours for something special");
      const from = page.getByTestId("go-working-from");
      await expect(from).toContainText(/Up to 2 hours away/);
      await expect(from).not.toContainText(/^Working from2 hours/);
      await expect(page.getByTestId("go-unknowns")).toContainText(
        /not how long you have/,
      );
    });

    test("“Within 30 minutes of Kelowna” is minutes, labelled as an estimate", async ({
      page,
    }) => {
      await open(page);
      await say(page, "Within 30 minutes of Kelowna");
      const from = page.getByTestId("go-working-from");
      await expect(from).toContainText(/Up to 30 min away/);
      await expect(from).toContainText("From Kelowna");
      await expect(from).not.toContainText("within 30 km");
    });

    test("“Taking my family out this afternoon” asks where, then stays local", async ({
      page,
    }) => {
      await open(page);
      await say(page, "Taking my family out this afternoon");
      await expect(page.getByTestId("go-where")).toBeVisible();
      await expect(stops(page)).toHaveCount(0);
      await page.getByTestId("go-start-vernon").click();
      await expect(page.getByTestId("go-where")).toHaveCount(0);
      await expect(stops(page).first()).toBeVisible();
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Vernon",
      );
      // Nothing in the day is a province away.
      const kms = await page
        .locator('[data-testid="go-move"]')
        .allTextContents();
      for (const text of kms) {
        for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*km/g))
          expect(Number(m[1])).toBeLessThan(45);
      }
    });

    test("changing your mind: Kelowna, indoors, no museums, a new age — kept stop survives", async ({
      page,
    }) => {
      await open(page, "/go?at=vernon");
      await say(page, "Half a day near Vernon");
      await expect(stops(page).first()).toBeVisible();
      const kept = (await stops(page).first().textContent())!;
      await page.getByTestId("go-keep-1").click();

      const change = async (sentence: string) => {
        await page.getByTestId("go-change").fill(sentence);
        await page.getByTestId("go-change-submit").click();
      };

      await change("No museums");
      await expect(page.getByTestId("go-reply")).toContainText(/museums/);
      await change("Keep us indoors");
      await expect(page.getByTestId("go-reply")).toContainText(/under cover/i);
      await expect(page.getByTestId("go-unknowns")).toContainText(
        /Under cover/,
      );
      await change("Let's do Kelowna instead");
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Kelowna",
      );
      await expect(page.getByTestId("go-reply")).not.toContainText(
        /didn't catch/,
      );
      await expect(stops(page).filter({ hasText: kept }).first()).toBeVisible();

      // A new age asks Atlas again — and the shaped day goes with it.
      await change("youngest is 6");
      // Atlas's first read for a new age is slow (seconds), so wait for it.
      await expect(page).toHaveURL(/age=6/);
      test.setTimeout(90_000);
      await expect(page.getByTestId("go-working-from")).toContainText(
        /6-year-old/,
        { timeout: 45_000 },
      );
      await expect(stops(page).filter({ hasText: kept }).first()).toBeVisible();

      // Retyping the top box keeps what was kept, and can be taken back.
      await say(page, "three hours, no hiking");
      await expect(stops(page).filter({ hasText: kept }).first()).toBeVisible();
      await expect(page.getByTestId("go-undo")).toBeVisible();
    });
  });
}

test.describe("GO HAVE A DAY when Atlas is down", () => {
  test.skip(!ATLAS_DOWN, "needs a server whose Atlas answers 503");

  test("is an honest recovery state, not a 500", async ({ page }) => {
    const response = await page.goto("/go?say=a%20day%20near%20Vernon");
    expect(response?.status()).toBeLessThan(500);
    const recovery = page.getByTestId("atlas-recovery");
    await expect(recovery).toBeVisible();
    await expect(recovery).toContainText(/couldn.t reach Atlas/);
    await expect(page.getByTestId("atlas-recovery-said")).toHaveText(
      "a day near Vernon",
    );
    await expect(page.getByText("Something went badly wrong")).toHaveCount(0);
    await expect(page.getByTestId("atlas-recovery-retry")).toBeVisible();
  });

  test("the printed paper says the same", async ({ page }) => {
    const response = await page.goto(
      "/go/print?stops=whatever&say=a%20day%20near%20Vernon&at=vernon",
    );
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByTestId("atlas-recovery")).toBeVisible();
  });
});
