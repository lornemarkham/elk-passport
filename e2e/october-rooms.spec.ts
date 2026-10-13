import { expect, test, type Page } from "@playwright/test";

/**
 * **From October, played.**
 *
 * The Secret Room is solved here the way a person solves it: tune the radio to
 * the three stations that tell the truth, read what each asks for off the room,
 * and spin the wheels to 4-7-2. Nothing in this file knows the code except by
 * way of the same sentences the radio says.
 *
 * Run on a desktop viewport and a phone, because the room's whole job is to be
 * playable on both.
 */

const PASSAGE = "october:passage:v1";

async function seed(page: Page, passage: Record<string, number>) {
  await page.addInitScript(
    ([key, value]) =>
      window.localStorage.setItem(key as string, value as string),
    [PASSAGE, JSON.stringify(passage)],
  );
}

/**
 * The Room opens on Halloween (`domain/october/threshold.ts`). Every test that
 * means to be *inside* it says what night it is, rather than depend on the day
 * the suite happens to run.
 */
async function itIsHalloween(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 31, 21, 0));
}

async function enterRoom(page: Page) {
  await itIsHalloween(page);
  await page.goto("/october/room");
  await page.getByTestId("room-cover").click();
  await expect(page.getByTestId("spot-radio")).toBeVisible();
}

async function tune(page: Page, frequency: number) {
  await page.getByTestId("radio-dial").fill(String(frequency));
}

async function setWheels(page: Page, digits: [number, number, number]) {
  for (const [i, d] of digits.entries()) {
    const current = Number(await page.getByTestId(`wheel-${i}`).textContent());
    const up = (d - current + 10) % 10;
    for (let k = 0; k < up; k += 1) {
      await page.getByTestId(`wheel-${i}-up`).click();
    }
  }
}

/** Solve it the way the radio says to. */
async function solve(page: Page) {
  await page.getByTestId("spot-radio").click();
  await tune(page, 89.7);
  await expect(page.getByTestId("radio-line")).toHaveText(/How many bars/);
  await tune(page, 95.3);
  await expect(page.getByTestId("radio-line")).toHaveText(/What was the hour/);
  await tune(page, 101.1);
  await expect(page.getByTestId("radio-line")).toHaveText(
    /Count what was taken/,
  );
  await expect(page.getByTestId("heard").locator("li")).toHaveCount(3);

  // What the radio asked for, counted off the room itself.
  const bars = await page.locator("[data-bar]").count();
  // The hour: read off the clock's hand like a person would.
  const hand = page.locator('[data-hand="hour"]');
  const [x2, y2] = await Promise.all([
    hand.getAttribute("x2"),
    hand.getAttribute("y2"),
  ]);
  const clock = { x: 50, y: 18 };
  const angle =
    ((Math.atan2(Number(x2) - clock.x, clock.y - Number(y2)) * 180) / Math.PI +
      360) %
    360;
  const hour = Math.round(angle / 30) % 12;
  const pale = await page.locator("[data-pale]").count();
  expect([bars, hour, pale]).toEqual([4, 7, 2]);

  await page.getByTestId("spot-door").click();
  await setWheels(page, [bars, hour, pale]);
  await page.getByTestId("lock-try").click();
}

