import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Date Night, made magical — the shared-adventure mission (SHARED-ADVENTURE.md), the owner's thirteen steps**,
 * on two phones (390×844), an Android-sized phone (412×915) and a desktop,
 * against a real stack (GoTrue, PostgREST, Postgres with every adventure
 * migration) and the 2 November corpus stand-in:
 *
 *  1. Lorne opens Date Night and chooses King Eddie Lake (leaves 2:15).
 *  2. He can't leave before 4: he changes the departure to 4 pm.
 *  3. The itinerary is laid out again — a shorter hunt, still the sunset —
 *     not shifted; the other ways and their catches are offered first.
 *  4–5. He opens the packing list and adds something.
 *  6–7. He makes a This or That and texts it to Jess (the share sheet).
 *  8–9. Jess opens the text's link, signs up, joins, and lands on it.
 *  10. Both see the same adventure.
 *  11. Jess answers, packs, and sends Lorne a challenge.
 *  12. Lorne opens her link and sees all of it; You Decide changes the plan.
 *  13. Memories and packing still work; the bar works on every screen.
 */

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
const PASSWORD = "first-date-forever-7";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-mg-${stamp}@example.test`;

async function shot(page: Page, name: string, fullPage = false) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `magic-${name}.png`),
    fullPage,
  });
}

/** A phone whose share sheet keeps what was shared, for the test to read. */
async function phone(browser: Browser, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  // Kept in the tab's sessionStorage, so it survives navigating.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async (data: { text?: string }) => {
        const shared = JSON.parse(
          sessionStorage.getItem("shared") ?? "[]",
        ) as string[];
        shared.push(data.text ?? "");
        sessionStorage.setItem("shared", JSON.stringify(shared));
      },
    });
  });
  return context.newPage();
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function signIn(page: Page, who: string) {
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

type RoomName = "Adventure" | "Change it" | "Together" | "Memories" | "Invite";
const tab = (page: Page, name: RoomName) =>
  page.getByRole("tab", { name: new RegExp(`^${name}`) });
async function room(page: Page, name: RoomName) {
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
}

async function settle(page: Page) {
  await expect(page.getByTestId("evening-plan")).toHaveCount(1);
  await expect(page.locator("main[data-busy]")).toHaveCount(0);
}

async function writes(
  page: Page,
  act: () => Promise<unknown>,
  path: RegExp = /\/api\/night\/[^/]+\/plan$/,
) {
  const done = page.waitForResponse(
    (r) =>
      path.test(new URL(r.url()).pathname) && r.request().method() !== "GET",
  );
  await act();
  expect((await done).ok()).toBe(true);
  await settle(page);
}

const titles = (page: Page) =>
  page.getByTestId("beat").locator("h3").allTextContents();
const beat = (page: Page, title: string) =>
  page.getByTestId("beat").filter({ hasText: title });

/** What the share sheet was last handed, and the link in it. */
async function lastShared(page: Page, count: number) {
  const shared = () =>
    page.evaluate(
      () => JSON.parse(sessionStorage.getItem("shared") ?? "[]") as string[],
    );
  await expect.poll(async () => (await shared()).length).toBe(count);
  const text = (await shared()).at(-1)!;
  const link = text.match(/https?:\/\/\S+/)![0];
  return { text, link, path: link.replace(/^https?:\/\/[^/]+/, "") };
}

/** Nothing sits under the bar: the room's last thing ends above it. */
async function clearOfTheBar(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const { lastBottom, barTop } = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(
      (el) => !(el as HTMLElement).hidden,
    )!;
    const bar = document.querySelector('[data-testid="night-bottom-nav"]')!;
    return {
      lastBottom: panel.getBoundingClientRect().bottom,
      barTop: bar.getBoundingClientRect().top,
    };
  });
  expect(lastBottom).toBeLessThanOrEqual(barTop + 1);
}

test("Date Night, made magical: leave at 4, pack, play, text, join, play back", async ({
  browser,
}) => {
  test.setTimeout(480_000);
  const lorne = await phone(browser);

  // 1. Lorne opens Date Night and chooses King Eddie Lake.
  await lorne.goto("/auth");
  await signUp(lorne, "lorne");
  await lorne.goto("/datenight");
  await lorne.getByRole("button", { name: "Let's find some trouble" }).click();
  await lorne.waitForURL(/\/night\//);
  const nightPath = new URL(lorne.url()).pathname;
  await expect(lorne.getByTestId("night-bottom-nav")).toBeVisible();
  await expect(
    lorne.getByTestId("night-bottom-nav").getByRole("tab"),
  ).toHaveCount(5);
  await writes(lorne, () =>
    lorne
      .getByTestId("evening")
      .filter({ hasText: "King Eddie Lake" })
      .getByTestId("choose-evening")
      .click(),
  );
  await expect(lorne.getByTestId("plan-summary")).toContainText("2:15 pm");
  await shot(lorne, "01-adventure");

  // 2. We can't leave before 4: from the Leave time on the plan.
  await lorne.getByTestId("change-leave").click();
  await expect(tab(lorne, "Change it")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await lorne.getByTestId("leave-16:00").click();
  await expect(lorne.getByTestId("leave-light")).toContainText(
    "53 min of daylight",
  );
  await expect(lorne.getByTestId("leave-light")).toContainText(
    "Legal hunting ends at 6:35 pm",
  );
  const options = lorne.getByTestId("leave-options");
  // The plan as it is stays on offer, with its catch said.
  await expect(options.locator('[data-option="keep"]')).toContainText(
    "misses it",
  );
  await expect(
    options.locator('[data-option="keep"]').getByTestId("leave-use"),
  ).toHaveText(/Keep it anyway/);
  // A shorter hunt, all the light for the hunt, dinner in town, closer.
  for (const id of [
    "tighter",
    "main-first",
    "ending:warm",
    "evening:cold-water",
  ])
    await expect(options.locator(`[data-option="${id}"]`)).toHaveCount(1);
  await expect(
    options.locator('[data-option="evening:crazy-creek"]'),
  ).toHaveCount(0);
  await expect(options).toContainText("doesn't know a closer place to hunt");
  await expect(options).toContainText("not live traffic");
  const pick = options.locator('[data-option="tighter"]');
  await expect(pick).toContainText("Passport's pick");
  await expect(pick).toContainText("Shorter hunt, still the sunset");
  await shot(lorne, "02-leave-at-4", true);

  // 3. The itinerary is laid out again, and it holds through a reload.
  await writes(lorne, () => pick.getByTestId("leave-use").click());
  await expect(tab(lorne, "Adventure")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(lorne.getByTestId("plan-summary")).toContainText("4:00 pm");
  const at4 = [
    "Leave Vernon",
    "Grouse along the King Edward FSR",
    "Sunset by the lake",
    "Fire & warm food by the lake",
    "Stars",
    "Home",
  ];
  expect(await titles(lorne)).toEqual(at4);
  await expect(beat(lorne, "Grouse")).toContainText("4:40");
  await expect(lorne.getByTestId("stop-warning")).toHaveCount(0);
  await lorne.reload();
  await settle(lorne);
  expect(await titles(lorne)).toEqual(at4);
  await expect(lorne.getByTestId("plan-summary")).toContainText("4:00 pm");
  await shot(lorne, "03-at-4", true);

  // 4–5. The packing list opens, and takes something new.
  await room(lorne, "Together");
  const packing = lorne.getByTestId("packing");
  await expect(lorne.getByTestId("packing-panel")).not.toHaveAttribute(
    "data-off",
    "true",
  );
  await expect(packing.getByRole("checkbox")).toHaveCount(7);
  await lorne.getByLabel("Add something to bring").fill("Hand warmers");
  await writes(
    lorne,
    () => lorne.getByRole("button", { name: "Add", exact: true }).click(),
    /\/packing$/,
  );
  await expect(
    packing.getByRole("checkbox", { name: /Hand warmers/ }),
  ).toBeVisible();

  // 6–7. A This or That, texted to Jess.
  await lorne.getByTestId("make-pick").click();
  await lorne.getByLabel("This", { exact: true }).fill("Campfire");
  await lorne.getByLabel("That", { exact: true }).fill("Hot tub");
  await lorne.getByTestId("guess-0").click();
  await expect(lorne.getByTestId("make-send")).toHaveText(/Make it for Jess/);
  await shot(lorne, "04-this-or-that");
  await writes(lorne, () => lorne.getByTestId("make-send").click(), /\/items$/);
  await lorne.getByTestId("ready-send").click();
  const first = await lastShared(lorne, 1);
  expect(first.text).toContain("This or that? Campfire or Hot tub.");
  // Jess isn't in yet: the link is her invitation, and it lands on this.
  expect(first.path).toMatch(/^\/adventures\/join\/[^?]+\?next=%2Fnight%2F/);
  expect(await lorne.evaluate(() => navigator.clipboard.readText())).toContain(
    first.link,
  );
  await expect(
    lorne.getByTestId("play").filter({ hasText: "Campfire" }),
  ).toContainText("Waiting for Jess");

  // 8–9. Jess opens the text on her phone, signs up, joins, lands on it.
  const jess = await phone(browser);
  await jess.goto(first.path);
  await expect(jess.getByTestId("invitation")).toContainText(
    "Come on an adventure with me",
  );
  await jess.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(jess, "jess");
  await jess.waitForURL(/adventures\/join\//);
  await jess.getByRole("button", { name: "I'm in — join" }).click();
  await jess.waitForURL(/\/night\/[^?]+\?p=[0-9a-f-]{36}/);
  await settle(jess);
  await expect(tab(jess, "Together")).toHaveAttribute("aria-selected", "true");
  const theirPick = jess.getByTestId("play").filter({ hasText: "Campfire" });
  await expect(theirPick).toBeVisible();
  await expect(theirPick).toHaveClass(/ring-2/);
  await shot(jess, "05-jess-lands-on-it");

  // 10. Both see the same adventure.
  expect(await titles(jess)).toEqual(at4);
  await expect(jess.getByTestId("plan-summary")).toContainText("4:00 pm");

  // 11. Jess answers, packs, and sends a challenge back.
  await writes(
    jess,
    () => theirPick.getByTestId("answer-1").click(),
    /\/items$/,
  );
  await expect(theirPick.getByTestId("play-result")).toContainText(
    "You picked Hot tub",
  );
  await expect(theirPick.getByTestId("play-result")).toContainText("Opposites");
  await writes(
    jess,
    () =>
      jess
        .getByTestId("packing")
        .getByRole("checkbox", { name: /Chairs/ })
        .click(),
    /\/packing\//,
  );
  await jess.getByLabel("Add something to bring").fill("Wool socks");
  await writes(
    jess,
    () => jess.getByRole("button", { name: "Add", exact: true }).click(),
    /\/packing$/,
  );
  await jess.getByTestId("make-dare").click();
  await jess.getByRole("button", { name: "❤️ Romantic" }).click();
  await jess.getByLabel("The words").fill("One slow dance by the water.");
  await expect(jess.getByTestId("make-send")).toHaveText(
    /Make it for lorne-mg-/,
  );
  await writes(jess, () => jess.getByTestId("make-send").click(), /\/items$/);
  await jess.getByTestId("ready-send").click();
  const dare = await lastShared(jess, 1);
  expect(dare.text).toContain("I dare you ❤️ One slow dance by the water.");
  expect(dare.path).toMatch(/^\/night\/[^?]+\?p=[0-9a-f-]{36}$/);
  await shot(jess, "06-jess-dares", true);

  // 12. Lorne opens her link: the dare, her pick, her packing.
  await lorne.goto(dare.path);
  await settle(lorne);
  await expect(tab(lorne, "Together")).toHaveAttribute("aria-selected", "true");
  await expect(tab(lorne, "Together")).toHaveAccessibleName(/1 waiting/);
  const herDare = lorne.locator('[data-testid="play"][data-kind="dare"]');
  await expect(herDare).toContainText("One slow dance by the water.");
  await writes(lorne, () => herDare.getByTestId("dare-on").click(), /\/items$/);
  await writes(
    lorne,
    () => herDare.getByTestId("dare-done").click(),
    /\/items$/,
  );
  await expect(herDare.getByTestId("play-result")).toContainText("Legend");
  await expect(
    lorne
      .getByTestId("play")
      .filter({ hasText: "Campfire" })
      .getByTestId("play-result"),
  ).toContainText(/picked Hot tub\. You picked Campfire\. Opposites/);
  await expect(
    lorne.getByTestId("packing").getByRole("checkbox", { name: /Chairs/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    lorne.getByTestId("packing").getByRole("checkbox", { name: /Wool socks/ }),
  ).toBeVisible();
  await shot(lorne, "07-lorne-sees-it", true);

  // You decide: Jess chooses how it ends, and Lorne makes it so.
  await lorne.getByTestId("make-decide").click();
  await expect(lorne.getByRole("radio", { checked: true })).toContainText(
    "Stay wild or Warm ending",
  );
  await writes(lorne, () => lorne.getByTestId("make-send").click(), /\/items$/);
  await lorne.getByTestId("ready-send").click();
  const decide = await lastShared(lorne, 2);
  expect(decide.text).toBe(
    `You decide: Stay wild or Warm ending? Your call, I'll go with it.\n${decide.link}`,
  );
  expect(decide.path).toMatch(/^\/night\/[^?]+\?p=/); // she's in now
  await jess.goto(decide.path);
  await settle(jess);
  const choice = jess.locator('[data-testid="play"][data-kind="decide"]');
  await writes(jess, () => choice.getByTestId("answer-1").click(), /\/items$/);
  await expect(choice.getByTestId("play-result")).toContainText(
    "You picked Warm ending",
  );
  await lorne.reload();
  await settle(lorne);
  const decided = lorne.locator('[data-testid="play"][data-kind="decide"]');
  await expect(decided.getByTestId("play-result")).toContainText(
    "picked Warm ending",
  );
  await writes(lorne, () => decided.getByTestId("decide-apply").click());
  await expect(tab(lorne, "Adventure")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    lorne.getByRole("button", { name: /Warm ending/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await titles(lorne)).slice(-2)).toEqual([
    "Dinner at BNA Brewing",
    "Home",
  ]);
  await expect(lorne.getByTestId("plan-summary")).toContainText("4:00 pm");

  // A love note that opens at sunset: hidden from Jess's page until then.
  await room(lorne, "Together");
  await lorne.getByTestId("make-note").click();
  await lorne.getByLabel("The note").fill("The best part of today is you.");
  await lorne.getByRole("button", { name: "at sunset" }).click();
  await writes(lorne, () => lorne.getByTestId("make-send").click(), /\/items$/);
  await lorne.getByTestId("ready-send").click();
  const note = await lastShared(lorne, 3);
  expect(note.text).toContain("It opens at sunset");
  await jess.goto(note.path);
  await settle(jess);
  const local = await jess.evaluate(() =>
    new Date().toLocaleTimeString("en-CA", {
      timeZone: "America/Vancouver",
      hour12: false,
    }),
  );
  const [h, m] = local.split(":").map(Number);
  const beforeSunset = h! * 60 + m! < 17 * 60 + 30;
  if (beforeSunset) {
    await expect(jess.getByTestId("note-locked")).toContainText(
      "Opens at sunset",
    );
    expect(await jess.content()).not.toContain("best part of today");
  }
  await shot(jess, "08-note-locked");

  // 13. Memories and packing still work, on both phones.
  await room(jess, "Memories");
  await expect(jess.getByTestId("memories-panel")).not.toHaveAttribute(
    "data-off",
    "true",
  );
  await jess
    .getByLabel("A moment worth keeping")
    .fill("Grouse: 0. Laughs: plenty.");
  await writes(
    jess,
    () => jess.getByRole("button", { name: "Share", exact: true }).click(),
    /\/moments$/,
  );
  await lorne.reload();
  await settle(lorne);
  await room(lorne, "Memories");
  await expect(lorne.getByTestId("memories-panel")).toContainText(
    "Grouse: 0. Laughs: plenty.",
  );
  await room(lorne, "Together");
  await writes(
    lorne,
    () =>
      lorne
        .getByTestId("packing")
        .getByRole("checkbox", { name: /Hand warmers/ })
        .click(),
    /\/packing\//,
  );

  // The bar: nothing hidden under it, in any room, on either phone.
  for (const page of [lorne, jess])
    for (const name of [
      "Adventure",
      "Change it",
      "Together",
      "Memories",
      "Invite",
    ] as const) {
      await room(page, name);
      await clearOfTheBar(page);
    }
  await room(lorne, "Invite");
  await expect(lorne.getByTestId("together-card")).toContainText("is in.");
  await shot(lorne, "09-invite-room");

  // An Android-sized phone: the same bar, the same clearance.
  const android = await phone(browser, { width: 412, height: 915 });
  await signIn(android, "jess");
  await android.goto(nightPath);
  await settle(android);
  await expect(android.getByTestId("night-bottom-nav")).toBeVisible();
  await room(android, "Together");
  await clearOfTheBar(android);
  await room(android, "Adventure");
  await clearOfTheBar(android);
  await shot(android, "10-android");

  // A desktop: the rooms are a compact row under the hero; no bottom bar.
  const desk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const desktop = await desk.newPage();
  await signIn(desktop, "lorne");
  await desktop.goto(nightPath);
  await settle(desktop);
  await expect(desktop.getByTestId("night-bottom-nav")).toBeHidden();
  await expect(desktop.getByTestId("room-tab-together")).toBeVisible();
  await shot(desktop, "11-desktop");
  await desktop.getByTestId("room-tab-together").click();
  await expect(desktop.locator("#room-together")).toBeVisible();
  // Without a share sheet, a computer copies: the link goes with it.
  await desktop.getByTestId("make-bad-idea").click();
  await writes(
    desktop,
    () => desktop.getByTestId("make-send").click(),
    /\/items$/,
  );
  await desktop.getByTestId("ready-send").click();
  await expect
    .poll(() => desktop.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/Bad Ideas Department presents: .+\nhttp:\/\/\S+\/night\/\S+\?p=/);
  await shot(desktop, "12-desktop-together", true);
});
