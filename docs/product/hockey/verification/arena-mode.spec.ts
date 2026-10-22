import fs from "node:fs";
import path from "node:path";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Arena Mode with three real people on three phones, and a stranger.**
 *
 * Needs the local stack WITH the arena migration (stack.mjs start, the
 * default) and the app built against it. Proves, end to end through the UI:
 *
 *   the door from Plan → before the window: explore only → the night moves
 *   to an hour from now → a guest checks in by tapping the map, with a
 *   status → the host sees her character on the map and in the herd →
 *   "Where you at?" reaches a friend who answers by checking in → a one-tap
 *   meetup request and its "On my way" → Find the herd → Find this legend
 *   zooms to her → three quests started, joined, reported and finished →
 *   food sorted by the host's seat, with the dietary guide and the dated
 *   press prices → strangers, signed-out people and bad input are refused
 *   → Vanish → a removed guest loses access and disappears → after the
 *   night everything is gone → it fits a 320 px phone → reduced motion →
 *   the night page itself is unchanged.
 */

const stamp = Date.now().toString(36);
const SHOTS = process.env.ARENA_SHOTS;
const STACK = process.env.STACK ?? "/tmp/hockey-stack";
const stackEnv = Object.fromEntries(
  fs
    .readFileSync(`${STACK}/env`, "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SUPABASE = stackEnv.NEXT_PUBLIC_SUPABASE_URL;
const ANON = stackEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const email = (who: string) => `arena-${who}-${stamp}@example.test`;

async function phone(
  browser: Browser,
  width: number,
  opts: { reducedMotion?: "reduce" } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...opts,
  });
  return { context, page: await context.newPage() };
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(email(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function token(who: string) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: email(who), password: TEST_PASSWORD }),
  });
  return (await res.json()).access_token as string;
}

/** The host moves the night, under their own RLS, as screenshots.mjs does. */
async function moveStart(nightId: string, startsAt: Date) {
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${await token("host")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ starts_at: startsAt.toISOString() }),
    },
  );
  expect(res.ok, `move start ${res.status}`).toBe(true);
}

async function shot(page: Page, name: string, full = false) {
  if (!SHOTS) return;
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: full,
  });
}

const map = (page: Page) => page.locator("svg[data-level]");
const herd = (page: Page, who: string) => page.getByTestId(`herd-${who}`);
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const arenaTab = (page: Page, name: string) =>
  page
    .getByRole("tablist", { name: "Arena Mode" })
    .getByRole("tab", { name: new RegExp(`^${name}`) });
const level = (page: Page, name: string) =>
  page
    .getByRole("tablist", { name: "Level" })
    .getByRole("tab", { name: new RegExp(`^${name}`) });

/** No sideways scroll; every HTML control a thumb's size; no tiny HTML text. */
async function fitsThePhone(page: Page, width: number) {
  const report = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const small = [
      ...main.querySelectorAll<HTMLElement>(
        "a, button, select, input, summary",
      ),
    ]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.height < 40)
      .map(
        ({ el, box }) =>
          `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(box.height)}px`,
      );
    const tiny = [
      ...main.querySelectorAll<HTMLElement>(
        "p, span, li, a, button, label, td, h2, h3",
      ),
    ]
      .filter((el) => el.offsetParent !== null && el.textContent?.trim())
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
      .map((el) => el.textContent!.trim().slice(0, 30));
    return { scroll: document.documentElement.scrollWidth, small, tiny };
  });
  expect(report.scroll, "no sideways scroll").toBeLessThanOrEqual(width);
  expect(report.small, "taps under 40px").toEqual([]);
  expect(report.tiny, "text under 12px").toEqual([]);
}

test.describe.configure({ mode: "serial" });

