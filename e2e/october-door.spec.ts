import { expect, test, type Page } from "@playwright/test";

/**
 * **October: opening the door.** The journeys from the ordinary product into
 * October herself, and back — driven in a real browser, at phone and desktop
 * sizes, by navigation rather than by visiting each page cold.
 *
 * Everything here is slow on purpose where the experience is: Found You and
 * Witching Hour are mostly written silence, so these wait for real time
 * rather than faking a clock the animation library also reads.
 */

const FOUND_YOU_KEY = "elk-passport:october:found-you";
const NIGHT_KEY = "elk-passport:october:witching-hour";

const phone = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
} as const;

async function remembered(page: Page) {
  return page.evaluate(
    ([a, b]) => ({
      foundYou: window.localStorage.getItem(a!),
      night: window.localStorage.getItem(b!),
    }),
    [FOUND_YOU_KEY, NIGHT_KEY],
  );
}

/**
 * October takes Ghostbusters back the first time anybody reaches for it
 * (`october-rooms.spec.ts` plays that). These tests are about holding a tape,
 * so they arrive as somebody she has already refused once.
 */
async function alreadyRefused(page: Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "october:passage:v1",
      JSON.stringify({ refused: Date.now() }),
    ),
  );
}

/** The line she is saying, whichever it is. */
const saying = (page: Page) => page.getByTestId("found-you").locator("p");

