import {
  expect,
  request as pwRequest,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";

/**
 * **Test Game Night**, end to end: the organizer's rehearsal with 25
 * fictional players, the registration countdown, and the calendar's today.
 *
 * Run against a fresh server on the memory store with the clock at 8:18 pm
 * the evening before a Thursday night, so sign-up opens in 11h 42m:
 * `COURTQUEUE_STORE=memory COURTQUEUE_CLOCK=2026-11-11T20:18:00-07:00`.
 * The organizer code is "organizer" unless COURTQUEUE_ORGANIZER_CODE says
 * otherwise.
 */

const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const RUN = Math.random().toString(36).slice(2, 6);

test.describe.configure({ mode: "serial" });

let org: APIRequestContext;

/** Everything real the organizer can see, minus the clock. */
async function realClub() {
  const v = await (await org.get("/api/badminton/live")).json();
  return JSON.stringify({
    sessions: v.sessions,
    night: v.night,
    roster: v.organizer?.roster,
    players: v.organizer?.players,
    audit: v.organizer?.audit,
    clubhouse: v.clubhouse?.messages,
    season: v.season,
  });
}

test.beforeAll(async ({ baseURL }) => {
  org = await pwRequest.newContext({ baseURL });
  const r = await org.post("/api/badminton/me", {
    data: {
      action: "register",
      name: `Organizer ${RUN}`,
      email: `org${RUN}@example.test`,
      pin: "8642",
    },
  });
  if (r.status() === 503) test.skip(true, "CourtQueue store not configured");
  expect(r.ok(), await r.text()).toBe(true);
  const claim = await org.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok(), await claim.text()).toBe(true);
});

async function organizerOn(
  browser: Browser,
  size: "phone" | "desktop",
): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext(
    size === "phone"
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1280, height: 900 } },
  );
  await ctx.addCookies((await org.storageState()).cookies);
  const page = await ctx.newPage();
  await page.goto("/badminton");
  return { page, close: () => ctx.close() };
}

async function skipJourneyQuestion(page: Page) {
  const skip = page.getByRole("button", { name: /rather not say|Skip/i });
  if (
    await skip
      .first()
      .isVisible()
      .catch(() => false)
  )
    await skip.first().click();
}

/** Every name on a court right now — never anyone twice. */
async function onCourts(page: Page) {
  const names: string[] = [];
  for (const c of [1, 2, 3]) {
    const court = page.getByTestId(`demo-court-${c}`);
    const status = await court.getAttribute("data-status");
    if (status === "called" || status === "playing") {
      const seats = await court
        .locator(".aspect-\\[13\\.4\\/6\\.1\\] button")
        .allInnerTexts();
      expect(seats, `court ${c} has four`).toHaveLength(4);
      names.push(...seats);
    }
  }
  expect(new Set(names).size, `nobody twice: ${names}`).toBe(names.length);
  return names;
}

