import { test, expect, devices, type Page } from "@playwright/test";

/**
 * **The family-test release candidate, in a real browser.**
 *
 * The journeys that cross the two halves that were built apart — the Day
 * Builder (keep, Undo, the clock, keep-this-day, print) and the intent fixes
 * (a start is required, a request is not a suggestion, minutes are an
 * estimate) — on a desktop and a phone.
 *
 * Runs like `go-intent.spec.ts`: against `next start` whose `ATLAS_API_URL`
 * is the stand-in (`e2e/support/atlas-standin.mjs`) serving the committed
 * critic fixture, with `E2E_ATLAS=1`. **Every place is real Atlas data; the
 * server is not Atlas, and no travel time here is a route.**
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

// A phone without `defaultBrowserType`, which cannot change inside a describe.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _browser, ...PIXEL } = devices["Pixel 7"];
const forms = [
  { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  { name: "mobile", use: PIXEL },
] as const;

/** Vernon Aquatic Center: Atlas states the locality, and no coordinates. */
const UNPLACED_ID = "04986cc2-c926-4740-a5ef-7253493719c3";

async function open(page: Page, path = "/go") {
  await page.goto(path);
  await expect(page.getByTestId("go-say")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function say(page: Page, sentence: string) {
  await page.getByTestId("go-say").fill(sentence);
  await page.getByTestId("go-build").click();
}

async function change(page: Page, sentence: string) {
  await page.getByTestId("go-change").fill(sentence);
  await page.getByTestId("go-change-submit").click();
}

const stops = (page: Page) => page.locator('[data-testid="go-stop"] h3');
const titles = (page: Page) => stops(page).allTextContents();

for (const form of forms) {
  test.describe(`release candidate — ${form.name}`, () => {
    test.use(form.use);
    test.skip(!WITH_ATLAS, "needs a server with Atlas places");

    test("a kept stop survives every revision, Undo takes back one step at a time, and a reload keeps the shaped day", async ({
      page,
    }) => {
      await open(page, "/go?at=vernon");
      await say(page, "Half a day near Vernon");
      await expect(stops(page).first()).toBeVisible();
      const kept = (await stops(page).first().textContent())!;
      await page.getByTestId("go-keep-1").click();

      await change(page, "No museums");
      await expect(page.getByTestId("go-working-from")).toContainText(
        "no museums",
      );
      await change(page, "Keep us indoors");
      await expect(page.getByTestId("go-working-from")).toContainText(
        "Under cover",
      );
      await expect(stops(page).filter({ hasText: kept })).toHaveCount(1);

      // Undo takes back the last change only.
      await page.getByTestId("go-undo").click();
      await expect(page.getByTestId("go-reply")).toContainText("Taken back");
      await expect(page.getByTestId("go-working-from")).not.toContainText(
        "Under cover",
      );
      await expect(page.getByTestId("go-working-from")).toContainText(
        "no museums",
      );
      await expect(stops(page).filter({ hasText: kept })).toHaveCount(1);

      // A town change keeps it too, and then the whole shaped day survives a
      // reload (this tab's storage, nothing sent).
      await change(page, "Let's do Kelowna instead");
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Kelowna",
      );
      await expect(stops(page).filter({ hasText: kept })).toHaveCount(1);
      const shaped = await titles(page);
      await page.reload();
      await expect
        .poll(() => titles(page), { timeout: 20_000 })
        .toEqual(shaped);
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Kelowna",
      );

      // And the paper is the same day.
      await page.getByTestId("go-print").click();
      await expect(page).toHaveURL(/\/go\/print\?/);
      const onPaper = await page.getByTestId("guide-stop").allTextContents();
      expect(onPaper).toHaveLength(shaped.length);
      for (const [i, title] of shaped.entries())
        expect(onPaper[i]).toContain(title);
    });

    test("no town: it asks, the town chosen is kept through a new sentence and a new age", async ({
      page,
    }) => {
      await open(page);
      await say(page, "A few hours outside with the kids");
      await expect(page.getByTestId("go-where")).toBeVisible();
      await expect(stops(page)).toHaveCount(0);
      // Location is offered, never asked for unprompted.
      await expect(page.getByTestId("go-start-nearest")).toHaveCount(0);
      await page.getByTestId("go-start-vernon").click();
      await expect(stops(page).first()).toBeVisible();

      await say(page, "Three hours, no hiking");
      await expect(page.getByTestId("go-where")).toHaveCount(0);
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Vernon",
      );

      test.setTimeout(90_000);
      await change(page, "youngest is 8");
      await expect(page).toHaveURL(/at=vernon/);
      await expect(page.getByTestId("go-working-from")).toContainText(
        /8-year-old/,
        { timeout: 45_000 },
      );
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Vernon",
      );

      // Back at /go in this tab, the shaped day (and its town) is still here.
      await page.goto("/go");
      await expect(page.getByTestId("go-working-from")).toContainText(
        "From Vernon",
      );

      // A new tab on this device: Vernon is offered — and still not applied.
      const next = await page.context().newPage();
      await next.goto("/go");
      await expect(async () => {
        await say(next, "Something outside this afternoon");
        await expect(next.getByTestId("go-where")).toBeVisible({
          timeout: 1_000,
        });
      }).toPass({ timeout: 20_000 });
      await expect(stops(next)).toHaveCount(0);
      await expect(next.getByTestId("go-start-last")).toContainText("Vernon");
    });

    test("shark diving: said first, nothing swapped in, and planning without it is the person's call", async ({
      page,
    }) => {
      await open(page, "/go?at=kelowna");
      await say(page, "Shark diving this afternoon");
      const notFound = page.getByTestId("go-not-found");
      await expect(notFound).toBeVisible();
      await expect(notFound).toContainText(/sharks/i);
      await expect(stops(page)).toHaveCount(0);
      await expect(page.getByTestId("go-print")).toHaveCount(0);

      await page.getByTestId("go-without-sharks").click();
      await expect(stops(page).first()).toBeVisible();
      await expect(page.getByTestId("go-working-from")).toContainText(
        "planning without sharks",
      );
      // Taking it back puts the request back on the page.
      await page.getByTestId("go-undo").click();
      await expect(page.getByTestId("go-not-found")).toBeVisible();
      await expect(stops(page)).toHaveCount(0);
    });

    test("partly available: scuba is built, sharks are said before the stops, and the paper prints the day", async ({
      page,
    }) => {
      await open(page, "/go?at=kelowna");
      await say(page, "Scuba diving with sharks this afternoon");
      const notFound = page.getByTestId("go-not-found");
      await expect(notFound).toBeVisible();
      await expect(notFound).toContainText(/sharks/i);
      await expect(stops(page).first()).toBeVisible();
      // Said before anything is offered: the notice precedes the first stop.
      const said = await notFound.boundingBox();
      const first = await stops(page).first().boundingBox();
      expect(said!.y).toBeLessThan(first!.y);

      const shaped = await titles(page);
      await page.getByTestId("go-print").click();
      await expect(page).toHaveURL(/\/go\/print\?/);
      const onPaper = await page.getByTestId("guide-stop").allTextContents();
      expect(onPaper).toHaveLength(shaped.length);
    });

    test("“within 30 minutes” is a labelled search estimate, never a drive time", async ({
      page,
    }) => {
      await open(page, "/go?at=vernon");
      await say(page, "Within 30 minutes, a couple of hours");
      const chip = page.getByTestId("go-working-from");
      await expect(chip).toContainText(/48 km\/h/);
      await expect(chip).toContainText("a search estimate, not a drive time");
      // The circle's minutes never become a leg's minutes: legs come only
      // from routing (here, the stand-in's) or say they are straight lines.
      // That is enforced in code — `kmForMinutes` has one caller, the brief.
    });

    test("a picked place with no coordinates stays in the day and its travel is not invented", async ({
      page,
    }) => {
      await open(page, `/go?with=${UNPLACED_ID}&at=vernon`);
      const picked = stops(page).filter({ hasText: /Vernon Aquatic/i });
      await expect(picked).toHaveCount(1);
      const text = (await page.getByTestId("go-day").textContent()) ?? "";
      expect(text).not.toMatch(/Vernon Aquatic[^.]*\b\d+ min drive/i);
      await page.getByTestId("go-print").click();
      await expect(page.getByTestId("guide-stop").first()).toBeVisible();
      expect(
        (await page.getByTestId("guide-stop").allTextContents()).join(" "),
      ).toMatch(/Vernon Aquatic/i);
    });

    test("the first result is on screen as soon as Build is pressed", async ({
      page,
    }) => {
      await open(page, "/go?at=vernon");
      await say(page, "Two hours near Vernon");
      const result = page.locator("#go-result");
      await expect(result).toBeVisible();
      await expect(stops(page).first()).toBeInViewport({ timeout: 5_000 });
    });
  });
}
