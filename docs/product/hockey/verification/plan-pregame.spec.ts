import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Locator } from "@playwright/test";
import { openDecision, openTab } from "./night-tabs";
import {
  type Person,
  moveStart,
  night,
  noSidewaysScroll,
  peopleCalled,
  signUp,
  setNight,
  snapshot,
  token,
} from "./mayhem-helpers";

/**
 * **Plan, the pregame hype machine — four real people, the real database.**
 *
 *   pat   (host, phone 390)     starts the night
 *   maya  (desktop 1280)        votes, throws a place into the mix
 *   dev   (phone 390)           votes, skips the pregame
 *   zed   (phone 320)           joins late, only looks and votes
 *
 * What it proves, in order (each `test` is one step of the same night):
 *
 *   1. three venue cards are on the page before anything is opened, each with
 *      a name, a walk, a reason to go, a vote button and a vote count
 *   2. one-tap voting: the voter sees "Your vote", everyone else sees the
 *      count and who, and it survives a reload
 *   3. while it moves: who has voted and who is still being waited on
 *   4. anyone can throw a place into the mix from Passport's places browser
 *      (and by typing a name); it lands on the ballot with their vote on it
 *   5. once everyone has voted the winner is the plan: shown big, with the
 *      others one tap away, and it is the default meeting point — no second vote
 *   6. "Joining pregame / Meeting at the arena / Not sure yet", visible to the
 *      group; the arena crew gets a place to meet and directions
 *   7. the host overrides the meeting point; a guest cannot (UI and API);
 *      clearing it returns to the pregame winner
 *   8. the after-party: cards, hours, voting and proposing before the game
 *   9. a night created before plan-migration.sql has no "joining?" question
 *      and still works; applying the migration (twice) brings it in
 *  10. after the game: the after-party leads; it locks at warm-up for the
 *      pregame ("Locked in")
 *  11. phones: nothing scrolls sideways at 390 and 320
 *
 * Run against `next start` on the stack's env with the Atlas stand-in
 * (atlas-seats-stub.mjs serving a saved production body):
 *   set -a; . "$STACK/env"; set +a
 *   PLAN_SHOTS=docs/product/hockey/plan E2E_PORT=3130 STACK=$STACK \
 *     npx playwright test -c docs/product/hockey/verification plan-pregame
 */

peopleCalled("plan");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
test.skip(!!process.env.CONFIRM_EMAIL, "needs an auto-confirming stack");

const SHOTS = process.env.PLAN_SHOTS;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Specs run from the repository root (README.md here).
const here = path.join(process.cwd(), "docs/product/hockey/verification");

let pat: Person;
let maya: Person;
let dev: Person;
let zed: Person;

const pregame = (p: Person) =>
  p.page.getByRole("region", { name: "Pregame", exact: true });
const meetUp = (p: Person) =>
  p.page.getByRole("region", { name: "Meet up", exact: true });
