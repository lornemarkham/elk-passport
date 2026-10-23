import { expect, test, type Browser, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Declare your team + the Chirp Room — real accounts, real RLS.**
 *
 * The host and a guest on phones, a stranger, and the database attacked
 * directly through PostgREST with each person's own session. No model is
 * configured on the stack (no OPENAI_API_KEY), so every Chirp Bot line here
 * comes from its curated library — which is the path production takes
 * whenever the model is unavailable.
 *
 * Run (the env is the stack's, with chirp-migration.sql applied; see README.md):
 *   set -a; . "$STACK/env"; set +a
 *   ATLAS_API_URL=http://127.0.0.1:54340 next start -p 3130
 *   CHIRP_SHOTS=<dir> E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification chirp
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-chirp-${stamp}@example.test`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function signIn(page: Page, who: string) {
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

async function person(browser: Browser, viewport = PHONE.viewport) {
  const context = await browser.newContext({ ...PHONE, viewport });
  return { context, page: await context.newPage() };
}

async function token(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: TEST_PASSWORD }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).access_token as string;
}

/** PostgREST as `who`, with their own session — what devtools would let them do. */
async function rest(
  who: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${await token(who)}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

interface Snapshot {
  state: { meId: string; moments: { text?: string; by?: string }[] };
  chirp: {
    available: boolean;
    on: boolean;
    fans: Record<string, string>;
    lines: { kind: string; text: string; tone: string; fact?: unknown }[];
  };
}

async function snapshot(page: Page, night: string): Promise<Snapshot> {
  const res = await page.request.get(`/hockey/api/occasions/${night}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as Snapshot;
}

async function shot(page: Page, name: string) {
  if (process.env.CHIRP_SHOTS)
    await page.screenshot({
      path: `${process.env.CHIRP_SHOTS}/${name}.png`,
      fullPage: false,
    });
}

async function noSidewaysScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(client);
}

const bot = (page: Page, kind?: string) =>
  page.locator(kind ? `[data-chirp-bot="${kind}"]` : "[data-chirp-bot]");

test.describe.configure({ mode: "serial" });

