import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";

/**
 * **A first-time visitor to Vancouver, on a phone** — the launch brief's
 * seven scenarios, end to end (Vancouver launch, 2026-10-24).
 *
 *   1  great coffee near JW Marriott Parq
 *   2  a restaurant for five coworkers tonight
 *   3  something fun within a 20-minute walk
 *   4  save three, organise an evening
 *   5  share the plan with a coworker, who joins
 *   6  open a venue's page and check what it says
 *   7  come back later and carry on
 *
 * Real `/auth` against the group-adventures stack (real GoTrue, Postgres
 * RLS); Atlas is `atlas-standin.mjs` serving the body `prod-corpus.mjs`
 * reads from gohaveaday.com. What each answer offered is written to
 * `$VAN_RECORD` so the run is a record, not only a pass.
 */

const PASSWORD = "a-hell-of-a-day-26";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-van-${stamp}@example.test`;
const SHOTS = process.env.VAN_SHOTS ?? "/tmp/vancouver-shots";
const RECORD = process.env.VAN_RECORD ?? "/tmp/vancouver-record.md";
mkdirSync(SHOTS, { recursive: true });
const record = (line: string) => appendFileSync(RECORD, `${line}\n`);
const PHONE = { ...devices["iPhone 13"] };

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function signIn(page: Page, who: string) {
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

async function person(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  return { context, page: await context.newPage() };
}

/** Say a sentence to Discovery and return the answer's titles, in order. */
async function ask(page: Page, said: string): Promise<string[]> {
  const input = page.getByTestId("ask-input");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await input.fill(said);
    await page.getByTestId("ask-submit").click({ timeout: 2_000 });
    await expect(page.getByTestId("ask-heading")).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 45_000 });
  const answer = page.getByTestId("ask-answer");
  const titles = (await answer.locator("h3").allTextContents()).map((t) =>
    t.replace(/✓/g, "").trim(),
  );
  const heading = (await page.getByTestId("ask-heading").textContent())?.trim();
  record(`\n### “${said}”\n\n${heading}\n`);
  const cards = await answer.locator("article, li").allInnerTexts();
  for (const t of titles) {
    const card = cards.find((c) => c.includes(t)) ?? "";
    const where =
      /(UNDER \d+ KM AWAY|≈ [\d.]+ KM AWAY|IN [A-Z ]+)/i.exec(card)?.[0] ?? "";
    record(`- ${t}${where ? ` — ${where.toLowerCase()}` : ""}`);
  }
  return titles;
}

/** How many things a person's board holds — what a save writes. */
async function held(page: Page): Promise<number> {
  const boards = await (await page.request.get("/api/boards")).json();
  if (!Array.isArray(boards) || boards.length === 0) return 0;
  const items = await (
    await page.request.get(`/api/boards/${boards[0].id}/items`)
  ).json();
  return Array.isArray(items) ? items.length : 0;
}

async function saveFirst(page: Page, count: number) {
  const save = page
    .getByTestId("ask-answer")
    .getByRole("button", { name: "Save", exact: true });
  await expect(async () => {
    if ((await held(page)) < count)
      await save.first().click({ timeout: 2_000 });
    expect(await held(page)).toBe(count);
  }).toPass({ timeout: 45_000 });
}

test.describe.configure({ mode: "serial" });

