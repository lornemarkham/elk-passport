import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Date Night — on two phones and a desktop, against a real stack**
 * (mission 487, made magical in mission 495). The acceptance tests, in the
 * order a person meets them:
 *
 * - **A** the adventures come before any itinerary; King Eddie Lake makes
 *   its own;
 * - **B** the warm ending changes the end and keeps the lake;
 * - **C** "Let's leave earlier and get home by eight" changes that same
 *   itinerary (one plan, never two);
 * - **D** Add, Move and Remove survive a reload; choosing another adventure
 *   over a customised plan asks first;
 * - **E** Jess joins on her own phone, sees the plan, adds a stop and sends
 *   a sentence; Lorne applies it, and Jess sees the change. A stranger and a
 *   second account see nothing;
 * - **F** a phone: nothing sideways, big touch targets, and the plan is
 *   close to the top; and the same night on a desktop.
 *
 * Mission 495 adds: the title is "This afternoon, just us" (no family
 * name), the other adventures fold behind Change adventure, the plan marks
 * what a change touched and Undo puts it back, and Together opens on a
 * personal invitation.
 *
 * The shared-adventure mission (SHARED-ADVENTURE.md) puts the page in five rooms (Adventure · Change it ·
 * Together · Memories · Invite) behind a bottom bar, so each step first
 * opens the room it happens in (`room`).
 */

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
const PASSWORD = "first-date-forever-7";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-mk-${stamp}@example.test`;

async function shot(page: Page, name: string, fullPage = true) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `markham-${name}.png`),
    fullPage,
  });
}

async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  // Headless Chromium has a share sheet nobody can tap: a stand-in keeps
  // what was shared, and the copy made first is what the test reads.
  await context.addInitScript(() => {
    const shared: string[] = [];
    Object.defineProperty(window, "__shared", { value: shared });
    Object.defineProperty(navigator, "share", {
      value: async (data: { text?: string }) => {
        shared.push(data.text ?? "");
      },
    });
  });
  return context.newPage();
}

async function signIn(page: Page, who: string) {
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function noSideways(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

const evening = (page: Page, title: string) =>
  page.getByTestId("evening").filter({ hasText: title });
const beat = (page: Page, title: string) =>
  page.getByTestId("beat").filter({ hasText: title });
const titles = (page: Page) =>
  page.getByTestId("beat").locator("h3").allTextContents();

/** Open one of the page's rooms from the bar, as a thumb would. */
async function room(
  page: Page,
  name: "Adventure" | "Change it" | "Together" | "Memories" | "Invite",
) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

async function settle(page: Page) {
  await expect(page.getByTestId("evening-plan")).toHaveCount(1);
  await expect(page.locator("main[data-busy]")).toHaveCount(0);
}

/** Do something that writes, and wait for the write and the refresh. */
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

async function say(page: Page, words: string, apply = "Make it so") {
  await page.getByTestId("change-input").fill(words);
  await page.getByTestId("change-submit").click();
  await expect(page.getByTestId("change-preview")).toBeVisible();
  await writes(page, () => page.getByRole("button", { name: apply }).click());
  await expect(page.getByTestId("change-preview")).toBeHidden();
}

test("Date Night: choose, customise, say it, edit, together", async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const lorne = await phone(browser);

  // ----------------------------------------------------------------- A
  await lorne.goto("/datenight");
  await expect(lorne.getByTestId("when")).toContainText("November 2");
  await expect(lorne.locator("main")).not.toContainText("Jess");
  await expect(lorne.locator("main")).not.toContainText(/Markham/i);
  await expect(lorne.getByRole("heading", { level: 1 })).toHaveText(/just us/i);
  await shot(lorne, "00-front-door", false);
  await lorne.getByRole("link", { name: "Let's find some trouble" }).click();
  await signUp(lorne, "lorne");
  await lorne.goto("/datenight");
  await lorne.getByRole("button", { name: "Let's find some trouble" }).click();
  await lorne.waitForURL(/\/night\//);
  const nightPath = new URL(lorne.url()).pathname;

  // The adventures come first; there is no itinerary until one is chosen.
  await expect(lorne.getByTestId("evening")).toHaveCount(4);
  await expect(lorne.getByTestId("evening-plan")).toHaveCount(0);
  await expect(lorne.getByTestId("change-box")).toHaveCount(0);
  await expect(evening(lorne, "Crazy Creek Escape")).toContainText(
    "Jess's Pick",
  );
  // The duplicated planners are gone, not folded away.
  for (const gone of [
    "Other trouble we could get into",
    "Plan it yourself, stop by stop",
    "Times, travel, changes & the printable guide",
  ])
    await expect(lorne.getByText(gone)).toHaveCount(0);
  await expect(lorne.getByTestId("idea")).toHaveCount(0);
  await noSideways(lorne);
  await shot(lorne, "01-choose", false);

  await writes(lorne, () =>
    evening(lorne, "King Eddie Lake").getByTestId("choose-evening").click(),
  );
  const plan = lorne.getByTestId("evening-plan");
  await expect(plan.getByRole("heading", { level: 2 })).toHaveText(
    "King Eddie Lake",
  );
  expect(await titles(lorne)).toEqual([
    "Leave Vernon",
    "Grouse along the King Edward FSR",
    "Explore King Edward Lake",
    "A quick dip, if you dare",
    "Sunset by the lake",
    "Fire & warm food by the lake",
    "Stars",
    "Home",
  ]);
  await expect(lorne.getByTestId("plan-summary")).toContainText("2:15 pm");
  await expect(lorne.getByTestId("plan-summary")).toContainText("5:35 pm");
  // The chosen adventure is the star: an afternoon start is not "tonight",
  // and there is no family name anywhere.
  await expect(lorne.getByTestId("night-title")).toHaveText(
    /^(This afternoon|Today|Monday afternoon|That afternoon), just us$/,
  );
  await expect(lorne.locator("main")).not.toContainText(/Markham/i);
  await expect(lorne.getByTestId("sunset-marker")).toHaveCount(1);
  await expect(
    lorne.getByRole("button", { name: /Stay wild/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(beat(lorne, "Grouse")).toContainText("2:55");
  await expect(lorne.getByTestId("stop-warning")).toHaveCount(0);
  // The other adventures have folded away behind one button.
  await expect(lorne.getByTestId("evening")).toHaveCount(0);
  await lorne.getByTestId("change-adventure").click();
  await expect(lorne.getByTestId("evening")).toHaveCount(3);
  await expect(evening(lorne, "King Eddie Lake")).toHaveCount(0);
  await shot(lorne, "02b-change-adventure", false);
  await lorne.getByTestId("change-adventure").click();
  await expect(lorne.getByTestId("evening")).toHaveCount(0);
  // Safety is said, never promised.
  await lorne.getByText(/^Before you go/).click();
  await expect(plan).toContainText("no hunting from an hour after sunset");
  await expect(plan).toContainText("Category 1 campfires");
  await expect(plan).toContainText("Nobody has checked the water");
  await shot(lorne, "02-king-eddie");

  // ----------------------------------------------------------------- B
  await writes(lorne, () =>
    lorne.getByRole("button", { name: /Warm ending/ }).click(),
  );
  await expect(
    lorne.getByRole("button", { name: /Warm ending/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const warm = await titles(lorne);
  expect(warm.slice(0, 5)).toEqual([
    "Leave Vernon",
    "Grouse along the King Edward FSR",
    "Explore King Edward Lake",
    "A quick dip, if you dare",
    "Sunset by the lake",
  ]);
  expect(warm.slice(5)).toEqual(["Dinner at BNA Brewing", "Home"]);
  await lorne.reload();
  await settle(lorne);
  expect(await titles(lorne)).toEqual(warm);
  await shot(lorne, "03-warm-ending");

  // ----------------------------------------------------------------- C
  // Said, previewed, applied, shown, undone — and said again.
  await room(lorne, "Change it");
  await say(lorne, "Let's leave earlier and get home by eight.");
  await expect(lorne.getByTestId("plan-summary")).toContainText("1:45 pm");
  await expect(lorne.getByTestId("plan-summary")).toContainText("8:00 pm");
  await expect(lorne.getByTestId("change-done")).toContainText(
    "Leave at 1:45 pm",
  );
  await room(lorne, "Adventure");
  await expect(lorne.getByTestId("stop-changed").first()).toBeVisible();
  await shot(lorne, "04a-what-changed", false);
  await room(lorne, "Change it");
  await writes(lorne, () => lorne.getByTestId("change-undo").click());
  await expect(lorne.getByTestId("plan-summary")).toContainText("2:15 pm");
  await say(lorne, "Let's leave earlier and get home by eight.");
  await expect(lorne.getByTestId("plan-summary")).toContainText("1:45 pm");
  await expect(lorne.getByTestId("evening-plan")).toHaveCount(1);
  expect(await titles(lorne)).toEqual(warm);
  await lorne.reload();
  await settle(lorne);
  await expect(lorne.getByTestId("plan-summary")).toContainText("1:45 pm");
  await expect(lorne.getByTestId("beat")).toHaveCount(7);
  // A place Atlas doesn't hold is never invented.
  await lorne.getByTestId("change-input").fill("Find us a sushi place");
  await lorne.getByTestId("change-submit").click();
  await expect(lorne.getByTestId("change-reply")).toContainText(
    "won't make one up",
  );
  await lorne.getByRole("button", { name: "OK" }).click();
  await shot(lorne, "04-said-it");

  // ----------------------------------------------------------------- D
  // Add.
  await room(lorne, "Adventure");
  await lorne.getByTestId("add-stop").click();
  const form = lorne.getByTestId("stop-form");
  await form.getByLabel("What").fill("Hot chocolate at the lookout");
  await form.getByLabel("Details").fill("The thermos, the good mugs");
  await form.getByLabel("Minutes").fill("20");
  await form.getByLabel("After").selectOption({ label: "Sunset by the lake" });
  await writes(lorne, () =>
    form.getByRole("button", { name: "Add it" }).click(),
  );
  await expect(beat(lorne, "Hot chocolate at the lookout")).toBeVisible();
  expect((await titles(lorne))[5]).toBe("Hot chocolate at the lookout");
  // Move: earlier, before the sunset.
  await beat(lorne, "Hot chocolate at the lookout")
    .getByTestId("edit-stop")
    .click();
  await writes(lorne, () =>
    lorne.getByRole("button", { name: "Earlier", exact: true }).click(),
  );
  expect((await titles(lorne))[4]).toBe("Hot chocolate at the lookout");
  // Remove the dip.
  await beat(lorne, "A quick dip").getByTestId("edit-stop").click();
  await writes(lorne, () =>
    lorne.getByRole("button", { name: "Remove", exact: true }).click(),
  );
  await lorne.reload();
  await settle(lorne);
  const edited = await titles(lorne);
  expect(edited).toEqual([
    "Leave Vernon",
    "Grouse along the King Edward FSR",
    "Explore King Edward Lake",
    "Hot chocolate at the lookout",
    "Sunset by the lake",
    "Dinner at BNA Brewing",
    "Home",
  ]);
  // Another adventure over a plan made ours: a preview first, and No.
  await lorne.getByTestId("change-adventure").click();
  await evening(lorne, "Cold Water, Warm Fire")
    .getByTestId("choose-evening")
    .click();
  await expect(lorne.getByTestId("replace-preview")).toContainText(
    "The dip at Kal Beach",
  );
  await shot(lorne, "05-replace-preview", false);
  await lorne.getByRole("button", { name: "Keep ours" }).click();
  await expect(lorne.getByTestId("replace-preview")).toHaveCount(0);
  expect(await titles(lorne)).toEqual(edited);
  await shot(lorne, "06-edited");

  // ----------------------------------------------------------------- E
  await room(lorne, "Invite");
  await expect(lorne.getByTestId("invite-card")).toContainText(
    "Come on an adventure with me.",
  );
  await expect(lorne.getByTestId("invite-preview")).toContainText(
    "King Eddie Lake. We leave at 1:45 pm.",
  );
  await lorne.getByTestId("invite-card").scrollIntoViewIfNeeded();
  await shot(lorne, "06b-invitation", false);
  await lorne.getByRole("button", { name: "Send it to Jess" }).click();
  await expect
    .poll(() => lorne.evaluate(() => navigator.clipboard.readText()), {
      timeout: 10_000,
    })
    .toContain("/adventures/join/");
  const text = await lorne.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Come on an adventure with me. ❤️");
  expect(text).toContain("King Eddie Lake. We leave at 1:45 pm.");
  const link = text.match(/https?:\/\/\S+\/adventures\/join\/\S+/)![0];

  const stranger = await phone(browser);
  await stranger.goto(new URL(link).pathname);
  await expect(stranger.getByTestId("invitation")).toContainText(
    "Come on an adventure with me",
  );
  await expect(stranger.getByText("King Edward")).toHaveCount(0);

  const jess = await phone(browser);
  await jess.goto(new URL(link).pathname);
  await jess.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(jess, "jess");
  await jess.waitForURL(/adventures\/join\//);
  await jess.getByRole("button", { name: "I'm in — join" }).click();
  await jess.waitForURL(/\/night\//);
  await settle(jess);
  // The same itinerary, not a copy.
  expect(await titles(jess)).toEqual(edited);
  await expect(jess.getByTestId("plan-summary")).toContainText("1:45 pm");
  await expect(jess.getByTestId("together-card")).toContainText("You're in.");
  // She can't change the ending or Lorne's stops…
  await expect(jess.getByRole("button", { name: /Stay wild/ })).toBeDisabled();
  await expect(
    beat(jess, "Sunset by the lake").getByTestId("edit-stop"),
  ).toHaveCount(0);
  // …but she adds her own, and it lands on the shared plan.
  await jess.getByTestId("add-stop").click();
  const jessForm = jess.getByTestId("stop-form");
  await jessForm.getByLabel("What").fill("Pie from the Swiss bakery");
  await jessForm.getByLabel("Minutes").fill("15");
  await jessForm
    .getByLabel("After")
    .selectOption({ label: "Dinner at BNA Brewing" });
  await writes(
    jess,
    () => jessForm.getByRole("button", { name: "Add it" }).click(),
    /\/items$/,
  );
  await expect(beat(jess, "Pie from the Swiss bakery")).toBeVisible();
  // And a sentence, sent to Lorne as a suggestion.
  await room(jess, "Change it");
  await jess.getByTestId("change-input").fill("More time at the lake");
  await jess.getByTestId("change-submit").click();
  await writes(
    jess,
    () => jess.getByRole("button", { name: /Suggest it to/ }).click(),
    /\/items$/,
  );
  await expect(jess.getByTestId("change-preview")).toBeHidden();
  await shot(jess, "07-jess");

  // A second account cannot open the night.
  const mallory = await phone(browser);
  await mallory.goto("/auth");
  await signUp(mallory, "mallory");
  await mallory.goto(nightPath);
  await expect(mallory.getByText("isn't yours to see")).toBeVisible();
  await expect(mallory.getByText("King Edward")).toHaveCount(0);

  // Lorne sees both, on his own phone, and who sent them.
  await lorne.reload();
  await settle(lorne);
  await expect(lorne.getByTestId("together-card")).toContainText("is in.");
  await expect(lorne.getByTestId("names")).toContainText("jess-mk-");
  await room(lorne, "Together");
  await expect(lorne.getByTestId("suggestion").first()).toContainText(
    /From jess-mk-/,
  );
  await expect(beat(lorne, "Pie from the Swiss bakery")).toContainText(
    "added by",
  );
  const ask = lorne
    .getByTestId("suggestion")
    .filter({ hasText: "More time at the lake" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Show me" }).click();
  await expect(lorne.getByTestId("change-preview")).toContainText(
    "More time for King Edward Lake",
  );
  await writes(lorne, () =>
    lorne.getByRole("button", { name: "Make it so" }).click(),
  );
  await expect(beat(lorne, "Explore King Edward Lake")).toContainText("1 h");
  await shot(lorne, "08-lorne-after-jess");

  // Jess sees Lorne's change without asking.
  await jess.reload();
  await settle(jess);
  await expect(beat(jess, "Explore King Edward Lake")).toContainText("1 h");
  await expect(beat(jess, "Pie from the Swiss bakery")).toHaveCount(1);

  // Packing: Jess ticks; Lorne sees it. Together opens with the list out.
  await room(jess, "Together");
  await writes(
    jess,
    () =>
      jess
        .getByTestId("packing")
        .getByRole("checkbox", { name: /Chairs/ })
        .click(),
    /\/packing\//,
  );
  await lorne.reload();
  await room(lorne, "Together");
  await expect(
    lorne.getByTestId("packing").getByRole("checkbox", { name: /Chairs/ }),
  ).toHaveAttribute("aria-checked", "true");

  // A returning owner goes straight to the board.
  await lorne.goto("/datenight");
  await lorne.waitForURL(/\/night\//);

  // ----------------------------------------------------------------- F
  for (const page of [lorne, jess]) {
    await settle(page);
    await room(page, "Adventure");
    await noSideways(page);
    // The plan starts on the first screen's scroll; nothing competes above it.
    await page.evaluate(() => window.scrollTo(0, 0));
    const top = await page.getByTestId("evening-plan").boundingBox();
    expect(top!.y).toBeLessThan(844);
    await expect(page.locator("#evenings")).toHaveCount(0);
    // Every button on the plan is a thumb's size.
    const small = await page
      .getByTestId("evening-plan")
      .locator("button:visible")
      .evaluateAll(
        (els) =>
          els
            .map((e) => e.getBoundingClientRect())
            .filter((r) => r.height < 44 || r.width < 44).length,
      );
    expect(small).toBe(0);
  }
  await shot(lorne, "09-lorne-final");
  await shot(jess, "10-jess-final");

  // The same night on a desktop, signed in as Lorne.
  const desk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const desktop = await desk.newPage();
  await signIn(desktop, "lorne");
  await desktop.goto(nightPath);
  await settle(desktop);
  await noSideways(desktop);
  expect(await titles(desktop)).toEqual(await titles(lorne));
  await shot(desktop, "11-desktop");
  await desktop.getByTestId("change-adventure").click();
  await shot(desktop, "12-desktop-change", false);
});

test("Date Night: the adventures as invitations, phone and desktop", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await phone(browser);
  await page.goto("/auth");
  await signUp(page, "fresh");
  await page.goto("/datenight");
  await page.getByRole("button", { name: "Let's find some trouble" }).click();
  await page.waitForURL(/\/night\//);
  const night = new URL(page.url()).pathname;
  await expect(page.getByTestId("evening")).toHaveCount(4);
  // One shape for every card, and each says what it is in one line.
  const sizes = await page
    .getByTestId("evening")
    .locator("article")
    .evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)),
    );
  expect(new Set(sizes).size).toBe(1);
  await noSideways(page);
  await page.locator("#evenings").scrollIntoViewIfNeeded();
  await shot(page, "01a-cards-phone", false);

  const desk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const desktop = await desk.newPage();
  await signIn(desktop, "fresh");
  await desktop.goto(night);
  await expect(desktop.getByTestId("evening")).toHaveCount(4);
  await noSideways(desktop);
  await shot(desktop, "01b-cards-desktop");
});
