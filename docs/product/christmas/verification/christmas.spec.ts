import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Go Have a Christmas — a real family, end to end, on a phone.**
 *
 *   1  Discover   signed out: the season, a town, a theme, real finds with
 *                 their evidence; Save asks to sign in; picks go to a tray.
 *   2  Plan       Alice signs up from the tray, plans a holiday weekend: a
 *                 one-day market lands on its day, a later one waits as an
 *                 idea, the days are sketched from real places.
 *   3  Share      Alice announces a change and makes an invite link.
 *   4  Together   Bob joins on his phone, says Got it, votes, finishes two
 *                 challenges (one with a photo) and shares a tradition.
 *   5  Remember   Alice sees who has it, Bob's photo and the recap, and
 *                 goes to plan another.
 *   6  Outside    Charlie, not invited, sees nothing and can post nothing;
 *                 Bob cannot announce.
 *   +  Reduced motion: no snow. 320 px: nothing overflows.
 *
 * Real GoTrue accounts and Postgres RLS (stack.mjs, with
 * the together migration (supabase/migrations/20261101000000_passport_adventure_together.sql) applied). Atlas is the stand-in serving Atlas's
 * real corpus of 2026-10-24 (atlas-candidates-2026-10-24.json.gz).
 *
 *   E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification christmas.spec
 */

