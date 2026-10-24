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
 * **The Crew: Find My Drunk Friend, Summon the Squad, the Crew strip and
 * Snack Run, with real accounts on real phones.**
 *
 * Needs the local stack WITH the arena and crew migrations (stack.mjs start,
 * the default) and the app built against it. Proves, end to end:
 *
 *   everyone starts hidden → one account adds a GPS hint on request and a
 *   second sees it as a hint, with accuracy and age, never as a section and
 *   never as "here" → a manual section check-in makes her present, the crew
 *   cheers → Stop sharing removes both at once, for everybody → a phone that
 *   refuses GPS still works by section → the night ending expires everything
 *   → summon the squad (map pick), answered On my way / Busy / Where?, and it
 *   persists across a reload → a snack run, a request, closing it → no
 *   public endpoint → 320 px and reduced motion → Plan and Play untouched.
 */

const stamp = Date.now().toString(36);
const SHOTS = process.env.CREW_SHOTS;
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
const email = (who: string) => `crew-${who}-${stamp}@example.test`;

/** Rogers Arena, roughly: what a phone standing outside the doors reports. */
const OUTSIDE_DOORS = { latitude: 49.2779, longitude: -123.1089 };

async function phone(
  browser: Browser,
  width: number,
  opts: {
    reducedMotion?: "reduce";
    gps?: { latitude: number; longitude: number; accuracy: number };
  } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const { gps, ...rest } = opts;
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...(gps ? { geolocation: gps, permissions: ["geolocation"] } : {}),
    ...rest,
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

const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const tab = (page: Page, name: string) =>
  page
    .getByRole("tablist", { name: "Arena Mode" })
    .getByRole("tab", { name: new RegExp(`^${name}`) });
const crew = (page: Page, who: string) => page.getByTestId(`crew-${who}`);

async function openPerson(page: Page, who: string) {
  await crew(page, who).click();
  const sheet = dialog(page, who);
  await expect(sheet).toBeVisible();
  return sheet;
}

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

test("The Crew: find friends, summon the squad, snack run", async ({
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
  const api = `/hockey/api/occasions/${nightId}/arena`;
  await host.page.getByRole("button", { name: /Skip/ }).click();
  await moveStart(nightId, new Date(Date.now() + 60 * 60_000));

  async function invite(label: string) {
    const res = await host.page.request.post(
      `/hockey/api/occasions/${nightId}/invites`,
      { data: { label } },
    );
    return `/hockey/join/${(await res.json()).token}`;
  }
  async function join(
    who: string,
    name: string,
    width: number,
    opts: Parameters<typeof phone>[2] = {},
  ) {
    const p = await phone(browser, width, opts);
    await p.page.goto(await invite(name));
    await p.page.getByRole("link", { name: "Sign in to see it" }).click();
    await signUp(p.page, who);
    await p.page.getByLabel("Your name").fill(name);
    await p.page.getByRole("button", { name: "I'm in" }).click();
    await expect(p.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
    await p.page.goto(arenaPath);
    return p;
  }
  const maya = await join("maya", "Maya", 320, {
    gps: { ...OUTSIDE_DOORS, accuracy: 40 },
  });
  // Sam's phone says no to GPS: no permission granted, so the browser refuses.
  const sam = await join("sam", "Sam", 375, { reducedMotion: "reduce" });
  await host.page.goto(arenaPath);
  const read = async (p: Page) => (await p.request.get(api)).json();

  // ---------------------------------------------------- everyone starts hidden
  for (const p of [host, maya, sam]) {
    await expect(p.page.getByTestId("sharing")).toContainText("Not sharing");
  }
  await expect(host.page.getByTestId("crew-count")).toContainText(
    "0 of 3 checked in",
  );
  for (const who of ["Maya", "Sam"]) {
    await expect(crew(host.page, who)).toHaveAttribute(
      "data-presence",
      "quiet",
    );
  }
  let view = await read(host.page);
  expect(view.checkins, "no check-ins by default").toEqual([]);
  expect(view.crew.gps, "no GPS hints by default").toEqual([]);
  await shot(host.page, "01-host-everyone-hidden-390");

  // ------------------------------------------- Maya opts in to a GPS hint
  await tab(maya.page, "Find friends").click();
  await expect(maya.page.getByTestId("find-title")).toHaveText(
    "Find My Drunk Friend",
  );
  await expect(maya.page.getByText("Optional: add a GPS hint")).toBeVisible();
  await shot(maya.page, "02-maya-find-my-friend-320", true);
  // Nothing was asked of the phone, and nothing is shared, until she taps.
  expect((await read(maya.page)).crew.gps).toEqual([]);
  const sent: unknown[] = [];
  maya.page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith(api))
      sent.push(r.postDataJSON());
  });
  await maya.page.getByRole("button", { name: "Share a GPS hint" }).click();
  await expect(maya.page.getByTestId("my-gps")).toContainText(
    "Phone is around the arena (±40 m)",
  );
  await expect(maya.page.getByTestId("sharing")).toHaveAttribute(
    "data-sharing",
    "true",
  );
  await expect(maya.page.getByTestId("sharing")).toContainText("GPS hint");
  await expect(maya.page.getByTestId("sharing")).toContainText(
    "Sharing with 2 friends",
  );
  expect(sent.length).toBe(1);
  await shot(maya.page, "03-maya-sharing-indicator-320");

  // What the server keeps and what a friend can read: zone, rounded, no position.
  view = await read(host.page);
  expect(view.crew.gps).toHaveLength(1);
  const hint = view.crew.gps[0];
  expect(Object.keys(hint).sort()).toEqual([
    "accuracyM",
    "at",
    "distanceM",
    "user",
    "zone",
  ]);
  expect(hint.zone).toBe("around");
  expect(hint.distanceM % 50).toBe(0);
  expect(JSON.stringify(view)).not.toMatch(/49\.27|-123\.10|"lat"|"lng"/);

  // The host sees a hint — not a person in the building.
  await expect(crew(host.page, "Maya")).toHaveAttribute(
    "data-presence",
    "hint",
    { timeout: 15_000 },
  );
  await expect(host.page.getByTestId("crew-count")).toContainText(
    "0 of 3 checked in",
  );
  const sheet = await openPerson(host.page, "Maya");
  await expect(sheet.getByTestId("gps-line")).toContainText(
    "Phone is around the arena (±40 m)",
  );
  await expect(sheet.getByTestId("gps-line")).toContainText(/just now|min ago/);
  await expect(sheet.getByTestId("gps-line")).toContainText(
    "can't tell which level or section",
  );
  await expect(sheet).not.toContainText("📍");
  await expect(sheet).toContainText("Only a GPS hint");
  await shot(host.page, "04-host-sees-gps-hint-not-section-390");
  await sheet.getByRole("button", { name: "Close" }).click();
  // GPS never draws a dot on the map.
  await expect(host.page.locator("svg[data-level] [data-person]")).toHaveCount(
    0,
  );

  // ----------------------- Maya says her section; the crew cheers, once she has
  await maya.page
    .getByRole("button", { name: "📍 Tell the crew my section or spot" })
    .click();
  await dialog(maya.page, "Where are you?")
    .getByPlaceholder("Any section, e.g. 309")
    .fill("112");
  await dialog(maya.page, "Where are you?")
    .getByRole("button", { name: "Check in" })
    .click();
  await expect(host.page.getByTestId("arrival")).toContainText(
    "Maya made it! Section 112",
    { timeout: 15_000 },
  );
  await shot(host.page, "05-celebrate-maya-made-it-390");
  await expect(crew(host.page, "Maya")).toHaveAttribute("data-presence", "in");
  await expect(host.page.getByTestId("crew-count")).toContainText(
    "1 of 3 checked in",
  );
  // Sam, who is just a face in the strip, is still nobody's "here".
  await expect(crew(host.page, "Sam")).toHaveAttribute(
    "data-presence",
    "quiet",
  );

  // ------------------------------- Stop sharing: one tap, gone for everybody
  await maya.page.getByTestId("stop-sharing").click();
  await expect(maya.page.getByTestId("sharing")).toContainText("Not sharing");
  view = await read(host.page);
  expect(view.checkins, "her check-in is gone at once").toEqual([]);
  expect(view.crew.gps, "and her GPS hint").toEqual([]);
  await expect(crew(host.page, "Maya")).toHaveAttribute(
    "data-presence",
    "quiet",
    { timeout: 15_000 },
  );

  // ------------------------------ Manual works with the GPS permission refused
  await tab(sam.page, "Find friends").click();
  await sam.page.getByRole("button", { name: "Share a GPS hint" }).click();
  await expect(sam.page.getByRole("status")).toContainText(/said no|Couldn't/, {
    timeout: 20_000,
  });
  expect((await read(host.page)).crew.gps).toEqual([]);
  await sam.page
    .getByRole("button", { name: "📍 Tell the crew my section or spot" })
    .click();
  await dialog(sam.page, "Where are you?")
    .getByRole("button", { name: /Outside the arena/ })
    .click();
  await expect(crew(host.page, "Sam")).toHaveAttribute(
    "data-presence",
    "outside",
    { timeout: 15_000 },
  );
  // "Outside" is not "here": no celebration, and the count does not move.
  await expect(host.page.getByTestId("crew-count")).toContainText(
    "0 of 3 checked in",
  );
  await sam.page.getByTestId("stop-sharing").click();

  // -------------------------------------------- no public endpoint
  for (const url of [
    api,
    `${api}/gps`,
    "/hockey/api/gps",
    "/hockey/api/crew",
  ]) {
    const anon = await fetch(
      `http://localhost:${process.env.E2E_PORT ?? 3130}${url}`,
    );
    expect([401, 404, 405], `${url} → ${anon.status}`).toContain(anon.status);
    const body = await anon.text();
    expect(body).not.toMatch(/zone|distanceM|accuracyM/);
  }
  const bad = await host.page.request.post(api, {
    data: { type: "gpsShare", reading: { lat: 999, lng: 0, accuracy: 5 } },
  });
  expect(bad.status()).toBe(400);
  const rough = await host.page.request.post(api, {
    data: {
      type: "gpsShare",
      reading: { lat: 49.2778, lng: -123.1088, accuracy: 9000 },
    },
  });
  expect(rough.status(), "a reading too rough to say anything").toBe(422);
  const noteTooLong = await host.page.request.post(api, {
    data: { type: "summon", place: "sec:112", note: "x".repeat(200) },
  });
  expect(noteTooLong.status()).toBe(400);

  // ---------------------------------------------------------- the squad
  await maya.page.getByRole("button", { name: "📣 Summon the squad" }).click();
  const summon = dialog(maya.page, "Summon the squad");
  await summon.getByRole("button", { name: "Nachos. Now." }).click();
  await summon.getByRole("button", { name: /Pick it on the map/ }).click();
  await expect(
    maya.page.getByText("Tap where the squad should meet"),
  ).toBeVisible();
  await maya.page.locator('[data-section="106"]').dispatchEvent("click");
  await expect(maya.page.getByText(/Squad summoned to/)).toBeVisible();
  await expect(sam.page.getByTestId("incoming-summons")).toContainText(
    "Maya summons the squad",
    { timeout: 15_000 },
  );
  await expect(sam.page.getByTestId("incoming-summons")).toContainText(
    "Nachos. Now.",
  );
  await shot(sam.page, "06-sam-is-summoned-375");
  await sam.page
    .getByTestId("incoming-summons")
    .getByRole("button", { name: /Where\?/ })
    .click();
  await expect(sam.page.getByTestId("incoming-summons")).toHaveCount(0);
  await expect(host.page.getByTestId("incoming-summons")).toContainText(
    "Maya summons the squad",
    { timeout: 15_000 },
  );
  await host.page
    .getByTestId("incoming-summons")
    .getByRole("button", { name: /On my way/ })
    .click();
  await tab(maya.page, "Squad").click();
  await expect(maya.page.getByTestId("tally-coming")).toContainText("Lorne", {
    timeout: 15_000,
  });
  await expect(maya.page.getByTestId("tally-where")).toContainText("Sam");
  await shot(maya.page, "07-maya-sees-who-is-coming-320", true);
  // Persisted: a reload still has the summons and the answers.
  await maya.page.reload();
  await tab(maya.page, "Squad").click();
  await expect(maya.page.getByTestId("summon")).toHaveCount(1);
  await expect(maya.page.getByTestId("tally-coming")).toContainText("Lorne");
  await expect(maya.page.getByTestId("tally-where")).toContainText("Sam");
  // A second summons inside twenty seconds is refused politely.
  const again = await maya.page.request.post(api, {
    data: { type: "summon", place: "sec:112", note: "" },
  });
  expect(again.status()).toBe(429);

  // ------------------------------------------------------------ snack run
  await tab(maya.page, "Snack run").click();
  await expect(maya.page.getByText(NO_MONEY)).toBeVisible();
  const stands = maya.page.getByRole("radiogroup", { name: "Where from" });
  await stands.getByRole("radio").nth(1).click();
  await maya.page.getByPlaceholder("Leaving in 2 minutes").fill("Back in 10");
  await maya.page
    .getByRole("button", { name: "🏃 Announce my snack run" })
    .click();
  await expect(maya.page.getByTestId("snack-run")).toContainText(
    "You're going to",
  );
  await tab(sam.page, "Snack run").click();
  const theirs = sam.page.getByTestId("snack-run");
  await expect(theirs).toContainText("Maya is going to", { timeout: 15_000 });
  await theirs.getByPlaceholder("What do you want?").fill("Two hot dogs");
  await theirs.getByRole("button", { name: "Ask" }).click();
  await expect(theirs.getByTestId("snack-items")).toContainText(
    "You: Two hot dogs",
  );
  await expect(maya.page.getByTestId("snack-items")).toContainText(
    "Sam: Two hot dogs",
    { timeout: 15_000 },
  );
  await shot(maya.page, "08-snack-run-with-request-320", true);
  // There is nowhere to pay.
  await expect(maya.page.locator("main")).not.toContainText(
    /\$|pay now|checkout|card number/i,
  );
  await maya.page.reload();
  await tab(maya.page, "Snack run").click();
  await expect(maya.page.getByTestId("snack-items")).toContainText(
    "Sam: Two hot dogs",
  );
  // Only the person going can close it; then nobody can add to it.
  const sneaky = await sam.page.request.post(api, {
    data: {
      type: "runClose",
      run: (await read(sam.page)).crew.runs[0].id,
      outcome: "done",
    },
  });
  expect(sneaky.status()).toBe(403);
  await maya.page.getByRole("button", { name: /Done — I'm back/ }).click();
  await expect(maya.page.getByTestId("snack-run")).toHaveCount(0);
  const late = await sam.page.request.post(api, {
    data: {
      type: "runRequest",
      run: (await read(sam.page)).crew.runs[0].id,
      item: "Late nachos",
    },
  });
  expect(late.status(), "can't order from a finished run").toBe(409);

  // ------------------------- 320 px and motion on every tab, Existing map intact
  await maya.page
    .getByRole("button", { name: "📍 I'm here", exact: true })
    .click();
  await dialog(maya.page, "Where are you?")
    .getByRole("button", { name: /Outside the arena/ })
    .click();
  for (const t of [
    "Find friends",
    "Squad",
    "Snack run",
    "Eat & drink",
    "Quests",
    "The arena",
  ]) {
    await tab(maya.page, t).click();
    if (t === "Eat & drink")
      await maya.page.getByRole("button", { name: "🍺 Drinks" }).click();
    await fitsThePhone(maya.page, 320);
  }
  await tab(maya.page, "Find friends").click();
  await expect(maya.page.locator("svg[data-level]")).toBeVisible();
  await fitsThePhone(sam.page, 375);
  await fitsThePhone(host.page, 390);

  // -------------------------------------- the night ends: everything expires
  await moveStart(nightId, new Date(Date.now() - 7 * 3_600_000));
  await maya.page.reload();
  await expect(maya.page.getByText(/The night.s over/)).toBeVisible();
  const over = await host.page.request.get(api);
  const gone = await over.json();
  expect(gone.checkins).toEqual([]);
  expect(gone.crew.gps).toEqual([]);
  expect(gone.crew.summons).toEqual([]);
  expect(gone.crew.runs).toEqual([]);
  await moveStart(nightId, new Date(Date.now() + 60 * 60_000));

  // ----------------------------------------------- Plan and Play untouched
  await host.page.goto(`/hockey/${nightId}`);
  for (const t of ["Plan", "Play", "Chat", "Group"]) {
    await expect(
      host.page
        .getByRole("tablist", { name: "Hockey Night" })
        .getByRole("tab", { name: new RegExp(`^${t}`) }),
    ).toBeVisible();
  }
  await expect(
    host.page.getByRole("region", { name: "Game time", exact: true }),
  ).toBeVisible();

  for (const p of [host, maya, sam]) await p.context.close();
});

const NO_MONEY = "Passport doesn't handle money.";
