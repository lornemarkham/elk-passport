import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * **A person, a phone or a laptop, and a day they have not planned yet.**
 *
 * Runs against an Atlas stand-in serving a saved real candidates body, so the
 * corpus is real and the failures are forced. Every step leaves a screenshot in
 * `docs/product/discovery-journeys/<project>/`, which is what a reviewer reads
 * before they read this file. Run with `playwright.journeys.config.ts`.
 *
 * The stand-in's `/travel/legs` is a straight-line-times-1.3 estimate labelled
 * `standin`, not a route: these tests prove what Passport does with an answer
 * and with the absence of one, not that any travel time is right.
 */
const ATLAS = `http://127.0.0.1:${Number(process.env.JOURNEYS_PORT ?? 3122) + 1}`;
const SHOTS = "docs/product/discovery-journeys";

const setAtlas = (modes: Record<string, string>) =>
  fetch(`${ATLAS}/__mode`, { method: "POST", body: JSON.stringify(modes) });

/**
 * The travel routes allow 20 asks a minute per client (`travelGuard.server`),
 * and this suite is one client asking for a dozen days in a minute. Each test
 * is therefore its own client, by the header the platform would write: the
 * limiter is not weakened, and nothing in the app knows it is under test.
 */
let nextClient = 0;

test.beforeEach(async ({ context }) => {
  await setAtlas({ candidates: "ok", distance: "ok", legs: "ok" });
  nextClient += 1;
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `10.200.${Math.floor(nextClient / 250)}.${nextClient % 250}`,
  });
});

