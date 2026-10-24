import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * **A coworker arrives in Vancouver, finds their people, joins a morning
 * walk, organises lunch, explores the city and shares memories** — with five
 * real accounts against a real GoTrue + PostgREST + Postgres, every
 * permission the database's.
 *
 *   Olivia  organiser, desktop
 *   Ana     a phone (390 px, touch, geolocation granted)
 *   Ben     desktop, geolocation granted
 *   Cat     a member who stays hidden
 *   Eve     signed in, in no conference
 *
 * Runs against a server built with the local stack's env and
 * CONFERENCE_STORE=supabase CONFERENCE_TOGETHER=on CONFERENCE_ARRIVALS=on,
 * ADS-B pointed at a closed port and ATLAS_API_URL at a saved Discovery body
 * (see docs/products/go-have-a-conference/TOGETHER.md).
 */

const PASSWORD = "see-you-in-vancouver-9";
const stamp = Date.now().toString(36);
const SHOTS = process.env.SHOTS ?? "";
const TZ = "America/Vancouver";
const emailFor = (who: string) => `${who}-${stamp}@example.test`;

const ymd = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
const hmIn = (minutes: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Date.now() + minutes * 60_000));

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function person(
  browser: Browser,
  opts: { mobile?: boolean; at?: { latitude: number; longitude: number } } = {},
) {
  const context = await browser.newContext({
    ...(opts.mobile
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : {}),
    ...(opts.at ? { geolocation: opts.at, permissions: ["geolocation"] } : {}),
  });
  return { context, page: await context.newPage() };
}

async function joinByCode(page: Page, who: string, code: string, id: string) {
  await page.goto("/conferences");
  await page.getByLabel("Conference code").fill(code);
  await page.getByRole("button", { name: "Let me in" }).click();
  await page.waitForURL("**/auth**");
  await signUp(page, who);
  await page.waitForURL("**/conferences");
  await page.getByLabel("Conference code").fill(code);
  await page.getByRole("button", { name: "Let me in" }).click();
  await page.waitForURL(`**/conferences/${id}`);
}