const after = (p: Person) =>
  p.page.getByRole("region", { name: /^(After|What's next)$/ });

/** The venue cards of a stop, as articles. */
const cards = (region: Locator) => region.getByRole("article");

async function shot(p: Person, name: string, full = true) {
  if (!SHOTS) return;
  await p.page.waitForTimeout(700);
  await p.page.screenshot({
    path: `${SHOTS}/${name}.png`,
    fullPage: full,
  });
}

/** Photograph of the stop itself, not the whole page (the tab bar floats). */
async function shotOf(p: Person, region: Locator, name: string) {
  if (!SHOTS) return;
  await region.scrollIntoViewIfNeeded();
  await p.page.waitForTimeout(900);
  await region.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function join(
  browser: Browser,
  who: string,
  name: string,
  opts: { width: number; desktop?: boolean },
): Promise<Person> {
  const res = await pat.page.request.post(
    `/hockey/api/occasions/${night}/invites`,
    { data: { label: name } },
  );
  const { token: invitation } = await res.json();
  const context = await browser.newContext(
    opts.desktop
      ? { viewport: { width: opts.width, height: 1000 } }
      : {
          viewport: { width: opts.width, height: 844 },
          isMobile: true,
          hasTouch: true,
        },
  );
  const page = await context.newPage();
  await page.goto(`/hockey/join/${invitation}`);
  await page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(page, who);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "I'm in" }).click();
  await expect(page).toHaveURL(new RegExp(`/hockey/${night}$`));
  return { who, name, page, id: (await snapshot(page)).state.meId };
}

/** Wait until Atlas has answered and the stop has its cards. */
async function seeCards(p: Person, atLeast = 3) {
  await expect
    .poll(async () => cards(pregame(p)).count(), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(atLeast);
}

const voteButton = (card: Locator) =>
  card.getByRole("button", { name: /^(Add .+ and vote|Vote for .+)$/ });

async function namesOf(region: Locator) {
  return cards(region).evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
}

async function sql(text: string) {
  const { default: pg } = await import(
    path.join(process.env.STACK!, "node_modules/pg/lib/index.js")
  );
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 54329,
    user: "postgres",
    database: "postgres",
  });
  await client.connect();
  try {
    return await client.query(text);
  } finally {
    await client.end();
  }
}

test("setup: pat hosts, maya, dev and zed join", async ({ browser }) => {
  test.setTimeout(300_000);
  const host = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await host.goto("/hockey");
  await signUp(host, "pat");
  await host.getByLabel("Your name").fill("Pat");
  await host.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await host.getByLabel("Game date").fill(in2);
  await host.getByLabel("Puck drop time").fill("19:00");
  await host.getByRole("button", { name: "Start it" }).click();
  await expect(host).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(host.url().split("/").pop()!);
  await host.getByRole("button", { name: /Skip/ }).click();
  pat = {
    who: "pat",
    name: "Pat",
    page: host,
    id: (await snapshot(host)).state.meId,
  };
  maya = await join(browser, "maya", "Maya", { width: 1280, desktop: true });
  dev = await join(browser, "dev", "Dev", { width: 390 });
  zed = await join(browser, "zed", "Zed", { width: 320 });
  for (const p of [pat, maya, dev, zed])
    await expect(pregame(p)).toBeVisible({ timeout: 30_000 });
});

test("1. three venue cards are on the page, nothing opened", async () => {
  test.setTimeout(120_000);
  for (const p of [pat, maya, dev]) await seeCards(p);
  const region = pregame(pat);
  // Not a dropdown: no button has to be pressed to see a place.
  await expect(region.locator("button[aria-controls]")).toHaveCount(0);
  const found = cards(region);
  expect(await found.count()).toBeGreaterThanOrEqual(3);
  const first = found.first();
  await expect(first).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const card = found.nth(i);
    await card.scrollIntoViewIfNeeded();
    const text = (await card.innerText()).replace(/\s+/g, " ");
    // The place, the walk (an estimate, said so), a reason, a vote.
    expect(text, `card ${i}`).toMatch(/\d+\+ ?min ?walk/i);
    expect(text, `card ${i} says the walk is an estimate`).toMatch(/estimate/i);
    expect(text, `card ${i} has a reason to go`).toMatch(/Atlas|walk|min from/);
    await expect(voteButton(card)).toBeVisible();
    await expect(voteButton(card)).toBeEnabled();
    expect(text).toMatch(/0 votes/);
  }
  // At least two of the three show the place's own photograph, loaded, with
  // its source on it where it is not plainly the place itself.
  const photos = await found
    .locator("[data-photo]:not([data-photo=none]) img")
    .evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).slice(0, 3).map((i) => ({
        loaded: i.complete && i.naturalWidth >= 400,
        src: i.src,
      })),
    );
  expect(photos.length, "cards with a photograph").toBeGreaterThanOrEqual(2);
  for (const photo of photos)
    expect(photo.loaded, `photo loaded: ${photo.src}`).toBe(true);
  // The invitation to add one is on the page too.
  await expect(
    region.getByText("Think you know somewhere better?"),
  ).toBeVisible();
  await expect(region.getByText("Throw it into the mix.")).toBeVisible();
  await shot(pat, "01-pregame-fresh-phone-390");
  await shotOf(maya, pregame(maya), "02-pregame-fresh-desktop");
});