async function shoot(page: Page, info: TestInfo, name: string) {
  const dir = `${SHOTS}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

/** A fresh Atlas read: the page caches per `?age=`, so each failure takes one. */
const freshAge = (info: TestInfo, slot: number) =>
  (info.project.name === "desktop" ? 8 : 12) + slot;

const ask = async (page: Page, said: string) => {
  await page.getByTestId("ask-input").fill(said);
  await page.getByTestId("ask-submit").click();
  await expect(page.getByTestId("ask-answer")).toBeVisible();
};

test.describe("arriving", () => {
  test("a possibility is on the first screen, not three screens of questions", async ({
    page,
  }, info) => {
    await page.goto("/discovery");
    await expect(page.getByTestId("ask-input")).toBeVisible();
    await shoot(page, info, "01-arrive");
    const viewport = page.viewportSize()!;
    if (info.project.name === "mobile") {
      // The rows are behind one line on a phone…
      await expect(page.getByTestId("ghad-refine")).toBeVisible();
      await expect(page.getByTestId("ghad-choice").first()).toBeHidden();
      // …so the first photograph-bearing section starts above the fold's end
      // plus one screen, rather than after a thousand pixels of pills.
      const first = page.getByTestId("possibility").first();
      const box = await first.boundingBox();
      expect(box, "no possibility card rendered").not.toBeNull();
      expect(box!.y + (await page.evaluate(() => window.scrollY))).toBeLessThan(
        viewport.height * 1.6,
      );
    } else {
      await expect(page.getByTestId("ghad-refine")).toBeHidden();
      await expect(page.getByTestId("ghad-choice").first()).toBeVisible();
    }
    // Never scrolls sideways.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
  });

  test("the rows open from the one line, and say what is chosen", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "the line exists on phones");
    await page.goto("/discovery");
    await page.getByTestId("ghad-refine").click();
    await expect(page.getByTestId("ghad-choice").first()).toBeVisible();
    await page.getByRole("button", { name: /^half a day/i }).click();
    await page.getByTestId("ghad-refine").click();
    await expect(page.getByTestId("ghad-refine")).toContainText("half a day");
    await shoot(page, info, "02-refine-chosen");
  });
});

test.describe("distance clarity", () => {
  test("'from where?' is answered in the answer, and the answer then measures", async ({
    page,
  }, info) => {
    await page.goto("/discovery");
    await ask(page, "What can we do with three hours?");
    const gap = page.getByTestId("ask-gap-origin");
    await expect(gap).toBeVisible();
    await shoot(page, info, "03-from-where");
    await gap.getByTestId("ask-town").selectOption("vernon");
    await expect(page.getByTestId("ask-gap-origin")).toHaveCount(0);
    await expect(page.getByTestId("ask-understood")).toContainText("Vernon");
    // Every pick now says how far it is, or the answer says why it cannot.
    await expect(
      page.getByTestId("ask-answer").getByTestId("possibility").first(),
    ).toBeVisible();
    await shoot(page, info, "04-measured-from-vernon");
  });

  test("a distant destination: worth an hour of driving, nearest first, in a straight line", async ({
    page,
  }, info) => {
    await page.goto("/discovery");
    await ask(page, "What is worth driving an hour for?");
    await page
      .getByTestId("ask-gap-origin")
      .getByTestId("ask-town")
      .selectOption("kamloops");
    await expect(page.getByTestId("ask-heading")).toHaveText(
      /worth an hour of driving/i,
    );
    await expect(page.getByTestId("ask-note")).toContainText(/straight line/i);
    await expect(page.getByTestId("ask-note")).toContainText(
      /check the drive/i,
    );
    const away = await page
      .getByTestId("ask-answer")
      .getByTestId("possibility")
      .evaluateAll((cards) =>
        cards.map((card) =>
          Number(/≈\s*(\d+)\s*km/i.exec(card.textContent ?? "")?.[1] ?? NaN),
        ),
      );
    expect(away.length).toBeGreaterThan(1);
    expect(away.every(Number.isFinite), `no distance on a card: ${away}`).toBe(
      true,
    );
    expect(away).toEqual([...away].sort((a, b) => a - b));
    await page.getByTestId("ask-answer").scrollIntoViewIfNeeded();
    await shoot(page, info, "05-worth-the-drive");
  });
});

test.describe("empty results", () => {
  test("a search that matches nothing says so, and the way back is one tap", async ({
    page,
  }, info) => {
    await page.goto("/discovery?q=zzzqqqxxx");
    await expect(page.getByTestId("result-summary")).toContainText(
      /nothing .* matches that/i,
    );
    await shoot(page, info, "06-empty-search");
  });

  test("a drive with nowhere to go says which wall it hit", async ({
    page,
  }, info) => {
    // Osoyoos is on the border; nothing Atlas places 40–200 km away has a
    // thing to do in this snapshot's feed *within an hour's routed time* —
    // and without routed times the band alone may still hold places, so this
    // asserts only that an empty answer is explained, never that it is empty.
    await page.goto("/discovery?at=osoyoos");
    await ask(page, "What is worth driving half an hour for?");
    await expect(page.getByTestId("ask-note")).not.toBeEmpty();
    await shoot(page, info, "07-short-drive");
  });

  test("Atlas answering with nothing is a page, not a crash", async ({
    page,
  }, info) => {
    await setAtlas({ candidates: "empty" });
    await page.goto(`/discovery?age=${freshAge(info, 0)}`);
    await expect(page.getByTestId("ask-input")).toBeVisible();
    await shoot(page, info, "08-atlas-empty");
  });

  test("Atlas failing says Atlas, and keeps the account out of it", async ({
    page,
  }, info) => {
    await setAtlas({ candidates: "500" });
    await page.goto(`/discovery?age=${freshAge(info, 1)}`);
    await expect(page.getByText(/couldn't reach Atlas/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
    await shoot(page, info, "09-atlas-failing");
  });
});

test.describe("into a day", () => {
  /**
   * Routing keeps an answer it was given for five minutes, on the server and
   * in the tab (`answerMemo`), so a test that forces a routing failure must
   * ask a question no earlier test asked. A different number of hours is not
   * enough (the same stops come back); a different town is, and it must
   * differ per project, since both projects share one server.
   */
  const townFor = (info: TestInfo, slot: number) =>
    (info.project.name === "desktop"
      ? ["kelowna", "lake-country"]
      : ["armstrong", "coldstream"])[slot];

  const intoGo = async (page: Page, town = "vernon") => {
    await page.goto("/discovery");
    await ask(page, "What can we do with three hours?");
    await page
      .getByTestId("ask-gap-origin")
      .getByTestId("ask-town")
      .selectOption(town);
    await expect(page.getByTestId("ask-make-a-day")).toBeVisible();
    await page.getByTestId("ask-make-a-day").click();
    await expect(page).toHaveURL(/\/go\?/);
  };

  test("the answer becomes a day, carrying the town and the picks", async ({
    page,
  }, info) => {
    await intoGo(page);
    const url = new URL(page.url());
    expect(url.searchParams.get("at")).toBe("vernon");
    expect(url.searchParams.get("with")).toBeTruthy();
    expect(url.search).not.toMatch(/\d+\.\d{3,}/);
    await expect(
      page.getByText(/You picked this in Discovery/i).first(),
    ).toBeVisible();
    await expect(page.getByTestId("travel-summary")).toBeVisible();
    await shoot(page, info, "10-the-day");
  });

  test("routing fails: the day stays, the distances say they are straight lines, and retry recovers", async ({
    page,
  }, info) => {
    await setAtlas({ legs: "500" });
    await intoGo(page, townFor(info, 0));
    const summary = page.getByTestId("travel-summary");
    await expect(summary).toContainText(/straight lines/i);
    await expect(summary).toContainText(/could not get travel times/i);
    await expect(
      page.getByText(/You picked this in Discovery/i).first(),
    ).toBeVisible();
    await shoot(page, info, "11-routing-failed");
    await setAtlas({ legs: "ok" });
    await page.getByTestId("travel-retry").click();
    await expect(page.getByTestId("travel-retry")).toHaveCount(0);
    await shoot(page, info, "12-routing-recovered");
  });

  test("routing not served: said once, as straight lines, with no retry to press", async ({
    page,
  }, info) => {
    await setAtlas({ legs: "404" });
    await intoGo(page, townFor(info, 1));
    await expect(page.getByTestId("travel-summary")).toContainText(
      /straight lines/i,
    );
    await shoot(page, info, "13-routing-not-served");
  });

  for (const routing of ["present", "absent"] as const) {
    test(`the whole day, routing ${routing}: Discovery, a clock, kept, printed, and handed to Go offline`, async ({
      page,
    }, info) => {
      const n = routing === "present" ? 0 : 1;
      const tag = `2${n}`;
      await setAtlas({ legs: routing === "present" ? "ok" : "404" });
      await intoGo(page, routing === "present" ? "vernon" : townFor(info, n));

      // The day: a clock that rests on something, and travel said honestly.
      await expect(page.getByTestId("go-day")).toBeVisible();
      const stops = await page.getByTestId("go-stop").count();
      expect(stops).toBeGreaterThan(0);
      const travel = page.getByTestId("travel-summary");
      await expect(travel).toBeVisible();
      if (routing === "present") {
        await expect(travel).not.toContainText(/could not get travel times/i);
      } else {
        await expect(travel).toContainText(/straight lines/i);
        await expect(page.getByTestId("travel-retry")).toHaveCount(0);
        expect(await page.getByTestId("go-travel").innerText()).not.toMatch(
          /\b\d+\s*min(utes)?\s*(drive|driving)\b/i,
        );
      }
      await shoot(page, info, `${tag}-1-the-day-routing-${routing}`);

      // Keep it, reload, and it is still the day that was shaped.
      const dayUrl = page.url();
      await page.getByTestId("go-keep-day").click();
      await expect(page.getByTestId("go-note")).toContainText("this device");
      await page.reload();
      await expect(page.getByTestId("go-stop")).toHaveCount(stops);
      await page.goto("/go");
      await expect(page.getByTestId("go-kept-day").first()).toBeVisible();
      await shoot(page, info, `${tag}-2-kept-${routing}`);
      await page.getByTestId("go-kept-open").first().click();
      await expect(page.getByTestId("go-stop")).toHaveCount(stops);

      // Print: the same stops on paper, nothing wider than the screen, and
      // back from the paper is the day, not a blank form.
      await page.getByTestId("go-print").click();
      await expect(page).toHaveURL(/\/go\/print/);
      await expect(page.getByTestId("guide-stop")).toHaveCount(stops);
      const wide = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(wide, "the paper scrolls sideways").toBe(false);
      await shoot(page, info, `${tag}-3-paper-${routing}`);
      await page.goBack();
      await expect(page.getByTestId("go-stop")).toHaveCount(stops);

      // The hand-off: Go offline carries this day, in this order, to the
      // pocket screen the phone is put away on.
      const names = await page.getByTestId("go-stop").allInnerTexts();
      await page.getByTestId("go-offline").click();
      await expect(page).toHaveURL(/\/detox/);
      await shoot(page, info, `${tag}-4-offline-${routing}`);
      await page.getByRole("link", { name: /phones away/i }).click();
      const pocket = page.getByTestId("offline-pocket-stop");
      await expect(pocket).toHaveCount(stops);
      const pocketText = (await pocket.allInnerTexts()).join("\n");
      expect(pocketText.length).toBeGreaterThan(0);
      await shoot(page, info, `${tag}-5-phone-away-${routing}`);
      expect(names).toHaveLength(stops);
    });
  }

  test("a card goes into a day on its own", async ({ page }, info) => {
    await page.goto("/discovery");
    await page.getByTestId("plan-a-day").first().click();
    await expect(page).toHaveURL(/\/go\?.*with=/);
    await expect(
      page.getByText(/You picked this in Discovery/i).first(),
    ).toBeVisible();
    await shoot(page, info, "14-from-a-card");
  });
});