const here = __dirname;
const SHOTS = path.resolve(here, "../screenshots");
const PHOTO = path.resolve(here, "test-lights.jpg");
const PASSWORD = "jingle-all-the-way-9";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-xmas-${stamp}@example.test`;

const CANYON = "cbabfb38-71fc-4043-af55-a8e16456caed";
const DELTA = "e3f342f5-202a-439e-8605-a3233b35413b"; // Sun Nov 22 only
const FESTIVE = "84362a59-62fd-4286-aef2-c4760052a665"; // from Nov 25

async function shot(page: Page, name: string, fullPage = false) {
  if (process.env.SHOTS !== "1") return;
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function person(
  browser: Browser,
  reducedMotion: "reduce" | "no-preference" = "reduce",
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion,
  });
  return { context, page: await context.newPage() };
}

test("a family discovers, plans, shares, lives and remembers a Christmas", async ({
  browser,
}) => {
  // ------------------------------------------------------- 1 discover
  const alice = await person(browser, "no-preference");
  const a = alice.page;
  await a.goto("/christmas");
  await expect(a.getByTestId("countdown")).toContainText(/sleep|Christmas/);
  await expect(a.getByTestId("lead-find")).toBeVisible();
  // Snow falls for someone who hasn't asked for less motion…
  await expect(a.getByText("❄").first()).toBeAttached();
  await shot(a, "01-home");
  await a.getByRole("link", { name: "North Vancouver" }).click();
  await expect(a).toHaveURL(/at=north-vancouver/);
  await a.getByTestId("theme-lights").click();
  await expect(a).toHaveURL(/theme=lights/);
  const canyon = a.locator(`[data-find="${CANYON}"]`);
  await expect(canyon).toContainText("Canyon Lights");
  await expect(canyon).toContainText("Dates from Atlas");
  await expect(canyon).toContainText(/km away/);
  await expect(canyon).toContainText("It's in the name");
  await shot(a, "02-discover-lights");

  // Save, signed out: Passport asks once, and stays put.
  await canyon.getByTestId("save-find").click();
  await expect(a.getByText("Sign in to keep this")).toBeVisible();

  await canyon.getByTestId("pick-find").click();
  await expect(a.getByTestId("pick-tray")).toContainText("1 picked");

  // Markets too: one Atlas dates to a single Sunday, one that starts later.
  const onlyTheme = async (from: string, to: string) => {
    await a.getByTestId(`chip-${from}`).click();
    await expect(a).not.toHaveURL(/theme=/);
    await a.getByTestId(`chip-${to}`).click();
    await expect(a).toHaveURL(new RegExp(`theme=${to}$|theme=${to}&`));
  };
  await onlyTheme("lights", "markets");
  await a.locator(`[data-find="${DELTA}"]`).getByTestId("pick-find").click();
  await onlyTheme("markets", "festivals");
  await a.locator(`[data-find="${FESTIVE}"]`).getByTestId("pick-find").click();
  await expect(a.getByTestId("pick-tray")).toContainText("3 picked");
  await shot(a, "03-discover-tray");

  // Refine works without the theme chips: dates, ages, free only.
  await a.getByTestId("refine").locator("summary").click();
  await a.locator('input[name="ages"]').fill("6");
  await a.getByTestId("refine-submit").click();
  await expect(a.getByTestId("result-count")).toContainText(
    "checked for a 6-year-old",
  );

  // ------------------------------------------------------------ 2 plan
  await a.getByTestId("plan-picks").click();
  await expect(a).toHaveURL(/\/christmas\/plan\?.*with=/);
  await a.getByTestId("plan-sign-in").click();
  await signUp(a, "alice");
  await expect(a).toHaveURL(/\/christmas\/plan/);
  const picks = a.getByTestId("plan-picks-list");
  await expect(picks).toContainText("Canyon Lights");
  await expect(picks).toContainText("Delta Grand Holiday Market 2026");
  await a.getByTestId("plan-shape-weekend").click();
  await a.getByTestId("plan-town").selectOption("north-vancouver");
  await a.getByTestId("plan-date").fill("2026-11-21");
  await expect(picks).toContainText("Goes on Sunday, Nov 22");
  await expect(picks).toContainText("Atlas dates this outside your days");
  await a.getByRole("button", { name: "Family with kids" }).click();
  await a.getByTestId("plan-ages").fill("6");
  await a.getByTestId("plan-title").fill("Our first Christmas weekend");
  await shot(a, "04-planner", true);
  await a.getByTestId("plan-start").click();
  await a.waitForURL(/\/christmas\/adventure\//, { timeout: 90_000 });
  const adventureUrl = a.url();
  const adventurePath = new URL(adventureUrl).pathname;
  const id = adventurePath.split("/").at(-1)!;
  await expect(
    a.getByRole("heading", { name: "Our first Christmas weekend" }),
  ).toBeVisible();
  await expect(a.getByTestId("started-note")).toContainText(
    "One thing you chose is dated by Atlas outside these days",
  );
  const days = a.getByTestId("plan-day-section");
  await expect(days).toHaveCount(2);
  await expect(days.nth(1)).toContainText("Delta Grand Holiday Market 2026");
  await expect(a.locator("#plan")).toContainText("Canyon Lights");
  await shot(a, "05-adventure-owner");

  // ----------------------------------------------------------- 3 share
  await a.getByTestId("announce").click();
  await a.getByRole("button", { name: /New time/ }).click();
  await a
    .getByTestId("notice-headline")
    .fill("Canyon Lights is packed at 6 — we're going at 8 instead");
  await a.getByLabel("Where to go").selectOption({ label: "Canyon Lights" });
  await a.getByTestId("notice-send").click();
  await expect(a.getByTestId("notice")).toContainText("TIME CHANGE");
  await expect(a.getByTestId("notice-seen")).toContainText(
    "Nobody's said Got it yet",
  );
  await shot(a, "06-announcement-owner");
  await a.getByRole("button", { name: "Link for one person" }).click();
  const invite = (
    await a.getByTestId("invite-url").first().textContent()
  )?.trim();
  expect(invite).toMatch(/\/adventures\/join\//);

  // -------------------------------------------------------- 4 together
  const bob = await person(browser);
  const b = bob.page;
  await b.goto(new URL(invite!).pathname);
  await b.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(b, "bob");
  await b.getByRole("button", { name: /join/ }).click();
  await b.waitForURL(/\/christmas\/adventure\//);
  await expect(
    b.getByRole("heading", { name: "Our first Christmas weekend" }),
  ).toBeVisible();
  // No snow for someone who asked their phone for less motion.
  await expect(b.getByText("❄")).toHaveCount(0);
  const notice = b.getByTestId("notice");
  await expect(notice).toContainText("we're going at 8 instead");
  await expect(
    notice.getByRole("link", { name: /View Canyon Lights/ }),
  ).toBeVisible();
  await shot(b, "07-announcement-guest");
  await b.getByTestId("notice-ack").click();
  await expect(b.getByTestId("notice")).toHaveCount(0);

  // Vote, with the core's own answer buttons.
  const firstStop = b.getByTestId("plan-item").first();
  await firstStop.getByRole("button", { name: "I'm in" }).click();
  await expect(firstStop).toContainText("1 in");

  // A challenge in words…
  await b.getByTestId("challenge-carol").getByTestId("do-challenge").click();
  await b.getByTestId("moment-text").fill("Jingle Bells in the car, all of it");
  await b.getByTestId("moment-send").click();
  await expect(b.getByTestId("challenge-carol")).toContainText("Done by");
  await expect(b.getByTestId("tally")).toContainText("1");
  // …one that needs a photo, which words alone don't finish…
  await b
    .getByTestId("challenge-best-lights")
    .getByTestId("do-challenge")
    .click();
  await expect(b.getByTestId("moment-send")).toBeDisabled();
  await b.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(b.getByAltText("Your photo")).toBeVisible();
  await b.getByTestId("moment-send").click();
  await expect(b.getByTestId("challenge-best-lights")).toContainText("Done by");
  // …and a tradition.
  await b.getByTestId("share-tradition").click();
  await b
    .getByTestId("moment-text")
    .fill("Hot chocolate on the walk home, every year");
  await b.getByTestId("moment-send").click();
  await expect(b.getByTestId("memories")).toContainText("Our traditions");
  await shot(b, "08-challenges-guest");

  // A participant may not announce: Postgres refuses, not the button.
  const refused = await b.request.post(`/christmas/api/${id}/notices`, {
    data: { kind: "note", headline: "I'm in charge now" },
  });
  expect(refused.status()).toBe(404);

  // -------------------------------------------------------- 5 remember
  await a.reload();
  await expect(a.getByTestId("notice-seen")).toContainText(
    `Got it: bob-xmas-${stamp}`,
  );
  await expect(a.getByTestId("recap-line")).toContainText(
    "1 photo · 2 challenges done · 1 tradition",
  );
  const photo = a.getByTestId("memory-wall").locator("img").first();
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await a.locator("#memories").scrollIntoViewIfNeeded();
  await shot(a, "09-memories-owner");
  await a.getByTestId("notice-end").click();
  await expect(a.getByTestId("notice")).toHaveCount(0);

  // The core's printable guide still works for a Christmas adventure.
  await a.getByTestId("open-guide").click();
  await expect(a).toHaveURL(new RegExp(`/adventures/${id}/guide`));
  await expect(
    a.getByText("Our first Christmas weekend").first(),
  ).toBeVisible();
  await a.goBack();

  // Saved and the generic adventure page lead back to the Christmas page.
  await a.goto(`/adventures/${id}`);
  await expect(a).toHaveURL(new RegExp(`/christmas/adventure/${id}`));

  // Go have another.
  await a.getByTestId("go-again").click();
  await expect(a).toHaveURL(/\/christmas\/plan\?.*with=.*name=/);
  await expect(a.getByTestId("plan-picks-list")).toContainText("Canyon Lights");
  await shot(a, "10-go-again");

  // --------------------------------------------------------- 6 outside
  const charlie = await person(browser);
  const c = charlie.page;
  await c.goto(`/auth?next=${encodeURIComponent("/christmas")}`);
  await signUp(c, "charlie");
  await c.goto(adventurePath);
  await expect(c.getByText("Not found")).toBeVisible();
  await expect(c.getByText("Our first Christmas weekend")).toHaveCount(0);
  const peek = await c.request.get(`/christmas/api/${id}/moments`);
  expect(peek.ok() ? await peek.json() : []).toEqual([]);
  const post = await c.request.post(`/christmas/api/${id}/moments`, {
    data: { kind: "moment", text: "I wasn't invited" },
  });
  expect(post.status()).toBe(404);
  const photoPeek = await c.request.get(
    `/christmas/api/${id}/moments/00000000-0000-0000-0000-000000000000/photo`,
  );
  expect(photoPeek.status()).toBe(404);

  await Promise.all([
    alice.context.close(),
    bob.context.close(),
    charlie.context.close(),
  ]);
});

test("nothing overflows at 320 px, and every tap target is a thumb's width", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 640 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  for (const url of [
    "/christmas",
    "/christmas/discover?at=vancouver",
    "/christmas/plan",
  ]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(1);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main a, main button, main summary")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 40;
        })
        .map((el) =>
          (el.textContent ?? el.getAttribute("aria-label") ?? "")
            .trim()
            .slice(0, 40),
        ),
    );
    expect(small, `${url}: tap targets under 40px`).toEqual([]);
  }
  await context.close();
});
