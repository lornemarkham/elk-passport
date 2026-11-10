import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";

/**
 * **After you choose: PLAN → EXPERIENCE → REMEMBER → SHARE**
 * (owner brief "GO HAVE A DAY — AFTER YOU CHOOSE", Lodge mission 694).
 *
 *   Alice chooses a day (today, Kelowna) and Passport builds it. She edits
 *   it — in words, then by hand. She shares it: Bob joins by a link on a
 *   second device and sees a LATER change she makes. She starts the day and
 *   keeps a note, a photo and a favourite. Then she signs in on another
 *   device and they are there — private: not on Bob's recap, not in the
 *   group's shared moments, not readable by Bob through the API.
 *
 * Run on a 390px phone and on a desktop. Real GoTrue accounts; every
 * permission is Postgres's (stack.mjs); Atlas is `atlas-standin.mjs`.
 *
 *   E2E_PORT=3124 npx playwright test -c docs/product/group-adventures/verification after-you-choose
 */

const PASSWORD = "a-whole-weekend-9";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-after-${stamp}@example.test`;

async function signUp(page: Page, who: string, next: string) {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function signIn(page: Page, who: string, next: string) {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function person(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  return { context, page: await context.newPage() };
}

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Vancouver",
});

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const titlesOf = async (page: Page) =>
  (
    await page
      .getByTestId("plan-day-section")
      .first()
      .getByTestId("plan-item")
      .locator("h4")
      .allTextContents()
  ).map((t) => t.trim());

/** No sideways scroll: the page fits the phone. */
const fits = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test.setTimeout(420_000);

for (const [label, device] of [
  [
    "phone 390px",
    {
      ...devices["Pixel 7"],
      viewport: { width: 390, height: 844 },
    },
  ],
  ["desktop", devices["Desktop Chrome"]],
] as const) {
  test(`choose → build → edit → share → revisit → remember (${label})`, async ({
    browser,
  }) => {
    const shots = process.env.SHOTS ?? "/tmp";
    const tag = label.startsWith("phone") ? "phone" : "desktop";

    // ---------------------------------------------------- choose a day
    const alice = await person(browser, { ...device });
    await signUp(alice.page, `alice-${tag}`, "/adventures/new");
    const a = alice.page;
    await a.getByTestId("create-town").selectOption("kelowna");
    await a.getByRole("button", { name: "Pick dates", exact: true }).click();
    await a.getByLabel("From", { exact: true }).fill(today);
    await a.getByLabel("To", { exact: true }).fill(today);
    await a.getByRole("button", { name: "Outdoors", exact: true }).click();
    await a.getByTestId("create-title").fill(`After you choose ${tag}`);
    await a.getByTestId("create-submit").click();
    await expect(a).toHaveURL(/\/adventures\/[0-9a-f]{32}/, {
      timeout: 90_000,
    });
    const adventureUrl = a.url().split("?")[0]!;
    const adventureId = adventureUrl.split("/").pop()!;

    // ------------------------------------------------------------ build
    // Ordered stops, with the way between them, on the day chosen.
    const built = await titlesOf(a);
    expect(built.length).toBeGreaterThan(1);
    const day = a.getByTestId("plan-day-section").first();
    await expect(day.getByTestId("plan-leg").first()).toContainText(
      /straight line|by road|can't place/,
      { timeout: 20_000 },
    );
    await a.screenshot({
      path: `${shots}/after-${tag}-1-built.png`,
      fullPage: true,
    });

    // ------------------------------------------------------------- edit
    // In words, previewed before anything is written...
    await a.getByTestId("change-input").fill("Add somewhere for dessert");
    await a.getByTestId("change-submit").click();
    await expect(a.getByTestId("change-preview")).toBeVisible({
      timeout: 60_000,
    });
    expect(await titlesOf(a)).toEqual(built);

    // ...and by hand: the first stop later.
    await day.getByLabel(`More for ${built[0]}`).click();
    await day.getByRole("button", { name: `Move ${built[0]} later` }).click();
    await expect(day.getByTestId("plan-item").nth(1)).toContainText(built[0]!);
    const edited = await titlesOf(a);
    expect(edited[0]).toBe(built[1]);

    // ------------------------------------------------------------ share
    await a.getByRole("button", { name: "Link for one person" }).click();
    const invite = (
      await a.getByTestId("invite-url").first().textContent()
    )?.trim();
    expect(invite).toMatch(/\/adventures\/join\//);

    const bob = await person(browser, { ...device });
    const b = bob.page;
    await b.goto(new URL(invite!).pathname);
    await b.getByRole("link", { name: "Sign in to join" }).click();
    await b.getByRole("tab", { name: "Sign Up" }).click();
    await b.getByLabel("Email address").fill(emailFor(`bob-${tag}`));
    await b.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await b.getByRole("button", { name: "Create account" }).click();
    await b.getByRole("button", { name: /join/ }).click();
    await expect(
      b.getByRole("heading", { name: `After you choose ${tag}` }),
    ).toBeVisible();
    expect(await titlesOf(b)).toEqual(edited);

    // A LATER change: Alice moves the new first stop later still. Bob sees it
    // on his next look, without being told anything.
    await day.getByLabel(`More for ${edited[0]}`).click();
    await day.getByRole("button", { name: `Move ${edited[0]} later` }).click();
    await expect(day.getByTestId("plan-item").nth(1)).toContainText(edited[0]!);
    const later = await titlesOf(a);
    expect(later).not.toEqual(edited);
    await b.reload();
    await expect(async () => expect(await titlesOf(b)).toEqual(later)).toPass({
      timeout: 15_000,
    });
    await b.screenshot({
      path: `${shots}/after-${tag}-2-bob.png`,
      fullPage: true,
    });

    // ------------------------------------------------------- experience
    // Today is the day: start it, and keep a favourite, a note and a photo.
    await a.goto(adventureUrl);
    await a.getByTestId("start-day").click();
    await a.getByTestId("capture-favourite").click();
    await a.getByTestId("capture-note").click();
    await a.getByTestId("capture-note-text").fill("Best view of the whole day");
    await a.getByTestId("capture-note-save").click();
    await a.getByTestId("capture-photo-input").setInputFiles({
      name: "p.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    });
    await a.screenshot({
      path: `${shots}/after-${tag}-3-started.png`,
      fullPage: true,
    });

    // The account has them (kept as it went, not at the end).
    await expect(async () => {
      const kept = await (
        await a.request.get(`/api/adventures/${adventureId}/memories`)
      ).json();
      expect(kept.memories.map((m: { kind: string }) => m.kind).sort()).toEqual(
        ["favourite", "note", "photo"],
      );
    }).toPass({ timeout: 15_000 });

    // ----------------------------------------------------------- revisit
    // Another device, a fresh sign-in: the day is there and so are the
    // memories, which this device never saw.
    const second = await person(browser, { ...device });
    const s = second.page;
    await signIn(s, `alice-${tag}`, `/adventures/${adventureId}/recap`);
    await expect(s.getByText("Best view of the whole day")).toBeVisible({
      timeout: 20_000,
    });
    await expect(s.getByTestId("recap-line")).toContainText("1 photo");
    await expect(s.getByTestId("recap-favourites")).toContainText(later[0]!);
    expect(await fits(s)).toBe(true);
    await s.screenshot({
      path: `${shots}/after-${tag}-4-recap-other-device.png`,
      fullPage: true,
    });
    await s.goto(adventureUrl);
    expect(await titlesOf(s)).toEqual(later);

    // --------------------------------------------------- private by default
    await b.goto(`/adventures/${adventureId}/recap`);
    await expect(b.getByText("Best view of the whole day")).toHaveCount(0);
    const theirs = await (
      await b.request.get(`/api/adventures/${adventureId}/memories`)
    ).json();
    expect(theirs.memories).toEqual([]);
    // Nothing was shared with the group unless Alice presses the button.
    await s.goto(`/adventures/${adventureId}/recap`);
    await expect(s.getByTestId("recap-shared")).toContainText(
      "Nothing shared yet",
    );

    // ------------------------------------------------------ and share one
    const share = s.getByRole("button", { name: /Share with the group/ });
    await share.first().click();
    await b.reload();
    await expect(b.getByTestId("recap-shared")).toBeVisible();

    for (const p of [alice, bob, second]) await p.context.close();
  });
}