async function beSeen(page: Page, name: string) {
  // How you appear lives on your profile, not on the overview.
  await page.goto(page.url().replace(/(\/conferences\/[^/?#]+).*/, "$1/you"));
  await page.getByLabel("Your name here").fill(name);
  await page.getByLabel(/Show my name to other/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

async function noSidewaysScroll(page: Page, what: string) {
  const wide = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - window.innerWidth,
  );
  expect(wide, `${what} scrolls sideways`).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
  });
}

/** Tick a day in the plan form (scoped: answer buttons carry day labels too). */
async function pickDay(page: Page, offset: number) {
  const label = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${ymd(offset)}T12:00:00Z`));
  await page
    .getByRole("form", { name: /plan/i })
    .getByRole("checkbox", { name: label })
    .check();
}

const plan = (page: Page, title: string) =>
  page.locator(`[data-testid="plan"][data-plan="${title}"]`);

test.describe.configure({ mode: "serial" });

test("a conference day, together", async ({ browser }) => {
  test.setTimeout(420_000);
  // The convention centre, and a block away.
  const olivia = await person(browser);
  const ana = await person(browser, {
    mobile: true,
    at: { latitude: 49.28905, longitude: -123.11683 },
  });
  const ben = await person(browser, {
    at: { latitude: 49.2878, longitude: -123.1135 },
  });
  const cat = await person(browser);
  const eve = await person(browser);

  // ── Olivia starts it, with every built module on by default ──
  await olivia.page.goto("/conferences");
  await olivia.page.getByRole("link", { name: "Sign in to Passport" }).click();
  await signUp(olivia.page, "olivia");
  await olivia.page.waitForURL("**/conferences");
  await olivia.page.getByRole("link", { name: "Start a conference" }).click();
  await olivia.page
    .getByLabel("What's it called?")
    .fill("Sycle Vancouver 2026");
  await olivia.page
    .getByLabel("Free-time ideas start from")
    .selectOption("vancouver");
  await olivia.page.getByLabel("Starts").fill(ymd(0));
  await olivia.page.getByLabel("Ends").fill(ymd(3));
  for (const m of [
    "Plans",
    "Find my people",
    "Explore",
    "Memories",
    "Arrivals",
  ])
    await expect(
      olivia.page.getByRole("checkbox", { name: new RegExp(`^${m}`) }),
    ).toBeChecked();
  // Chat starts off (VISION §7's standing lean); the organiser switches it on.
  const chat = olivia.page.getByRole("checkbox", { name: /^Chat/ });
  await expect(chat).not.toBeChecked();
  await chat.check();
  await olivia.page.getByRole("button", { name: "Create it" }).click();
  await expect(
    olivia.page.getByRole("heading", { name: "Organiser settings" }),
  ).toBeVisible();
  const id = olivia.page.url().split("/conferences/")[1]!.split("/")[0]!;
  await olivia.page.getByRole("button", { name: "Turn on a code" }).click();
  const code = (await olivia.page
    .getByTestId("access-code")
    .textContent())!.trim();
  await olivia.page.goto(`/conferences/${id}`);
  await beSeen(olivia.page, "Olivia");

  // ── Ana (phone), Ben and Cat come in; Ana and Ben choose to be seen ──
  await joinByCode(ana.page, "ana", code, id);
  await beSeen(ana.page, "Ana");
  await joinByCode(ben.page, "ben", code, id);
  await beSeen(ben.page, "Ben");
  await joinByCode(cat.page, "cat", code, id);
  await eve.page.goto("/auth");
  await signUp(eve.page, "eve");
  await eve.page.waitForURL(/\/discovery|\/conferences/);

  // ── Arrivals: Ana and Ben land tomorrow, half an hour apart ──
  for (const [p, name, flight, lands] of [
    [ana.page, "Ana", "AC123", "14:20"],
    [ben.page, "Ben", "WS456", "14:50"],
  ] as const) {
    const r = await p.request.put(`/api/conferences/${id}/arrivals/me`, {
      data: {
        flight,
        date: ymd(1),
        from: "YYZ",
        lands: `${ymd(1)}T${lands}`,
        shared: true,
        displayName: name,
      },
    });
    expect(r.status(), `${name}'s flight`).toBe(200);
  }
  await olivia.page.goto(`/conferences/${id}/arrivals`);
  await expect(olivia.page.getByTestId("arriving-next")).toContainText("Ana");
  await expect(olivia.page.getByTestId("landing-together")).toContainText(
    "Ana, Ben",
  );
  await expect(olivia.page.getByTestId("arrival-timeline")).toContainText(
    "(scheduled)",
  );
  await shot(olivia.page, "01-arrivals-coordination");
  // "Meet at arrivals" opens a plan already filled in.
  await olivia.page.getByRole("link", { name: "Meet at arrivals" }).click();
  await expect(olivia.page.getByLabel("Call it")).toHaveValue(
    "Ride in from YVR together",
  );
  await expect(olivia.page.getByLabel("Where do we meet?")).toHaveValue(
    "YVR arrivals hall",
  );
  await olivia.page.getByRole("button", { name: "Never mind" }).click();

  // ── Ana makes the morning walk: two days, 7:00, the hotel lobby ──
  await ana.page.goto(`/conferences/${id}/plans`);
  await ana.page.getByRole("button", { name: /Make a plan/ }).click();
  await ana.page.getByRole("button", { name: /Morning walk/ }).click();
  await ana.page
    .getByLabel("Call it")
    .fill("Early risers — Vancouver morning walk");
  await ana.page
    .getByLabel("Anything people should know")
    .fill("Seawall loop, back by 8.");
  const dayBoxes = ana.page.getByRole("checkbox");
  await pickDay(ana.page, 1);
  await pickDay(ana.page, 2);
  expect(await dayBoxes.count()).toBeGreaterThan(2);
  await expect(ana.page.getByLabel(/What time/)).toHaveValue("07:00");
  await ana.page.getByLabel("Where do we meet?").fill("Hotel lobby");
  await ana.page.getByRole("button", { name: "Post the plan" }).click();
  const walk = plan(ana.page, "Early risers — Vancouver morning walk");
  await expect(walk).toBeVisible();
  await expect(walk.getByTestId("occurrence")).toHaveCount(2);
  await expect(walk.getByTestId("occurrence").first()).toContainText("7:00 AM");
  await noSidewaysScroll(ana.page, "plans");
  await shot(ana.page, "02-phone-plans");

  // ── Ben sees it on his home page without reloading, and answers each day ──
  await ben.page.goto(`/conferences/${id}`);
  await expect(ben.page.getByTestId("up-next")).toContainText("Early risers", {
    timeout: 25_000,
  });
  await ben.page.goto(`/conferences/${id}/plans`);
  const benWalk = plan(ben.page, "Early risers — Vancouver morning walk");
  await benWalk
    .getByTestId("occurrence")
    .nth(0)
    .getByRole("button", { name: "I'm in" })
    .click();
  await benWalk
    .getByTestId("occurrence")
    .nth(1)
    .getByRole("button", { name: "Maybe" })
    .click();
  await expect(
    benWalk
      .getByTestId("occurrence")
      .nth(0)
      .getByRole("button", { name: "I'm in" }),
  ).toHaveAttribute("aria-pressed", "true");
  // Cat, still hidden, is in on day one: counted, never named.
  await cat.page.goto(`/conferences/${id}/plans`);
  await plan(cat.page, "Early risers — Vancouver morning walk")
    .getByTestId("occurrence")
    .nth(0)
    .getByRole("button", { name: "I'm in" })
    .click();
  await expect(
    walk.getByTestId("occurrence").nth(0).getByTestId("who"),
  ).toContainText("3 in", { timeout: 20_000 });
  await expect(
    walk.getByTestId("occurrence").nth(0).getByTestId("who"),
  ).toContainText("Ben");
  await expect(
    walk.getByTestId("occurrence").nth(0).getByTestId("who"),
  ).toContainText("+1 more");
  await expect(
    walk.getByTestId("occurrence").nth(1).getByTestId("who"),
  ).toContainText("maybe: Ben");
  await expect(ana.page.getByText("Cat")).toHaveCount(0);

  // ── Ben organises lunch for just him and Ana, and the two of them vote ──
  await ben.page.getByRole("button", { name: /Make a plan/ }).click();
  await ben.page.getByRole("button", { name: /Lunch/ }).click();
  await ben.page
    .getByLabel("Call it")
    .fill("Lunch away from the convention centre");
  await pickDay(ben.page, 1);
  await expect(ben.page.getByLabel(/What time/)).toHaveValue("12:30");
  await ben.page.getByText("Selected coworkers").click();
  await ben.page.getByTestId("invite-people").getByText("Ana").click();
  await ben.page.getByRole("button", { name: "Post the plan" }).click();
  const lunch = plan(ben.page, "Lunch away from the convention centre");
  await expect(lunch).toContainText("Invite only");
  await lunch.getByRole("button", { name: "+ Suggest a place" }).click();
  const picker = lunch.getByTestId("place-picker");
  await expect(picker.getByRole("button").nth(1)).toBeVisible({
    timeout: 30_000,
  });
  const first = (await picker
    .getByRole("button")
    .nth(1)
    .locator("span.block")
    .first()
    .textContent())!.trim();
  await picker.getByRole("button").nth(1).click();
  await lunch.getByRole("button", { name: "+ Suggest a place" }).click();
  const second = (await lunch
    .getByTestId("place-picker")
    .getByRole("button")
    .nth(2)
    .locator("span.block")
    .first()
    .textContent())!.trim();
  await lunch.getByTestId("place-picker").getByRole("button").nth(2).click();
  await expect(
    lunch.getByTestId("venue-options").getByRole("listitem"),
  ).toHaveCount(2);
  // Ana votes for the second; Ben for the first, then changes his mind.
  await ana.page.reload();
  const anaLunch = plan(ana.page, "Lunch away from the convention centre");
  await anaLunch.getByRole("button", { name: `Vote for ${second}` }).click();
  await lunch.getByRole("button", { name: `Vote for ${first}` }).click();
  await lunch.getByRole("button", { name: `Vote for ${second}` }).click();
  await expect(lunch.getByTestId("venue-options")).toContainText("2 votes", {
    timeout: 15_000,
  });
  await lunch.getByRole("button", { name: `Choose ${second}` }).click();
  // Choosing the place makes it where we meet: one line, not two.
  await expect(lunch).toContainText(`Meet at: ${second}`);
  await expect(anaLunch).toContainText(`Meet at: ${second}`, {
    timeout: 20_000,
  });
  await expect(
    anaLunch.getByRole("link", { name: /Directions to/ }).first(),
  ).toHaveAttribute("href", /google\.com\/maps\/dir|maps\.apple\.com/);
  await shot(ben.page, "03-lunch-vote");
  // Not invited: Olivia and Cat can't see it, can't answer it, can't read its thread.
  await olivia.page.goto(`/conferences/${id}/plans`);
  await expect(
    plan(olivia.page, "Early risers — Vancouver morning walk"),
  ).toBeVisible();
  await expect(
    plan(olivia.page, "Lunch away from the convention centre"),
  ).toHaveCount(0);
  const lunchId = (await lunch.getAttribute("id"))!.replace("plan-", "");
  const catTries = await cat.page.request.get(
    `/api/conferences/${id}/chat?room=${lunchId}`,
  );
  expect(catTries.status()).toBe(404);
  const catAnswers = await cat.page.request.post(
    `/api/conferences/${id}/plans`,
    {
      data: {
        action: "answer",
        planId: lunchId,
        occurrenceId: "x",
        answer: "in",
      },
    },
  );
  expect(catAnswers.status()).toBe(404);

  // ── Chat: the room, a reaction, and the lunch thread ──
  await ana.page.goto(`/conferences/${id}/chat`);
  await ana.page
    .getByLabel("Message")
    .fill("Anyone want coffee before the keynote?");
  await ana.page.getByRole("button", { name: "Send" }).click();
  await ben.page.goto(`/conferences/${id}/chat`);
  await expect(ben.page.getByTestId("messages")).toContainText(
    "Anyone want coffee before the keynote?",
  );
  await ben.page.getByRole("button", { name: /Message from Ana/ }).click();
  await ben.page.getByRole("button", { name: "React 🙌" }).click();
  await expect(ana.page.getByTestId("messages")).toContainText("🙌 1", {
    timeout: 15_000,
  });
  await noSidewaysScroll(ana.page, "chat");
  await shot(ana.page, "04-phone-chat");
  await cat.page.goto(`/conferences/${id}/chat`);
  await expect(cat.page.getByTestId("messages")).toContainText(
    "Anyone want coffee",
  );
  await expect(cat.page.getByText(/reading quietly/)).toBeVisible();
  const catPosts = await cat.page.request.post(`/api/conferences/${id}/chat`, {
    data: { action: "say", body: "sneaky" },
  });
  expect(catPosts.status()).toBe(403);
  await ben.page.goto(`/conferences/${id}/chat?room=${lunchId}`);
  await ben.page.getByLabel("Message").fill("Table for two at 12:30?");
  await ben.page.getByRole("button", { name: "Send" }).click();
  await ana.page.goto(`/conferences/${id}/chat?room=${lunchId}`);
  await expect(ana.page.getByTestId("messages")).toContainText("Table for two");
  const olivThread = await olivia.page.goto(
    `/conferences/${id}/chat?room=${lunchId}`,
  );
  expect(olivThread?.status()).toBe(404);

  // ── Find my people: Ana shares for 30 minutes; Ben finds her; she stops ──
  await ana.page.goto(`/conferences/${id}/people`);
  await ana.page.getByRole("button", { name: "30 min" }).click();
  await ana.page.getByLabel(/A note/).fill("By the Olympic cauldron");
  await ana.page.getByRole("button", { name: "Share for 30 min" }).click();
  await expect(ana.page.getByTestId("sharing")).toBeVisible();
  await noSidewaysScroll(ana.page, "find my people");
  await ben.page.goto(`/conferences/${id}/people`);
  await expect(ben.page.getByTestId("people-here")).toContainText("Ana");
  await expect(ben.page.getByTestId("people-here")).toContainText(
    "By the Olympic cauldron",
  );
  await ben.page.getByRole("button", { name: /Share for/ }).click();
  await expect(ben.page.getByTestId("people-here")).toContainText(
    /\d+ m away/,
    { timeout: 15_000 },
  );
  await shot(ben.page, "05-find-my-people");
  // The position on the wire is rounded (4 decimals).
  const seen = await ben.page.request.get(`/api/conferences/${id}/people`);
  const anaAt = (
    (await seen.json()).people.people as { name: string; at: number[] }[]
  ).find((p) => p.name === "Ana")!.at;
  expect(
    anaAt.every((x) => Math.abs(x * 10_000 - Math.round(x * 10_000)) < 1e-6),
  ).toBe(true);
  // Cat can look but not share; Eve can't even look.
  await cat.page.goto(`/conferences/${id}/people`);
  await expect(
    cat.page.getByText(/first choose a name and to be seen/),
  ).toBeVisible();
  expect(
    (await eve.page.request.get(`/api/conferences/${id}/people`)).status(),
  ).toBe(404);
  expect((await eve.page.goto(`/conferences/${id}/people`))?.status()).toBe(
    404,
  );
  await ana.page.getByRole("button", { name: "Stop sharing now" }).click();
  await expect(
    ana.page.getByRole("button", { name: /Share for/ }),
  ).toBeVisible();
  // Revoked means gone at the source: Ben's very next read has no Ana.
  const after = await ben.page.request.get(`/api/conferences/${id}/people`);
  expect(
    ((await after.json()).people.people as { name: string }[]).map(
      (p) => p.name,
    ),
  ).toEqual(["You"]);
  await expect(ben.page.getByText("By the Olympic cauldron")).toHaveCount(0, {
    timeout: 15_000,
  });

  // ── Explore: real places near the venue, and "Plan this" ──
  await ana.page.goto(`/conferences/${id}/discover`);
  await expect(ana.page.getByTestId("explore-place").first()).toBeVisible({
    timeout: 30_000,
  });
  const shelves = (
    await (await ana.page.request.get(`/api/conferences/${id}/explore`)).json()
  ).explore.shelves as Record<string, { name: string; photo?: unknown }[]>;
  console.log(
    "explore shelves:",
    Object.entries(shelves)
      .map(
        ([k, v]) =>
          `${k} ${v.length} (${v.filter((x) => x.photo).length} photographed)`,
      )
      .join(", "),
  );
  expect(shelves.restaurants.length).toBeGreaterThan(0);
  await ana.page.getByRole("button", { name: /^Restaurants/ }).click();
  const placeCard = ana.page.getByTestId("explore-place").first();
  const placeName = (await placeCard
    .getByTestId("place-name")
    .textContent())!.trim();
  await noSidewaysScroll(ana.page, "explore");
  await shot(ana.page, "06-phone-explore");
  await placeCard.getByRole("link", { name: "Plan this" }).click();
  await expect(ana.page.getByText(`📍 ${placeName}`)).toBeVisible();
  await pickDay(ana.page, 1);
  await ana.page.getByRole("button", { name: "Post the plan" }).click();
  await expect(ana.page.getByText(`Going to: ${placeName}`)).toBeVisible();

  // ── A reminder: Olivia's coffee in 25 minutes, Ben is in ──
  await olivia.page.goto(`/conferences/${id}/plans?kind=coffee`);
  await olivia.page.getByLabel("Call it").fill("Coffee right now-ish");
  await pickDay(olivia.page, 0);
  await olivia.page.getByLabel(/What time/).fill(hmIn(25));
  await olivia.page.getByLabel("Where do we meet?").fill("Hotel lobby");
  await olivia.page.getByRole("button", { name: "Post the plan" }).click();
  await ben.page.goto(`/conferences/${id}/plans`);
  await plan(ben.page, "Coffee right now-ish")
    .getByRole("button", { name: "I'm in" })
    .click();
  await ben.page.goto(`/conferences/${id}`);
  await expect(ben.page.getByTestId("reminder").first()).toContainText(
    /Coffee starts in 2\d minutes/,
    { timeout: 30_000 },
  );
  await ben.page.getByRole("button", { name: "Got it" }).first().click();
  await ben.page.reload();
  await expect(ben.page.getByTestId("up-next")).toBeVisible();
  await ben.page.waitForTimeout(2_000);
  await expect(ben.page.getByTestId("reminder")).toHaveCount(0);
  // Ana said nothing to it: no reminder for her.
  await ana.page.goto(`/conferences/${id}`);
  await ana.page.waitForTimeout(3_000);
  await expect(ana.page.getByText(/Coffee starts in/)).toHaveCount(0);

  // ── Memories: Ana adds a photo from the walk; Ben reacts and downloads ──
  await ana.page.goto(`/conferences/${id}/memories`);
  await ana.page
    .getByLabel(/What's happening in it/)
    .fill("Sunrise on the seawall");
  await ana.page
    .getByLabel("From which plan?")
    .selectOption({ label: "Early risers — Vancouver morning walk" });
  await ana.page
    .getByTestId("photo-file")
    .setInputFiles(
      path.resolve(
        "docs/products/go-have-a-conference/arrivals/05-board-phone-stubbed.png",
      ),
    );
  await expect(ana.page.getByTestId("album").getByRole("listitem")).toHaveCount(
    1,
    { timeout: 30_000 },
  );
  await noSidewaysScroll(ana.page, "memories");
  await ben.page.goto(`/conferences/${id}/memories`);
  await ben.page
    .getByRole("button", { name: /Photo by Ana: Sunrise on the seawall/ })
    .click();
  await expect(ben.page.getByRole("dialog")).toContainText("Early risers");
  await ben.page.getByRole("button", { name: "React ❤️" }).click();
  await expect(
    ben.page.getByRole("button", { name: "React ❤️" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    ben.page.getByRole("button", { name: /Delete my photo|Take it down/ }),
  ).toHaveCount(0);
  const href = await ben.page
    .getByRole("link", { name: "Download" })
    .getAttribute("href");
  const file = await ben.page.request.get(href!);
  expect(file.headers()["content-type"]).toBe("image/jpeg");
  expect(file.headers()["content-disposition"]).toMatch(
    /attachment; filename="sycle-vancouver-2026-sunrise-on-the-seawall-.+\.jpg"/,
  );
  await shot(ben.page, "07-memory");
  const photoUrl = href!.replace("?download=1", "");
  expect((await eve.page.request.get(photoUrl)).status()).toBe(404);
  expect((await ben.page.request.delete(photoUrl)).status()).toBe(403);
  await ben.page.getByRole("button", { name: "Close" }).click();

  // ── The home page answers the five questions ──
  await ben.page.goto(`/conferences/${id}`);
  await expect(ben.page.getByTestId("up-next")).toContainText("Early risers");
  await expect(ben.page.getByTestId("up-next")).toContainText("Lunch away");
  await expect(ben.page.getByTestId("chat-preview")).toContainText(
    "Anyone want coffee",
  );
  await expect(
    ben.page.getByTestId("recent-memories").locator("img"),
  ).toHaveCount(1);
  await expect(ben.page.getByTestId("arrivals-summary")).toContainText("Next");
  await ana.page.goto(`/conferences/${id}`);
  await noSidewaysScroll(ana.page, "home");
  await shot(ana.page, "08-phone-home");
  await shot(ben.page, "09-desktop-home");

  // ── Ana on her phone: five tabs along the bottom, at three phone widths ──
  // Go Have a Day's own bar steps aside inside a conference on a phone.
  await expect(
    ana.page.getByRole("link", { name: "Discover", exact: true }),
  ).toBeHidden();
  const tabs = ana.page.getByRole("navigation", {
    name: "Conference sections",
  });
  for (const width of [320, 375, 390]) {
    await ana.page.setViewportSize({ width, height: 760 });
    for (const [label, rest] of [
      ["Arrivals", "/arrivals"],
      ["Agenda", "/schedule"],
      ["Explore", "/discover"],
      ["People", "/people"],
      ["Home", ""],
    ] as const) {
      const tab = tabs.getByRole("link", { name: label });
      await tab.click();
      await ana.page.waitForURL(new RegExp(`/conferences/${id}${rest}$`));
      await expect(tab).toHaveAttribute("aria-current", "page");
      const box = (await tab.boundingBox())!;
      expect(
        box.height,
        `${label} tab is a thumb-sized target`,
      ).toBeGreaterThanOrEqual(44);
      await noSidewaysScroll(ana.page, `${label} at ${width} px`);
      await shot(ana.page, `10-phone-${width}-${label.toLowerCase()}`);
    }
  }
  await ana.page.setViewportSize({ width: 390, height: 844 });

  // ── Ana takes her photo down; Ben leaves, and everything he wrote goes ──
  await ana.page.goto(`/conferences/${id}/memories`);
  await ana.page.getByRole("button", { name: /Photo by You/ }).click();
  await ana.page.getByRole("button", { name: "Delete my photo" }).click();
  await expect(ana.page.getByTestId("album")).toHaveCount(0);
  const left = await ben.page.request.delete(`/api/conferences/${id}/me`);
  expect(left.status()).toBe(200);
  await ana.page.goto(`/conferences/${id}/plans`);
  await expect(
    plan(ana.page, "Lunch away from the convention centre"),
  ).toHaveCount(0);
  await expect(
    plan(ana.page, "Early risers — Vancouver morning walk")
      .getByTestId("occurrence")
      .nth(0)
      .getByTestId("who"),
  ).not.toContainText("Ben");
  await ana.page.goto(`/conferences/${id}/chat`);
  await expect(ana.page.getByTestId("messages")).not.toContainText("🙌");

  // A stranger never learns any of it existed.
  for (const p of [
    "",
    "/plans",
    "/chat",
    "/people",
    "/memories",
    "/discover",
    "/arrivals",
    "/schedule",
    "/you",
    "/admin",
  ])
    expect(
      (await eve.page.goto(`/conferences/${id}${p}`))?.status(),
      p || "home",
    ).toBe(404);
  expect(
    (await eve.page.request.get(`/api/conferences/${id}/plans`)).status(),
  ).toBe(404);

  for (const p of [olivia, ana, ben, cat, eve]) await p.context.close();
});