test("2. one-tap voting shows to everyone and persists", async () => {
  test.setTimeout(120_000);
  const names = await namesOf(pregame(pat));
  const [a] = names;
  const card = (p: Person) => pregame(p).getByRole("article", { name: a });
  await voteButton(card(pat)).click();
  // Pat sees it at once, in the same place.
  await expect(card(pat).getByRole("button", { pressed: true })).toContainText(
    "Your vote",
  );
  await expect(card(pat)).toContainText("1 vote");
  // Everyone else sees one vote, whose.
  await expect(card(maya)).toContainText("1 vote", { timeout: 20_000 });
  await expect(
    card(maya).locator("[aria-label*='Pat'], [title*='Pat']").first(),
  ).toBeVisible();
  // …and it is the database's: a reload, and a fresh page, show the same.
  await pat.page.reload();
  await expect(card(pat)).toContainText("1 vote", { timeout: 30_000 });
  await expect(card(pat).getByRole("button", { pressed: true })).toBeVisible();
  const snap = await snapshot(pat.page);
  expect(snap).toBeTruthy();
  // Voting for another place moves the vote; it is never two.
  const b = names[1];
  await voteButton(pregame(pat).getByRole("article", { name: b })).click();
  await expect(pregame(pat).getByRole("article", { name: b })).toContainText(
    "1 vote",
  );
  await expect(card(pat)).toContainText("0 votes");
  await voteButton(card(pat)).click();
  await expect(card(pat)).toContainText("1 vote");
  await expect(pregame(pat).getByRole("article", { name: b })).toContainText(
    "0 votes",
  );
});

test("3. while it moves: who has voted, who is being waited on", async () => {
  test.setTimeout(120_000);
  const [a] = await namesOf(pregame(pat));
  const status = pregame(maya).getByText(/have voted/);
  await expect(status).toContainText(/1 of 4 have voted/, { timeout: 20_000 });
  await expect(status).toContainText(/Waiting on .*Maya/);
  await expect(
    pregame(maya).getByText(`${a} leads with 1 vote.`),
  ).toBeVisible();
  await shot(maya, "03-voting-in-progress-desktop", false);
});

let thrownIn = "";

test("4. a place thrown into the mix lands on the ballot with its vote", async () => {
  test.setTimeout(180_000);
  const onBallot = await namesOf(pregame(maya));
  await maya.page
    .getByRole("button", { name: /^Find one in Passport/ })
    .click();
  const sheet = maya.page.getByRole("dialog", { name: /^Near / });
  await expect(sheet).toBeVisible();
  await shotOf(maya, sheet, "04-find-one-in-passport-desktop");
  // Search by name, the way Discovery's one box works: a word, not a menu.
  const search = sheet.getByLabel("Search places near the arena");
  await search.fill("zzzz-nothing");
  await expect(sheet.getByText(/Nothing near the arena matches/)).toBeVisible();
  await search.fill("");
  const pool = sheet
    .getByRole("region", { name: /Add one to the vote|Good bets nearby/ })
    .getByRole("article");
  await expect(pool.first()).toBeVisible({ timeout: 60_000 });
  const pick = await pool
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""))
    .then((all) => all.find((n) => !onBallot.includes(n))!);
  thrownIn = pick;
  await search.fill(pick.slice(0, 5));
  await sheet
    .getByRole("button", { name: `Add ${pick} and vote` })
    .first()
    .click();
  await sheet.getByRole("button", { name: "Close explore" }).click();
  await expect(sheet).toHaveCount(0);
  // Maya's own pick is on the ballot with her vote on it…
  const mine = pregame(maya).getByRole("article", { name: pick });
  await expect(mine).toContainText("1 vote", { timeout: 30_000 });
  await expect(mine.getByRole("button", { pressed: true })).toBeVisible();
  // …and Pat sees it, and who put it there.
  const theirs = pregame(pat).getByRole("article", { name: pick });
  await expect(theirs).toBeVisible({ timeout: 30_000 });
  await expect(theirs).toContainText("1 vote");
  await expect(theirs).toContainText("Maya put this on the vote");
  // A name nobody has in Atlas can be typed in too.
  await pregame(maya)
    .getByLabel("Somewhere else? Type a name")
    .fill("Grandma's basement");
  await pregame(maya).getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    pregame(maya).getByRole("list", { name: "On the vote" }),
  ).toContainText("Grandma's basement", { timeout: 20_000 });
  await shot(pat, "05-after-a-throw-in-phone-390");
});

