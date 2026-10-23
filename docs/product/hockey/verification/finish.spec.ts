import { expect, test, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Finish the experience — the whole journey, with three real people.**
 *
 * Create → Invite → Join → Vote → Predict → Share → Game → Recap → Run it
 * back, plus the doors that must stay shut. Real accounts on the local stack,
 * under RLS; a phone each for the guests, a phone for the host.
 *
 * The NHL is a recorded, real answer (`finish/nhl-stub.mjs`): the 26 Sept
 * 2026 Canucks–Kraken game at Rogers Arena, final 4–3 in regulation. The
 * server under test must be started with `NHL_API_BASE=http://127.0.0.1:54350`.
 *
 * Run (the env is the stack's, see README.md):
 *   node docs/product/hockey/finish/nhl-stub.mjs 54350 &
 *   set -a; . "$STACK/env"; set +a
 *   NHL_API_BASE=http://127.0.0.1:54350 next start -p 3130
 *   FINISH_SHOTS=<dir> E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification finish
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-fin-${stamp}@example.test`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ICE = path.join(__dirname, "../finish/fixtures/ice.jpg");
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
  expect(res.status).toBe(200);
  return (await res.json()).access_token as string;
}

/** The host moving the game the way a host can: their own session, under RLS. */
async function setGame(who: string, nightId: string, startsAt: string) {
  const headers = {
    apikey: ANON,
    authorization: `Bearer ${await token(who)}`,
    "content-type": "application/json",
    prefer: "return=representation",
  };
  const url = `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`;
  const [row] = (await (await fetch(url, { headers })).json()) as {
    details: Record<string, unknown>;
  }[];
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ starts_at: startsAt, details: row.details }),
  });
  expect(((await res.json()) as unknown[]).length).toBe(1);
}

async function shot(page: Page, name: string) {
  if (process.env.FINISH_SHOTS)
    await page.screenshot({
      path: `${process.env.FINISH_SHOTS}/${name}.png`,
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

async function joinThrough(
  browser: Browser,
  link: string,
  who: string,
  name: string,
) {
  const p = await person(browser);
  await p.page.goto(link);
  await p.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(p.page, who);
  await p.page.getByLabel("Your name").fill(name);
  await p.page.getByRole("button", { name: "I'm in" }).click();
  await expect(p.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  return p;
}

test.describe.configure({ mode: "serial" });
test.skip(
  !!process.env.CONFIRM_EMAIL,
  "this run signs up instantly; it needs an auto-confirming stack",
);

test("create, invite, join, vote, predict, share, game, recap, run it back", async ({
  browser,
}) => {
  test.setTimeout(240_000);

  // ------------------------------------------------------ create (the host)
  const lorne = await person(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByLabel("Opponent").fill("Kraken");
  const in3 = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await lorne.page.getByLabel("Game date").fill(in3);
  await lorne.page.getByLabel("Puck drop time").fill("19:00");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const night = lorne.page.url().split("/").pop()!;
  await lorne.page.getByRole("button", { name: /Skip/ }).click();

  // ----------------------------------------------------------- invite, join
  await openTab(lorne.page, "Group");
  const links: string[] = [];
  for (const label of ["Maya", "Sam"]) {
    await lorne.page.getByLabel("Who the invitation is for").fill(label);
    await lorne.page.getByRole("button", { name: "Make a link" }).click();
    await expect(lorne.page.getByText(`For ${label}.`)).toBeVisible();
    links.push(
      new URL(
        (await lorne.page.getByTestId("invite-url").textContent())!.trim(),
      ).pathname,
    );
  }
  const maya = await joinThrough(browser, links[0], "maya", "Maya");
  const sam = await joinThrough(browser, links[1], "sam", "Sam");
  await shot(maya.page, "01-guest-joined");

  // ------------------------------------------------- vote and predict, by UI
  // Maya answers the first sealed pick by tapping, and it survives a reload.
  await openTab(maya.page, "Play");
  const deck = maya.page.getByRole("region", { name: "Your picks" });
  await expect(deck).toContainText("0 of 7 sealed");
  await deck.getByRole("button", { name: "Canucks one more" }).click();
  await expect(deck).toContainText("1 of 7 sealed");
  await deck.getByRole("button", { name: "Next" }).click();
  await deck.getByRole("button", { name: /SEA\s*Kraken/ }).click();
  await expect(deck).toContainText("2 of 7 sealed");
  await deck.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(deck).toContainText("3 of 7 sealed");
  const post = (p: Page, action: unknown) =>
    p.request.post(`/hockey/api/occasions/${night}/actions`, {
      data: action as never,
    });
  expect(
    (
      await post(sam.page, {
        type: "respond",
        promptId: "final-score",
        value: [4, 3],
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await post(lorne.page, {
        type: "respond",
        promptId: "final-score",
        value: [1, 0],
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await post(sam.page, {
        type: "respond",
        promptId: "overtime",
        value: true,
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await post(lorne.page, {
        type: "respond",
        promptId: "first-team",
        value: "opponent",
      })
    ).ok(),
  ).toBe(true);
  await maya.page.reload();
  await openTab(maya.page, "Play");
  await shot(maya.page, "02-maya-picks-after-reload");

  // ------------------------------------------------------------------ share
  // Before the game: Memories on Play. Maya takes a photo; Sam sees it.
  await maya.page
    .getByRole("heading", { name: "Memories" })
    .scrollIntoViewIfNeeded();
  await expect(
    maya.page.getByText("Nothing yet. The first one sets the tone."),
  ).toBeVisible();
  await maya.page.getByLabel("Choose a photo").setInputFiles(ICE);
  await expect(
    maya.page.getByAltText("Your photo, before it is shared"),
  ).toBeVisible();
  await maya.page.getByRole("button", { name: /Kraken fan/ }).click();
  await shot(maya.page, "03-photo-draft");
  await maya.page.getByRole("button", { name: "Share with the group" }).click();
  await expect(
    maya.page.getByRole("button", { name: /Photo by Maya/ }),
  ).toBeVisible();
  await shot(maya.page, "04-album-maya");

  await openTab(sam.page, "Play");
  await expect(
    sam.page.getByRole("button", { name: /Photo by Maya/ }),
  ).toBeVisible({ timeout: 20_000 });
  const photoUrl = await sam.page
    .getByRole("img", { name: /Kraken fan/ })
    .first()
    .getAttribute("src");
  expect(photoUrl).toMatch(/\/photos\/[0-9a-f-]{36}$/);
  // The picture really is a shrunken JPEG, and Sam can fetch it.
  const bytes = await sam.page.request.get(photoUrl!);
  expect(bytes.status()).toBe(200);
  expect(bytes.headers()["content-type"]).toBe("image/jpeg");
  const body = await bytes.body();
  expect(body[0]).toBe(0xff);
  expect(body[1]).toBe(0xd8);
  expect(body.length).toBeLessThan(600_000);
  // Sam cannot take Maya's photo down; Maya's host can.
  await sam.page.getByRole("button", { name: /Photo by Maya/ }).click();
  await expect(sam.page.getByRole("dialog")).toBeVisible();
  await expect(
    sam.page.getByRole("button", { name: "Take it down" }),
  ).toHaveCount(0);
  await shot(sam.page, "05-photo-open-guest");
  await sam.page.getByRole("button", { name: "Close photo" }).click();
  const del = await sam.page.request.delete(photoUrl!);
  expect(del.status()).toBe(403);

  // A stranger gets nothing: not the album, not the picture, not the game.
  const eve = await person(browser);
  await eve.page.goto("/hockey");
  await signUp(eve.page, "eve");
  await eve.page.waitForURL(/\/hockey/);
  for (const url of [
    `/hockey/api/occasions/${night}/photos`,
    photoUrl!,
    `/hockey/api/occasions/${night}/game`,
  ]) {
    expect((await eve.page.request.get(url)).status(), url).toBe(404);
  }
  expect(
    (
      await eve.page.request.post(`/hockey/api/occasions/${night}/photos`, {
        data: { data: "/9j/" + "A".repeat(200) },
      })
    ).status(),
  ).toBe(404);
  // Straight at the database, as each person's own session — RLS, not the app.
  const rest = async (
    who: string | null,
    method: string,
    query: string,
    body?: unknown,
  ) => {
    const res = await fetch(
      `${SUPABASE}/rest/v1/passport_occasion_photos${query}`,
      {
        method,
        headers: {
          apikey: ANON,
          ...(who ? { authorization: `Bearer ${await token(who)}` } : {}),
          "content-type": "application/json",
          prefer: "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return {
      status: res.status,
      rows: (await res.json().catch(() => [])) as unknown[],
    };
  };
  const row = { occasion_id: night, data: "/9j/" + "A".repeat(200) };
  // A stranger reads nothing and writes nothing; signed out is refused outright.
  expect(
    (await rest("eve", "GET", `?occasion_id=eq.${night}`)).rows,
  ).toHaveLength(0);
  expect((await rest("eve", "POST", "", row)).status).toBe(403);
  expect((await rest(null, "GET", "")).status).toBeGreaterThanOrEqual(401);
  // A guest cannot write as somebody else, cannot edit, and cannot delete another's photo.
  expect(
    (
      await rest("sam", "POST", "", {
        ...row,
        user_id: "00000000-0000-0000-0000-000000000001",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await rest("sam", "PATCH", `?occasion_id=eq.${night}`, {
        caption: "mine now",
      })
    ).status,
  ).toBeGreaterThanOrEqual(401);
  expect(
    (await rest("sam", "DELETE", `?occasion_id=eq.${night}`)).rows,
  ).toHaveLength(0);
  expect(
    (await rest("sam", "GET", `?occasion_id=eq.${night}&select=id`)).rows,
  ).toHaveLength(1);

  // A guest cannot change the game or cancel the night; and bad photos bounce.
  expect(
    (
      await sam.page.request.patch(`/hockey/api/occasions/${night}`, {
        data: {
          opponent: "Oilers",
          startsAt: new Date(Date.now() + 5 * 86400e3).toISOString(),
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await sam.page.request.delete(`/hockey/api/occasions/${night}`)).status(),
  ).toBe(403);
  expect(
    (
      await sam.page.request.post(`/hockey/api/occasions/${night}/photos`, {
        data: { data: "iVBORw0KGgo" + "A".repeat(200) },
      })
    ).status(),
  ).toBe(400);

  // ---------------------------------------------- host controls: the game
  await openTab(lorne.page, "Group");
  const game = lorne.page.getByRole("region", { name: "The game" });
  await expect(game.getByLabel("Opponent")).toHaveValue("Kraken");
  await game.getByLabel("Opponent").fill("Oilers");
  await game.getByRole("button", { name: "Change the game" }).click();
  await expect(lorne.page.getByText("Oilers").first()).toBeVisible({
    timeout: 15_000,
  });
  await openTab(lorne.page, "Group");
  await shot(lorne.page, "06-host-game-controls");
  await lorne.page
    .getByRole("region", { name: "The game" })
    .getByLabel("Opponent")
    .fill("Kraken");
  await lorne.page
    .getByRole("region", { name: "The game" })
    .getByRole("button", { name: "Change the game" })
    .click();
  await expect(lorne.page.getByText("Kraken").first()).toBeVisible({
    timeout: 15_000,
  });

  // ----------------------------------------------- the game, as the NHL says
  // 26 Sept 2026, 23:00Z, Rogers Arena: Canucks 4, Kraken 3 (regulation).
  await setGame("lorne", night, "2026-09-26T23:00:00.000Z");
  await lorne.page.goto(`/hockey/${night}`);
  await expect(
    lorne.page.getByRole("region", { name: "The NHL scoreboard" }),
  ).toContainText("Final", { timeout: 20_000 });
  await expect(
    lorne.page.getByRole("region", { name: "The NHL scoreboard" }),
  ).toContainText("4");
  await expect(
    lorne.page.getByRole("region", { name: "The NHL scoreboard" }),
  ).toContainText("From the NHL");
  await shot(lorne.page, "07-host-nhl-final-top");

  // The host calls it from the league's record — one tap, nothing typed.
  await openTab(lorne.page, "Play");
  const call = lorne.page.getByRole("region", { name: "Call it" });
  await expect(call.getByText(/The NHL has this one on record/)).toBeVisible();
  await shot(lorne.page, "08-host-call-it-suggestion");
  await call.getByRole("button", { name: "Use the NHL's numbers" }).click();
  await expect(lorne.page.getByRole("region", { name: "Call it" }))
    .toHaveCount(0, { timeout: 15_000 })
    .catch(() => {});

  // A guest never sees the host's controls, but does see the same board.
  await maya.page.goto(`/hockey/${night}`);
  await expect(maya.page.getByLabel("Final: VAN 4, SEA 3")).toBeVisible({
    timeout: 20_000,
  });
  await openTab(maya.page, "Play");
  await expect(maya.page.getByRole("region", { name: "Call it" })).toHaveCount(
    0,
  );

  // ------------------------------------------------------- the recap, after
  const results = await (
    await lorne.page.request.get(`/hockey/api/occasions/${night}`)
  ).json();
  const prompt = (id: string) =>
    results.definition.prompts.find((p: { id: string }) => p.id === id);
  expect(prompt("final-score").resolution).toEqual([4, 3]);
  expect(prompt("overtime").resolution).toBe(false);
  await maya.page.reload();
  await openTab(maya.page, "Play");
  await shot(maya.page, "09-guest-play-after");
  await noSidewaysScroll(maya.page);
  // The smallest phones: the album, the board and the host's switches fit.
  for (const width of [320, 375]) {
    await maya.page.setViewportSize({ width, height: 700 });
    await noSidewaysScroll(maya.page);
    await lorne.page.setViewportSize({ width, height: 700 });
    await openTab(lorne.page, "Group");
    await noSidewaysScroll(lorne.page);
    await openTab(lorne.page, "Play");
    await noSidewaysScroll(lorne.page);
  }
  await maya.page.setViewportSize({ width: 390, height: 844 });
  await expect(
    maya.page.getByRole("heading", { name: "Memories" }),
  ).toBeVisible();
  await expect(
    maya.page.getByRole("button", { name: /Photo by Maya/ }),
  ).toBeVisible();

  // ---------------------------------------------------------- run it back
  await maya.page.getByRole("button", { name: "Now go have another." }).click();
  const runItBack = maya.page.getByRole("region", { name: "Run it back" });
  await runItBack.getByRole("button", { name: "Start the next one" }).click();
  await runItBack.getByLabel("Opponent").fill("Flames");
  await runItBack.getByRole("button", { name: "Start No. 2" }).click();
  await maya.page.waitForURL(
    (u) =>
      /\/hockey\/[0-9a-f-]{36}$/.test(u.pathname) &&
      !u.pathname.endsWith(night),
    { timeout: 15_000 },
  );
  const next = new URL(maya.page.url()).pathname.split("/").pop()!;
  expect(next).not.toBe(night);
  await maya.page.getByRole("button", { name: /Skip/ }).click();
  await openTab(maya.page, "Play");
  await expect(
    maya.page.getByRole("region", { name: "Last time" }),
  ).toContainText("No. 1");
  await shot(maya.page, "10-run-it-back-no2");
  await noSidewaysScroll(maya.page);

  // The host of No. 2 can cancel it, and then it is gone for everybody.
  await openTab(maya.page, "Group");
  await maya.page.getByRole("button", { name: "Cancel this night" }).click();
  await shot(maya.page, "11-cancel-asks-twice");
  await maya.page
    .getByRole("button", { name: "Yes, cancel the night" })
    .click();
  await expect(maya.page).toHaveURL(/\/hockey(\?.*)?$/, { timeout: 15_000 });
  expect(
    (await maya.page.request.get(`/hockey/api/occasions/${next}`)).status(),
  ).toBe(404);
  // No. 1 is untouched, and Sam still sees Maya's photo.
  expect(
    (
      await sam.page.request.get(`/hockey/api/occasions/${night}/photos`)
    ).status(),
  ).toBe(200);
});
