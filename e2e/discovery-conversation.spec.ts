import { mkdirSync } from "node:fs";
import { devices, expect, test, type Page } from "@playwright/test";

/**
 * **Discovery 2.0: say what kind of day it is, and keep talking.**
 *
 * Against an Atlas stand-in serving the committed real candidates body
 * (`scripts/critic/atlas-mock.mjs`), so every pick is a real Atlas subject.
 * Screenshots land in `docs/product/discovery-conversation/` for a reviewer.
 *
 *   node scripts/critic/atlas-mock.mjs docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz 3131
 *   ATLAS_API_URL=http://127.0.0.1:3131 … npx next start -p 3130
 *   E2E_PORT=3130 npx playwright test e2e/discovery-conversation.spec.ts
 */
const SHOTS = "docs/product/discovery-conversation";

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Say a sentence, and return how long the answer took to change. */
async function say(page: Page, said: string): Promise<number> {
  const before = await page.getByTestId("ask-turn").count();
  await page.getByTestId("ask-input").fill(said);
  const started = Date.now();
  await page.getByTestId("ask-submit").click();
  await expect(page.getByTestId("ask-turn")).toHaveCount(before + 1);
  await expect(page.getByTestId("ask-answer")).toBeVisible();
  return Date.now() - started;
}

const heard = (page: Page) => page.getByTestId("ask-understood");

test.describe("desktop", () => {
  test("opens with the question in words, starting points, and the rows tucked away", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await expect(page.locator("h1")).toHaveText(
      "What kind of day are you looking for?",
    );
    await expect(page.getByTestId("ask-input")).toHaveAttribute(
      "placeholder",
      /Something fun with the kids/,
    );
    const starters = page.getByTestId("ask-example");
    await expect(starters.filter({ hasText: "Surprise me" })).toBeVisible();
    await expect(starters.filter({ hasText: "A great date" })).toBeVisible();
    // The old questionnaire is still there, one tap away, not in the way.
    await expect(page.getByTestId("ghad-refine")).toBeVisible();
    await expect(page.locator("#ghad-rows")).toBeHidden();
    await shoot(page, "desktop-01-arrive");
  });

  test("'Surprise me' answers at once with real places, and asks nothing first", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await page
      .getByTestId("ask-example")
      .filter({ hasText: "Surprise me" })
      .click();
    const answer = page.getByTestId("ask-answer");
    await expect(answer).toBeVisible();
    await expect(page.getByTestId("ask-unread")).toHaveCount(0);
    expect(await answer.getByTestId("possibility").count()).toBeGreaterThan(2);
    await shoot(page, "desktop-02-surprise");
  });

  test("remembers the conversation, asks only what matters, and changes only what changed", async ({
    page,
  }) => {
    await page.goto("/discovery");
    const timings: number[] = [];
    timings.push(await say(page, "Something fun with my daughter"));
    await expect(page.getByTestId("ask-question")).toHaveAttribute(
      "data-about",
      "time",
    );
    await expect(page.getByTestId("ask-question")).toContainText(
      "How much time do you have?",
    );
    await shoot(page, "desktop-03-daughter");

    timings.push(await say(page, "About three hours"));
    await expect(page.getByTestId("ask-question")).toHaveAttribute(
      "data-about",
      "distance",
    );
    await expect(heard(page)).toContainText("3 hours");
    await expect(heard(page)).toContainText("with a kid");

    timings.push(await say(page, "Maybe 45 minutes"));
    await expect(heard(page)).toContainText("up to 45 min away");
    await expect(page.getByTestId("ask-question")).toHaveCount(0);

    timings.push(await say(page, "Actually, somewhere indoors"));
    await expect(heard(page)).toContainText("staying dry");
    // Nothing earlier was forgotten.
    await expect(heard(page)).toContainText("3 hours");
    await expect(heard(page)).toContainText("with a kid");
    await expect(heard(page)).toContainText("up to 45 min away");
    await expect(page.getByTestId("ask-turn")).toHaveCount(4);
    await shoot(page, "desktop-04-indoors");

    // The conversation is a link: a refresh brings all of it back.
    expect(new URL(page.url()).searchParams.getAll("ask")).toHaveLength(4);
    await page.reload();
    await expect(page.getByTestId("ask-turn")).toHaveCount(4);
    await expect(heard(page)).toContainText("staying dry");
    await expect(heard(page)).toContainText("with a kid");

    test.info().annotations.push({
      type: "latency-ms",
      description: timings.join(", "),
    });
    for (const ms of timings) expect(ms).toBeLessThan(2_500);
  });

  test("opens a pick, and comes back to the same conversation", async ({
    page,
  }) => {
    await page.goto("/discovery");
    // One sentence that sets a day, and a card tapped at once: the address
    // must already hold the question, before the server has answered.
    await say(page, "Something unusual tonight");
    const first = page
      .getByTestId("ask-answer")
      .getByTestId("possibility-link")
      .first();
    const title = (await first.getAttribute("aria-label")) ?? "";
    await first.click();
    // A place opens /places/, anything else Atlas holds (a bar, a show)
    // /passport/ — the evening lifts both since the Vancouver launch.
    await page.waitForURL(/\/(places|passport)\//);
    expect(title.length).toBeGreaterThan(0);
    await page.goBack();
    // The way back re-reads Atlas for the chosen day (`on=`), which is a
    // server render, not a client one: allow it the time a cold read takes.
    await expect(page.getByTestId("ask-turn")).toHaveCount(1, {
      timeout: 20_000,
    });
    await expect(heard(page)).toContainText("tonight");
  });

  test("'Something different' shows none of what was just on screen", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "Hiking");
    const titles = () =>
      page
        .getByTestId("ask-answer")
        .getByTestId("possibility-link")
        .evaluateAll((links) => links.map((l) => l.getAttribute("aria-label")));
    const before = await titles();
    await page.getByTestId("ask-different").click();
    await expect(page.getByTestId("ask-turn")).toHaveCount(2);
    await expect(page.getByTestId("ask-heading")).toHaveText(
      "Something completely different",
    );
    const after = await titles();
    expect(after.length).toBeGreaterThan(0);
    for (const title of after) expect(before).not.toContain(title);
  });

  test("'Start over' clears the conversation", async ({ page }) => {
    await page.goto("/discovery");
    await say(page, "A great date");
    await page.getByTestId("ask-clear").click();
    await expect(page.getByTestId("ask-turn")).toHaveCount(0);
    await expect(page.getByTestId("ask-example").first()).toBeVisible();
  });
});

// The phone, without the browser type (a describe cannot change that).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...PIXEL } = devices["Pixel 7"];

test.describe("phone", () => {
  test.use(PIXEL);

  // Kept short: headless Chromium on this host crashes an idle phone page on
  // Discovery after a few seconds (see the M300 notes), whatever the page does.
  test("a sentence, a change of mind, and no sideways scroll", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await expect(page.getByTestId("ask-input")).toBeVisible();
    await say(page, "Something unusual tonight");
    await say(page, "Actually, make that tomorrow");
    await expect(heard(page)).toContainText("tomorrow evening");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await shoot(page, "phone-01-tomorrow");
  });
});
