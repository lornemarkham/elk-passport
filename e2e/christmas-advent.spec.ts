import { expect, test, type Page } from "@playwright/test";

/**
 * **Holiday Season 2026 + Advent Adventure** (owner brief M1053), on a phone.
 *
 * The doors are tested on a day of December: start the server with
 * `ADVENT_TODAY=2026-12-12` and run with `E2E_ADVENT_TODAY=2026-12-12`.
 * Without it only what November shows is checked. `E2E_ATLAS=1` means an
 * Atlas stand-in serves real listings (the production corpus of 2026-11-23
 * was used for M1053: Kelowna has three New Year's Eve events).
 */
const TODAY = process.env.E2E_ADVENT_TODAY;
const DAY = TODAY ? Number(TODAY.slice(8, 10)) : 0;
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function openDoor(page: Page, n: number) {
  await page.getByTestId(`door-${n}`).click();
  const reveal = page.getByTestId("advent-reveal");
  await expect(reveal).toBeVisible();
  return reveal;
}

async function close(page: Page) {
  await page.getByTestId("advent-close").click();
  await expect(page.getByTestId("advent-reveal")).toHaveCount(0);
}

test("Advent is on Christmas's own bar, one tap from anywhere", async ({
  page,
}) => {
  // Owner brief M1128: Home | Lights Map | Advent | My Christmas. The hero
  // asks nothing (M1127), and Advent no longer competes with it as a pill.
  await page.goto("/christmas?at=vernon");
  await expect(page.getByTestId("pill-advent")).toHaveCount(0);
  await page.getByTestId("xmas-nav-advent").click();
  await expect(page).toHaveURL(/\/christmas\/advent/);
  await expect(page.getByTestId("advent-doors").locator("li")).toHaveCount(25);
  // A phone: the board fits, nothing scrolls sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

// Advent Preview Mode (M1074) is on until midnight Pacific on December 1, so
// the doors-shut specs below need a server started with ADVENT_PREVIEW=off
// (E2E_ADVENT_PREVIEW=off); the preview spec needs it without.
const PREVIEW = process.env.E2E_ADVENT_PREVIEW !== "off";

test("Advent Preview Mode: all 25 doors open, each surprise works", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(!PREVIEW, "the server has the preview switched off");
  await page.goto("/christmas/advent?at=vernon");
  await expect(page.getByTestId("advent-preview")).toContainText(
    "Advent Preview Mode",
  );
  for (let n = 1; n <= 25; n++)
    await expect(page.getByTestId(`door-${n}`)).toHaveAttribute(
      "data-state",
      "ready",
    );
  for (let n = 1; n <= 25; n++) {
    const reveal = await openDoor(page, n);
    await expect(reveal).toContainText(`Door ${n}`);
    const first = await page.getByTestId("reveal-title").innerText();
    expect(first.length, `door ${n}`).toBeGreaterThan(3);
    await page.getByTestId("advent-swap").click();
    await expect(page.getByTestId("reveal-title")).not.toBeEmpty();
    await page.getByTestId("advent-done").click();
    await expect(page.getByTestId("advent-done")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await close(page);
    await expect(page.getByTestId(`door-${n}`)).toHaveAttribute(
      "data-state",
      "done",
    );
  }
  await expect(page.getByTestId("advent-progress")).toHaveText(
    "You've completed 25 adventures — a whole Advent!",
  );
  // Surprise me opens a door; Make it yours opens the choices.
  await page.getByTestId("advent-surprise").click();
  await expect(page.getByTestId("advent-reveal")).toBeVisible();
  await close(page);
  await page.getByTestId("advent-prefs-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a door still to come stays shut — no peeking", async ({ page }) => {
  test.skip(PREVIEW, "Advent Preview Mode has every door open");
  await page.goto("/christmas/advent?at=vernon");
  const shut = DAY ? DAY + 1 : 1;
  await expect(page.getByTestId(`door-${shut}`)).toHaveAttribute(
    "data-state",
    "locked",
  );
  await page.getByTestId(`door-${shut}`).click();
  await expect(page.getByTestId("advent-reveal")).toHaveCount(0);
  await expect(page.getByTestId("advent-note")).toContainText("No peeking");
});

test("before December, Surprise me gives a warm-up for today", async ({
  page,
}) => {
  test.skip(Boolean(TODAY), "the server is pinned to a day of December");
  test.skip(PREVIEW, "Advent Preview Mode has every door open");
  await page.goto("/christmas/advent?at=vernon");
  await expect(page.getByTestId("advent-stage")).toContainText("December 1");
  await page.getByTestId("advent-surprise").click();
  const reveal = page.getByTestId("advent-reveal");
  await expect(reveal).toContainText("A warm-up for today");
  await expect(page.getByTestId("reveal-title")).not.toBeEmpty();
});

test.describe("on a day of December", () => {
  test.skip(!TODAY, "start the server with ADVENT_TODAY to open doors");

  test("today's door: surprise, swap, complete — and it is still done tomorrow", async ({
    page,
  }) => {
    await page.goto("/christmas/advent?at=vernon");
    for (let n = 1; n <= DAY; n++)
      await expect(page.getByTestId(`door-${n}`)).toHaveAttribute(
        "data-state",
        "ready",
      );
    await page.getByTestId("advent-surprise").click();
    const reveal = page.getByTestId("advent-reveal");
    await expect(reveal).toContainText(`Door ${DAY}`);
    const first = await page.getByTestId("reveal-title").innerText();
    expect(first.length).toBeGreaterThan(3);

    await page.getByTestId("advent-swap").click();
    await expect(page.getByTestId("reveal-title")).not.toHaveText(first);
    const swapped = await page.getByTestId("reveal-title").innerText();

    await page.getByTestId("advent-done").click();
    await expect(page.getByTestId("advent-done")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("advent-swap")).toBeDisabled();
    await close(page);
    await expect(page.getByTestId("advent-progress")).toHaveText(
      "You've completed 1 adventure!",
    );
    await expect(page.getByTestId(`door-${DAY}`)).toHaveAttribute(
      "data-state",
      "done",
    );

    // A new visit: the progress is still there, without an account.
    await page.reload();
    await expect(page.getByTestId("advent-progress")).toHaveText(
      "You've completed 1 adventure!",
    );
    await openDoor(page, DAY);
    await expect(page.getByTestId("reveal-title")).toHaveText(swapped);
  });

  test("an idea says it is an idea; a real event shows its dates, place, price and source", async ({
    page,
  }) => {
    test.skip(!WITH_ATLAS, "needs Atlas listings");
    await page.goto("/christmas/advent?at=kelowna");
    let sawEvent = false;
    let sawIdea = false;
    for (let n = 1; n <= DAY && !(sawEvent && sawIdea); n++) {
      const reveal = await openDoor(page, n);
      for (let swaps = 0; swaps < 6; swaps++) {
        const kind = await reveal.getAttribute("data-kind");
        if (kind === "event") {
          sawEvent = true;
          await expect(page.getByTestId("reveal-kind")).toContainText(
            "Real event near Kelowna",
          );
          await expect(page.getByTestId("reveal-when")).not.toBeEmpty();
          await expect(page.getByTestId("reveal-details")).toHaveAttribute(
            "href",
            /^\/passport\//,
          );
          await expect(reveal).toContainText(
            /Free, the organiser says|In the organiser's words|Price not listed/,
          );
        } else {
          sawIdea = true;
          await expect(page.getByTestId("reveal-kind")).toHaveText(
            "An idea, not a listing",
          );
          await expect(page.getByTestId("reveal-details")).toHaveCount(0);
        }
        if (sawEvent && sawIdea) break;
        await page.getByTestId("advent-swap").click();
      }
      await close(page);
    }
    expect(sawEvent).toBe(true);
    expect(sawIdea).toBe(true);
  });

  test("preferences change the doors, and are kept", async ({ page }) => {
    await page.goto("/christmas/advent?at=vernon");
    const titles = async () => {
      const out: string[] = [];
      for (let n = 1; n <= DAY; n++) {
        await openDoor(page, n);
        out.push(await page.getByTestId("reveal-title").innerText());
        await close(page);
      }
      return out;
    };
    const before = await titles();

    await page.getByTestId("advent-prefs-open").click();
    const sheet = page.getByTestId("advent-prefs");
    await sheet.getByRole("button", { name: "The two of us" }).click();
    await sheet.getByRole("button", { name: "Indoors" }).click();
    await sheet.getByRole("button", { name: "Free" }).click();
    await sheet.getByRole("button", { name: "Movies" }).click();
    await page.getByTestId("advent-prefs-save").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("advent-prefs-open")).toHaveText(
      /Your choices/,
    );
    const after = await titles();
    expect(after).not.toEqual(before);
    // Nothing for little ones behind a couple's doors.
    expect(after.join(" ")).not.toMatch(/Letters to Santa|Track Santa/i);

    await page.reload();
    await page.getByTestId("advent-prefs-open").click();
    await expect(
      page
        .getByTestId("advent-prefs")
        .getByRole("button", { name: "The two of us" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("sharing an adventure hands the phone's share sheet a line and a link", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { shared: unknown[] }).shared = [];
      Object.defineProperty(navigator, "share", {
        value: (data: unknown) => {
          (window as unknown as { shared: unknown[] }).shared.push(data);
          return Promise.resolve();
        },
      });
    });
    await page.goto("/christmas/advent?at=vernon");
    await openDoor(page, DAY);
    await page.getByTestId("advent-share").click();
    const shared = await page.evaluate(
      () =>
        (window as unknown as { shared: { text: string; url: string }[] })
          .shared,
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]!.text).toContain(`Door ${DAY} of our Advent Adventure`);
    expect(shared[0]!.url).toMatch(/^http/);
  });
});

test.describe("New Year's", () => {
  test("New Year's Eve is said when it is near, and never hidden from who asks", async ({
    page,
  }) => {
    // Owner brief M1128: part of the holiday season, not a rival on every
    // screen. In November its chip and banner are not on discovery…
    await page.goto("/christmas?at=kelowna#discover");
    await expect(page.getByTestId("nye-banner")).toHaveCount(0);
    await expect(page.getByTestId("chip-newyear")).toHaveCount(0);
    // …choosing its night under When brings it in.
    await page.getByTestId("when-select").selectOption("nye");
    await expect(page).toHaveURL(/when=nye/);
    await expect(page.getByTestId("when-select")).toHaveValue("nye");
    // In view now: offered with what it holds, or said to have none yet.
    await expect(page.getByTestId("finder")).toContainText("New Year's Eve");
  });

  test("New Year's Day is one tap under When", async ({ page }) => {
    await page.goto("/christmas?at=kelowna#discover");
    await page.getByTestId("when-select").selectOption("nyd");
    await expect(page).toHaveURL(/when=nyd/);
    await expect(page.getByTestId("when-select")).toHaveValue("nyd");
  });
});

test("Big White is its own place, not Kelowna", async ({ page }) => {
  await page.goto("/christmas?at=big-white#discover");
  await expect(page.getByTestId("discover")).toContainText(
    "Christmas around Big White",
  );
  await page.goto("/christmas/lights?at=big-white");
  await expect(page.locator("main")).toContainText("Big White");
});