for (const [name, viewport, touch] of [
  ["desktop", { width: 1280, height: 800 }, false],
  ["phone", { width: 390, height: 844 }, true],
] as const) {
  test.describe(`the Secret Room — ${name}`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch });

    test.beforeEach(async ({ page }) => itIsHalloween(page));

    test("is a puzzle: wrong codes stay locked, October lies, the right code opens it", async ({
      page,
    }) => {
      await enterRoom(page);
      await expect(page.getByTestId("secret-room")).toHaveAttribute(
        "data-open",
        "false",
      );

      // The door is locked, and the lock is where wrong answers go to be wrong.
      await page.getByTestId("spot-door").click();
      await page.getByTestId("lock-try").click();
      await expect(page.getByTestId("room-voice")).toHaveText(
        "Locked. You did check.",
      );
      await page.getByTestId("wheel-0-up").click();
      await page.getByTestId("lock-try").click();
      await expect(page.getByTestId("room-voice")).toHaveText("Locked.");

      // October's station is the clearest one on the dial, and it lies.
      await page.getByTestId("spot-radio").click();
      await tune(page, 106.9);
      await expect(page.getByTestId("radio-line")).toHaveText(
        /Seven\. Seven\./,
      );
      await page.getByTestId("spot-door").click();
      await setWheels(page, [7, 7, 7]);
      await page.getByTestId("lock-try").click();
      await expect(page.getByTestId("room-voice")).toHaveText(
        "Everyone believes that one.",
      );
      await expect(page.getByTestId("secret-room")).toHaveAttribute(
        "data-open",
        "false",
      );
    });

    test("can be solved from what the room and the radio say, and the door leads to the store", async ({
      page,
    }) => {
      await enterRoom(page);
      await solve(page);

      await expect(page.getByTestId("secret-room")).toHaveAttribute(
        "data-open",
        "true",
      );
      await expect(page.getByTestId("room-voice")).toHaveText(
        "The door opens.",
      );

      // The room remembers it, in this browser.
      const remembered = await page.evaluate(
        (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}"),
        PASSAGE,
      );
      expect(remembered.escaped).toBeGreaterThan(0);

      await page.getByTestId("room-exit").click();
      await page.waitForURL("**/october/store");
      await expect(page.getByTestId("vhs-wall")).toBeVisible();
    });

    test("with the tape from the store, the room plays it — once the door is open", async ({
      page,
    }) => {
      test.setTimeout(75_000);
      await seed(page, { tape: Date.now() });
      await enterRoom(page);

      // Not before.
      await page.getByTestId("spot-vcr").click();
      await expect(page.getByTestId("room-voice")).toHaveText("Not yet.");
      await expect(page.getByTestId("tape-view")).toHaveCount(0);

      await solve(page);
      await expect(page.getByTestId("room-exit")).toBeVisible();
      await page.getByTestId("spot-vcr").click();
      await expect(page.getByTestId("tape-view")).toBeVisible();
      await expect(page.getByTestId("room-voice")).toHaveText(
        "This is the last one who stayed.",
      );
      // And it is remembered as seen.
      await expect
        .poll(
          async () =>
            (
              await page.evaluate(
                (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}"),
                PASSAGE,
              )
            ).played,
          { timeout: 45_000 },
        )
        .toBeGreaterThan(0);
    });
  });
}

test.describe("the Video Store", () => {
  test("October refuses the obvious tape once, and the unlabeled one goes in your pocket", async ({
    page,
  }) => {
    await page.goto("/october/store");
    await expect(page.getByTestId("store-waiting")).toHaveCSS("opacity", "0", {
      timeout: 15_000,
    });

    // The refusal: the first reach for Ghostbusters is taken back.
    await page.getByTestId("tape-ghostbusters").click({ force: true });
    await expect(page.getByTestId("case-ghostbusters")).toHaveAttribute(
      "data-motion",
      "seized",
    );
    await expect
      .poll(async () =>
        page.evaluate(
          (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}").refused,
          PASSAGE,
        ),
      )
      .toBeGreaterThan(0);

    // The tape nobody catalogued.
    await expect(page.getByTestId("pocket-tape")).toHaveCount(0);
    await page.getByTestId("tape-unlabeled").click({ force: true });
    await expect(page.getByTestId("case-unlabeled")).toHaveAttribute(
      "data-arrived",
      "true",
      { timeout: 5000 },
    );
    await expect(page.getByTestId("pocket-tape")).toBeVisible();
    await page.getByTestId("pocket-tape").click();
    await page.waitForURL("**/october/room");
  });

  test("after the room, October lets you have the obvious tape", async ({
    page,
  }) => {
    await seed(page, { refused: Date.now(), escaped: Date.now() });
    await page.goto("/october/store");
    await expect(page.getByTestId("store-waiting")).toHaveCSS("opacity", "0", {
      timeout: 15_000,
    });
    await page.getByTestId("tape-ghostbusters").click({ force: true });
    await expect(page.getByTestId("case-ghostbusters")).toHaveAttribute(
      "data-arrived",
      "true",
      { timeout: 5000 },
    );
  });
});

