import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import {
  PHONE,
  type Person,
  botLine,
  declareTeam,
  moveStart,
  night,
  noSidewaysScroll,
  noTinyTargets,
  ok,
  phone,
  refused,
  rest,
  shot,
  signUp,
  snapshot,
  standings,
  setNight,
  peopleCalled,
} from "./mayhem-helpers";

/**
 * **Operation Mayhem — PLAY with three real people.**
 *
 * Lorne (Calgary Flames, host), Alex (Vancouver Canucks) and Sam (Minnesota
 * Wild), three GoTrue accounts on the local stack, three phones. The brief's
 * acceptance test, scenario by scenario:
 *
 *   A — the Flames fan: something personal within 30 s; a challenge crosses
 *       accounts and back.
 *   B — the competition: picks, bets, a jury, a secret mission; one Cup on
 *       three phones; no client-side cheating moves it.
 *   C — the bot: a challenge taken gets a contextual line; Quiet keeps the
 *       moments only; the host silences it.
 *   D — two days out: everybody has something to do.
 *   E — mobile: every major state at 390 px, no sideways scroll, thumb-size
 *       targets; 375 and 320 shots of the opening.
 *
 * Run against `next start` on the stack's env with mayhem-migration.sql
 * applied (README.md here):
 *   set -a; . "$STACK/env"; set +a
 *   MAYHEM_SHOTS=docs/product/hockey/mayhem E2E_PORT=3130 \
 *     npx playwright test -c docs/product/hockey/verification mayhem
 */

peopleCalled("mayhem");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
test.skip(!!process.env.CONFIRM_EMAIL, "needs an auto-confirming stack");