test("5. everyone has voted: the winner is the plan, and the meeting point", async () => {
  test.setTimeout(180_000);
  const [a] = await namesOf(pregame(pat));
  // Pat is behind `a`, Maya behind her own pick. Dev and Zed tip it.
  await voteButton(pregame(dev).getByRole("article", { name: a })).click();
  await expect(pregame(dev).getByRole("article", { name: a })).toContainText(
    "2 votes",
  );
  await expect(pregame(zed).getByText(/3 of 4 have voted/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(pregame(zed).getByText(/Waiting on Zed\./)).toBeVisible();
  await voteButton(pregame(zed).getByRole("article", { name: a })).click();

  for (const p of [pat, maya, dev, zed]) {
    await expect(pregame(p).getByText(`We're meeting at ${a}`)).toBeVisible({
      timeout: 25_000,
    });
    // Featured: one big card, with its source, the others one tap away.
    // Whoever put places on the vote has the others open under the winner
    // (Pat and Maya did); the others see the winner alone.
    if (p === dev || p === zed) await expect(cards(pregame(p))).toHaveCount(1);
    else expect(await cards(pregame(p)).count()).toBeGreaterThan(1);
    await expect(pregame(p).getByText("3 votes")).toBeVisible();
  }
  await shot(pat, "06-winner-phone-390");
  await shotOf(maya, pregame(maya), "07-winner-desktop");

  // The meeting point is the winner. Nobody was asked to vote on it.
  for (const p of [pat, maya, dev, zed]) {
    await expect(meetUp(p)).toContainText(a, { timeout: 20_000 });
    await expect(meetUp(p)).toContainText(/Pregame winner/);
    await expect(meetUp(p)).toContainText(/Skipping the pregame\? Outside/);
    await expect(
      p.page.getByRole("region", { name: "Where are we meeting?" }),
    ).toHaveCount(0);
  }
  const snap = await snapshot(pat.page);
  const blocks = (
    snap as unknown as {
      definition: { blocks: { promptIds?: string[] }[] };
    }
  ).definition.blocks;
  expect(blocks.flatMap((b) => b.promptIds ?? [])).not.toContain("meet-spot");

  // The others stay reachable, and the vote still moves while it is open.
  const table = pregame(dev).getByRole("button", {
    name: /Still on the table|Hide the other options/,
  });
  await table.click();
  await expect(cards(pregame(dev)).nth(1)).toBeVisible();
  expect(await cards(pregame(dev)).count()).toBeGreaterThanOrEqual(3);
  await expect(
    pregame(dev).getByRole("article", { name: thrownIn }),
  ).toBeVisible();
  await shot(dev, "08-others-still-on-the-table-phone-390");
  await table.click();
});

test("6. who is joining, who is meeting at the arena", async () => {
  test.setTimeout(120_000);
  const group = (p: Person) =>
    pregame(p).getByRole("group", { name: "Are you joining the pregame?" });
  await expect(group(pat)).toBeVisible();
  await group(pat).getByRole("button", { name: "Joining pregame" }).click();
  await group(maya)
    .getByRole("button", { name: "Meeting at the arena" })
    .click();
  await expect(
    group(pat).getByRole("button", { name: "Joining pregame", pressed: true }),
  ).toBeVisible();
  // The group sees it: a count and who.
  await expect(group(dev)).toContainText("Joining pregame", {
    timeout: 20_000,
  });
  await expect(
    group(dev).getByRole("button", { name: "Meeting at the arena" }),
  ).toBeVisible();
  // Reload keeps it.
  await maya.page.reload();
  await expect(
    group(maya).getByRole("button", {
      name: "Meeting at the arena",
      pressed: true,
    }),
  ).toBeVisible({ timeout: 30_000 });

  // Meet up tells each crew where to go.
  await openDecision(maya.page, "Meet up");
  const crew = (p: Person, id: string) =>
    meetUp(p).locator(`[data-crew=${id}]`);
  await expect(crew(maya, "pregame")).toContainText("Pat", { timeout: 20_000 });
  await expect(crew(maya, "arena")).toContainText("Maya");
  await expect(crew(maya, "arena")).toContainText("Outside Rogers Arena");
  // Practical directions for whoever skips the pregame, in both map apps,
  // handed to the phone's own app and ending at the arena (no gate is known).
  const links = crew(maya, "arena").getByRole("link");
  await expect(links).toHaveCount(2);
  const hrefs = await links.evaluateAll((as) =>
    as.map((a) => (a as HTMLAnchorElement).href),
  );
  expect(hrefs.join(" ")).toMatch(/google\.com\/maps\/dir/);
  expect(hrefs.join(" ")).toMatch(/maps\.apple\.com/);
  expect(hrefs.join(" ")).toContain("49.27");
  // Dev answered nothing: not sure yet.
  await openDecision(dev.page, "Meet up");
  await expect(crew(dev, "unsure")).toContainText("Dev", { timeout: 20_000 });
  await expect(crew(dev, "unsure")).toContainText("Zed");
  // The pregame crew walks to the winner.
  await openDecision(pat.page, "Meet up");
  await expect(crew(pat, "pregame").getByRole("link").first()).toHaveAttribute(
    "href",
    /destination=49\./,
  );
  await shotOf(maya, meetUp(maya), "09-meet-up-arena-crew-desktop");
  await openDecision(dev.page, "Meet up");
  await shot(dev, "10-meet-up-crews-phone-390");
});

test("7. the host can override the meeting point; a guest cannot", async () => {
  test.setTimeout(180_000);
  await openDecision(pat.page, "Meet up");
  // A guest has no override control, and the API says no too.
  await expect(
    meetUp(maya).getByRole("button", { name: /meeting point/i }),
  ).toHaveCount(0);
  const refused = await maya.page.request.put(
    `/hockey/api/occasions/${night}/meetup`,
    { data: { spot: "Maya's call", gate: "", time: "18:00" } },
  );
  expect(refused.status()).toBe(403);
  const refusedClear = await dev.page.request.delete(
    `/hockey/api/occasions/${night}/meetup`,
  );
  expect(refusedClear.status()).toBe(403);

  await meetUp(pat)
    .getByRole("button", { name: "Override the meeting point" })
    .click();
  const form = pat.page.getByRole("form", {
    name: "Override the meeting point",
  });
  await form
    .getByLabel("Meet at", { exact: true })
    .selectOption({ label: "At the arena (Rogers Arena)" });
  await form.getByLabel("Gate", { exact: true }).selectOption("6");
  await form
    .getByLabel("Where exactly (optional)", { exact: true })
    .fill("By the big doors");
  await form.getByLabel("Time", { exact: true }).fill("18:15");
  await form.getByRole("button", { name: "Make it official" }).click();
  await expect(form).toHaveCount(0);

  // Everyone is told, and the winner no longer is "where we meet".
  for (const p of [pat, maya, dev, zed]) {
    await openDecision(p.page, "Meet up");
    await expect(meetUp(p).locator("[data-crew=host]")).toContainText(
      "Gate 6 · By the big doors · 6:15 p.m.",
      { timeout: 25_000 },
    );
    await expect(meetUp(p)).toContainText(/The host's call/);
  }
  await shotOf(maya, meetUp(maya), "11-host-override-desktop");
  // It is stored where the host always stored it, and survives a reload.
  await dev.page.reload();
  await openDecision(dev.page, "Meet up");
  await expect(meetUp(dev)).toContainText("Gate 6 · By the big doors", {
    timeout: 25_000,
  });

  // Clear it: back to the pregame winner, nothing else lost.
  await openDecision(pat.page, "Meet up");
  await meetUp(pat)
    .getByRole("button", { name: "Back to the pregame plan" })
    .click();
  await expect(meetUp(maya)).toContainText(/Pregame winner/, {
    timeout: 25_000,
  });
  await expect(meetUp(maya).locator("[data-crew=host]")).toHaveCount(0);
  // The host can name a place instead (the winner's rival), too.
  await meetUp(pat)
    .getByRole("button", { name: "Override the meeting point" })
    .click();
  const again = pat.page.getByRole("form", {
    name: "Override the meeting point",
  });
  await again
    .getByLabel("Meet at", { exact: true })
    .selectOption({ label: thrownIn });
  await again.getByLabel("Time", { exact: true }).fill("17:45");
  await again.getByRole("button", { name: "Make it official" }).click();
  await expect(meetUp(zed)).toContainText(thrownIn, { timeout: 25_000 });
  await expect(meetUp(zed)).toContainText("5:45 p.m.");
  await openDecision(pat.page, "Meet up");
  await meetUp(pat)
    .getByRole("button", { name: "Back to the pregame plan" })
    .click();
  await expect(meetUp(zed)).toContainText(/Pregame winner/, {
    timeout: 25_000,
  });
});

test("8. the after-party: cards, hours, voting and proposing", async () => {
  test.setTimeout(240_000);
  const stop = after(pat);
  await expect(stop).toBeVisible();
  await stop.getByRole("button", { name: "Plan the after" }).click();
  const board = stop.getByRole("region", { name: "So. Where are we going?" });
  await expect(board).toBeVisible();
  await expect
    .poll(async () => cards(board).count(), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(3);
  const names = await namesOf(board);
  const text = (await cards(board).first().innerText()).replace(/\s+/g, " ");
  expect(text).toMatch(/\d+\+ ?min ?walk/i);
  // Hours are Atlas's, quoted — or the card says plainly there are none.
  expect(text).toMatch(/Game day:|no hours on file|quotes hours|Atlas/i);
  await shotOf(pat, board, "12-after-party-cards-phone-390");

  // The mood answers are still there, and voting on them works.
  await expect(
    board.getByRole("list", { name: "On the vote" }).getByText("Keep going"),
  ).toBeVisible();
  await board.getByRole("button", { name: "Vote for Keep going" }).click();
  await expect(
    board.getByRole("button", { name: "Vote for Keep going", pressed: true }),
  ).toBeVisible();

  // Pat backs a place, Maya (on desktop) sees it; Maya proposes another.
  await voteButton(board.getByRole("article", { name: names[0] })).click();
  await expect(board.getByRole("article", { name: names[0] })).toContainText(
    "1 vote",
  );
  await maya.page.reload();
  await openTab(maya.page, "Plan");
  const mayaBoard = after(maya).getByRole("region", {
    name: "So. Where are we going?",
  });
  await after(maya).getByRole("button", { name: "Plan the after" }).click();
  await expect(
    mayaBoard.getByRole("article", { name: names[0] }),
  ).toContainText("1 vote", { timeout: 30_000 });
  await mayaBoard
    .getByRole("button", { name: /^Find one in Passport/ })
    .click();
  const sheet = maya.page.getByRole("dialog", { name: /after the game/ });
  await expect(sheet).toBeVisible();
  const pool = sheet
    .getByRole("region", { name: /Add one to the vote|Good bets nearby/ })
    .getByRole("article");
  await expect(pool.first()).toBeVisible({ timeout: 60_000 });
  const pick = await pool
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""))
    .then((all) => all.find((n) => !names.includes(n))!);
  await sheet
    .getByRole("button", { name: `Add ${pick} and vote` })
    .first()
    .click();
  await sheet.getByRole("button", { name: "Close explore" }).click();
  await expect(mayaBoard.getByRole("article", { name: pick })).toContainText(
    "1 vote",
    { timeout: 30_000 },
  );
  // Pat sees Maya's, and who put it there.
  await expect(board.getByRole("article", { name: pick })).toContainText(
    "Maya put this on the vote",
    { timeout: 30_000 },
  );
  await shot(maya, "13-after-party-desktop", false);
  // Pregame and after are different questions, even for the same place: the
  // after-party vote did not move anyone's pregame vote.
  const pregameVotes = await snapshot(pat.page);
  expect(pregameVotes).toBeTruthy();
  await expect(pregame(pat).getByText(/We're meeting at/)).toBeVisible();
});

test("9. a night from before plan-migration.sql still works, and the migration brings the question in", async () => {
  test.setTimeout(240_000);
  // Make this night one that was created before the release: no rule row.
  const rule = "occasion_id = '" + night + "' and prompt_id = 'pregame-plans'";
  const rows = await sql(
    `select count(*)::int as n from passport_occasion_prompts where ${rule}`,
  );
  expect(rows.rows[0].n).toBe(1);
  await sql(`delete from passport_occasion_prompts where ${rule}`);
  await pat.page.reload();
  await expect(pregame(pat)).toBeVisible({ timeout: 30_000 });
  // The page works: the winner is still the default, nothing is faked.
  await expect(pregame(pat).getByText(/We're meeting at/)).toBeVisible();
  await expect(
    pregame(pat).getByRole("group", { name: "Are you joining the pregame?" }),
  ).toHaveCount(0);
  await openDecision(pat.page, "Meet up");
  await expect(meetUp(pat)).toContainText(/Pregame winner/);
  // The migration, twice: the question is back, nobody's other answer moved.
  const migration = readFileSync(
    path.join(here, "..", "plan-migration.sql"),
    "utf8",
  );
  await sql(migration);
  await sql(migration);
  const count = await sql(
    `select count(*)::int as n from passport_occasion_prompts where ${rule}`,
  );
  expect(count.rows[0].n).toBe(1);
  await pat.page.reload();
  await expect(
    pregame(pat).getByRole("group", { name: "Are you joining the pregame?" }),
  ).toBeVisible({ timeout: 30_000 });
  // Answers were never deleted by the rehearsal: the rule's rollback leaves them.
  const rollback = readFileSync(
    path.join(here, "..", "plan-rollback.sql"),
    "utf8",
  );
  await sql(rollback);
  await sql(migration);
  await pat.page.reload();
  await expect(
    pregame(pat).getByRole("group", {
      name: "Are you joining the pregame?",
    }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    pregame(pat)
      .getByRole("group", { name: "Are you joining the pregame?" })
      .getByRole("button", { name: "Joining pregame", pressed: true }),
  ).toBeVisible();
});

test("10. at warm-up the pregame locks in; after the game the after-party leads", async () => {
  test.setTimeout(240_000);
  // Warm-up: votes close 90 minutes before puck drop.
  await moveStart(new Date(Date.now() + 60 * 60_000), "pat");
  await pat.page.reload();
  await expect(pregame(pat).getByText("Locked in")).toBeVisible({
    timeout: 30_000,
  });
  // The vote is closed: nothing on the page takes a vote any more.
  for (const button of await pregame(pat)
    .getByRole("button", { name: /^(Vote for|Add .+ and vote)/ })
    .all())
    await expect(button).toBeDisabled();
  await expect(
    pregame(pat)
      .getByText(/Voting's closed/)
      .first(),
  ).toBeVisible();
  await shot(pat, "14-locked-in-phone-390");
  // The game is over: what's next leads, open, with its cards.
  await moveStart(new Date(Date.now() - 4 * 3_600_000), "pat");
  await maya.page.reload();
  await openTab(maya.page, "Plan");
  const next = after(maya);
  await expect(next).toContainText("What's next");
  const board = next.getByRole("region", { name: "So. Where are we going?" });
  await expect(board).toBeVisible({ timeout: 30_000 });
  await expect(next.locator("button[aria-controls]").first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  // Pat's earlier vote for the after-party is still there.
  await expect(
    board.getByRole("list", { name: "On the vote" }).getByText("Keep going"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(board.getByRole("list", { name: "On the vote" })).toContainText(
    "1 vote",
  );
  await shot(maya, "15-whats-next-desktop", false);
});

test("11. phones: nothing scrolls sideways, every control is a thumb's size", async () => {
  test.setTimeout(240_000);
  await moveStart(new Date(Date.now() + 2 * 86_400_000), "pat");
  for (const p of [pat, dev, zed]) {
    await p.page.reload();
    await expect(pregame(p)).toBeVisible({ timeout: 30_000 });
    await seeCards(p, 1);
    await noSidewaysScroll(p.page);
    const tooSmall = await p.page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "[role=region][aria-label=Pregame] button, [role=region][aria-label=Pregame] a",
        ),
      ]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => el.getBoundingClientRect().height < 40)
        .map((el) => (el.textContent || "").trim().slice(0, 30)),
    );
    expect(tooSmall, "controls under 40px in Pregame").toEqual([]);
    const tiny = await p.page.evaluate(() =>
      [...document.querySelectorAll("[role=region][aria-label=Pregame] *")]
        .filter(
          (el) =>
            el.children.length === 0 &&
            el.textContent?.trim() &&
            parseFloat(getComputedStyle(el).fontSize) < 12,
        )
        .map((el) => el.textContent!.trim().slice(0, 30)),
    );
    expect(tiny, "text under 12px in Pregame").toEqual([]);
  }
  await shot(zed, "16-pregame-phone-320");
  // And the host can still reach every stop on the smallest phone.
  await openDecision(zed.page, "Meet up");
  await noSidewaysScroll(zed.page);
  await shot(zed, "17-meet-up-phone-320");
  // Nothing anybody typed or voted for is missing from the database either.
  const t = await token("pat");
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasion_responses?occasion_id=eq.${night}&prompt_id=eq.pregame-spot&select=user_id`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        authorization: `Bearer ${t}`,
      },
    },
  );
  expect(((await res.json()) as unknown[]).length).toBe(4);
});
