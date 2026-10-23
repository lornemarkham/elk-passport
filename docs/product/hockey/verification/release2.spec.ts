import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Release 2: restore discovery inside the compact Plan.**
 *
 * Needs the same stack and `atlas-seats-stub.mjs` as `release1.spec.ts`.
 * Proves what `RELEASE-2-DISCOVERY.md` changed, as it stands since the
 * recovery (`RECOVERY.md`: every part open under the plan, no accordion):
 *
 *   the hero is short, with teams, date, venue, countdown and the headline
 *   → the plan starts well up the first phone screen → opening Before the
 *   game shows three venue cards at once, each with name, blurb, walk, kind
 *   and a vote → one tap adds and votes, the row follows, and it survives a
 *   reload → Meeting point shows meeting-place cards that vote on the
 *   existing `meet-spot` → only the host can "Meet here", it keeps the gate
 *   and time already set and shows to the guest → nothing scrolls sideways
 *   at 320 or 390 px, or on a desktop.
 */

const stamp = Date.now().toString(36);
const SHOTS = process.env.RELEASE2_SHOTS;

async function phone(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`${who}-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function shot(page: Page, name: string, full = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
}

// Since the recovery (RECOVERY.md) a decision is its line on the plan card
// (`toggle`, which goes to it) and its part of the page under the plan
// (`decision`, always open). Release 1 and 2 opened one row at a time.
const plan = (p: Page) => p.getByRole("region", { name: "The plan" });
const decision = (p: Page, label: string) =>
  p.getByRole("region", { name: label, exact: true });
const toggle = (p: Page, label: string) =>
  plan(p).getByRole("button", { name: new RegExp(`^${label}`) });

async function open(p: Page, label: string) {
  await toggle(p, label).click();
  await expect(decision(p, label)).toBeInViewport();
}

async function noSideways(page: Page, width: number) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    "no sideways scroll",
  ).toBeLessThanOrEqual(width);
}

/** The hero and the top of the plan, measured. */
async function heroAndPlan(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector("main header")!;
    // Where we eat leads the page; the plan card sits under it.
    const planTop = document
      .querySelector("#decision-before")!
      .getBoundingClientRect().top;
    return {
      hero: Math.round(header.getBoundingClientRect().height),
      planTop: Math.round(planTop + window.scrollY),
    };
  });
}

test("compact hero, three venue cards, meeting spots, host's pick", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  const host = await phone(browser, 390);
  await host.page.goto("/hockey");
  await signUp(host.page, "r2-host");
  await host.page.getByLabel("Your name").fill("Lorne");
  await host.page.getByRole("button", { name: "Start it" }).click();
  await expect(host.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightPath = new URL(host.page.url()).pathname;
  await host.page.getByRole("button", { name: /Skip/ }).click();
  await expect(plan(host.page)).toBeVisible();

  // ------------------------------------------------------ the compact hero
  const header = host.page.locator("main header");
  await expect(header.getByRole("timer")).toBeVisible();
  await expect(header).toContainText(/Rogers Arena/);
  await expect(header.getByText("Home")).toBeVisible();
  await expect(header.getByText("Away")).toBeVisible();
  await expect(header.getByText(/\d+ in/)).toBeVisible();
  const m390 = await heroAndPlan(host.page);
  expect(m390.hero, "hero height at 390").toBeLessThan(500);
  // (The host is alone here, so the invite card is in the hero too.)
  expect(m390.planTop, "dinner starts in the first phone screen").toBeLessThan(
    560,
  );
  // Restaurant cards are visible immediately: with nothing scrolled, the
  // first photograph is on the first screen, above the tab bar (~70 px).
  const lead = host.page
    .getByRole("region", { name: "Places near Rogers Arena" })
    .getByRole("article")
    .first();
  await expect(lead).toBeVisible({ timeout: 30_000 });
  const leadBox = await lead.boundingBox();
  expect(
    leadBox!.y,
    "first card is on the first screen, unscrolled",
  ).toBeLessThan(844 - 150);
  await shot(host.page, "01-compact-hero-390");

  // --------------------------------------- Before the game: cards at once
  await open(host.page, "Before the game");
  const near = host.page.getByRole("region", {
    name: "Places near Rogers Arena",
  });
  const cards = near.getByRole("article");
  await expect(cards).toHaveCount(3, { timeout: 30_000 });
  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    await expect(card.getByRole("heading", { level: 4 })).toBeVisible();
    // Either Atlas's own photograph, or the designed no-photo card, never a gap.
    await expect(card.locator("[data-photo]")).toHaveCount(1);
    await expect(card).toContainText(/\d+\+ min walk/);
    await expect(
      card.getByRole("button", { name: /^Add .* and vote$/ }),
    ).toBeVisible();
  }
  // The first card is on the first screen of the open row, not behind a button.
  const first = await cards.first().boundingBox();
  expect(first!.y).toBeLessThan(844);
  await expect(
    host.page.getByRole("button", { name: /Explore places/ }),
  ).toHaveCount(0);
  await shot(host.page, "02-before-the-game-cards-390");

  // One tap adds it to the vote and votes for it; the row follows.
  const place = (await cards.first().getAttribute("aria-label"))!;
  await cards
    .first()
    .getByRole("button", { name: `Add ${place} and vote` })
    .click();
  await expect(toggle(host.page, "Before the game")).toContainText(place, {
    timeout: 15_000,
  });
  await expect(toggle(host.page, "Before the game")).toContainText("1 vote");
  await expect(
    decision(host.page, "Before the game").getByRole("button", {
      name: `Vote for ${place}`,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  // The place is on the ballot, so it is no longer one of the good bets.
  await expect(cards).toHaveCount(3);
  await expect(
    near.getByRole("article", { name: place, exact: true }),
  ).toHaveCount(0);

  // Everything else is still one tap away, and the card of a place already on
  // the vote says so.
  const all = near.getByRole("button", { name: /^See all \d+ places$/ });
  const count = Number((await all.textContent())!.match(/\d+/)![0]);
  await all.click();
  await expect(near.getByRole("article")).toHaveCount(count);
  await expect(
    near.getByRole("button", { name: `${place} is your vote` }),
  ).toBeDisabled();

  // --------------------------------------------- Meeting point: the cards
  await open(host.page, "Meeting point");
  const spots = host.page.getByRole("list", {
    name: "Places to meet near the arena",
  });
  await expect(spots.getByRole("article").first()).toBeVisible({
    timeout: 30_000,
  });
  const nSpots = await spots.getByRole("article").count();
  expect(nSpots).toBeGreaterThanOrEqual(2);
  const station = spots.getByRole("article", {
    name: "Stadium–Chinatown Station",
    exact: true,
  });
  await expect(station).toContainText("The SkyTrain stop across the street");
  await expect(station).toContainText(/\d+\+ min walk/);
  await expect(station.locator("[data-photo]")).toHaveCount(1);
  await shot(host.page, "03-meeting-spots-390");
  // The old ballot is still under the cards.
  await expect(
    decision(host.page, "Meeting point").getByRole("button", {
      name: /Just meet at our seats/,
    }),
  ).toBeVisible();

  // A vote on the card is the existing meet-spot vote.
  await station
    .getByRole("button", { name: "Back Stadium–Chinatown Station" })
    .click();
  await expect(toggle(host.page, "Meeting point")).toContainText(
    "Stadium–Chinatown Station",
  );
  await expect(toggle(host.page, "Meeting point")).toContainText("1 vote");

  // ------------------- The host's time and gate first, then picks a place.
  await open(host.page, "Getting there");
  await decision(host.page, "Getting there")
    .getByRole("button", { name: "Set a meeting point" })
    .click();
  const meet = host.page.getByRole("form", { name: "Meeting point" });
  await meet.getByLabel("Gate").selectOption("10");
  await meet.getByLabel("Time").fill("18:15");
  await meet.getByRole("button", { name: "Save" }).click();
  await expect(toggle(host.page, "Getting there")).toContainText(
    "6:15pm at the arena · Gate 10",
  );

  await open(host.page, "Meeting point");
  await spots
    .getByRole("article", { name: "Terry Fox Plaza", exact: true })
    .getByRole("button", { name: "Make Terry Fox Plaza the meeting spot" })
    .click();
  await expect(
    host.page.getByRole("status").filter({ hasText: "Host's pick" }),
  ).toContainText("Terry Fox Plaza");
  // The gate and time the host already set are kept.
  await expect(toggle(host.page, "Getting there")).toContainText(
    "6:15pm at the arena · Gate 10",
  );

  // Invite a guest, on a 320 px phone.
  await host.page.getByRole("tab", { name: /^Group/ }).click();
  await host.page.getByRole("button", { name: "Invite" }).click();
  await host.page.getByLabel("Who the invitation is for").fill("Maya");
  await host.page.getByRole("button", { name: "Make a link" }).click();
  const invitePath = new URL(
    (await host.page.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;

  const guest = await phone(browser, 320);
  await guest.page.goto(invitePath);
  await guest.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(guest.page, "r2-guest");
  await guest.page.getByLabel("Your name").fill("Maya");
  await guest.page.getByRole("button", { name: "I'm in" }).click();
  await expect(guest.page).toHaveURL(new RegExp(`${nightPath}$`));

  const m320 = await heroAndPlan(guest.page);
  expect(
    m320.planTop,
    "plan starts in the first phone screen at 320",
  ).toBeLessThan(560);
  await shot(guest.page, "04-compact-hero-320");

  // Cards, immediately, with a vote already on the board.
  await open(guest.page, "Before the game");
  const gNear = guest.page.getByRole("region", {
    name: "Places near Rogers Arena",
  });
  await expect(gNear.getByRole("article")).toHaveCount(3, { timeout: 30_000 });
  await noSideways(guest.page, 320);
  await shot(guest.page, "05-guest-cards-320");

  // She votes with one tap on a card, and the host's plan moves.
  const gPlace = (await gNear
    .getByRole("article")
    .first()
    .getAttribute("aria-label"))!;
  await gNear
    .getByRole("article")
    .first()
    .getByRole("button", { name: `Add ${gPlace} and vote` })
    .click();
  await expect(toggle(guest.page, "Before the game")).toContainText(
    `you: ${gPlace}`,
    { timeout: 15_000 },
  );

  // Meeting spots: she can vote, sees the host's pick, and cannot set it.
  await open(guest.page, "Meeting point");
  const gSpots = guest.page.getByRole("list", {
    name: "Places to meet near the arena",
  });
  await expect(gSpots.getByRole("article").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    guest.page.getByRole("status").filter({ hasText: "Host's pick" }),
  ).toContainText("Terry Fox Plaza");
  await expect(
    gSpots.getByRole("article", { name: "Terry Fox Plaza", exact: true }),
  ).toContainText("Host's pick");
  await expect(
    guest.page.getByRole("button", { name: /Meet here/ }),
  ).toHaveCount(0);
  await gSpots
    .getByRole("article", { name: "Gastown Steam Clock", exact: true })
    .getByRole("button", { name: "Back Gastown Steam Clock" })
    .click();
  await expect(toggle(guest.page, "Meeting point")).toContainText(
    "you: Gastown Steam Clock",
  );
  await noSideways(guest.page, 320);
  await shot(guest.page, "06-guest-meeting-spots-320");

  // The server, not the screen, refuses a guest setting the host's meeting point.
  const refused = await guest.page.request.put(
    `/hockey/api/occasions/${nightPath.split("/").pop()}/meetup`,
    { data: { gate: "", spot: "Somewhere I made up", time: "" } },
  );
  expect(refused.ok()).toBe(false);

  // Everything survives a reload: votes, the host's pick, gate and time.
  await host.page.reload();
  await host.page.getByRole("tab", { name: /^Plan/ }).click();
  await expect(toggle(host.page, "Before the game")).toContainText(/vote/);
  await expect(toggle(host.page, "Getting there")).toContainText(
    "6:15pm at the arena · Gate 10",
  );
  await open(host.page, "Meeting point");
  await expect(
    host.page.getByRole("status").filter({ hasText: "Host's pick" }),
  ).toContainText("Terry Fox Plaza");

  // ------------------------------------------------------------ desktop
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: await host.context.storageState(),
  });
  const deskPage = await desk.newPage();
  await deskPage.goto(`${nightPath}#plan`);
  await open(deskPage, "Before the game");
  await expect(
    deskPage
      .getByRole("region", { name: "Places near Rogers Arena" })
      .getByRole("article"),
  ).toHaveCount(3, { timeout: 30_000 });
  await noSideways(deskPage, 1280);
  await shot(deskPage, "07-desktop-before-the-game", true);
  await open(deskPage, "Meeting point");
  await shot(deskPage, "08-desktop-meeting-point", true);

  for (const c of [host.context, guest.context, desk]) await c.close();
});