test("Home counts down to 8:00 a.m. and the calendar marks today", async ({
  browser,
}) => {
  const { page, close } = await organizerOn(browser, "phone");
  await skipJourneyQuestion(page);
  const next = page.getByTestId("next-session");
  await expect(next).toBeVisible();
  await expect(
    next.getByText("Thursday, November 12", { exact: true }),
  ).toBeVisible();
  // Server clock started at 8:18 pm Wednesday: sign-up opens at 8:00 am
  // Thursday, so 11h 42m (less the minutes the suite has been running).
  await expect(next.getByTestId("registration")).toHaveAttribute(
    "data-state",
    "counting",
  );
  await expect(
    next.getByText(/^Registration opens in 11h (3\d|4[0-2])m$/),
  ).toBeVisible();
  await expect(next.getByText(/Opens Thursday at 8:00 a\.m\./)).toBeVisible();
  await expect(next.getByRole("button", { name: "Courts →" })).toBeVisible();

  await page.getByRole("button", { name: "Schedule" }).click();
  // Wednesday Nov 11 is not a club night but is still marked as today.
  const today = page.locator("[data-today]");
  await expect(today).toHaveCount(1);
  await expect(today).toHaveText("11");
  await expect(today).toHaveAttribute(
    "aria-label",
    /Today, Wednesday, November 11/,
  );
  // Separate marks: completed, coming up.
  await expect(
    page.getByRole("button", { name: /^Monday Nov 9, .*completed/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Thursday Nov 12, .*coming up/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Thursday, November 12" });
  await expect(sheet.getByText(/Registration opens in 11h/)).toBeVisible();
  await expect(sheet.getByText("6:30–8:30 pm", { exact: false })).toBeVisible();
  await close();
});

async function rehearse(page: Page, size: string) {
  const before = await realClub();
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("/api/badminton")) posts++;
  });

  await page
    .getByRole("button", { name: "🏸 Test Game Night" })
    .first()
    .click();
  await expect(page.getByTestId("demo-banner")).toContainText(
    "DEMO — 25 FICTIONAL PLAYERS",
  );
  await expect(page.getByTestId("demo-moment")).toHaveText(
    "Before registration",
  );
  // Countdown on the simulated clock.
  await expect(page.getByText(/Registration opens in \d+m/)).toBeVisible();

  await page.getByRole("button", { name: /^Players \(25\)/ }).click();
  await expect(page.getByTestId("demo-players").locator("li")).toHaveCount(25);
  await expect(page.getByText("First night at the club").first()).toBeVisible();
  await page.getByRole("button", { name: "Courts", exact: true }).click();

  const next = page.getByRole("button", { name: /^Next event/ });
  // Sign-ups through the day, then doors open and courts fill.
  for (let i = 0; i < 60; i++) {
    const busy = await page
      .locator('[data-testid^="demo-court-"][data-status="playing"]')
      .count();
    const waiting = await page.getByTestId("demo-line").locator("li").count();
    if (busy === 3 && waiting > 0) break;
    await next.click();
  }
  await expect(page.getByText(/25\/25 registered/)).toBeVisible();
  await expect(
    page.locator('[data-testid^="demo-court-"][data-status="playing"]'),
  ).toHaveCount(3);
  await onCourts(page);
  await expect(page.getByText(/^Why: /).first()).toBeVisible();

  // Waiting times go up with the clock.
  const line = page.getByTestId("demo-line");
  await expect(line.locator("li").first()).toBeVisible();
  const head = await line
    .locator("li")
    .first()
    .locator("span.truncate")
    .innerText();
  const w0 = Number(
    await line.locator("li").first().getByTestId("wait").innerText(),
  );
  await page.getByRole("button", { name: "Five minutes later" }).click();
  const row = line.locator("li", {
    hasText: head.replace(/next.*/s, "").trim(),
  });
  if (await row.count())
    expect(
      Number(await row.first().getByTestId("wait").innerText()),
    ).toBeGreaterThan(w0);

  // Rotation: everyone off; the four from each court catch their breath and
  // tap back in themselves, and the next groups are called. Nobody twice.
  await page.getByRole("button", { name: "Rotate all courts" }).click();
  await expect(
    page.locator('[data-testid^="demo-court-"][data-status="playing"]'),
  ).toHaveCount(0);
  for (let i = 0; i < 10; i++) {
    if (
      (await page
        .locator('[data-testid^="demo-court-"][data-status="called"]')
        .count()) > 0
    )
      break;
    await next.click();
  }
  await expect(
    page.locator('[data-testid^="demo-court-"][data-status="called"]'),
  ).not.toHaveCount(0);
  const called = await onCourts(page);
  expect(called.length).toBeGreaterThan(0);
  for (let i = 0; i < 12; i++) {
    await next.click();
    await onCourts(page);
  }

  // Mark someone unavailable from the line.
  await line.locator("li button").first().click();
  await page.getByRole("button", { name: "Mark unavailable" }).click();
  await expect(
    page.getByText("Marked unavailable.", { exact: true }),
  ).toBeVisible();

  // Add a walk-in: tonight is full, so the waitlist.
  await page.getByRole("button", { name: "+ Add a player" }).click();
  await expect(page.getByText(/1 waitlist/)).toBeVisible();

  // To the end: the summary.
  await page.getByRole("button", { name: "Skip to the end" }).click();
  await expect(page.getByTestId("demo-moment")).toHaveText("Session complete");
  await page.getByRole("button", { name: "Summary" }).click();
  const summary = page.getByTestId("demo-summary");
  await expect(summary.getByText("Games played")).toBeVisible();
  await expect(summary.getByText(/welcome!/).first()).toBeVisible();
  await page.screenshot({
    path: `test-results/game-night-${size}.png`,
    fullPage: false,
  });

  // Exit: the real app, exactly as it was.
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(page.getByTestId("demo-banner")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Organizer" })).toBeVisible();
  expect(posts, "the rehearsal never wrote to the server").toBe(0);
  expect(await realClub()).toBe(before);
  const players = (await (await org.get("/api/badminton/live")).json())
    .organizer.players as { name: string }[];
  for (const fake of ["Maya Chen", "Sam Okafor", "Zara Ahmed", "Theo Grant"])
    expect(players.some((p) => p.name === fake)).toBe(false);
}

test("Test Game Night on a phone: 25 players, courts, queue, rotation, exit", async ({
  browser,
}) => {
  const { page, close } = await organizerOn(browser, "phone");
  await skipJourneyQuestion(page);
  await rehearse(page, "phone");
  await close();
});

test("Test Game Night on a desktop, and a reload keeps the rehearsal", async ({
  browser,
}) => {
  const { page, close } = await organizerOn(browser, "desktop");
  await skipJourneyQuestion(page);
  await page.getByRole("button", { name: "Organize" }).click();
  await page.getByRole("button", { name: "🏸 Test Game Night" }).click();
  await page.getByRole("button", { name: /^Next event/ }).click();
  await page.getByRole("button", { name: /^Next event/ }).click();
  const clock = await page.getByTestId("demo-clock").innerText();
  await page.reload();
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(page.getByTestId("demo-clock")).toHaveText(clock);
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Exit demo" }).click();
  await rehearse(page, "desktop");
  await close();
});

test("A visitor who hasn't joined can run Test Game Night, and Exit returns to Join", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/badminton");
  await page.getByRole("button", { name: "🏸 Test Game Night" }).click();
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(page.getByTestId("demo-clock")).toBeVisible();
  await page.getByRole("button", { name: /^Next event/ }).click();
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(
    page.getByRole("button", { name: "Join CourtQueue" }),
  ).toBeVisible();
  await ctx.close();
});