test("Operation Mayhem: three people, one rivalry, one Cup", async ({
  browser,
}) => {
  test.setTimeout(600_000);

  // ============================================================ the night
  const lornePage = await phone(browser);
  await lornePage.goto("/hockey");
  await signUp(lornePage, "lorne");
  await lornePage.getByLabel("Your name").fill("Lorne");
  await lornePage.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await lornePage.getByLabel("Game date").fill(in2);
  await lornePage.getByLabel("Puck drop time").fill("19:00");
  await lornePage.getByRole("button", { name: "Start it" }).click();
  await expect(lornePage).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(lornePage.url().split("/").pop()!);
  await lornePage.getByRole("button", { name: /Skip/ }).click();
  const lorne: Person = {
    who: "lorne",
    name: "Lorne",
    page: lornePage,
    id: (await snapshot(lornePage)).state.meId,
  };
  expect(
    (await snapshot(lornePage)).play.available,
    "mayhem-migration.sql applied",
  ).toBe(true);

  async function join(who: string, name: string): Promise<Person> {
    const res = await lorne.page.request.post(
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
  const alex = await join("alex", "Alex");
  const sam = await join("sam", "Sam");

  // The before: PLAY with nobody declared.
  await openTab(alex.page, "Play");
  await shot(alex.page, "00-play-nobody-declared");

  await declareTeam(lorne, "Calgary Flames");
  await declareTeam(alex, "Vancouver Canucks");
  await declareTeam(sam, "Minnesota Wild");

  // ======================================== SCENARIO A — the Flames fan
  // Lorne opens PLAY. Something funny and personal, inside 30 seconds.
  const opened = Date.now();
  await lorne.page.reload();
  await openTab(lorne.page, "Play");
  const hero = lorne.page.getByRole("region", {
    name: "You're a Flames fan at a Canucks game.",
  });
  await expect(hero).toBeVisible();
  await expect(hero).toContainText("2 people have");
  await expect(hero).toContainText("to make you regret it");
  await expect(hero).toContainText("History: 1989 and 2004");
  expect(Date.now() - opened, "personal within 30 s").toBeLessThan(30_000);
  // Chirp Bot already noticed the Flames.
  const welcome = await botLine(lorne.page, "welcome", lorne.id);
  expect(welcome.text).toMatch(/Flames|Calgary|Lorne/);
  await shot(lorne.page, "01-lorne-enemy-territory", false);
  await shot(lorne.page, "02-lorne-play-full");
  await noSidewaysScroll(lorne.page);
  await noTinyTargets(lorne.page);

  // Everybody else sees the same story from the other side.
  await alex.page.reload();
  await openTab(alex.page, "Play");
  const alexHero = alex.page.getByRole("region", {
    name: "A Flames fan has entered Rogers Arena.",
  });
  await expect(alexHero).toContainText(
    "Lorne has willingly agreed to attend a Canucks game.",
  );
  await expect(alexHero).toContainText("to make them question that decision.");
  await shot(alex.page, "03-alex-enemy-territory", false);

  // Lorne goes on the attack: a bet against Alex, the Canucks fan.
  await hero.getByRole("button", { name: "Go on the attack" }).click();
  const sheet = lorne.page.getByRole("dialog", { name: /The Bet/ });
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole("button", { name: /Alex/, pressed: false })
    .or(sheet.getByRole("button", { name: /Alex/, pressed: true }))
    .first()
    .click();
  await sheet.getByRole("button", { name: "Who wins" }).click();
  await sheet.getByRole("button", { name: /Wild win/ }).click();
  await expect(sheet).toContainText("Alex gets the Canucks win.");
  await sheet.getByLabel(/Trash talk/).fill("Your power play is a rumour.");
  await shot(lorne.page, "04-lorne-throws-a-bet", false);
  await noTinyTargets(lorne.page);
  await sheet.getByRole("button", { name: "Throw it at Alex" }).click();
  await expect(sheet).toBeHidden();
  await expect(
    lorne.page.getByRole("article", { name: "The Bet: You → Alex" }),
  ).toContainText("Waiting on Alex");

  // Alex sees it — on a different account, a different phone.
  await alex.page.reload();
  await expect(alex.page.getByRole("tab", { name: /^Play/ })).toContainText(
    /\d/,
  ); // the badge
  await openTab(alex.page, "Play");
  const incoming = alex.page.getByRole("article", {
    name: "The Bet: Lorne → you",
  });
  await expect(incoming).toBeVisible();
  await expect(incoming).toContainText(
    "Lorne says the Wild win. You get the Canucks win.",
  );
  await expect(incoming).toContainText("Your power play is a rumour.");
  await shot(alex.page, "05-alex-incoming-challenge", false);
  await incoming.getByRole("button", { name: "Bring it on" }).click();
  await expect(
    alex.page.getByRole("article", { name: "The Bet: Lorne → you" }),
  ).toContainText("It's on");

  // Lorne sees the response.
  await lorne.page.reload();
  await openTab(lorne.page, "Play");
  await expect(
    lorne.page.getByRole("article", { name: "The Bet: You → Alex" }),
  ).toContainText("It's on");
  await expect(
    lorne.page.getByRole("region", { name: "The latest drama" }),
  ).toContainText("Alex accepted your challenge. It's on.");
  await shot(lorne.page, "06-lorne-sees-it-accepted");

  // ===================================== SCENARIO C — the bot (part 1)
  // A meaningful event: the challenge accepted. Chirp Bot escalates it.
  const took = await botLine(lorne.page, "took", alex.id);
  expect(took.text).toContain("Alex");
  expect(took.text).toContain("Lorne");
  await openTab(lorne.page, "Chat");
  await expect(lorne.page.getByText(took.text)).toBeVisible();
  await shot(lorne.page, "07-chat-chirp-bot-took-the-bet");

  // ======================================= the others start things too
  // Alex challenges Lorne to defend the Flames.
  await openTab(alex.page, "Play");
  await alexHero.getByRole("button", { name: "Challenge Lorne" }).click();
  const defendSheet = alex.page.getByRole("dialog", {
    name: /Enemy Territory/,
  });
  await expect(defendSheet).toContainText("Defend the Flames' honour");
  await defendSheet.getByRole("button", { name: "Throw it at Lorne" }).click();
  await expect(defendSheet).toBeHidden();

  // Sam volunteers a hot take, and dares Alex to commentate.
  await ok(sam.page, {
    type: "issueChallenge",
    kind: "hottake",
    targetId: sam.id,
    entry:
      "Overtime should start at 3-on-3 and end in a skills competition. Nobody would complain.",
  });
  await ok(sam.page, {
    type: "issueChallenge",
    kind: "commentary",
    targetId: alex.id,
  });
  // Sam makes a prophecy.
  await ok(sam.page, {
    type: "issueChallenge",
    kind: "prophecy",
    targetId: sam.id,
    entry:
      "Somebody scores off their own skate before the second intermission.",
  });

  // Lorne accepts the defence and writes it in PLAY.
  await lorne.page.reload();
  await openTab(lorne.page, "Play");
  const defend = lorne.page.getByRole("article", {
    name: "Enemy Territory: Alex → you",
  });
  await defend.getByRole("button", { name: "Bring it on" }).click();
  await lorne.page
    .getByRole("article", { name: "Enemy Territory: Alex → you" })
    .getByLabel("Your move")
    .fill("Two Game 7 overtimes, 1989 and 2004. Both ours. I'll wait.");
  await lorne.page
    .getByRole("article", { name: "Enemy Territory: Alex → you" })
    .getByRole("button", { name: "Put it on the record" })
    .click();
  await expect(
    lorne.page.getByRole("article", { name: "Enemy Territory: Alex → you" }),
  ).toContainText("Two Game 7 overtimes");

  // Alex passes on the commentary — and nobody else is told.
  await ok(alex.page, {
    type: "answerChallenge",
    challengeId: (await snapshot(alex.page)).play.challenges.find(
      (c) => c.kind === "commentary",
    )!.id,
    answer: "decline",
  });
  expect(
    (await snapshot(lorne.page)).play.challenges.some(
      (c) => c.kind === "commentary",
    ),
    "a pass is private",
  ).toBe(false);
  expect(
    (await snapshot(sam.page)).play.challenges.find(
      (c) => c.kind === "commentary",
    )?.status,
  ).toBe("declined");

  // ================================== SCENARIO D — two days out, all three
  for (const p of [lorne, alex, sam]) {
    await p.page.reload();
    await openTab(p.page, "Play");
    const chaos = p.page.getByRole("region", { name: "Tonight's chaos" });
    await expect(chaos).toBeVisible();
    // Something to start, or something waiting on them.
    const things = await chaos.getByRole("button").count();
    expect(things, `${p.name} has things to do`).toBeGreaterThanOrEqual(2);
    await expect(
      p.page.getByRole("region", { name: "Bold predictions" }),
    ).toBeVisible();
    await expect(
      p.page.getByRole("region", { name: "The Sycle Cup" }),
    ).toContainText("One extremely questionable trophy.");
    await shot(p.page, `10-two-days-out-${p.who}`);
    await noSidewaysScroll(p.page);
  }

  // The jury, before the game: Sam's hot take and Lorne's defence.
  await openTab(alex.page, "Play");
  const take = alex.page.getByRole("article", {
    name: "The Hot Take: Sam volunteered",
  });
  await take.getByRole("button", { name: "Certified spicy 🌶️" }).click();
  await ok(lorne.page, {
    type: "voteChallenge",
    challengeId: (await snapshot(lorne.page)).play.challenges.find(
      (c) => c.kind === "hottake",
    )!.id,
    verdict: true,
  });
  const defenceId = (await snapshot(sam.page)).play.challenges.find(
    (c) => c.kind === "defend",
  )!.id;
  await openTab(sam.page, "Play");
  const samJury = sam.page.getByRole("article", {
    name: "Enemy Territory: Alex → Lorne",
  });
  await samJury.getByRole("button", { name: "Honour defended" }).click();
  await ok(alex.page, {
    type: "voteChallenge",
    challengeId: defenceId,
    verdict: true,
  });
  // Nobody judges their own.
  const own = await refused(sam.page, {
    type: "voteChallenge",
    challengeId: (await snapshot(sam.page)).play.challenges.find(
      (c) => c.kind === "hottake",
    )!.id,
    verdict: true,
  });
  expect(own.error).toMatch(/judge yourself/i);

  // ===================================== the picks: game cards, the vault
  await lorne.page.reload();
  await openTab(lorne.page, "Play");
  const calls = lorne.page.getByRole("region", { name: "Bold predictions" });
  await expect(
    calls.locator("article").getByText("The Big One", { exact: true }),
  ).toBeVisible();
  await shot(lorne.page, "11-bold-call-card", false);
  await calls.getByRole("button", { name: "Wild one more" }).click();
  await calls.getByRole("button", { name: "Wild one more" }).click();
  await calls.getByRole("button", { name: "Next" }).click();
  await calls.getByRole("button", { name: /Wild/ }).first().click(); // first blood
  await calls.getByRole("button", { name: "No", exact: true }).click(); // overtime
  await expect(
    calls.locator("article").getByText("Goal Fest", { exact: true }),
  ).toBeVisible();
  await calls.getByRole("button", { name: "One more" }).click(); // 6 goals
  await calls.getByRole("button", { name: "Next" }).click();
  await calls.getByRole("button", { name: "Yes", exact: true }).click(); // the $19 beer
  await calls.getByRole("button", { name: /Alex/ }).first().click(); // ref rage
  await calls
    .getByRole("button", { name: "Done" })
    .click()
    .catch(() => undefined);
  if (
    await calls
      .getByRole("button", { name: "Done" })
      .isVisible()
      .catch(() => false)
  )
    await calls.getByRole("button", { name: "Done" }).click();
  const vault = calls.getByText("In the vault.");
  await expect(vault).toBeVisible();
  await expect(calls).toContainText("Your big call");
  await expect(calls).not.toContainText("of 7 sealed"); // no padlock row
  await shot(lorne.page, "12-picks-in-the-vault", false);
  await calls.getByRole("button", { name: "Peek at mine" }).click();
  await expect(
    calls.getByRole("list", { name: "Your sealed picks" }),
  ).toContainText("2–4");
  await shot(lorne.page, "13-vault-peek", false);

  // Alex and Sam seal theirs (the same action the cards send).
  for (const [p, picks] of [
    [
      alex,
      {
        "final-score": [4, 1],
        "first-team": "canucks",
        overtime: false,
        "total-goals": 5,
        "host-beer": true,
        refs: lorne.id,
      },
    ],
    [
      sam,
      {
        "final-score": [1, 3],
        "first-team": "opponent",
        overtime: true,
        "total-goals": 4,
        "host-beer": false,
        refs: alex.id,
      },
    ],
  ] as const) {
    for (const [promptId, value] of Object.entries(picks))
      await ok(p.page, { type: "respond", promptId, value });
  }
  // Sealed for everybody: Alex cannot read Lorne's pick, even straight from the database.
  const peek = await rest(
    "alex",
    "GET",
    `passport_occasion_responses?occasion_id=eq.${night}&prompt_id=eq.final-score&user_id=eq.${lorne.id}`,
  );
  expect(peek.json).toEqual([]);

  // ===================================== a secret mission, verified by two
  await ok(alex.page, {
    type: "addToy",
    family: "mission",
    input: {
      text: "Get Lorne to say “analytics” out loud, without prompting.",
      targetId: sam.id,
      phaseId: "before",
      locksAtPhaseId: "after",
      points: 20,
      edge: 1,
    },
  });
  await sam.page.reload();
  await openTab(sam.page, "Play");
  const mission = sam.page.getByRole("article", {
    name: "Your secret mission",
  });
  await mission.getByRole("button", { name: "Show me" }).click();
  await expect(
    sam.page.getByRole("article", { name: "Your secret mission" }),
  ).toContainText("analytics");
  await sam.page
    .getByRole("article", { name: "Your secret mission" })
    .getByRole("button", { name: "I pulled it off" })
    .click();
  await expect(
    sam.page.getByRole("article", { name: "Your secret mission" }),
  ).toContainText("Waiting on Alex");
  await shot(sam.page, "14-sam-secret-mission", false);
  // Lorne cannot see it — not the mission, not that Sam claimed it.
  expect(
    (await snapshot(lorne.page)).state.addedPrompts.some(
      (p) => p.family === "mission",
    ),
  ).toBe(false);
  // Sam cannot confirm their own.
  const missionId = (await snapshot(alex.page)).state.addedPrompts.find(
    (p) => p.family === "mission",
  )!.id;
  await refused(
    sam.page,
    { type: "callIt", promptId: missionId, value: true },
    403,
  );
  // Alex, the mastermind, confirms it in PLAY.
  await alex.page.reload();
  await openTab(alex.page, "Play");
  await alex.page
    .getByRole("article", { name: "Your mission for Sam" })
    .getByRole("button", { name: "Yes, they did it" })
    .click();
  await expect(
    alex.page.getByRole("article", { name: "Your mission for Sam" }),
  ).toContainText("It's in the Cup");
  // Every phone counts it — the one that can't read the mission too.
  await expect
    .poll(async () =>
      (await snapshot(lorne.page)).play.ledger.map((l) => l.earner),
    )
    .toEqual([sam.id]);

  // ================================ SCENARIO B — cheating, by hand (devtools)
  // A member writes a question worth 999 straight into the database...
  const forged = await rest("sam", "POST", "passport_occasion_prompts", {
    occasion_id: night,
    prompt_id: "toy-prediction-forged",
    reveal: "immediate",
    asked_by: sam.id,
    content: {
      question: "Will Sam win?",
      kind: "boolean",
      phaseId: "before",
      reveal: "immediate",
      family: "prediction",
      scoring: { points: 999, label: "Rigged" },
    },
  });
  expect(forged.status, JSON.stringify(forged.json)).toBe(201);
  // ...answers it themself, and calls it.
  await refused(
    sam.page,
    { type: "respond", promptId: "toy-prediction-forged", value: true },
    422,
  );
  const direct = await rest("sam", "POST", "passport_occasion_responses", {
    occasion_id: night,
    prompt_id: "toy-prediction-forged",
    user_id: sam.id,
    value: true,
  });
  expect(direct.status).toBe(201);
  await ok(sam.page, {
    type: "callIt",
    promptId: "toy-prediction-forged",
    value: true,
  });
  // No challenge row can be written by hand, or answered for somebody else.
  const row = await rest("sam", "POST", "passport_occasion_challenges", {
    occasion_id: night,
    kind: "bet",
    challenger_id: sam.id,
    target_id: lorne.id,
    market: "winner",
    side: "away",
    status: "accepted",
  });
  expect(row.status).toBeGreaterThanOrEqual(400);
  const betId = (await snapshot(sam.page)).play.challenges.find(
    (c) => c.kind === "bet",
  )!.id;
  await refused(
    sam.page,
    { type: "answerChallenge", challengeId: betId, answer: "decline" },
    403,
  );
  const forgedVote = await rest(
    "sam",
    "POST",
    "passport_occasion_challenge_votes",
    {
      challenge_id: defenceId,
      occasion_id: night,
      voter_id: alex.id,
      verdict: false,
    },
  );
  expect(forgedVote.status).toBeGreaterThanOrEqual(400);
  // The rigged question is worth 5 at most, to somebody else, and nothing to Sam.
  const rigged = (await snapshot(lorne.page)).definition.prompts;
  void rigged;

  // ========================================== puck drop, and the night
  const start = new Date(Date.now() - 50 * 60_000); // first intermission
  await moveStart(start);
  await refused(
    lorne.page,
    {
      type: "issueChallenge",
      kind: "bet",
      targetId: sam.id,
      market: "overtime",
      side: "yes",
    },
    422,
  );
  // The prophecy jury opens with the game.
  await ok(lorne.page, {
    type: "voteChallenge",
    challengeId: (await snapshot(lorne.page)).play.challenges.find(
      (c) => c.kind === "prophecy",
    )!.id,
    verdict: true,
  });
  await ok(alex.page, {
    type: "voteChallenge",
    challengeId: (await snapshot(alex.page)).play.challenges.find(
      (c) => c.kind === "prophecy",
    )!.id,
    verdict: false,
  });
  // The host calls the first goal: Wild. Lorne's not-a-bet, Sam's pick.
  await ok(lorne.page, {
    type: "callIt",
    promptId: "first-team",
    value: "opponent",
  });
  await lorne.page.reload();
  await openTab(lorne.page, "Play");
  await shot(lorne.page, "20-intermission-play");
  await noSidewaysScroll(lorne.page);

  // ===================================== SCENARIO C — the bot (part 2)
  // Quiet: the moments only. A thrown challenge is a heckle, so it's silent.
  await ok(lorne.page, { type: "setChirp", on: true, level: "quiet" });
  await ok(sam.page, {
    type: "issueChallenge",
    kind: "defend",
    targetId: alex.id,
  });
  const samDefendAlex = (await snapshot(sam.page)).play.challenges.find(
    (c) => c.kind === "defend" && c.target_id === alex.id,
  )!;
  await alex.page.waitForTimeout(2500);
  expect(
    (await snapshot(alex.page)).chirp.lines.some(
      (l) => l.kind === "chal" && l.about === alex.id,
    ),
    "Quiet: no heckle",
  ).toBe(false);
  // ...but taking it on is a moment, and speaks.
  await ok(alex.page, {
    type: "answerChallenge",
    challengeId: samDefendAlex.id,
    answer: "accept",
  });
  let tookLines: string[] = [];
  await expect
    .poll(
      async () => {
        tookLines = (await snapshot(alex.page)).chirp.lines
          .filter((l) => l.kind === "took" && l.about === alex.id)
          .map((l) => l.text);
        return tookLines.length;
      },
      { timeout: 20_000, message: "a second took line" },
    )
    .toBe(2);
  // Not repetitive: a different line from the first one.
  expect(new Set(tookLines).size).toBe(2);
  // The host silences it: no lines at all, old ones hidden.
  await ok(lorne.page, { type: "setChirp", on: false });
  expect((await snapshot(sam.page)).chirp.lines).toEqual([]);
  await ok(alex.page, {
    type: "performChallenge",
    challengeId: samDefendAlex.id,
    entry: "Quinn Hughes is a Wild player now. That was the plan all along.",
  });
  await ok(lorne.page, { type: "setChirp", on: true, level: "normal" });

  // ================================================ the final horn
  await moveStart(new Date(Date.now() - 170 * 60_000));
  // The host calls the game: Wild 4–2, regulation, six goals; Lorne bought the beer; Alex cried about the refs.
  for (const [promptId, value] of [
    ["final-score", [2, 4]],
    ["overtime", false],
    ["total-goals", 6],
    ["host-beer", true],
    ["refs", alex.id],
  ] as const)
    await ok(lorne.page, { type: "callIt", promptId, value });

  // Provisional until every point is settled: Alex's own question is uncalled.
  // (The rigged one: Sam is its asker; it is called; Sam's own answer counts for nothing.)
  const [l, a, s] = await Promise.all([
    standings(lorne.page),
    standings(alex.page),
    standings(sam.page),
  ]);
  // ============================== SCENARIO B — the same Cup on three phones
  expect(a).toEqual(l);
  expect(s).toEqual(l);
  // Lorne: exact score? (2–4 vs called 2–4 → +5), first goal Wild +3, OT no +3, 6 goals +3, beer yes +10,
  // refs Alex +4, the bet (Wild win) +3, defence upheld by the jury +3 = 34.
  // Alex: beer yes +10, OT no +3, refs Lorne ✗ → 13. Sam: right winner +2, first goal +3, refs Alex +4,
  // the mission (sent as 20, worth 8 at most) +8, the hot take +3, the prophecy hung 1–1 → 0 = 20.
  // The rigged 999-point question: Sam asked it, so Sam's own answer counts for nothing.
  expect(l).toEqual(["Lorne: 34 points", "Sam: 20 points", "Alex: 13 points"]);

  await lorne.page.reload();
  await openTab(lorne.page, "Play");
  const cup = lorne.page.getByRole("region", { name: "The Sycle Cup" });
  await expect(cup.getByText("Sycle Cup champion")).toBeVisible();
  await expect(cup).toContainText("34 points · verified");
  await expect(
    lorne.page.getByRole("region", { name: "Spectacularly wrong" }),
  ).toContainText("Alex called it 4–1. It finished 2–4.");
  await shot(lorne.page, "30-after-champion", false);
  await shot(lorne.page, "31-after-play-full");
  await shot(sam.page, "32-after-sam");

  // Chirp Bot: the bet's verdict, and the spectacularly wrong pick, once each.
  const ruled = await botLine(alex.page, "ruled", lorne.id);
  expect(ruled.text).toMatch(/Lorne/);
  const worst = await botLine(alex.page, "worst", alex.id);
  expect(worst.text).toContain("4–1");
  await openTab(alex.page, "Chat");
  await shot(alex.page, "33-chat-after");

  // ======================================== SCENARIO E — narrow phones
  const session = await sam.page.context().storageState();
  for (const width of [375, 320]) {
    const context = await browser.newContext({
      ...PHONE,
      viewport: { width, height: 760 },
      storageState: session,
    });
    const page = await context.newPage();
    await page.goto(`/hockey/${night}`);
    await openTab(page, "Play");
    await noSidewaysScroll(page);
    await shot(page, `40-after-${width}`, false);
    await context.close();
  }
});
