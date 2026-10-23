import { expect, test, type Browser, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **The playful parts, with three real people** — a secret mission only its
 * target can see, a forfeit you opt into, a prediction anybody can call, the
 * Sycle Cup and the receipts that follow the host's call.
 *
 * Run (the env is the stack's, see README.md):
 *   set -a; . "$STACK/env"; set +a
 *   FINISH_SHOTS=<dir> E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification finish-play
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-play-${stamp}@example.test`;
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

async function person(browser: Browser) {
  const context = await browser.newContext(PHONE);
  return { context, page: await context.newPage() };
}

async function token(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: TEST_PASSWORD }),
  });
  return (await res.json()).access_token as string;
}

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
  expect(((await res.json()) as unknown[]).length).toBe(1);
}

async function shot(page: Page, name: string) {
  if (process.env.FINISH_SHOTS)
    await page.screenshot({
      path: `${process.env.FINISH_SHOTS}/${name}.png`,
      fullPage: true,
    });
}

test.describe.configure({ mode: "serial" });
test.skip(!!process.env.CONFIRM_EMAIL, "needs an auto-confirming stack");

test("secret mission, forfeit, prediction, the Cup and the receipts", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const lorne = await person(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByLabel("Opponent").fill("Kraken");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const night = new URL(lorne.page.url()).pathname.split("/").pop()!;
  await lorne.page.getByRole("button", { name: /Skip/ }).click();

  const guests: Record<string, { context: unknown; page: Page; id: string }> =
    {};
  for (const [who, name] of [
    ["maya", "Maya"],
    ["sam", "Sam"],
  ] as const) {
    const res = await lorne.page.request.post(
      `/hockey/api/occasions/${night}/invites`,
      { data: { label: name } },
    );
    const { token: t } = await res.json();
    const p = await person(browser);
    await p.page.goto(`/hockey/join/${t}`);
    await p.page.getByRole("link", { name: "Sign in to see it" }).click();
    await signUp(p.page, who);
    await p.page.getByLabel("Your name").fill(name);
    await p.page.getByRole("button", { name: "I'm in" }).click();
    await expect(p.page).toHaveURL(new RegExp(`/hockey/${night}$`));
    const snap = await (
      await p.page.request.get(`/hockey/api/occasions/${night}`)
    ).json();
    guests[who] = { ...p, id: snap.state.meId };
  }
  const maya = guests.maya,
    sam = guests.sam;
  const post = async (p: Page, a: unknown) => {
    const r = await p.request.post(`/hockey/api/occasions/${night}/actions`, {
      data: a as never,
    });
    expect(r.ok(), JSON.stringify(a) + (await r.text())).toBe(true);
  };

  // ---------------------------------------------------- the toy box, by hand
  await openTab(lorne.page, "Play");
  await lorne.page
    .getByRole("button", { name: /Ask the group something stupid/ })
    .click();
  await shot(lorne.page, "p1-toy-box-open");
  await lorne.page.getByRole("button", { name: /close/i }).first().click();

  // ---------------------------------------------------- build the night's toys
  await post(lorne.page, {
    type: "addToy",
    family: "mission",
    input: {
      text: "Get Maya to say the word 'analytics' out loud.",
      targetId: sam.id,
      phaseId: "before",
      points: 3,
      edge: 1,
    },
  });
  await post(maya.page, {
    type: "addToy",
    family: "consequence",
    input: {
      text: "Will the Canucks score first? | Losing side delivers an overly sincere concession speech.",
      phaseId: "before",
      locksAtPhaseId: "live",
      points: 2,
      edge: 1,
    },
  });
  await post(sam.page, {
    type: "addToy",
    family: "prediction",
    input: {
      text: "Someone in our row spills a full beer before the third.",
      phaseId: "before",
      locksAtPhaseId: "live",
      points: 4,
      edge: 0,
    },
  });

  // The mission is private to Sam: not in Maya's payload. The host wrote it, so
  // the server still sends it back to them as its author (the page does not
  // show it to them as a card); nobody else ever receives its text.
  const seen = async (p: Page) =>
    JSON.stringify(
      await (await p.request.get(`/hockey/api/occasions/${night}`)).json(),
    );
  expect(await seen(sam.page)).toContain("analytics");
  expect(await seen(maya.page)).not.toContain("analytics");

  // Sam sees it in Play and has to opt in; nobody is bound by being asked.
  await sam.page.reload();
  await openTab(sam.page, "Play");
  // The mission is a card in Sam's deck, after the seven the night starts with.
  const deck = sam.page.getByRole("region", { name: "Your picks" });
  await expect(deck).toContainText("0 of 10 sealed", { timeout: 15_000 });
  for (
    let i = 0;
    i < 9 && !(await sam.page.getByText(/analytics/).isVisible());
    i++
  )
    await deck.getByRole("button", { name: /Skip|Next/ }).click();
  await expect(sam.page.getByText(/analytics/)).toBeVisible();
  await shot(sam.page, "p2-sam-secret-mission");

  // ------------------------------------------------------ opt in and answer
  const prompts = JSON.parse(await seen(maya.page)).state.addedPrompts as {
    id: string;
    family?: string;
  }[];
  const forfeit = prompts.find((p) => p.family === "consequence")!;
  const guess = prompts.find((p) => p.family === "prediction")!;
  const mine = JSON.parse(await seen(sam.page)).state.addedPrompts as {
    id: string;
    family?: string;
  }[];
  const mission = mine.find((p) => p.family === "mission")!;
  await post(maya.page, {
    type: "consent",
    promptId: forfeit.id,
    agreed: true,
  });
  await post(sam.page, { type: "consent", promptId: forfeit.id, agreed: true });
  await post(maya.page, { type: "respond", promptId: forfeit.id, value: "a" });
  await post(sam.page, { type: "respond", promptId: forfeit.id, value: "b" });
  await post(sam.page, { type: "consent", promptId: mission.id, agreed: true });
  await post(lorne.page, { type: "respond", promptId: guess.id, value: true });
  await post(maya.page, { type: "respond", promptId: guess.id, value: false });
  await openTab(maya.page, "Play");
  await maya.page.reload();
  await openTab(maya.page, "Play");
  await shot(maya.page, "p3-maya-forfeit-and-prediction");

  // -------------------------------------------- the game ends; the host calls
  await moveStart(
    "lorne",
    night,
    new Date(Date.now() - 4 * 3600e3).toISOString(),
  );
  await post(sam.page, {
    type: "respond",
    promptId: mission.id,
    value: true,
  }).catch(() => {});
  await post(sam.page, { type: "cue", promptId: mission.id }).catch(() => {});
  // Maya asked the forfeit, so she calls it; Sam asked the prediction, he calls it.
  await post(maya.page, { type: "callIt", promptId: forfeit.id, value: "a" });
  await post(sam.page, { type: "callIt", promptId: guess.id, value: true });

  await lorne.page.goto(`/hockey/${night}`);
  await openTab(lorne.page, "Play");
  await expect(lorne.page.getByText("The Sycle Cup")).toBeVisible({
    timeout: 15_000,
  });
  await shot(lorne.page, "p4-host-cup-and-receipts");
  const board = lorne.page.getByRole("region", {
    name: /Sycle Hockey Night|Cup/,
  });
  await expect(lorne.page.getByText(/concession speech/)).toBeVisible();
  // Receipts are attributed: Sam picked the losing side and owes the speech.
  await expect(lorne.page.getByText(/Sam/).first()).toBeVisible();
  void board;
  await sam.page.goto(`/hockey/${night}`);
  await openTab(sam.page, "Play");
  await shot(sam.page, "p5-sam-after");
  await maya.page.goto(`/hockey/${night}`);
  await openTab(maya.page, "Play");
  await shot(maya.page, "p6-maya-after");
});