test("declare your team, the Chirp Room, chirp someone — and the doors that stay shut", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  // ------------------------------------------------ the host starts a night
  const lorne = await person(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await lorne.page.getByLabel("Game date").fill(in2);
  await lorne.page.getByLabel("Puck drop time").fill("19:00");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const night = lorne.page.url().split("/").pop()!;
  await lorne.page.getByRole("button", { name: /Skip/ }).click();

  // ------------------------------------------- WHO DO YOU BLEED FOR? (host)
  // On Plan it is a slim bar above the tabs — dinner keeps the top of the
  // page — and in Chat a card.
  const ask = lorne.page.getByRole("complementary", {
    name: "Who do you bleed for?",
  });
  await expect(ask).toBeVisible();
  await openTab(lorne.page, "Chat");
  await expect(ask).toBeHidden();
  await expect(
    lorne.page.getByRole("region", { name: "WHO DO YOU BLEED FOR?" }),
  ).toBeVisible();
  await openTab(lorne.page, "Plan");
  await shot(lorne.page, "01-bleed-prompt");
  await ask.getByRole("button", { name: "Pick my team" }).click();
  const picker = lorne.page.getByRole("dialog", {
    name: "WHO DO YOU BLEED FOR?",
  });
  await expect(picker.getByRole("radio")).toHaveCount(32);
  await expect(picker).toContainText("not tonight's game");
  await noSidewaysScroll(lorne.page);
  await shot(lorne.page, "02-team-picker");
  await picker.getByRole("radio", { name: "Calgary Flames" }).click();
  await expect(picker).toBeHidden();
  await expect(ask).toBeHidden();

  // The roster wears it.
  await openTab(lorne.page, "Group");
  await expect(
    lorne.page.getByLabel("Calgary Flames fan").first(),
  ).toBeVisible();
  await expect(lorne.page.getByText("You bleed for")).toBeVisible();

  // ---------------------------------------------- a guest joins, says later
  await lorne.page.getByLabel("Who the invitation is for").fill("Sam");
  await lorne.page.getByRole("button", { name: "Make a link" }).click();
  const link = new URL(
    (await lorne.page.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;

  const sam = await person(browser);
  await sam.page.goto(link);
  await sam.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(sam.page, "sam");
  await sam.page.getByLabel("Your name").fill("Sam");
  await sam.page.getByRole("button", { name: "I'm in" }).click();
  await expect(sam.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);

  // Nonblocking: the night is usable with the ask on screen, and "Not now" puts it away.
  const samAsk = sam.page.getByRole("complementary", {
    name: "Who do you bleed for?",
  });
  await expect(samAsk).toBeVisible();
  await openTab(sam.page, "Play");
  await samAsk.getByRole("button", { name: "Not now" }).click();
  await expect(samAsk).toBeHidden();
  await sam.page.reload();
  await expect(sam.page.getByRole("tab", { name: /^Play/ })).toBeVisible();
  await expect(samAsk).toBeHidden();
  await openTab(sam.page, "Chat");
  await expect(
    sam.page.getByRole("region", { name: "WHO DO YOU BLEED FOR?" }),
  ).toBeHidden();

  // ...and the team is still one tap away, later, from Group.
  await openTab(sam.page, "Group");
  await sam.page.getByRole("button", { name: "Who do you bleed for?" }).click();
  await sam.page
    .getByRole("dialog", { name: "WHO DO YOU BLEED FOR?" })
    .getByRole("radio", { name: "Vancouver Canucks" })
    .click();
  await expect(
    sam.page.getByLabel("Vancouver Canucks fan").first(),
  ).toBeVisible();

  const lorneId = (await snapshot(lorne.page, night)).state.meId;
  const samId = (await snapshot(sam.page, night)).state.meId;

  // ------------------------------------------------------- the Chirp Room
  // Welcomes for both declarations and the arrival ask, clearly Chirp Bot's.
  await openTab(lorne.page, "Chat");
  await expect(async () => {
    await lorne.page.reload();
    await openTab(lorne.page, "Chat");
    await expect(bot(lorne.page, "welcome")).toHaveCount(2, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(bot(lorne.page, "arrival")).toHaveCount(1);
  const welcome = bot(lorne.page, "welcome").last();
  await expect(welcome).toContainText("Chirp Bot");
  await expect(welcome).toContainText("BOT");
  await expect(welcome).toContainText("Satire");

  // Opening the chat with two people in, before the game: a question to argue about.
  await openTab(sam.page, "Chat");
  await expect(async () => {
    await sam.page.reload();
    await openTab(sam.page, "Chat");
    await expect(bot(sam.page, "prompt")).toHaveCount(1, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(bot(sam.page, "prompt")).toContainText("Hot take · opinion");
  const s1 = await snapshot(sam.page, night);
  const prompt = s1.chirp.lines.find((l) => l.kind === "prompt")!;
  expect(prompt.tone).toBe("opinion");

  // Existing chat still works, both ways, with teams beside names.
  const box = sam.page.getByLabel("Say something to the group");
  await box.fill("the Flames are a garage sale with a jumbotron");
  await sam.page.getByRole("button", { name: "Send" }).click();
  await expect(
    lorne.page.getByText("the Flames are a garage sale with a jumbotron"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    lorne.page
      .locator("li", { hasText: "the Flames are a garage sale" })
      .getByLabel("Vancouver Canucks fan"),
  ).toBeVisible();

  // A Canucks fan and a Flames fan arguing: Chirp Bot stirs it, once.
  await expect(async () => {
    await lorne.page.reload();
    await openTab(lorne.page, "Chat");
    await expect(bot(lorne.page, "rivalry")).toHaveCount(1, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(bot(lorne.page, "rivalry")).toContainText(/Flames|Canucks/);
  await shot(lorne.page, "03-chirp-room");

  // ...and does not answer every message.
  await box.fill("also the Flames power play is a rumour");
  await sam.page.getByRole("button", { name: "Send" }).click();
  await expect(sam.page.getByText("power play is a rumour")).toBeVisible();
  await sam.page.waitForTimeout(6000);
  expect(
    (await snapshot(sam.page, night)).chirp.lines.filter(
      (l) => l.kind === "rivalry",
    ),
  ).toHaveLength(1);

  // -------------------------------------------------------- chirp someone
  await lorne.page.getByRole("button", { name: "🔥 Chirp Someone" }).click();
  const chirpSheet = lorne.page.getByRole("dialog", {
    name: "🔥 Chirp Someone",
  });
  await chirpSheet.getByRole("button", { name: /Sam/ }).click();
  const options = chirpSheet
    .getByRole("list", { name: "Pick a chirp" })
    .getByRole("button");
  await expect(options).toHaveCount(3, { timeout: 15_000 });
  await noSidewaysScroll(lorne.page);
  await shot(lorne.page, "04-chirp-someone");
  const chosen = (await options.first().textContent())!.trim();
  expect(chosen).toContain("Sam");
  await options.first().click();
  await expect(chirpSheet).toBeHidden();
  const lorneBox = lorne.page.getByLabel("Say something to the group");
  await expect(lorneBox).toHaveValue(chosen);

  // Nothing went out on Lorne's behalf.
  expect(
    (await snapshot(sam.page, night)).state.moments.some(
      (m) => m.text === chosen,
    ),
  ).toBe(false);

  await lorne.page.getByRole("button", { name: "Send" }).click();
  await expect(sam.page.getByText(chosen)).toBeVisible({ timeout: 20_000 });
  const sent = (await snapshot(sam.page, night)).state.moments.find(
    (m) => m.text === chosen,
  );
  expect(sent?.by).toBe(lorneId);

  // ------------------------------------------------------- authorization
  // Chirp someone: not yourself, not a stranger, not on a night you're not in.
  const chirps = (p: Page, targetId: string) =>
    p.request.post(`/hockey/api/occasions/${night}/chirps`, {
      data: { targetId },
    });
  expect((await chirps(sam.page, samId)).status()).toBe(422);
  expect(
    (await chirps(sam.page, "99999999-9999-4999-8999-999999999999")).status(),
  ).toBe(404);

  const stranger = await person(browser);
  await stranger.page.goto("/hockey");
  await signUp(stranger.page, "stranger");
  await expect(stranger.page.getByLabel("Your name")).toBeVisible();
  expect((await chirps(stranger.page, samId)).status()).toBe(404);
  expect(
    (
      await stranger.page.request.post(
        `/hockey/api/occasions/${night}/actions`,
        {
          data: { type: "setTeam", team: "TOR" },
        },
      )
    ).status(),
  ).toBe(404);
  // A stranger reads nobody's team and no Chirp Bot line through PostgREST.
  const peek = await rest(
    "stranger",
    "GET",
    `passport_occasion_members?occasion_id=eq.${night}&select=user_id,nhl_team`,
  );
  expect(peek.json).toEqual([]);
  const peekBot = await rest(
    "stranger",
    "GET",
    `passport_occasion_moments?occasion_id=eq.${night}&kind=eq.chirp&select=id`,
  );
  expect(peekBot.json).toEqual([]);

  // Sam cannot set Lorne's team...
  const hijack = await rest(
    "sam",
    "PATCH",
    `passport_occasion_members?user_id=eq.${lorneId}`,
    { nhl_team: "EDM" },
  );
  expect(hijack.json).toEqual([]);
  // ...nor pick a team that doesn't exist...
  const fake = await rest(
    "sam",
    "PATCH",
    `passport_occasion_members?user_id=eq.${samId}`,
    { nhl_team: "QUE" },
  );
  expect(fake.status).toBe(400);
  // ...nor post as somebody else.
  const asLorne = await rest("sam", "POST", "passport_occasion_moments", {
    occasion_id: night,
    actor_id: lorneId,
    kind: "chirp",
    bot_key: "bold:x",
    bot_line: "o.bd.1",
  });
  expect(asLorne.status).toBe(403);

  // Sam writes "Chirp Bot" lines straight into the table. Allowed as rows
  // (he is a member), never shown as Chirp Bot's — nor as anybody's.
  const forgedText = await rest("sam", "POST", "passport_occasion_moments", {
    occasion_id: night,
    actor_id: samId,
    kind: "chirp",
    text: "CHIRP BOT: Lorne is a loser",
    bot_key: "bold:forged",
    bot_line: "ai",
    bot_sig: "made-up",
  });
  expect(forgedText.status).toBe(201);
  // A line about Lorne can't be written by Sam — so he can't squat the key
  // and stop the real one being posted.
  const squat = await rest("sam", "POST", "passport_occasion_moments", {
    occasion_id: night,
    actor_id: samId,
    kind: "chirp",
    bot_key: `team:${lorneId}:TOR`,
    bot_line: "w.TOR.1",
  });
  expect(squat.status).toBe(400);
  // A real library line under the wrong kind of key is stored, never shown.
  const wrongKind = await rest("sam", "POST", "passport_occasion_moments", {
    occasion_id: night,
    actor_id: samId,
    kind: "chirp",
    bot_key: `team:${samId}:BUF`,
    bot_line: "o.ch.1",
  });
  expect(wrongKind.status).toBe(201);
  // An ordinary message cannot smuggle bot columns either.
  const smuggle = await rest("sam", "POST", "passport_occasion_moments", {
    occasion_id: night,
    actor_id: samId,
    kind: "note",
    text: "hi",
    bot_key: "bold:smuggle",
    bot_line: "o.bd.1",
  });
  expect(smuggle.status).toBe(400);
  const afterForgery = await snapshot(lorne.page, night);
  const shown = JSON.stringify(afterForgery);
  expect(shown).not.toContain("Lorne is a loser");
  expect(shown).not.toContain("holding the receipts");

  // The host decides whether Chirp Bot is in the chat; a guest does not.
  const setChirp = (p: Page, on: boolean) =>
    p.request.post(`/hockey/api/occasions/${night}/actions`, {
      data: { type: "setChirp", on },
    });
  expect((await setChirp(sam.page, false)).status()).toBe(403);
  await lorne.page.getByRole("button", { name: "Kick Chirp Bot out" }).click();
  await expect(bot(lorne.page)).toHaveCount(0);
  await expect(
    lorne.page.getByRole("button", { name: "🔥 Chirp Someone" }),
  ).toBeHidden();
  // The switch shows at once; wait for the server to have it.
  await expect(async () => {
    expect((await snapshot(sam.page, night)).chirp.on).toBe(false);
  }).toPass({ timeout: 10_000 });
  expect((await snapshot(sam.page, night)).chirp.lines).toEqual([]);
  expect((await chirps(sam.page, lorneId)).status()).toBe(409);
  // People's own messages stay.
  await expect(lorne.page.getByText(chosen)).toBeVisible();
  await lorne.page
    .getByRole("button", { name: "Let Chirp Bot back in" })
    .click();
  await expect(bot(lorne.page, "welcome").first()).toBeVisible();

  // ----------------------------------------------- persistence + change
  // A new session on another device: still a Flames fan.
  const lorne2 = await person(browser, { width: 1280, height: 900 });
  await lorne2.page.goto(`/auth?next=/hockey/${night}`);
  await signIn(lorne2.page, "lorne");
  await expect(lorne2.page).toHaveURL(new RegExp(`^[^?]*/hockey/${night}`));
  expect((await snapshot(lorne2.page, night)).chirp.fans[lorneId]).toBe("CGY");

  // Lorne defects to Toronto. The chip moves; Chirp Bot notices.
  await openTab(lorne2.page, "Group");
  await lorne2.page.getByRole("button", { name: "Change team" }).click();
  await lorne2.page
    .getByRole("dialog", { name: "WHO DO YOU BLEED FOR?" })
    .getByRole("radio", { name: "Toronto Maple Leafs" })
    .click();
  await expect(
    lorne2.page.getByLabel("Toronto Maple Leafs fan").first(),
  ).toBeVisible();
  await expect(async () => {
    const lines = (await snapshot(lorne2.page, night)).chirp.lines;
    expect(lines.filter((l) => l.kind === "welcome")).toHaveLength(3);
  }).toPass({ timeout: 20_000 });
  expect((await snapshot(sam.page, night)).chirp.fans[lorneId]).toBe("TOR");

  // A new night: the team comes along.
  await lorne2.page.goto("/hockey");
  await lorne2.page
    .getByRole("button", { name: "Start another night" })
    .click();
  await lorne2.page.getByLabel("Opponent").fill("Oilers");
  const in5 = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await lorne2.page.getByLabel("Game date").fill(in5);
  await lorne2.page.getByLabel("Puck drop time").fill("19:00");
  await lorne2.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne2.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const second = lorne2.page.url().split("/").pop()!;
  expect(second).not.toBe(night);
  expect((await snapshot(lorne2.page, second)).chirp.fans[lorneId]).toBe("TOR");

  // ----------------------------------------------------- 320 px phone
  const small = await person(browser, { width: 320, height: 640 });
  await small.page.goto(`/auth?next=/hockey/${night}`);
  await signIn(small.page, "sam");
  await expect(small.page).toHaveURL(new RegExp(`^[^?]*/hockey/${night}`));
  await openTab(small.page, "Chat");
  await expect(bot(small.page).first()).toBeVisible();
  await noSidewaysScroll(small.page);
  for (const name of ["🔥 Chirp Someone", "Send"]) {
    const box = await small.page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(32);
  }
  await shot(small.page, "05-chat-320");

  for (const p of [lorne, sam, stranger, lorne2, small])
    await p.context.close();
});