test.describe("the way in, on a phone", () => {
  test.use(phone);

  test("a first-time visitor walks past her, follows, meets her, and is remembered", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/october/discover");

    // Something ordinary first: Discover is Discover.
    await expect(page.getByTestId("phrases")).toBeVisible();

    // At the very bottom, under everything: the only line that is hers.
    const door = page.getByRole("link", { name: "You walked right past me." });
    await door.scrollIntoViewIfNeeded();
    await expect(door).toBeVisible();
    await expect(
      page.getByRole("link", { name: "You've been here before." }),
    ).toHaveCount(0);
    const box = (await door.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    await door.tap();
    await expect(page).toHaveURL(/\/october\/found-you$/);

    // A beginning, not the middle of a story.
    await expect(saying(page)).toHaveText("You stopped.", { timeout: 8000 });
    await expect(saying(page)).toHaveText("Nobody stops.", { timeout: 8000 });
    await expect(saying(page)).toHaveText("October notices things like that.", {
      timeout: 8000,
    });
    await expect(page.getByText("You found a way out.")).toHaveCount(0);

    await page.getByRole("button", { name: "31" }).tap({ timeout: 15_000 });
    await page.getByRole("button", { name: "STAY" }).tap({ timeout: 15_000 });
    await expect(saying(page)).toHaveText("You chose STAY.");
    await page.getByRole("button", { name: "NO" }).tap({ timeout: 15_000 });
    await expect(saying(page)).toHaveText("They walked right by me.", {
      timeout: 30_000,
    });
    // Nothing kept until she is finished with them.
    expect((await remembered(page)).foundYou).toBeNull();

    await page.getByTestId("exit").tap({ timeout: 20_000 });
    await expect(saying(page)).toHaveText("So I followed you.", {
      timeout: 25_000,
    });
    const kept = JSON.parse((await remembered(page)).foundYou!);
    expect(kept).toEqual({
      found: true,
      number: "31",
      door: "STAY",
      hearing: "NO",
    });

    // Back to October, and the ordinary page has noticed.
    await page.getByRole("link", { name: "back to October" }).tap({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/october$/);
    await page.goto("/october/discover");
    const again = page.getByRole("link", { name: "You've been here before." });
    await again.scrollIntoViewIfNeeded();
    await expect(again).toBeVisible();
    await expect(
      page.getByRole("link", { name: "You walked right past me." }),
    ).toHaveCount(0);

    // And she remembers them, at the door.
    await again.tap();
    await expect(saying(page)).toHaveText("I remember you.");
    await expect(saying(page)).toHaveText("You found a way out.", {
      timeout: 8000,
    });
  });
});

test.describe("what she remembers can be seen and forgotten", () => {
  test("My October lists it, says where it lives, and forgets on request", async ({
    page,
  }) => {
    await page.goto("/october/mine");
    await expect(page.getByTestId("what-she-remembers")).toHaveCount(0);
    await page.evaluate(
      ([a, b]) => {
        window.localStorage.setItem(
          a!,
          JSON.stringify({ found: true, door: "LEAVE" }),
        );
        window.localStorage.setItem(b!, JSON.stringify({ ended: "story" }));
      },
      [FOUND_YOU_KEY, NIGHT_KEY],
    );
    await page.reload();
    const note = page.getByTestId("what-she-remembers");
    await expect(note).toContainText("That you chose LEAVE.");
    await expect(note).toContainText(
      "That you asked her to tell you something, the last night.",
    );
    await expect(note).toContainText("Only in this browser");
    await page.getByRole("button", { name: "Make her forget" }).click();
    await expect(page.getByTestId("october-forgot")).toBeVisible();
    expect(await remembered(page)).toEqual({ foundYou: null, night: null });

    // And the door at the bottom of Discover no longer claims to know them.
    await page.goto("/october/discover");
    const door = page.getByRole("link", { name: "You walked right past me." });
    await door.scrollIntoViewIfNeeded();
    await expect(door).toBeVisible();
  });
});

/**
 * Witching Hour from the doorway — the screening shortcut — so each ending is
 * reached in under a minute. Desktop: the night is built for a big screen,
 * and pairing is never offered from the doorway.
 */
test.describe("Witching Hour: every door goes somewhere", () => {
  const night = (page: Page) => page.locator("p.font-serif");

  async function toDoorway(page: Page) {
    await page.goto("/october/witching-hour?at=doorway");
    await page
      .getByRole("button", { name: /^(Click|Touch) to begin$/ })
      .click();
    await expect(page.getByText("Still awake?")).toBeVisible({
      timeout: 10_000,
    });
  }

  test("Stay inside: the door, then the surface", async ({ page }) => {
    test.setTimeout(90_000);
    await toDoorway(page);
    await page.getByRole("button", { name: /^Stay inside/ }).click();
    await expect(night(page)).toHaveText("Locked.", { timeout: 20_000 });
    await expect(page.getByTestId("stay-inside")).toBeVisible({
      timeout: 10_000,
    });
    expect((await remembered(page)).night).toBe('{"ended":"inside"}');
  });

  test("Go outside: the light, ten minutes, and the way back", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await toDoorway(page);
    await page.getByRole("button", { name: /^Go outside/ }).click();
    await expect(night(page)).toHaveText("Don't bring me.", {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "I'm back" }).click({
      timeout: 15_000,
    });
    await expect(night(page)).toHaveText("That wasn't ten minutes.", {
      timeout: 10_000,
    });
    await expect(night(page)).toHaveText("Goodnight.", { timeout: 15_000 });
    // No Found You in this browser, so no callback to it.
    await expect(page.getByText("I didn't follow you this time.")).toHaveCount(
      0,
    );
    const end = page.getByTestId("night-ended");
    await expect(end).toBeVisible({ timeout: 10_000 });
    expect((await remembered(page)).night).toBe('{"ended":"outside"}');
    await end.click();
    await expect(page).toHaveURL(/\/october$/);
  });

  test("Go outside, having met her: she did not follow you this time", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/october");
    await page.evaluate(
      (k) =>
        window.localStorage.setItem(
          k,
          JSON.stringify({ found: true, number: "10", door: "LEAVE" }),
        ),
      FOUND_YOU_KEY,
    );
    await toDoorway(page);
    await page.getByRole("button", { name: /^Go outside/ }).click();
    await page.getByRole("button", { name: "I'm back" }).click({
      timeout: 30_000,
    });
    await expect(night(page)).toHaveText("I didn't follow you this time.", {
      timeout: 20_000,
    });
    await expect(night(page)).toHaveText("Goodnight.", { timeout: 15_000 });
  });

  test("Tell me something: darker, hers, then black", async ({ page }) => {
    test.setTimeout(120_000);
    await toDoorway(page);
    await page.getByRole("button", { name: /^Tell me something/ }).click();
    await expect(night(page)).toHaveText("Darker.", { timeout: 25_000 });
    await expect(night(page)).toHaveText("31, then everything goes black.", {
      timeout: 20_000,
    });
    await expect(night(page)).toHaveText("That's all you get tonight.", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("night-ended")).toBeVisible({
      timeout: 10_000,
    });
    expect((await remembered(page)).night).toBe('{"ended":"story"}');
  });

  test("Surprise me: nothing behind you, then the night given back", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await toDoorway(page);
    await page.getByRole("button", { name: /^Surprise me/ }).click();
    await expect(night(page)).toHaveText("Most people turn around.", {
      timeout: 30_000,
    });
    await expect(night(page)).toHaveText("There was nothing behind you.", {
      timeout: 15_000,
    });
    await expect(night(page)).toHaveText(
      "I just wanted someone to stay still with me for a minute.",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("night-ended")).toBeVisible({
      timeout: 10_000,
    });
    expect((await remembered(page)).night).toBe('{"ended":"surprise"}');
  });
});

