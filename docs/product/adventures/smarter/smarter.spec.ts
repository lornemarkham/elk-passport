import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Smarter adventures, as real people would use them.**
 *
 *   A  Two adults, Vernon, Sat Nov 7 2026: "a fun romantic Christmas date
 *      night with mulled wine or hot apple cider, Christmas lights, maybe
 *      snow, something cute, cozy and memorable."
 *   B  "Go ice skating" becomes a real rink, not a card that says so.
 *   C  A family Christmas day with a six-year-old: different plan, different
 *      challenges.
 *   D  Friends, a snow day, through the generic adventure — the same
 *      intelligence, no Christmas.
 *   E  Sharing: invite, contribute, refresh both, a second device, an
 *      outsider who sees nothing.
 *
 * Every plan the tests see is written to `results.json` beside the
 * screenshots, so the report quotes what Passport actually produced.
 */

const SHOTS = path.resolve(__dirname, "screenshots");
const RESULTS = path.resolve(__dirname, "results.json");
const PASSWORD = "mulled-cider-by-the-fire-7";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-smart-${stamp}@example.test`;
const results: Record<string, unknown> = {};

const TEST_A =
  "I want a fun romantic Christmas date night with mulled wine or hot apple cider, Christmas lights, maybe snow, something cute, cozy, and memorable.";

async function shot(page: Page, name: string, fullPage = true) {
  if (process.env.SHOTS !== "1") return;
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

async function person(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  return { context, page: await context.newPage() };
}

async function signUp(page: Page, who: string, next: string) {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function logIn(page: Page, who: string, next: string) {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

/** What the plan says, stop by stop — read off the page as a person sees it. */
async function readPlan(page: Page) {
  const days = page.getByTestId("plan-day-section");
  await expect(days.first()).toBeVisible();
  const out = [];
  for (const day of await days.all()) {
    const stops = [];
    for (const stop of await day.getByTestId("plan-item").all()) {
      stops.push({
        name: (await stop.locator("h4").textContent())?.trim(),
        at: (await stop.getByLabel(/^Stop \d/).textContent())?.trim(),
        because: (
          await stop
            .getByTestId("stop-because")
            .textContent()
            .catch(() => null)
        )?.trim(),
        check: (
          await stop
            .getByTestId("stop-check")
            .textContent({ timeout: 500 })
            .catch(() => null)
        )?.trim(),
      });
    }
    out.push({
      heard: (
        await day
          .getByTestId("day-heard")
          .textContent({ timeout: 2000 })
          .catch(() => null)
      )?.trim(),
      stops,
    });
  }
  return out;
}

async function startChristmas(
  page: Page,
  input: {
    shape: string;
    party: string;
    date: string;
    ages?: string;
    extra?: string;
    title: string;
  },
) {
  await page.goto(`/christmas/plan?shape=${input.shape}`);
  await page.getByTestId(`plan-shape-${input.shape}`).click();
  await page.getByTestId("plan-town").selectOption("vernon");
  await page.getByTestId("plan-date").fill(input.date);
  await page.getByRole("button", { name: input.party }).click();
  if (input.ages) await page.getByTestId("plan-ages").fill(input.ages);
  if (input.extra)
    await page
      .getByPlaceholder("home by 8 · within 30 minutes · Gran uses a walker")
      .fill(input.extra);
  await page.getByTestId("plan-title").fill(input.title);
  await page.getByTestId("plan-start").click();
  await page.waitForURL(/\/christmas\/adventure\//, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: input.title })).toBeVisible();
}

async function leadingChallenges(page: Page) {
  const box = page.getByTestId("challenges");
  await box.scrollIntoViewIfNeeded();
  const leading = box.locator(":scope > ul > li");
  const out = [];
  for (const li of await leading.all())
    out.push({
      id: (await li.getAttribute("data-testid"))?.replace("challenge-", ""),
      text: (await li.innerText()).replace(/\s+/g, " ").slice(0, 400),
    });
  return out;
}

test.afterAll(() => {
  fs.writeFileSync(RESULTS, `${JSON.stringify(results, null, 2)}\n`);
});

test("A + B + E: a romantic Christmas date, a real rink, and the person it's for", async ({
  browser,
}) => {
  // ---------------------------------------------------------------- A
  const alice = await person(browser);
  const a = alice.page;
  await signUp(a, "alice", "/christmas/plan");
  await startChristmas(a, {
    shape: "evening",
    party: "The two of us",
    date: "2026-11-07",
    extra: TEST_A,
    title: "Our Christmas date",
  });
  const adventurePath = new URL(a.url()).pathname;
  const id = adventurePath.split("/").at(-1)!;
  const plan = await readPlan(a);
  results.A = { plan, challenges: await leadingChallenges(a) };
  const names = plan.flatMap((d) => d.stops.map((s) => s.name ?? ""));
  expect(names.length).toBeGreaterThan(0);
  expect(names.join(" | ")).not.toMatch(/McDonald|Polson Park/);
  await expect(a.getByTestId("day-heard").first()).toContainText("romantic");
  await expect(a.getByTestId("day-missing").first()).toContainText(
    "Christmas lights",
  );
  // A date gets no Santa dares.
  const dares = (results.A as { challenges: { id?: string }[] }).challenges;
  expect(dares.map((d) => d.id)).not.toContain("santa-question");
  expect(dares.length).toBeLessThanOrEqual(3);
  await a.locator("#plan").scrollIntoViewIfNeeded();
  await shot(a, "A-romantic-date");

  // ---------------------------------------------------------------- B
  await a.getByText("Add something of your own").click();
  await a.locator("#item-label").fill("Go ice skating");
  await a.getByTestId("find-places").first().click();
  const found = a.getByTestId("found-places");
  await expect(found).toContainText("Great idea");
  const choices = found.getByTestId("place-choice");
  await expect(choices.first()).toBeVisible();
  results.B = {
    choices: await choices.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ")),
    ),
  };
  await shot(a, "B-ice-skating-choices", false);
  const kal = choices.filter({ hasText: "Kal Tire Place" }).first();
  await kal.getByRole("button", { name: /Add Kal Tire Place/ }).click();
  await expect(a.locator("#plan")).toContainText("Kal Tire Place");
  await a.reload();
  await expect(a.locator("#plan")).toContainText("Kal Tire Place");
  await expect(
    a.getByTestId("plan-item").filter({ hasText: "Kal Tire Place" }).first(),
  ).toContainText("Go ice skating");

  // A plain idea first, turned into a real place afterwards.
  await a.getByText("Add something of your own").click();
  await a.locator("#item-label").fill("go bowling");
  await a.getByRole("button", { name: "Add it", exact: true }).click();
  const idea = a
    .getByTestId("plan-ideas")
    .getByTestId("plan-item")
    .filter({ hasText: "go bowling" });
  await expect(idea).toBeVisible();
  await idea.getByTestId("find-places").click();
  await idea
    .getByTestId("place-choice")
    .first()
    .getByRole("button", { name: /^Add / })
    .click();
  await expect(a.locator("#plan")).toContainText("Lincoln Lanes");
  await expect(
    a.getByTestId("plan-ideas").getByText("go bowling", { exact: true }),
  ).toHaveCount(0);
  results.B2 = "go bowling → Lincoln Lanes Bowling, idea replaced";

  // ---------------------------------------------------------------- E
  await a.getByRole("button", { name: "Link for one person" }).click();
  const invite = (
    await a.getByTestId("invite-url").first().textContent()
  )?.trim();
  expect(invite).toMatch(/\/adventures\/join\//);

  const jess = await person(browser);
  const j = jess.page;
  await j.goto(new URL(invite!).pathname);
  await j.getByRole("link", { name: "Sign in to join" }).click();
  await j.getByRole("tab", { name: "Sign Up" }).click();
  await j.getByLabel("Email address").fill(emailFor("jess"));
  await j.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await j.getByRole("button", { name: "Create account" }).click();
  await j.waitForURL((u) => !u.pathname.startsWith("/auth"));
  await j.getByRole("button", { name: /join/ }).click();
  await j.waitForURL(/\/christmas\/adventure\//);
  await expect(
    j.getByRole("heading", { name: "Our Christmas date" }),
  ).toBeVisible();

  // Jess votes and proposes; separate identities.
  const first = j.getByTestId("plan-item").first();
  const firstName = (await first.locator("h4").textContent())!.trim();
  await first.getByRole("button", { name: "I'm in" }).click();
  await expect(first).toContainText("1 in");
  await j.getByText("Propose something").click();
  await j.locator("#item-label").fill("Warm socks and a thermos");
  await j.getByRole("button", { name: "Propose it" }).click();
  await expect(j.getByTestId("plan-ideas")).toContainText("Warm socks");
  await shot(j, "E-jess-contributes");

  // Refresh both: it's in the database, not in a tab.
  await j.reload();
  await a.reload();
  await expect(
    a.getByTestId("plan-item").filter({ hasText: firstName }).first(),
  ).toContainText("1 in");
  await expect(a.getByTestId("plan-ideas")).toContainText("Warm socks");
  await expect(a.getByTestId("plan-ideas")).toContainText("From the group");

  // A memory, shared, still there for the other person.
  await j.getByTestId("share-moment").click();
  await j.getByTestId("moment-text").fill("Best skate of my life");
  await j.getByTestId("moment-send").click();
  await a.reload();
  await expect(a.getByTestId("memories")).toContainText(
    "Best skate of my life",
  );

  // Alice on a second device, later: same adventure, same state.
  const laptop = await person(browser);
  await logIn(laptop.page, "alice", adventurePath);
  await laptop.page.goto(adventurePath);
  await expect(laptop.page.locator("#plan")).toContainText("Kal Tire Place");
  await expect(laptop.page.getByTestId("memories")).toContainText(
    "Best skate of my life",
  );
  await laptop.page.goto("/adventures");
  await expect(
    laptop.page.getByText("Our Christmas date").first(),
  ).toBeVisible();

  // An outsider sees nothing and can touch nothing.
  const charlie = await person(browser);
  await signUp(charlie.page, "charlie", "/christmas");
  await charlie.page.goto(adventurePath);
  await expect(charlie.page.getByText("Not found")).toBeVisible();
  expect(
    (
      await charlie.page.request.get(`/api/adventures/${id}/find?q=skating`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await charlie.page.request.post(`/api/adventures/${id}/items`, {
        data: { label: "gatecrash" },
      })
    ).status(),
  ).toBeGreaterThanOrEqual(400);
  results.E = {
    invite: "one-person link redeemed by a second account",
    vote: `${firstName}: 1 in, seen by owner after refresh`,
    proposal: "Warm socks and a thermos — From the group, after refresh",
    memory: "shared moment visible to owner and on a second device",
    secondDevice: "owner logged in fresh, adventure listed and identical",
    outsider: "Not found page; find → 404; item post refused",
  };

  await Promise.all(
    [alice, jess, laptop, charlie].map((p) => p.context.close()),
  );
});

test("C: a family Christmas day with a six-year-old", async ({ browser }) => {
  const mum = await person(browser);
  const m = mum.page;
  await signUp(m, "mum", "/christmas/plan");
  await startChristmas(m, {
    shape: "family-day",
    party: "Family with kids",
    date: "2026-12-12",
    ages: "6",
    extra: "something festive the kids will love",
    title: "Christmas with the kids",
  });
  const plan = await readPlan(m);
  results.C = { plan, challenges: await leadingChallenges(m) };
  const names = plan.flatMap((d) => d.stops.map((s) => s.name ?? ""));
  expect(names.join(" | ")).not.toMatch(/Winery|Distillery|Lounge|Pub\b/);
  await shot(m, "C-family-day");
  await mum.context.close();
});

test("D: friends plan a snow day through the generic adventure", async ({
  browser,
}) => {
  const sam = await person(browser);
  const s = sam.page;
  await signUp(s, "sam", "/adventures/new");
  await s.goto("/adventures/new");
  await s.getByTestId("create-town").selectOption("vernon");
  await s
    .getByRole("group", { name: "When" })
    .getByRole("button", { name: "Pick dates" })
    .click();
  await s
    .getByRole("textbox", { name: "From", exact: true })
    .fill("2026-12-12");
  await s.getByRole("textbox", { name: "To", exact: true }).fill("2026-12-12");
  await s
    .getByRole("group", { name: "Who" })
    .getByRole("button", { name: "Friends" })
    .click();
  await s
    .getByTestId("create-extra")
    .fill("skiing or snowboarding all day, then food and drinks after");
  await s.getByTestId("create-title").fill("Powder day");
  await s.getByTestId("create-submit").click();
  // A client-side navigation: wait for the adventure itself.
  await expect(s.getByRole("heading", { name: "Powder day" })).toBeVisible({
    timeout: 120_000,
  });
  const plan = await readPlan(s);
  results.D = { plan };
  const names = plan.flatMap((d) => d.stops.map((x) => x.name ?? ""));
  expect(names.join(" | ")).toMatch(/Silver ?Star|Sovereign|Big White/);
  // One mountain, not a tour of them.
  expect(
    names.filter((n) => /Silver ?Star|Sovereign|Big White/.test(n)).length,
  ).toBe(1);
  await shot(s, "D-snow-day");
  await sam.context.close();
});