test.describe("the way in", () => {
  test("From October is visible on Discover, which is otherwise untouched", async ({
    page,
  }) => {
    await itIsHalloween(page);
    await page.goto("/october/discover");
    const door = page.getByTestId("from-october");
    await expect(door).toBeVisible();
    await expect(door).toContainText("From October");
    // Discover itself is still Discover.
    await expect(
      page.getByRole("heading", { name: "Here is October." }),
    ).toBeVisible();
    await door.click();
    await page.waitForURL("**/october/from");
    await page.getByTestId("door-room").click();
    await page.waitForURL("**/october/room");
    await page.getByTestId("room-leave").click();
    await page.waitForURL("**/october/from");
    await page.getByTestId("door-store").click();
    await page.waitForURL("**/october/store");
    await expect(page.getByTestId("vhs-wall")).toBeVisible();
  });

  test("on a phone the wall can be dragged, and the first tape of the shelf is reachable", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/october/store");
    await expect(page.getByTestId("vhs-wall")).toHaveAttribute(
      "data-panning",
      "true",
    );
    await expect(page.getByTestId("pan-hint")).toBeVisible({ timeout: 15_000 });

    const cdp = await context.newCDPSession(page);
    const before = await page.getByTestId("tape-alien").boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 330, y: 400 }],
    });
    for (let i = 1; i <= 10; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 330 - 29 * i, y: 400 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByTestId("pan-hint")).toHaveCount(0);
    const after = await page.getByTestId("tape-alien").boundingBox();
    expect(after!.x).toBeLessThan(before!.x - 100);
    await context.close();
  });
});

test.describe("the Room before it opens", () => {
  const on = (page: Page, month: number, day: number) =>
    page.clock.setFixedTime(new Date(2026, month, day, 21, 0));

  test('is a door that says "Not yet.", answers a knock, and lets you leave', async ({
    page,
  }) => {
    await on(page, 9, 14);
    await page.goto("/october/room");
    await expect(page.getByTestId("shut-door")).toHaveAttribute(
      "data-threshold",
      "not-yet",
    );
    await expect(page.getByTestId("shut-door-line")).toHaveText("Not yet.");
    await expect(page.getByTestId("shut-door-light")).toHaveCount(0);
    await expect(page.getByTestId("secret-room")).toHaveCount(0);
    await page.getByTestId("shut-door-knock").click();
    await expect(page.getByTestId("shut-door-answer")).toBeVisible();
    await page.getByTestId("shut-door-leave").click();
    await page.waitForURL("**/october/from");
  });

  test("counts the nights down, and From October says so before you knock", async ({
    page,
  }) => {
    await on(page, 9, 25);
    await page.goto("/october/from");
    await expect(page.getByTestId("door-room-line")).toHaveText("Six nights.");
    await page.getByTestId("door-room").click();
    await page.waitForURL("**/october/room");
    await expect(page.getByTestId("shut-door-line")).toHaveText("Six nights.");
    await expect(page.getByTestId("shut-door-light")).toBeVisible();
  });

  test("never shuts out somebody who has already been inside", async ({
    page,
  }) => {
    await on(page, 9, 14);
    await seed(page, { entered: 1 });
    await page.goto("/october/room");
    await expect(page.getByTestId("secret-room")).toBeVisible();
  });
});
