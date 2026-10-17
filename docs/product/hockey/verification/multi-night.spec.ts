import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **More than one night — and the nights do not leak into each other.**
 *
 * M216 built one night. This proves the run of them, with real accounts on
 * the local stack, under RLS:
 *
 *   Lorne hosts two nights (Kraken, Oilers) with different guest lists:
 *   Maya on one, Sam on the other → neither guest can see, answer in, or
 *   chat in the night they are not on, and neither appears on the other's
 *   shelf → a pick, a comment and a called result stay on their own night →
 *   the Kraken night ends → **Maya, a guest, runs it back** and hosts No. 2 →
 *   No. 2 opens carrying last time (Maya defending, points not carried) →
 *   she re-invites Lorne from "last time's crew" → Lorne's shelf shows the
 *   Sycle Cup → Sam, who was at neither, still sees nothing.
 *
 * Desktop for Lorne, a phone for Maya, and 320px for the page Maya hosts.
 *
 * Run (the env is the stack's, see README.md):
 *   set -a; . "$STACK/env"; set +a
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification multi-night
 */

const PASSWORD = "puck-drops-at-seven";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-multi-${stamp}@example.test`;

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function person(browser: Browser, mobile = false) {
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : {},
  );
  return { context, page: await context.newPage() };
}

/** `YYYY-MM-DD`, `days` from now. Good enough for a date input. */
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function token(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).access_token as string;
}

/** The host moving the start, the way a host can: their session, under RLS. */
async function moveStart(who: string, nightId: string, startsAt: string) {
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${await token(who)}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({ starts_at: startsAt }),
    },
  );
  return (await res.json()) as unknown[];
}

async function startNight(
  page: Page,
  opponent: string,
  date: string,
  button: string,
) {
  await page.getByLabel("Opponent").fill(opponent);
  await page.getByLabel("Game date").fill(date);
  await page.getByLabel("Puck drop time").fill("19:00");
  await page.getByRole("button", { name: button }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

async function invite(page: Page, label: string): Promise<string> {
  await page.getByLabel("Who the invitation is for").fill(label);
  await page.getByRole("button", { name: "Make a link" }).click();
  return new URL((await page.getByTestId("invite-url").textContent())!.trim())
    .pathname;
}

async function joinSignedOut(page: Page, path: string, who: string) {
  await page.goto(path);
  await page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(page, who);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.getByLabel("Your name").fill(who[0].toUpperCase() + who.slice(1));
  await page.getByRole("button", { name: "I'm in" }).click();
}

/** With SHOTS=<dir>, keep a full-page picture of the moment, for a human. */
async function shot(page: Page, name: string) {
  if (process.env.SHOTS)
    await page.screenshot({
      path: `${process.env.SHOTS}/${name}.png`,
      fullPage: true,
    });
}

async function noSidewaysScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(client);
}

test.describe.configure({ mode: "serial" });
test.skip(
  !!process.env.CONFIRM_EMAIL,
  "this run signs up instantly; it needs an auto-confirming stack",
);

test("two nights, two guest lists, nothing crosses — then a guest runs it back", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  // --------------------------------------------- Lorne hosts two nights
  const lorne = await person(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await expect(lorne.page.getByText(/Nothing on yet/)).toBeVisible();
  await lorne.page.getByLabel("Your name").fill("Lorne");
  const kraken = await startNight(lorne.page, "kraken", inDays(23), "Start it");
  await lorne.page.getByRole("button", { name: /Skip/ }).click();
  await expect(lorne.page.getByText("Canucks vs Kraken")).toBeVisible();
  await expect(
    lorne.page.getByRole("navigation", { name: "The night" }),
  ).toContainText("Before the game");
  await shot(lorne.page, "1-kraken-before-desktop");
  const forMaya = await invite(lorne.page, "Maya");

  await lorne.page.goto("/hockey");
  await lorne.page.getByRole("button", { name: "Start another night" }).click();
  // The form refuses what it should before it accepts anything.
  await lorne.page.getByLabel("Opponent").fill("Canucks");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(
    lorne.page.getByText("The Canucks can't play themselves."),
  ).toBeVisible();
  const oilers = await startNight(lorne.page, "Oilers", inDays(37), "Start it");
  expect(oilers).not.toBe(kraken);
  await lorne.page.getByRole("button", { name: /Skip/ }).click();
  await expect(lorne.page.getByText("Canucks vs Oilers")).toBeVisible();
  const forSam = await invite(lorne.page, "Sam");

  // ------------------------------------- Maya joins one, Sam the other
  const maya = await person(browser, true);
  await joinSignedOut(maya.page, forMaya, "maya");
  await expect(maya.page).toHaveURL(new RegExp(`/hockey/${kraken}$`));
  const sam = await person(browser);
  await joinSignedOut(sam.page, forSam, "sam");
  await expect(sam.page).toHaveURL(new RegExp(`/hockey/${oilers}$`));

  // A used link does not open the other night, or this one, for anybody else.
  const samOnMayasLink = await sam.page.request.post("/hockey/api/join", {
    data: { token: forMaya.split("/").pop(), name: "Sam" },
  });
  expect(samOnMayasLink.ok()).toBe(false);

  // ---------------------------------- the nights do not know each other
  const get = (p: Page, id: string) =>
    p.request.get(`/hockey/api/occasions/${id}`);
  expect((await get(maya.page, oilers)).status()).toBe(404);
  expect((await get(sam.page, kraken)).status()).toBe(404);
  expect((await maya.page.request.get(`/hockey/${oilers}`)).status()).toBe(404);
  expect((await get(maya.page, kraken)).status()).toBe(200);

  await maya.page.goto("/hockey");
  await expect(maya.page.getByText("vs Kraken")).toBeVisible();
  await expect(maya.page.getByText("vs Oilers")).toHaveCount(0);
  await sam.page.goto("/hockey");
  await expect(sam.page.getByText("vs Oilers")).toBeVisible();
  await expect(sam.page.getByText("vs Kraken")).toHaveCount(0);
  await lorne.page.goto("/hockey");
  const comingUp = lorne.page.getByRole("region", { name: "Coming up" });
  await expect(comingUp.getByText("vs Kraken")).toBeVisible();
  await expect(comingUp.getByText("vs Oilers")).toBeVisible();

  // ------------------------- picks, chat and invitations stay put
  const act = (p: Page, id: string, data: object) =>
    p.request.post(`/hockey/api/occasions/${id}/actions`, { data });
  expect(
    (
      await act(maya.page, kraken, {
        type: "respond",
        promptId: "final-score",
        value: [4, 2],
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await act(maya.page, kraken, {
        type: "say",
        text: "Kraken night only, this.",
      })
    ).ok(),
  ).toBe(true);
  // Maya cannot answer or talk on a night she is not on.
  for (const data of [
    { type: "respond", promptId: "final-score", value: [9, 0] },
    { type: "say", text: "let me in" },
  ]) {
    expect((await act(maya.page, oilers, data)).status()).toBe(404);
  }
  const oilersAsLorne = await (await get(lorne.page, oilers)).json();
  expect(
    (oilersAsLorne.state.responses as { participantId: string }[]).length,
  ).toBe(0);
  expect(JSON.stringify(oilersAsLorne)).not.toContain("Kraken night only");
  expect(JSON.stringify(oilersAsLorne)).not.toContain("Maya");
  const oilersInvites = await (
    await lorne.page.request.get(`/hockey/api/occasions/${oilers}/invites`)
  ).json();
  expect((oilersInvites as { label: string }[]).map((i) => i.label)).toEqual([
    "Sam",
  ]);

  // ------------------------- the Kraken night happens; its result is its own
  const yesterday = new Date(Date.now() - 20 * 3600_000).toISOString();
  expect(await moveStart("maya", kraken, yesterday)).toHaveLength(0);
  expect(await moveStart("lorne", kraken, yesterday)).toHaveLength(1);
  expect(
    (
      await act(lorne.page, kraken, {
        type: "callIt",
        promptId: "final-score",
        value: [4, 2],
      })
    ).ok(),
  ).toBe(true);
  // Lorne cannot call the Kraken score into the Oilers night by accident:
  // the Oilers picks have not even locked.
  const oilersAfter = await (await get(lorne.page, oilers)).json();
  const finalScore = (
    oilersAfter.definition.prompts as { id: string; resolution?: unknown }[]
  ).find((p) => p.id === "final-score");
  expect(finalScore?.resolution).toBeUndefined();

  // ------------------------- the morning after: Maya, a guest, runs it back
  await maya.page.goto(`/hockey/${kraken}`);
  await expect(
    maya.page.getByRole("navigation", { name: "The night" }),
  ).toContainText("The morning after");
  await shot(maya.page, "2-kraken-morning-after-phone");
  const runItBack = maya.page.getByRole("region", { name: "Run it back" });
  await expect(runItBack.getByText("Run it back?")).toBeVisible();
  await runItBack.getByRole("button", { name: "Start the next one" }).click();
  await maya.page.setViewportSize({ width: 320, height: 700 });
  await noSidewaysScroll(maya.page);
  await maya.page.setViewportSize({ width: 390, height: 844 });
  await runItBack.getByLabel("Opponent").fill("Flames");
  await runItBack.getByRole("button", { name: "Start No. 2" }).click();
  await expect(maya.page).not.toHaveURL(new RegExp(`/hockey/${kraken}$`), {
    timeout: 15_000,
  });
  await expect(maya.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const flames = maya.page.url().split("/").pop()!;
  expect([kraken, oilers]).not.toContain(flames);

  // She hosts it, so she gets the curator's four taps.
  await maya.page.getByRole("button", { name: /Skip/ }).click();
  await expect(maya.page.getByText("Rogers Arena · No. 2")).toBeVisible();
  const lastTime = maya.page.getByRole("region", { name: "Last time" });
  await expect(lastTime).toContainText("No. 1 · Canucks vs Kraken");
  await expect(lastTime).toContainText(/Maya is defending the Sycle Cup/);
  await expect(lastTime).toContainText(/Points were not/);

  // Last time's crew, one tap from a labelled link.
  const guestList = maya.page.getByRole("region", { name: "Guest list" });
  await guestList.getByRole("button", { name: /Lorne/ }).click();
  await expect(guestList.getByLabel("Who the invitation is for")).toHaveValue(
    "Lorne",
  );
  await guestList.getByRole("button", { name: "Make a link" }).click();
  const forLorne = new URL(
    (await guestList.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;

  // Phone widths on the page she hosts.
  await shot(maya.page, "3-no2-host-phone");
  await noSidewaysScroll(maya.page);
  await maya.page.setViewportSize({ width: 320, height: 700 });
  await noSidewaysScroll(maya.page);

  // ------------------------- Lorne comes back for No. 2
  await lorne.page.goto(forLorne);
  await lorne.page.getByRole("button", { name: "I'm in" }).click();
  await expect(lorne.page).toHaveURL(new RegExp(`/hockey/${flames}$`));
  await expect(
    lorne.page.getByRole("region", { name: "Last time" }),
  ).toContainText(/Maya is defending the Sycle Cup/);
  // Lorne is a guest on this one: no guest list for him.
  await expect(
    lorne.page.getByRole("region", { name: "Guest list" }),
  ).toHaveCount(0);

  // The shelf: three nights, one Cup, held by Maya.
  await lorne.page.goto("/hockey");
  await expect(
    lorne.page.getByRole("region", { name: "Coming up" }).getByText(/vs /),
  ).toHaveCount(2);
  const cup = lorne.page.getByRole("region", { name: "The Sycle Cup" });
  await expect(cup).toContainText(/Maya holds it/);
  await expect(cup).toContainText(/No\. 1 · Canucks vs Kraken/);
  await expect(cup).toContainText(/No\. 2 · Canucks vs Flames/);
  await expect(cup).toContainText("Still to play");
  await shot(lorne.page, "4-shelf-desktop");
  await expect(
    lorne.page.getByRole("region", { name: "Already happened" }),
  ).toContainText("vs Kraken");

  // ------------------------- Sam was at neither: nothing, anywhere
  expect((await get(sam.page, flames)).status()).toBe(404);
  await sam.page.goto("/hockey");
  await expect(sam.page.getByText(/Sycle Cup/)).toHaveCount(0);
  await expect(sam.page.getByText(/Flames|Kraken/)).toHaveCount(0);
  // Nor can he run a night he was never at back into his own.
  const samRunsIt = await sam.page.request.post("/hockey/api/occasions", {
    data: {
      name: "Sam",
      game: {
        opponent: "Jets",
        startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
      after: kraken,
    },
  });
  expect(samRunsIt.status()).toBe(404);

  await Promise.all([
    lorne.context.close(),
    maya.context.close(),
    sam.context.close(),
  ]);
});