test("a visitor at the Parq finds, saves, plans, shares and comes back", async ({
  browser,
}) => {
  test.setTimeout(480_000);
  record(`# Vancouver visitor run, ${new Date().toISOString()}\n`);

  // -------------------------------------------- 1 · coffee near the hotel
  const alice = await person(browser, PHONE);
  await alice.page.goto("/auth?next=%2Fdiscovery%3Fat%3Djw-marriott-parq");
  await signUp(alice.page, "alice");
  await expect(alice.page).toHaveURL(/\/discovery\?at=jw-marriott-parq/);

  const coffee = await ask(alice.page, "Great coffee near my hotel");
  await expect(alice.page.getByTestId("ask-heading")).toContainText(
    "Coffee & cafés",
  );
  expect(coffee.length).toBeGreaterThanOrEqual(3);
  await expect(alice.page.getByTestId("ask-answer")).toContainText(/1 km/i);
  await alice.page.screenshot({ path: `${SHOTS}/1-coffee.png` });
  await saveFirst(alice.page, 1);

  // ---------------------------- 2 · a restaurant for five coworkers tonight
  // Each scenario starts fresh, as a visitor arriving from a link would:
  // "Start over" keeps the rows (an open owner question), so a restaurant
  // chosen here would carry into the next question.
  await alice.page.goto("/discovery?at=jw-marriott-parq");
  const dinner = await ask(
    alice.page,
    "A good restaurant for five coworkers tonight",
  );
  expect(dinner.length).toBeGreaterThanOrEqual(3);
  await alice.page.screenshot({ path: `${SHOTS}/2-dinner.png` });
  await saveFirst(alice.page, 2);

  // ---------------------------------- 3 · fun within a 20-minute walk
  await alice.page.goto("/discovery?at=jw-marriott-parq");
  const fun = await ask(alice.page, "Something fun within a 20-minute walk");
  await expect(alice.page.getByTestId("ask-understood")).toContainText(
    "1.7 km",
  );
  expect(fun.length).toBeGreaterThanOrEqual(3);
  await alice.page.screenshot({ path: `${SHOTS}/3-walk.png` });
  await saveFirst(alice.page, 3);

  // ------------------------------------------ 6 · a venue's own page
  await alice.page.goto("/saved");
  const firstSaved = alice.page
    .locator("main a[href^='/passport/'], main a[href^='/places/']")
    .first();
  await expect(firstSaved).toBeVisible({ timeout: 30_000 });
  const venueHref = (await firstSaved.getAttribute("href"))!;
  const venue = await person(browser, PHONE);
  const opened = await venue.page.goto(venueHref);
  expect(opened?.status()).toBeLessThan(400);
  await expect(venue.page.locator("h1").first()).toBeVisible();
  const venueText = await venue.page.locator("main").innerText();
  record(
    `\n### Venue page ${venueHref}\n\n${venueText.split("\n").filter(Boolean).slice(0, 25).join(" · ")}\n`,
  );
  await venue.page.screenshot({ path: `${SHOTS}/6-venue.png`, fullPage: true });
  await venue.context.close();

  // --------------------------------- 4 · three saved → an evening plan
  await alice.page.goto("/saved");
  await expect(alice.page.getByTestId("saved-review")).toContainText(
    "3 possibilities",
  );
  await alice.page.getByTestId("saved-plan").click();
  const choose = alice.page.getByTestId("saved-choose");
  await expect(choose).toHaveCount(3);
  for (let i = 0; i < 3; i++) await choose.nth(i).click();
  await alice.page.getByTestId("saved-build-adventure").click();
  await expect(alice.page).toHaveURL(/\/adventures\/new\?with=/);
  await alice.page.getByTestId("create-town").selectOption("jw-marriott-parq");
  await alice.page.getByRole("button", { name: "Pick dates" }).click();
  await alice.page.getByLabel("From", { exact: true }).fill("2026-10-27");
  await alice.page.getByLabel("To", { exact: true }).fill("2026-10-27");
  await alice.page.getByTestId("create-title").fill("Sycle Tuesday night");
  await alice.page.getByTestId("create-sketch").uncheck();
  await alice.page.getByTestId("create-submit").click();
  await expect(alice.page).toHaveURL(/\/adventures\/[0-9a-f]{32}$/);
  const adventureUrl = alice.page.url();
  await expect(
    alice.page.getByRole("list", { name: "Ideas" }).getByTestId("plan-item"),
  ).toHaveCount(3);

  await alice.page.getByTestId("plan-day").first().click();
  await expect(alice.page).toHaveURL(/\/go\?.*adventure=/);
  await expect(alice.page.getByTestId("go-day")).toBeVisible({
    timeout: 30_000,
  });
  await alice.page
    .getByTestId("go-change")
    .fill("This evening, after the sessions");
  await alice.page.getByTestId("go-change-submit").click();
  const stops = alice.page.locator('[data-testid="go-stop"] h3');
  await expect(stops.first()).toBeVisible();
  const built = (await stops.allTextContents()).map((s) => s.trim());
  record(
    `\n### The evening Go Have a Day built\n\n${built.map((b) => `- ${b}`).join("\n")}\n`,
  );
  await alice.page.screenshot({
    path: `${SHOTS}/4-go-evening.png`,
    fullPage: true,
  });
  await alice.page.getByTestId("go-save-adventure").click();
  await expect(alice.page.getByTestId("go-adventure-note")).toContainText(
    "Saved to Sycle Tuesday night",
  );
  await alice.page.goto(adventureUrl);
  const day = alice.page.getByTestId("plan-day-section").first();
  await expect(day.getByTestId("plan-item")).toHaveCount(built.length);
  if (built.length > 1) {
    await day.getByLabel(`More for ${built[0]}`).click();
    // The open menu stays on a phone's screen (it once pushed the page
    // sideways at 390px).
    expect(
      await alice.page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    await day.getByRole("button", { name: `Move ${built[0]} later` }).click();
    await expect(day.getByTestId("plan-item").nth(1)).toContainText(built[0]!);
  }
  await alice.page.screenshot({
    path: `${SHOTS}/4-adventure.png`,
    fullPage: true,
  });

  // ---------------------------------------- 5 · share with a coworker
  await alice.page.getByRole("button", { name: "Link for one person" }).click();
  const invite = (
    await alice.page.getByTestId("invite-url").first().textContent()
  )?.trim();
  expect(invite).toMatch(/\/adventures\/join\//);
  const bob = await person(browser, { ...devices["Pixel 7"] });
  await bob.page.goto(new URL(invite!).pathname);
  await expect(
    bob.page.getByRole("heading", { name: /You're invited/ }),
  ).toBeVisible();
  await bob.page.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(bob.page, "bob");
  await bob.page.getByRole("button", { name: /join/ }).click();
  await expect(
    bob.page.getByRole("heading", { name: "Sycle Tuesday night" }),
  ).toBeVisible();
  const bobsDay = bob.page.getByTestId("plan-day-section").first();
  await expect(bobsDay.getByTestId("plan-item")).toHaveCount(built.length);
  await bobsDay
    .getByTestId("plan-item")
    .first()
    .getByRole("button", { name: "I'm in" })
    .click();
  await expect(bobsDay.getByTestId("plan-item").first()).toContainText("1 in");
  await bob.page.screenshot({
    path: `${SHOTS}/5-bob-joined.png`,
    fullPage: true,
  });

  // ---------------------------------------------- 7 · back another time
  await alice.context.close();
  const again = await person(browser, PHONE);
  await again.page.goto("/auth?next=/saved");
  await signIn(again.page, "alice");
  await again.page
    .getByTestId("saved-adventures")
    .getByRole("link", { name: /Sycle Tuesday night/ })
    .click();
  await expect(again.page).toHaveURL(adventureUrl);
  const later = again.page.getByTestId("plan-day-section").first();
  await expect(later.getByTestId("plan-item")).toHaveCount(built.length);
  await expect(later.getByTestId("plan-item").first()).toContainText("1 in");
  await again.page.screenshot({
    path: `${SHOTS}/7-back-later.png`,
    fullPage: true,
  });

  for (const p of [bob, again]) await p.context.close();
});