test("Arena Mode: three friends, a stranger, the window, privacy and quests", async ({
  browser,
}) => {
  test.setTimeout(420_000);
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  // ------------------------------------------------------------ the host
  const host = await phone(browser, 390);
  await host.page.goto("/hockey");
  await signUp(host.page, "host");
  await host.page.getByLabel("Your name").fill("Lorne");
  await host.page.getByRole("button", { name: "Start it" }).click();
  await expect(host.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = new URL(host.page.url()).pathname.split("/").pop()!;
  const arenaPath = `/hockey/${nightId}/arena`;
  await host.page.getByRole("button", { name: /Skip/ }).click();

  // The door is on Plan, with Our Seats still there under it.
  const door = host.page.getByTestId("arena-door");
  await expect(door).toBeVisible();
  await expect(
    host.page.getByRole("region", { name: "Our seats" }),
  ).toBeVisible();
  await shot(host.page, "00-door-on-plan");
  await door.click();
  await expect(host.page).toHaveURL(new RegExp(`${arenaPath}$`));

  // Days before the game: explore, but nobody can check in.
  await expect(host.page.getByText(/Check-ins open at/)).toBeVisible();
  await expect(map(host.page)).toBeVisible();
  await expect(
    host.page.getByRole("button", { name: "📍 I'm here", exact: true }),
  ).toHaveCount(0);
  const early = await host.page.request.post(
    `/hockey/api/occasions/${nightId}/arena`,
    {
      data: { type: "checkin", place: "sec:309" },
    },
  );
  expect(early.status(), "no check-in before the window").toBe(409);

  // The host's seat (Our Seats), and the game an hour from now.
  const me = (
    await (
      await host.page.request.get(`/hockey/api/occasions/${nightId}/arena`)
    ).json()
  ).me;
  const seat = await host.page.request.put(
    `/hockey/api/occasions/${nightId}/seats`,
    {
      data: { for: me, section: "309", row: "12", seats: "3" },
    },
  );
  expect(seat.ok()).toBe(true);
  await moveStart(nightId, new Date(Date.now() + 60 * 60_000));
  await host.page.reload();
  await expect(host.page.getByTestId("sharing")).toContainText("You're hidden");
  // The host's seat puts them on Level 300, in their section.
  await expect(level(host.page, "Level 300")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await shot(host.page, "01-host-hidden-level-300");

  // ------------------------------------------------------ two friends join
  async function invite(label: string) {
    const res = await host.page.request.post(
      `/hockey/api/occasions/${nightId}/invites`,
      {
        data: { label },
      },
    );
    return `/hockey/join/${(await res.json()).token}`;
  }
  async function join(
    who: string,
    name: string,
    width: number,
    reduced = false,
  ) {
    const p = await phone(
      browser,
      width,
      reduced ? { reducedMotion: "reduce" } : {},
    );
    await p.page.goto(await invite(name));
    await p.page.getByRole("link", { name: "Sign in to see it" }).click();
    await signUp(p.page, who);
    await p.page.getByLabel("Your name").fill(name);
    await p.page.getByRole("button", { name: "I'm in" }).click();
    await expect(p.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
    await p.page.goto(arenaPath);
    return p;
  }
  const maya = await join("maya", "Maya", 320);
  const sam = await join("sam", "Sam", 375, true);
  const ids = async (p: Page) =>
    (
      await (
        await p.request.get(`/hockey/api/occasions/${nightId}/arena`)
      ).json()
    ).me as string;
  const mayaId = await ids(maya.page);
  const samId = await ids(sam.page);

  // -------------------------------- Maya checks in by tapping the map
  await expect(maya.page.getByTestId("sharing")).toContainText("You're hidden");
  await level(maya.page, "Level 300").click();
  await maya.page
    .getByRole("button", { name: "📍 I'm here", exact: true })
    .click();
  const sheet = dialog(maya.page, "Where are you?");
  await expect(sheet).toContainText("Only the 2 other people on this night");
  await expect(sheet).toContainText("never GPS");
  await sheet.getByRole("button", { name: "In line. Pray for me." }).click();
  await shot(maya.page, "02-guest-check-in-sheet-320");
  await sheet.getByRole("button", { name: /Pick it on the map/ }).click();
  await expect(maya.page.getByText("Tap where you are")).toBeVisible();
  await maya.page.locator('[data-spot="300:J:304"]').dispatchEvent("click");
  await expect(maya.page.getByTestId("sharing")).toContainText("Hot Dogs (J)");
  await expect(
    map(maya.page).locator(`[data-person="${mayaId}"]`),
  ).toBeVisible();

  // The host sees her character, on the map and in the herd.
  await expect(map(host.page).locator(`[data-person="${mayaId}"]`)).toBeVisible(
    { timeout: 15_000 },
  );
  await expect(herd(host.page, "Maya")).toContainText("Hot Dogs (J)");
  await expect(herd(host.page, "Maya")).toContainText("In line. Pray for me.");
  await expect(herd(host.page, "Maya")).toContainText(/just now|min ago/);
  await shot(host.page, "03-host-sees-maya");

  // ------------------------------------------- "Where you at, Sam?"
  await herd(host.page, "Sam")
    .getByRole("button", { name: /Where you at, Sam/ })
    .click();
  await expect(host.page.getByText("Asked Sam where they are.")).toBeVisible();
  const asked = sam.page.locator('[data-ping="where"]');
  await expect(asked).toContainText("Lorne is looking for you", {
    timeout: 15_000,
  });
  await shot(sam.page, "04-sam-is-asked-375");
  await asked.getByRole("button", { name: /Check in/ }).click();
  await dialog(sam.page, "Where are you?")
    .getByRole("button", { name: /Outside the arena/ })
    .click();
  await expect(herd(host.page, "Sam")).toContainText("Outside the arena", {
    timeout: 15_000,
  });

  // ------------------------------- a one-tap meetup request, answered
  await arenaTab(maya.page, "The herd").click();
  await herd(maya.page, "Lorne")
    .getByRole("button", { name: "🤝 Meet me" })
    .click();
  const meet = host.page.locator('[data-ping="meet"]');
  await expect(meet).toContainText("Maya wants to meet you at Hot Dogs (J)", {
    timeout: 15_000,
  });
  await meet.getByRole("button", { name: "On my way" }).click();
  await expect(
    host.page.getByText("Told Maya you're on the way."),
  ).toBeVisible();
  await expect(
    maya.page.getByRole("region", { name: "What you sent" }),
  ).toContainText("✅ Lorne", { timeout: 15_000 });

  // ------------------------------------------------------- find the herd
  await host.page.getByRole("button", { name: "🐃 Find the herd" }).click();
  // Not checked in and no meeting point: Passport asks where first.
  await dialog(host.page, "Where are you?")
    .getByRole("button", { name: /In my seat — Section 309/ })
    .click();
  await expect(host.page.getByTestId("sharing")).toContainText("Section 309");
  await host.page.getByRole("button", { name: "🐃 Find the herd" }).click();
  await expect(
    host.page.getByText("Herd summoned to Section 309."),
  ).toBeVisible();
  await expect(sam.page.locator('[data-ping="herd"]')).toContainText(
    "Lorne is rounding up the herd at Section 309",
    { timeout: 15_000 },
  );
  await sam.page
    .locator('[data-ping="herd"]')
    .getByRole("button", { name: "On my way" })
    .click();
  // Maya can't come: she says so, and the host hears it.
  await maya.page
    .locator('[data-ping="herd"]')
    .getByRole("button", { name: "Can't" })
    .click();
  await expect(host.page.locator('[data-ping="cant"]')).toContainText(
    "Maya can't make it.",
    { timeout: 15_000 },
  );

  // ---------------------------------------------------- find this legend
  await herd(sam.page, "Maya")
    .getByRole("button", { name: "🔦 Find this legend" })
    .click();
  await expect(map(sam.page)).toHaveAttribute("data-level", "300");
  await expect(map(sam.page)).toHaveAttribute("data-zoomed", "true");
  const found = dialog(sam.page, "Hot Dogs (J)");
  await expect(found).toContainText("Maya checked in");
  await expect(found).toContainText("beside section 304");
  await expect(found).toContainText("What the arena lists here");
  await expect(found).toContainText("dietary guide");
  await shot(sam.page, "05-find-this-legend-reduced-motion-375");
  await found.getByRole("button", { name: "Close" }).click();

  // --------------------------------------------------------------- quests
  await arenaTab(maya.page, "Quests").click();
  await maya.page.getByRole("button", { name: /Hot Dog Hero/ }).click();
  await maya.page
    .getByLabel("A word for the crew (optional)")
    .fill("Feeding the herd");
  await maya.page.getByRole("button", { name: "Start Hot Dog Hero" }).click();
  await expect(maya.page.getByTestId("quest-hot-dog-hero")).toContainText(
    "Started by you",
  );

  await arenaTab(sam.page, "Quests").click();
  const hero = sam.page.getByTestId("quest-hot-dog-hero");
  await expect(hero).toContainText("Feeding the herd", { timeout: 15_000 });
  await hero.getByLabel("Your order").fill("Two, mustard");
  await hero.getByRole("button", { name: "I'm in" }).click();
  await expect(hero).toContainText("You — Two, mustard");

  await arenaTab(host.page, "Quests").click();
  await host.page
    .getByRole("button", { name: /Find the Cheapest Beer/ })
    .click();
  await expect(
    host.page.getByText("It's a price hunt, not a drinking game."),
  ).toBeVisible();
  await host.page
    .getByRole("button", { name: "Start Find the Cheapest Beer" })
    .click();
  await host.page.getByRole("button", { name: /The Missing Legend/ }).click();
  await host.page.getByLabel("Who's missing?").selectOption(samId);
  await host.page
    .getByRole("button", { name: "Start The Missing Legend" })
    .click();
  await expect(host.page.getByTestId("quest-missing-legend")).toContainText(
    /Missing: \S+ Sam — last checked in at Outside the arena/,
  );
  await expect(host.page.getByTestId("quest-hot-dog-hero")).toContainText(
    "Sam — Two, mustard",
    {
      timeout: 15_000,
    },
  );

  // Maya reports a price she saw, at a stand.
  await arenaTab(maya.page, "Quests").click();
  const beer = maya.page.getByTestId("quest-cheapest-beer");
  await expect(beer).toBeVisible({ timeout: 15_000 });
  await expect(beer).toContainText(
    "To beat: Molson Canadian, 12 oz at $10.00, seen by Daily Hive",
  );
  await beer.getByLabel("Price you saw").fill("10.50");
  await beer.getByLabel("Where").selectOption({ index: 1 });
  await beer.getByRole("button", { name: "I'm in" }).click();
  await expect(beer).toContainText("Lowest seen tonight: $10.50 by Maya");
  await expect(beer).toContainText("Reported, not verified.");
  await shot(maya.page, "06-quests-320", true);

  // Sam finishes Hot Dog Hero; everyone sees the log.
  await hero.getByRole("button", { name: "✅ Done" }).click();
  await expect(sam.page.getByTestId("quest-log").first()).toContainText(
    "Hot Dog Hero — done by Sam",
  );
  await expect(host.page.getByTestId("quest-log").first()).toContainText(
    "done by Sam",
    { timeout: 15_000 },
  );
  await shot(host.page, "07-host-quests", true);

  // A second open Cheapest Beer is refused with a sentence.
  const dupe = await sam.page.request.post(
    `/hockey/api/occasions/${nightId}/arena`,
    {
      data: { type: "questStart", kind: "cheapest-beer" },
    },
  );
  expect(dupe.status()).toBe(409);

  // ------------------------------------------------------- eat & drink
  await arenaTab(host.page, "Eat & drink").click();
  await expect(
    host.page.getByText("Nearest your seat in Section 309 first"),
  ).toBeVisible();
  const first = host.page.getByTestId("stand").first();
  await expect(first).toContainText(/Right by your section|1 section along/);
  await host.page.getByRole("button", { name: "Vegan", exact: true }).click();
  await first
    .getByRole("button", { name: "What the arena lists here" })
    .click();
  await expect(first).toContainText(/Vegan|Nothing listed here for that diet/);
  await host.page.getByRole("button", { name: "🍺 Drinks" }).click();
  await expect(
    host.page.getByRole("cell", { name: "Molson Canadian, 12 oz" }),
  ).toBeVisible();
  await expect(host.page.getByRole("cell", { name: "$10.00" })).toBeVisible();
  await expect(host.page.getByText(/Press, not official/)).toBeVisible();
  await shot(host.page, "08-eat-and-drink-prices", true);

  // ------------------------------------------- the arena tab: sources
  await arenaTab(host.page, "The arena").click();
  await expect(host.page.getByText("Gate 16", { exact: true })).toBeVisible();
  await expect(
    host.page.getByText(/Quiet room at section 108|quiet room at section 108/i),
  ).toBeVisible();

  // --------------------------------------------- privacy at the boundary
  const stranger = await phone(browser, 390);
  await stranger.page.goto("/hockey");
  await signUp(stranger.page, "stranger");
  await expect(stranger.page.getByLabel("Your name")).toBeVisible();
  const peek = await stranger.page.request.get(
    `/hockey/api/occasions/${nightId}/arena`,
  );
  expect(peek.status(), "a stranger gets the same 404 as no night").toBe(404);
  const sneak = await stranger.page.request.post(
    `/hockey/api/occasions/${nightId}/arena`,
    {
      data: { type: "checkin", place: "sec:309" },
    },
  );
  expect(sneak.status()).toBe(404);
  await stranger.page.goto(arenaPath);
  await expect(stranger.page.locator("svg[data-level]")).toHaveCount(0);
  const signedOut = await browser.newContext();
  const anon = await signedOut.request.get(
    `http://localhost:${process.env.E2E_PORT ?? 3130}/hockey/api/occasions/${nightId}/arena`,
  );
  expect(anon.status()).toBe(401);
  await signedOut.close();
  const bogus = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/arena`,
    {
      data: { type: "checkin", place: "sec:999" },
    },
  );
  expect(bogus.status(), "an unknown place").toBe(400);
  const evil = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/arena`,
    {
      data: {
        type: "ping",
        kind: "where",
        to: "6f1c1a3e-3f0e-4c1e-9a8e-1f0a2b3c4d5e",
      },
    },
  );
  expect(evil.status(), "a ping to someone not on the night").toBe(404);
  const ping = () =>
    maya.page.request.post(`/hockey/api/occasions/${nightId}/arena`, {
      data: { type: "ping", kind: "here", to: me, place: "300:J:304" },
    });
  expect((await ping()).status(), "one ping").toBe(200);
  expect((await ping()).status(), "the same ping again within 20 s").toBe(429);
  // Addressed pings: Sam never sees Maya's request to Lorne.
  const samView = await (
    await sam.page.request.get(`/hockey/api/occasions/${nightId}/arena`)
  ).json();
  expect(
    samView.pings.some(
      (p: { kind: string; from: string }) =>
        p.kind === "meet" && p.from === mayaId,
    ),
  ).toBe(false);

  // -------------------------------------------- the door, mid-period
  // The first period is "put your phone away": no tabs, one quiet page. The
  // way into Arena Mode must still be there (approved 2026-10-22: reachable
  // throughout the event).
  await moveStart(nightId, new Date(Date.now() - 10 * 60_000));
  await host.page.goto(`/hockey/${nightId}`);
  await expect(host.page.getByRole("tablist")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(host.page.getByTestId("arena-door")).toBeVisible();
  await host.page.getByTestId("arena-door").click();
  await expect(host.page).toHaveURL(new RegExp(`${arenaPath}$`));
  await expect(map(host.page)).toBeVisible();
  // Puck drop an hour away again, for the steps that follow.
  await moveStart(nightId, new Date(Date.now() + 60 * 60_000));

  // ------------------------------------------------------------- vanish
  await maya.page
    .getByTestId("sharing")
    .getByRole("button", { name: /Vanish/ })
    .click();
  await expect(maya.page.getByTestId("sharing")).toContainText("You're hidden");
  await arenaTab(host.page, "The herd").click();
  await expect(herd(host.page, "Maya")).toContainText("Hasn't checked in", {
    timeout: 15_000,
  });
  await expect(map(host.page).locator(`[data-person="${mayaId}"]`)).toHaveCount(
    0,
  );

  // ------------------------------------------------- 320 px, and motion
  await arenaTab(maya.page, "The herd").click();
  await fitsThePhone(maya.page, 320);
  for (const t of ["Eat & drink", "Quests", "The arena"]) {
    await arenaTab(maya.page, t).click();
    if (t === "Eat & drink")
      await maya.page.getByRole("button", { name: "🍺 Drinks" }).click();
    await fitsThePhone(maya.page, 320);
  }
  await arenaTab(maya.page, "The herd").click();
  await shot(maya.page, "09-guest-320", true);
  await fitsThePhone(sam.page, 375);

  // ------------------------------------------------ removed from the night
  const removed = await host.page.request.delete(
    `/hockey/api/occasions/${nightId}/members/${samId}`,
  );
  expect(removed.ok()).toBe(true);
  const samAfter = await sam.page.request.get(
    `/hockey/api/occasions/${nightId}/arena`,
  );
  expect(samAfter.status()).toBe(404);
  await expect(herd(host.page, "Sam")).toHaveCount(0, { timeout: 15_000 });

  // ---------------------------------- the night page is unchanged under it
  await host.page.goto(`/hockey/${nightId}`);
  for (const t of ["Plan", "Play", "Chat", "Group"]) {
    await expect(
      host.page
        .getByRole("tablist", { name: "Hockey Night" })
        .getByRole("tab", { name: new RegExp(`^${t}`) }),
    ).toBeVisible();
  }

  // ------------------------------------------------- after the night
  await moveStart(nightId, new Date(Date.now() - 6 * 3600_000));
  await host.page.goto(arenaPath);
  await expect(host.page.getByText("The night's over.")).toBeVisible();
  const after = await (
    await host.page.request.get(`/hockey/api/occasions/${nightId}/arena`)
  ).json();
  expect(after.checkins).toEqual([]);
  expect(after.pings).toEqual([]);
  expect(after.quests).toEqual([]);
  await expect(map(host.page).locator("[data-person]")).toHaveCount(0);
  // The map and the guide still work after: they're the arena's, not ours.
  await arenaTab(host.page, "Eat & drink").click();
  await expect(host.page.getByTestId("stand").first()).toBeVisible();
  await shot(host.page, "10-after-the-night");

  for (const p of [host, maya, sam, stranger]) await p.context.close();
});
