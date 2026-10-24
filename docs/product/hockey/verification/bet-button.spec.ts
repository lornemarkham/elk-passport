import {
  expect,
  test,
  request as pwRequest,
  type Page,
} from "@playwright/test";
import { openTab } from "./night-tabs";
import {
  type Person,
  act,
  declareTeam,
  moveStart,
  night,
  ok,
  peopleCalled,
  phone,
  refused,
  rest,
  setNight,
  signUp,
  snapshot,
  token,
} from "./mayhem-helpers";

/**
 * **The Bet button — three real accounts, one non-member, the real database.**
 *
 * "THROW IT AT BRYAN.K.SMITH" did not reliably send a bet. This drives the
 * sheet the way a phone does (typing, a poll landing mid-word, a dropped
 * connection, a double tap), then follows the challenge to the people it is
 * for and checks the database's own answers to anyone who tries around it.
 *
 *   casey (Canucks)         throws the bet — the sender
 *   bryan.k.smith (Wild)    host, the recipient: accepts one, passes one
 *   drew                    a third member: the jury, and a witness for RLS
 *   ivy                     signed in, not on the night
 *
 * Run against `next start` on the stack's env with mayhem-migration.sql
 * applied (README.md here):
 *   set -a; . "$STACK/env"; set +a
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification bet-button
 */

peopleCalled("bet");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
test.skip(!!process.env.CONFIRM_EMAIL, "needs an auto-confirming stack");

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let bryan: Person;
let casey: Person;
let drew: Person;
let ivy: Person;

const isIssue = (postData: unknown) =>
  (postData as { type?: string } | null)?.type === "issueChallenge";