test.describe("the Video Store on a 390px phone", () => {
  test.use(phone);

  test("Ghostbusters is on screen and can be picked up and put back", async ({
    page,
  }) => {
    await alreadyRefused(page);
    await page.goto("/october/store");
    await expect(page.getByTestId("store-waiting")).toHaveCSS("opacity", "0", {
      timeout: 15_000,
    });
    const tape = page.getByTestId("tape-ghostbusters");
    const box = (await tape.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    await tape.tap();
    const back = page.getByTestId("backdrop");
    await expect(back).toBeVisible();
    // Putting it down is tapping anywhere that is not the tape. The held tape
    // settles over the middle of the screen, so a tap aimed at the backdrop's
    // own centre lands on the tape once it has arrived — which it has by the
    // time the machine is busy. Tap the corner, which the tape never covers.
    await back.tap({ position: { x: 12, y: 12 } });
    await expect(back).toHaveCount(0);
  });

  test("a sideways drag looks along the wall to the far end, and back", async ({
    page,
  }) => {
    await page.goto("/october/store");
    await expect(page.getByTestId("store-waiting")).toHaveCSS("opacity", "0", {
      timeout: 15_000,
    });
    // The far-right cabinet's tape starts off the edge.
    const ids = await page
      .locator('[data-testid^="tape-"]')
      .evaluateAll((els) =>
        els.map((e) => ({
          id: e.getAttribute("data-testid")!,
          x: e.getBoundingClientRect().x,
        })),
      );
    const rightmost = ids.sort((a, b) => b.x - a.x)[0]!;
    expect(rightmost.x).toBeGreaterThan(390);

    // Drag right-to-left: the head turns right.
    await page.mouse.move(300, 700);
    await page.mouse.down();
    for (let x = 300; x >= 20; x -= 20) await page.mouse.move(x, 700);
    await page.mouse.up();

    const moved = page.getByTestId(rightmost.id);
    const after = (await moved.boundingBox())!;
    expect(after.x).toBeGreaterThanOrEqual(0);
    expect(after.x + after.width).toBeLessThanOrEqual(390);
    // A drag is a look, not a reach: nothing was picked up on the way.
    await expect(page.getByTestId("backdrop")).toHaveCount(0);

    // And that tape is a real tape from here.
    await moved.tap();
    await expect(page.getByTestId("backdrop")).toBeVisible();
  });
});

test.describe("the Video Store on a desktop", () => {
  test("is the wall it was: everything in view, pointer-aimed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await alreadyRefused(page);
    await page.goto("/october/store");
    await expect(page.getByTestId("store-waiting")).toHaveCSS("opacity", "0", {
      timeout: 15_000,
    });
    for (const id of await page
      .locator('[data-testid^="tape-"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!))) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.x, id).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, id).toBeLessThanOrEqual(1440);
    }
    await page.getByTestId("tape-ghostbusters").click();
    await expect(page.getByTestId("backdrop")).toBeVisible();
  });
});
