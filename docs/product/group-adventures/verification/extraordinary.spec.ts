import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";

/**
 * **Make Adventures Extraordinary — the brief's real-user scenarios**
 * (ADR 012, `docs/product/adventures/EXPERIENCE.md`).
 *
 *   A  A spontaneous Saturday: sketched from real places, changed in words,
 *      the change persists, Undo puts it back, a kept stop survives.
 *   B  A family weekend: a child's age, then "less demanding".
 *   C  Saved becomes an adventure: chosen places are planned around, and
 *      the rest are offered one tap onto a day.
 *   D  Friends planning together: invite, suggest, answer, keep, share.
 *   E  The actual day: today's adventure says what's next.
 *   F  AI/data unavailable or not understood: nothing invented, nothing lost,
 *      everything manual still works.
 *   +  320 / 375 / 390 px, touch targets, keyboard.
 *
 * Real GoTrue accounts, every permission Postgres's (stack.mjs). Atlas is
 * `atlas-standin.mjs` serving a saved production feed body.
 *
 *   E2E_PORT=3126 npx playwright test -c docs/product/group-adventures/verification extraordinary
 */

const PASSWORD = "a-whole-weekend-9";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-x-${stamp}@example.test`;

async function signUp(page: Page, who: string, next = "/saved") {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function person(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  return { context, page: await context.newPage() };
}

const SAVED = [
  "27bad519-00b7-42e8-8d96-64b3cf450eb4", // Downtown Marina
  "28d2718b-0cb8-496d-a8fa-0579641f1c73", // Kelowna Flower Farm
  "40a236e3-fae9-4657-83fa-389a9204f91d", // Waterfront Park
  "3b958853-74ef-4cda-b75a-47aa69362d4e", // Gellatly Nut Farm
  "ce6c75f2-bdf5-4798-b2ea-a05e0f6f75bf", // Kangaroo Creek Farm
  "879b9775-8fe2-4f34-83ad-fdca59c9b1a3", // Mission Hill Family Estate Winery
];

/** Save things the way the Save button does: through `/api/boards`. */
async function save(page: Page, ids: readonly string[]) {
  await page.evaluate(async (list) => {
    const post = (url: string, body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    const board = await post("/api/boards", { name: "Saved" });
    for (const experienceId of list)
      await post(`/api/boards/${board.id}/items`, { experienceId });
  }, ids);
}

/** The guided start, filled in the way a person would. */
async function start(
  page: Page,
  options: {
    town: string;
    when: "This Saturday" | "This weekend" | "Pick dates";
    on?: string;
    who?: string;
    age?: number;
    vibes?: readonly string[];
    extra?: string;
    title?: string;
    sketch?: boolean;
  },
) {
  if (!page.url().includes("/adventures/new"))
    await page.goto("/adventures/new");
  await page.getByTestId("create-town").selectOption(options.town);
  await page.getByRole("button", { name: options.when, exact: true }).click();
  if (options.on) {
    await page.getByLabel("From", { exact: true }).fill(options.on);
    await page.getByLabel("To", { exact: true }).fill(options.on);
  }
  if (options.who)
    await page.getByRole("button", { name: options.who, exact: true }).click();
  if (options.age !== undefined)
    await page.getByLabel("Age of the youngest").fill(String(options.age));
  for (const vibe of options.vibes ?? [])
    await page.getByRole("button", { name: vibe, exact: true }).click();
  if (options.extra) await page.getByTestId("create-extra").fill(options.extra);
  if (options.title) await page.getByTestId("create-title").fill(options.title);
  if (options.sketch === false)
    await page.getByTestId("create-sketch").uncheck();
  await page.getByTestId("create-submit").click();
  await expect(page).toHaveURL(/\/adventures\/[0-9a-f]{32}/, {
    timeout: 90_000,
  });
  return page.url().split("?")[0]!;
}

const stopsOf = (page: Page, day = 0) =>
  page.getByTestId("plan-day-section").nth(day).getByTestId("plan-item");

const titlesOf = async (page: Page, day = 0) =>
  (await stopsOf(page, day).locator("h4").allTextContents()).map((t) =>
    t.trim(),
  );

async function changeInWords(page: Page, said: string) {
  await page.getByTestId("change-input").fill(said);
  await page.getByTestId("change-submit").click();
  await expect(page.getByTestId("change-preview")).toBeVisible({
    timeout: 60_000,
  });
}

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Vancouver",
});

test.setTimeout(300_000);

test("A — a spontaneous Saturday: sketched, changed in words, persisted, undone", async ({
  browser,
}) => {
  const { page, context } = await person(browser);
  await signUp(page, "ana", "/adventures/new");
  const url = await start(page, {
    town: "kelowna",
    when: "This Saturday",
    vibes: ["Adventurous", "Food & drink"],
    title: "Spontaneous Saturday",
  });

  // Never a blank adventure: real Atlas places, all Passport's suggestions.
  await expect(page.getByTestId("started-note")).toContainText("first sketch");
  await expect(page.getByTestId("plan-day-section")).toHaveCount(1);
  const first = await titlesOf(page);
  expect(first.length).toBeGreaterThanOrEqual(2);
  for (const stop of await stopsOf(page).all())
    await expect(stop).toHaveAttribute("data-origin", "passport");
  await expect(page.getByTestId("stop-suggested").first()).toBeVisible();

  // Keep the first stop.
  await stopsOf(page)
    .first()
    .getByRole("button", { name: "Keep", exact: true })
    .click();
  await expect(stopsOf(page).first().getByTestId("stop-kept")).toBeVisible();

  // Change it in words: a preview first, nothing written yet.
  await changeInWords(page, "Make it cheaper");
  const preview = page.getByTestId("change-day");
  await expect(preview).toContainText("Budget");
  await expect(preview).toContainText(`${first[0]} · kept`);
  await page.reload();
  expect(await titlesOf(page)).toEqual(first);

  // Apply — and it persists.
  await changeInWords(page, "Make it cheaper");
  await page.getByTestId("change-apply").click();
  await expect(page.getByTestId("change-applied")).toBeVisible();
  await expect(page.getByTestId("day-ask")).toContainText("cheaper");
  await page.reload();
  await expect(page.getByTestId("day-ask")).toContainText("cheaper");
  const cheaper = await titlesOf(page);
  expect(cheaper).toContain(first[0]); // the kept stop survived

  // Undo puts the day back as it was asked.
  await changeInWords(page, "Make it more relaxed");
  await page.getByTestId("change-apply").click();
  await expect(page.getByTestId("change-undo")).toBeVisible();
  await page.getByTestId("change-undo").click();
  await expect(page.getByTestId("change-applied")).toHaveCount(0);
  await expect(page.getByTestId("day-ask")).not.toContainText("relaxed");
  await expect
    .poll(async () => new Set(await titlesOf(page)))
    .toEqual(new Set(cheaper));

  await page.screenshot({
    path: `${process.env.SHOTS ?? "/tmp"}/A-saturday.png`,
    fullPage: true,
  });
  expect(url).toMatch(/adventures/);
  await context.close();
});

test("B — a family weekend: a five-year-old, then less demanding", async ({
  browser,
}) => {
  const { page, context } = await person(browser, { ...devices["iPhone 13"] });
  await signUp(page, "bea", "/adventures/new");
  await start(page, {
    town: "kelowna",
    when: "This weekend",
    who: "Family",
    age: 5,
    vibes: ["Outdoors"],
  });
  await expect(page.getByTestId("plan-day-section")).toHaveCount(2);
  await expect(page.getByTestId("day-ask").first()).toContainText(
    "youngest is 5",
  );
  const saturday = await titlesOf(page, 0);
  const sunday = await titlesOf(page, 1);
  // Two days, not the same places twice.
  expect(saturday.filter((t) => sunday.includes(t))).toEqual([]);

  await changeInWords(page, "Saturday is too much, make it less demanding");
  const change = page.getByTestId("change-day");
  await expect(change).toHaveCount(1);
  await expect(change).toContainText("Saturday");
  await expect(change).toContainText("One stop fewer");
  await page.getByTestId("change-apply").click();
  await expect(page.getByTestId("change-applied")).toBeVisible();
  await expect(stopsOf(page, 0)).toHaveCount(saturday.length - 1);
  // Sunday was not touched.
  await expect.poll(() => titlesOf(page, 1)).toEqual(sunday);
  await page.screenshot({
    path: `${process.env.SHOTS ?? "/tmp"}/B-family-phone.png`,
    fullPage: true,
  });
  await context.close();
});

test("C — Saved becomes an adventure, and the rest are one tap away", async ({
  browser,
}) => {
  const { page, context } = await person(browser);
  await signUp(page, "cal");
  await save(page, SAVED);
  await page.goto("/saved");
  await expect(page.getByTestId("saved-review")).toContainText(
    "6 possibilities",
  );
  await expect(page.getByTestId("create-adventure")).toBeVisible();

  // Find one again, then choose four.
  await page.getByTestId("saved-find").fill("farm");
  await expect(page.getByTestId("possibility")).toHaveCount(3);
  await page.getByTestId("saved-find").fill("");
  await page.getByTestId("saved-plan").click();
  const chosen = [
    "Downtown Marina",
    "Kelowna Flower Farm",
    "Waterfront Park",
    "Kangaroo Creek Farm",
  ];
  for (const name of chosen)
    await page.getByRole("button", { name: `Choose ${name}` }).click();
  await expect(page.getByTestId("chosen-count")).toContainText("4 chosen");
  await page.getByTestId("saved-build-adventure").click();
  await expect(page.getByTestId("create-seeds")).toContainText(
    "4 saved places",
  );
  await start(page, {
    town: "kelowna",
    when: "This weekend",
    title: "Our saved weekend",
  });

  // A coherent plan around them: each chosen place is on a day, as a person's pick.
  const onDays = [...(await titlesOf(page, 0)), ...(await titlesOf(page, 1))];
  const planned = chosen.filter((c) => onDays.includes(c));
  expect(planned.length).toBeGreaterThanOrEqual(3);
  await expect(page.locator('[data-origin="person"]').first()).toContainText(
    "Your pick",
  );

  // The two left on Saved are offered — once — and one tap puts one on Sunday.
  const offered = page.getByTestId("saved-suggestion");
  await expect(offered).toHaveCount(2);
  await page
    .getByRole("button", { name: "Add Gellatly Nut Farm to Sunday" })
    .click();
  await expect(page.getByTestId("plan-day-section").nth(1)).toContainText(
    "Gellatly Nut Farm",
  );
  await expect(offered).toHaveCount(1);
  await page.screenshot({
    path: `${process.env.SHOTS ?? "/tmp"}/C-saved-weekend.png`,
    fullPage: true,
  });

  // Saved now leads with it.
  await page.goto("/saved");
  await expect(page.getByTestId("next-adventure")).toContainText(
    "Our saved weekend",
  );
  await context.close();
});

test("D — three friends plan together, and share the finished day", async ({
  browser,
}) => {
  const alice = await person(browser);
  await signUp(alice.page, "dee", "/adventures/new");
  const url = await start(alice.page, {
    town: "kelowna",
    when: "This Saturday",
    who: "Friends",
    vibes: ["Food & drink"],
    title: "Friends Saturday",
  });
  const links: string[] = [];
  for (let i = 0; i < 2; i++) {
    await alice.page
      .getByRole("button", { name: "Link for one person" })
      .click();
    // Wait for this click's link, not the one before it.
    await expect
      .poll(async () =>
        (
          (await alice.page.getByTestId("invite-url").first().textContent()) ??
          ""
        ).trim(),
      )
      .not.toBe(links[links.length - 1] ?? "");
    links.push(
      (
        (await alice.page.getByTestId("invite-url").first().textContent()) ?? ""
      ).trim(),
    );
  }
  const first = await titlesOf(alice.page);

  const friends = [];
  for (const [i, who] of ["eli", "fay"].entries()) {
    const friend = await person(browser, { ...devices["Pixel 7"] });
    await friend.page.goto(new URL(links[i]!).pathname);
    await friend.page.getByRole("link", { name: "Sign in to join" }).click();
    await friend.page.getByRole("tab", { name: "Sign Up" }).click();
    await friend.page.getByLabel("Email address").fill(emailFor(who));
    await friend.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await friend.page.getByRole("button", { name: "Create account" }).click();
    await friend.page.getByRole("button", { name: /join/ }).click();
    await expect(
      friend.page.getByRole("heading", { name: "Friends Saturday" }),
    ).toBeVisible();
    // Participants answer; they don't place or keep.
    await expect(
      friend.page.getByRole("button", { name: "Keep", exact: true }),
    ).toHaveCount(0);
    await stopsOf(friend.page)
      .first()
      .getByRole("button", { name: "I'm in" })
      .click();
    friends.push(friend);
  }

  // Eli suggests a change in words: it arrives as ideas for Alice, not a new plan.
  const eli = friends[0]!.page;
  await changeInWords(eli, "Make it more adventurous");
  await expect(eli.getByTestId("change-apply")).toHaveText("Suggest these");
  await eli.getByTestId("change-apply").click();
  await expect(stopsOf(eli)).toHaveCount(first.length);

  await alice.page.reload();
  await expect(stopsOf(alice.page).first()).toContainText("2 in");
  expect(await titlesOf(alice.page)).toEqual(first);
  await stopsOf(alice.page)
    .first()
    .getByRole("button", { name: "Keep", exact: true })
    .click();
  await expect(
    stopsOf(alice.page).first().getByTestId("stop-kept"),
  ).toBeVisible();

  // The finished day, shared with someone who has no account.
  const print = await alice.page.getByTestId("print-day").getAttribute("href");
  const visitor = await person(browser, { ...devices["iPhone 13"] });
  expect((await visitor.page.goto(print!))?.status()).toBe(200);
  await expect(visitor.page.getByText(first[0]!).first()).toBeVisible();

  // And a stranger cannot open the adventure at all.
  const stranger = await person(browser);
  await signUp(stranger.page, "gus", "/adventures");
  await stranger.page.goto(new URL(url).pathname);
  await expect(stranger.page.getByText("Not found")).toBeVisible();

  for (const p of [alice, ...friends, visitor, stranger])
    await p.context.close();
});

test("E — the actual day: what's next, directions, done", async ({
  browser,
}) => {
  const { page, context } = await person(browser, { ...devices["Pixel 7"] });
  await signUp(page, "hal", "/adventures/new");
  await start(page, {
    town: "kelowna",
    when: "Pick dates",
    on: today,
    vibes: ["Outdoors"],
    title: "Today in Kelowna",
  });
  const panel = page.getByTestId("today-panel");
  await expect(panel).toBeVisible();
  const stops = await titlesOf(page);
  await expect(page.getByTestId("today-next")).toContainText(stops[0]!);
  await expect(page.getByTestId("today-directions")).toHaveAttribute(
    "href",
    /^https:\/\/www\.google\.com\/maps\/dir\//,
  );
  await page.getByTestId("today-done").click();
  await expect(page.getByTestId("today-next")).toContainText(stops[1]!);
  await page.reload();
  // Kept on this device.
  await expect(page.getByTestId("today-next")).toContainText(stops[1]!);
  await page.screenshot({
    path: `${process.env.SHOTS ?? "/tmp"}/E-today-phone.png`,
    fullPage: true,
  });
  await context.close();
});

test("F — not understood, or no sketch: nothing invented, everything manual works", async ({
  browser,
}) => {
  const { page, context } = await person(browser);
  await signUp(page, "ivy", "/adventures/new");
  await start(page, {
    town: "kelowna",
    when: "This Saturday",
    sketch: false,
    title: "By hand",
  });
  // A manual adventure is allowed: an open day, an invitation to fill it.
  await expect(stopsOf(page)).toHaveCount(0);
  await expect(page.getByTestId("sketch-day")).toBeVisible();

  // Gibberish changes nothing and says so.
  await changeInWords(page, "flibber the wibble");
  await expect(page.getByTestId("change-reply")).toBeVisible();
  await expect(page.getByTestId("change-apply")).toHaveCount(0);

  // Adding by hand works.
  await page.getByText("Add something of your own").click();
  await page.locator("#item-label").fill("Breakfast at Mom's");
  await page.getByRole("combobox", { name: "Day" }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add it" }).click();
  await expect(stopsOf(page)).toHaveCount(1);
  await expect(stopsOf(page).first()).toContainText("Breakfast at Mom's");

  // Asking Passport to fill the rest is one tap, and previews first.
  await page.reload();
  await context.close();
});

for (const width of [320, 375, 390]) {
  test(`fits ${width}px, and every control is thumb-sized`, async ({
    browser,
  }) => {
    const { page, context } = await person(browser, {
      viewport: { width, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    await signUp(page, `w${width}`, "/adventures/new");
    const url = await start(page, {
      town: "kelowna",
      when: "This weekend",
      vibes: ["Outdoors"],
    });
    for (const path of [
      "/saved",
      "/adventures",
      "/adventures/new",
      new URL(url).pathname,
      `${new URL(url).pathname}/guide`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState("load");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(
        overflow,
        `${path} scrolls sideways at ${width}px`,
      ).toBeLessThanOrEqual(1);
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "main button, main a[data-testid], main select, main input:not([type=checkbox]):not([type=radio])",
          ),
        ]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.height < 40;
          })
          .map(
            (el) =>
              `${el.tagName} ${(el.textContent ?? "").trim().slice(0, 30)} ${Math.round(el.getBoundingClientRect().height)}px`,
          ),
      );
      expect(small, `${path} has controls under 40px`).toEqual([]);
    }
    await context.close();
  });
}

test("the change box works from the keyboard alone", async ({ browser }) => {
  const { page, context } = await person(browser);
  await signUp(page, "kay", "/adventures/new");
  await start(page, {
    town: "kelowna",
    when: "This Saturday",
    vibes: ["Outdoors"],
  });
  await page.getByTestId("change-input").focus();
  await page.keyboard.type("Make it cheaper");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("change-preview")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId("change-apply").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("change-applied")).toBeVisible();
  await context.close();
});

/**
 * F, with Atlas down. Run against a server whose ATLAS_API_URL answers
 * nothing (the same build, started with ATLAS_API_URL=http://127.0.0.1:9):
 *
 *   E2E_ATLAS_DOWN=1 E2E_PORT=3127 npx playwright test -c … extraordinary -g "Atlas is down"
 */
test("F — Atlas is down: the adventure is created, safe, and editable by hand", async ({
  browser,
}) => {
  test.skip(!process.env.E2E_ATLAS_DOWN, "needs a server with no Atlas");
  const { page, context } = await person(browser);
  await signUp(page, "zed", "/adventures/new");
  await start(page, {
    town: "kelowna",
    when: "This weekend",
    vibes: ["Outdoors"],
    title: "No Atlas weekend",
  });
  await expect(page.getByTestId("started-note")).toContainText(
    "Atlas couldn't be reached",
  );
  await expect(page.getByTestId("atlas-down")).toBeVisible();
  await expect(page.getByTestId("plan-day-section")).toHaveCount(2);
  await expect(stopsOf(page)).toHaveCount(0);
  // Nothing invented to fill the gap — and by hand still works.
  await page.getByText("Add something of your own").click();
  await page.locator("#item-label").fill("Picnic at the beach");
  await page.getByRole("combobox", { name: "Day" }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add it" }).click();
  await expect(stopsOf(page)).toHaveCount(1);
  await page.screenshot({
    path: `${process.env.SHOTS ?? "/tmp"}/F-atlas-down.png`,
    fullPage: true,
  });
  await context.close();
});