/** A signed-in account's user id, from GoTrue itself. */
async function idOf(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/user`, {
    headers: { apikey: ANON, authorization: `Bearer ${await token(who)}` },
  });
  expect(res.status).toBe(200);
  return (await res.json()).id as string;
}

async function challengesOf(page: Page) {
  return (await snapshot(page)).play.challenges;
}

async function openBet(p: Person) {
  await openTab(p.page, "Play");
  await p.page.getByRole("button", { name: "Start something else" }).click();
  const sheet = p.page.getByRole("dialog", { name: /The Bet/ });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("setup: bryan hosts, casey and drew join, ivy is a stranger", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const host = await phone(browser);
  await host.goto("/hockey");
  await signUp(host, "bryan");
  await host.getByLabel("Your name").fill("bryan.k.smith");
  await host.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await host.getByLabel("Game date").fill(in2);
  await host.getByLabel("Puck drop time").fill("19:00");
  await host.getByRole("button", { name: "Start it" }).click();
  await expect(host).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(host.url().split("/").pop()!);
  await host.getByRole("button", { name: /Skip/ }).click();
  bryan = {
    who: "bryan",
    name: "bryan.k.smith",
    page: host,
    id: (await snapshot(host)).state.meId,
  };

  async function join(who: string, name: string): Promise<Person> {
    const res = await bryan.page.request.post(
      `/hockey/api/occasions/${night}/invites`,
      { data: { label: name } },
    );
    const { token: invitation } = await res.json();
    const page = await phone(browser);
    await page.goto(`/hockey/join/${invitation}`);
    await page.getByRole("link", { name: "Sign in to see it" }).click();
    await signUp(page, who);
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "I'm in" }).click();
    await expect(page).toHaveURL(new RegExp(`/hockey/${night}$`));
    return { who, name, page, id: (await snapshot(page)).state.meId };
  }
  casey = await join("casey", "Casey");
  drew = await join("drew", "Drew");

  const stranger = await phone(browser);
  await stranger.goto("/hockey");
  await signUp(stranger, "ivy");
  await expect(stranger.getByLabel("Opponent")).toBeVisible();
  ivy = {
    who: "ivy",
    name: "Ivy",
    page: stranger,
    id: await idOf("ivy"),
  };

  await declareTeam(casey, "Vancouver Canucks");
  await declareTeam(bryan, "Minnesota Wild");
  expect(
    (await snapshot(casey.page)).play.available,
    "mayhem-migration.sql applied",
  ).toBe(true);
});

test("the sheet: loading, an error that stays put, and a bet that lands once", async () => {
  test.setTimeout(240_000);
  const { page } = casey;
  const sheet = await openBet(casey);

  // Who, which question, which side: exactly what was reported.
  await sheet
    .getByRole("button", { name: /^\S*\s?bryan\.k\.smith$/ })
    .first()
    .click();
  await sheet.getByRole("button", { name: "First goal" }).click();
  const button = sheet.getByRole("button", { name: /Throw it at|Sending/ });
  // Not ready yet — and it says why instead of just being grey.
  await expect(button).toBeDisabled();
  await expect(sheet).toContainText("Pick your side to throw it.");
  await sheet.getByRole("button", { name: /VAN/ }).click();
  await expect(button).toBeEnabled();

  // Typed the way a thumb does, with a poll landing mid-word. The keyboard
  // must stay up: the sheet used to steal focus on every re-render.
  const taunt = sheet.getByLabel(/Trash talk/);
  await taunt.click();
  await taunt.pressSequentially("boo", { delay: 150 });
  await page.waitForTimeout(6000); // POLL_MS is 5 s
  await expect(taunt).toBeFocused();
  await taunt.pressSequentially("o", { delay: 150 });
  await expect(taunt).toHaveValue("booo");

  // A press that begins on the sheet and ends on the backdrop (the keyboard
  // dropping moves the sheet under a thumb) is not "close".
  const at = (await button.boundingBox())!;
  await page.mouse.move(at.x + 20, at.y + 10);
  await page.mouse.down();
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect(sheet).toBeVisible();

  // The connection drops. Refused, in the sheet, with the button back.
  let issued = 0;
  let mode: "drop" | "slow" = "drop";
  await page.route("**/hockey/api/occasions/*/actions", async (route) => {
    if (!isIssue(route.request().postDataJSON())) return route.continue();
    issued += 1;
    if (mode === "drop") return route.abort("connectionreset");
    await new Promise((r) => setTimeout(r, 1500));
    return route.continue();
  });
  await button.click();
  await expect(sheet.getByRole("alert")).toContainText(
    "Couldn't reach Passport",
  );
  await expect(sheet).toBeVisible();
  await expect(button).toBeEnabled();
  expect(await challengesOf(page)).toHaveLength(0);

  // Try again, slowly: a visible "Sending…", one request however hard it is
  // tapped, then the sheet goes and the page says what happened.
  mode = "slow";
  issued = 0;
  await button.click();
  await expect(button).toHaveText("Sending…");
  await expect(button).toBeDisabled();
  await button.click({ force: true, noWaitAfter: true }).catch(() => {});
  await expect(sheet).toBeHidden();
  expect(issued, "one request, however many taps").toBe(1);
  await expect(page.getByRole("status")).toContainText(
    "Thrown at bryan.k.smith",
  );
  await page.unroute("**/hockey/api/occasions/*/actions");

  // The sender's own card says where it stands.
  const mine = page.getByRole("article", {
    name: "The Bet: You → bryan.k.smith",
  });
  await expect(mine).toContainText(
    "Waiting on bryan.k.smith to accept or pass",
  );
  await expect(mine).toContainText("booo");
  const rows = await challengesOf(page);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: "bet",
    status: "open",
    challenger_id: casey.id,
    target_id: bryan.id,
    market: "first-goal",
    side: "home",
    taunt: "booo",
  });
});

test("the same bet again: refused inside the sheet, nothing duplicated", async () => {
  const { page } = casey;
  await page.reload();
  const sheet = await openBet(casey);
  await sheet
    .getByRole("button", { name: /^\S*\s?bryan\.k\.smith$/ })
    .first()
    .click();
  await sheet.getByRole("button", { name: "First goal" }).click();
  await sheet.getByRole("button", { name: /VAN/ }).click();
  await sheet.getByRole("button", { name: /Throw it at/ }).click();
  await expect(sheet.getByRole("alert")).toContainText(
    "You've already thrown that one at them.",
  );
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: /Throw it at/ }),
  ).toBeEnabled();
  expect(await challengesOf(page)).toHaveLength(1);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});

test("the recipient sees it without asking, and accepts; the sender sees accepted", async () => {
  // bryan has not reloaded or touched anything since the night began.
  // The Play badge counts unsealed picks too, so it is the card that proves it.
  await expect(
    bryan.page.getByRole("tab", { name: /^Play, \d+ waiting/ }),
  ).toBeVisible({ timeout: 20_000 });
  await openTab(bryan.page, "Play");
  const incoming = bryan.page.getByRole("article", {
    name: "The Bet: Casey → you",
  });
  await expect(incoming).toBeVisible();
  await expect(incoming).toContainText("booo");
  await expect(incoming).toContainText("Canucks");
  await incoming.getByRole("button", { name: "Bring it on" }).click();
  await expect(incoming).toContainText("You accepted");

  // casey, no reload: the poll brings it.
  const mine = casey.page.getByRole("article", {
    name: "The Bet: You → bryan.k.smith",
  });
  await expect(mine).toContainText("bryan.k.smith accepted", {
    timeout: 20_000,
  });
  await expect(mine).toContainText("Accepted");
  const [row] = await challengesOf(casey.page);
  expect(row.status).toBe("accepted");

  // A second accept is refused, not applied twice.
  const again = await refused(
    bryan.page,
    {
      type: "answerChallenge",
      challengeId: row.id,
      answer: "accept",
    },
    422,
  );
  expect(again.error).toMatch(/already answered/i);
});

test("the recipient can pass; the sender is told, nobody else is", async () => {
  // casey asks bryan about overtime; bryan passes.
  await ok(casey.page, {
    type: "issueChallenge",
    kind: "bet",
    targetId: bryan.id,
    market: "overtime",
    side: "yes",
    taunt: "go on then",
  });
  await openTab(bryan.page, "Play");
  const incoming = bryan.page.getByRole("article", {
    name: "The Bet: Casey → you",
  });
  const second = incoming.filter({ hasText: "go on then" });
  await expect(second).toBeVisible({ timeout: 20_000 });
  await second.getByRole("button", { name: "Pass quietly" }).click();
  await expect(second).toContainText("You passed. Nobody else was told.");

  await openTab(casey.page, "Play");
  const passed = casey.page
    .getByRole("article", { name: "The Bet: You → bryan.k.smith" })
    .filter({ hasText: "go on then" });
  await expect(passed).toContainText("bryan.k.smith passed", {
    timeout: 20_000,
  });
  await expect(passed).toContainText("Passed");

  // Drew was never told: the passed bet is not in his rows at all.
  const seen = (await challengesOf(drew.page)).map((c) => c.market);
  expect(seen).toEqual(["first-goal"]);
});

test("invalid and duplicate submissions are refused with a reason", async () => {
  const bet = (over: Record<string, unknown>) => ({
    type: "issueChallenge",
    kind: "bet",
    targetId: drew.id,
    market: "winner",
    side: "home",
    ...over,
  });
  const say = async (over: Record<string, unknown>, status: number) =>
    (await refused(casey.page, bet(over), status)).error ?? "";

  // The good one, then the same one again.
  await ok(casey.page, bet({}));
  expect(await say({}, 422)).toMatch(/already thrown/i);
  // …and the database's own unique index agrees when the app is bypassed.
  const direct = await rest("casey", "POST", "rpc/passport_issue_challenge", {
    p_occasion: night,
    p_kind: "bet",
    p_target: drew.id,
    p_market: "winner",
    p_side: "home",
    p_taunt: null,
    p_entry: null,
  });
  expect(direct.status).toBe(409);
  expect(
    (await challengesOf(casey.page)).filter((c) => c.target_id === drew.id),
  ).toHaveLength(1);

  expect(
    await say({ targetId: casey.id, market: "goals", side: "over" }, 422),
  ).toMatch(/cry for help/i);
  expect(await say({ market: "goals", side: "home" }, 422)).toMatch(
    /isn't a side/i,
  );
  expect(await say({ market: "overtime", side: undefined }, 422)).toMatch(
    /pick what you're betting on/i,
  );
  expect(await say({ market: undefined, side: "home" }, 422)).toMatch(
    /pick what you're betting on/i,
  );
  expect(
    await say(
      {
        targetId: "00000000-0000-4000-8000-000000000000",
        market: "goals",
        side: "over",
      },
      422,
    ),
  ).toMatch(/actually on this night/i);
  // A name is not an id.
  const named = await act(casey.page, bet({ targetId: "bryan.k.smith" }));
  expect(named.status()).toBe(400);
  // Somebody who exists but is not on the night.
  expect(
    await say({ targetId: ivy.id, market: "goals", side: "over" }, 422),
  ).toMatch(/actually on this night/i);
});

test("who may do what, and what the database says to anyone going around the app", async ({
  browser,
}) => {
  // Not signed in at all.
  const anon = await pwRequest.newContext({
    baseURL: `http://localhost:${process.env.E2E_PORT ?? 3130}`,
  });
  const nobody = await anon.post(`/hockey/api/occasions/${night}/actions`, {
    data: {
      type: "answerChallenge",
      challengeId: "00000000-0000-4000-8000-000000000000",
      answer: "accept",
    },
  });
  expect([401, 403]).toContain(nobody.status());

  // Signed in, not a member: the night does not exist for them.
  const stranger = await act(ivy.page, {
    type: "issueChallenge",
    kind: "bet",
    targetId: bryan.id,
    market: "winner",
    side: "home",
  });
  expect(stranger.status()).toBe(404);

  // Only the target answers; only the challenger withdraws.
  const [pending] = (await challengesOf(casey.page)).filter(
    (c) => c.status === "open" && c.target_id === drew.id,
  );
  expect(pending, "casey → drew is open").toBeTruthy();
  const wrongPerson = await refused(
    bryan.page,
    {
      type: "answerChallenge",
      challengeId: pending.id,
      answer: "accept",
    },
    403,
  );
  expect(wrongPerson.error).toMatch(/not yours/i);
  const ownAccept = await refused(
    casey.page,
    {
      type: "answerChallenge",
      challengeId: pending.id,
      answer: "accept",
    },
    403,
  );
  expect(ownAccept.error).toMatch(/not yours/i);
  const notChallenger = await refused(
    drew.page,
    {
      type: "answerChallenge",
      challengeId: pending.id,
      answer: "withdraw",
    },
    403,
  );
  expect(notChallenger.error).toMatch(/not yours/i);

  // Straight to the tables with a real member's JWT: reads are RLS'd,
  // writes are not granted at all.
  const insert = await rest("casey", "POST", "passport_occasion_challenges", {
    occasion_id: night,
    kind: "bet",
    challenger_id: casey.id,
    target_id: drew.id,
    market: "goals",
    side: "over",
  });
  expect([401, 403]).toContain(insert.status);
  const forge = await rest(
    "casey",
    "PATCH",
    `passport_occasion_challenges?id=eq.${pending.id}`,
    { status: "accepted" },
  );
  expect([401, 403]).toContain(forge.status);
  const forgeByTarget = await rest(
    "drew",
    "PATCH",
    `passport_occasion_challenges?id=eq.${pending.id}`,
    { status: "accepted" },
  );
  expect([401, 403]).toContain(forgeByTarget.status);
  const erase = await rest(
    "casey",
    "DELETE",
    `passport_occasion_challenges?id=eq.${pending.id}`,
  );
  expect([401, 403]).toContain(erase.status);
  expect(
    (await challengesOf(casey.page)).find((c) => c.id === pending.id)?.status,
  ).toBe("open");

  // The stranger reads nothing; the passed bet is readable by its two only.
  const strangerRead = await rest(
    "ivy",
    "GET",
    "passport_occasion_challenges?select=id",
  );
  expect(strangerRead.status).toBe(200);
  expect(strangerRead.json).toEqual([]);
  const ids = async (who: string) =>
    (
      (
        await rest(
          who,
          "GET",
          `passport_occasion_challenges?occasion_id=eq.${night}&select=market,status`,
        )
      ).json as {
        market: string;
        status: string;
      }[]
    ).map((r) => `${r.market}:${r.status}`);
  expect(await ids("casey")).toContain("overtime:declined");
  expect(await ids("bryan")).toContain("overtime:declined");
  expect(await ids("drew")).not.toContain("overtime:declined");

  // The functions are not callable without signing in, or from outside the night.
  const fn = (token: string | null, target: string) =>
    fetch(`${SUPABASE}/rest/v1/rpc/passport_issue_challenge`, {
      method: "POST",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${token ?? ANON}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_occasion: night,
        p_kind: "bet",
        p_target: target,
        p_market: "goals",
        p_side: "over",
        p_taunt: null,
        p_entry: null,
      }),
    });
  expect([401, 403]).toContain((await fn(null, drew.id)).status);
  const outsider = await rest("ivy", "POST", "rpc/passport_issue_challenge", {
    p_occasion: night,
    p_kind: "bet",
    p_target: drew.id,
    p_market: "goals",
    p_side: "over",
    p_taunt: null,
    p_entry: null,
  });
  expect([401, 403]).toContain(outsider.status);
  void browser;
});

test("puck drop closes bets, in the app and in the database", async () => {
  const [pending] = (await challengesOf(casey.page)).filter(
    (c) => c.status === "open" && c.target_id === drew.id,
  );
  await moveStart(new Date(Date.now() - 10 * 60_000), "bryan");
  const accept = await refused(
    drew.page,
    {
      type: "answerChallenge",
      challengeId: pending.id,
      answer: "accept",
    },
    422,
  );
  expect(accept.error).toMatch(/bets close at puck drop/i);
  const late = await refused(
    casey.page,
    {
      type: "issueChallenge",
      kind: "bet",
      targetId: bryan.id,
      market: "goals",
      side: "over",
    },
    422,
  );
  expect(late.error).toMatch(/bets close at puck drop/i);
  const direct = await rest("casey", "POST", "rpc/passport_issue_challenge", {
    p_occasion: night,
    p_kind: "bet",
    p_target: bryan.id,
    p_market: "goals",
    p_side: "over",
    p_taunt: null,
    p_entry: null,
  });
  expect(direct.status).toBe(400);
});
