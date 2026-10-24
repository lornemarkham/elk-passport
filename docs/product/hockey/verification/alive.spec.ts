import { expect, test, type Browser, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Make the night come alive — one whole evening, four real people.**
 *
 * Lorne (Calgary Flames), Alex (Toronto Maple Leafs) and Danny (Vancouver
 * Canucks) are going; Priya is watching from the couch. Real GoTrue sign-ups,
 * real invitation links, PostgREST under RLS, phones at 390 px with touch.
 * The host moves the start time (with their own session, under RLS) to take
 * the same night from two days out through puck drop to the morning after.
 *
 * No model is reachable on the stack, so every Chirp Bot line is from its
 * library. Run once with no OPENAI_API_KEY (Chirp Bot's library) and once with
 * a key and OPENAI_BASE_URL pointing at a closed port (the model is down):
 * the night must be the same both times.
 *
 *   set -a; . "$STACK/env"; set +a     # needs alive-migration.sql (stack.mjs applies it)
 *   ATLAS_API_URL=http://127.0.0.1:54340 NHL_API_BASE=… next start -p 3130
 *   ALIVE_SHOTS=<dir> E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification alive
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-alive-${stamp}@example.test`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

interface Person {
  who: string;
  name: string;
  page: Page;
  id: string;
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function phone(browser: Browser) {
  const context = await browser.newContext(PHONE);
  return context.newPage();
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

/** PostgREST as `who`, with their own session — what devtools would allow. */
async function rest(who: string, method: string, path: string, body?: unknown) {
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
  state: {
    meId: string;
    addedPrompts: { id: string; family?: string }[];
    addedOptions: { promptId: string; option: { id: string; label: string } }[];
    responses: { promptId: string; participantId: string }[];
  };
  chirp: {
    fans: Record<string, string>;
    lines: { kind: string; text: string; about?: string }[];
  };
  crowd?: { available: boolean; where: Record<string, string> };
}

let night = "";

async function snapshot(page: Page): Promise<Snapshot> {
  const res = await page.request.get(`/hockey/api/occasions/${night}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as Snapshot;
}

async function act(page: Page, action: unknown) {
  return page.request.post(`/hockey/api/occasions/${night}/actions`, {
    data: action as never,
  });
}

async function ok(page: Page, action: unknown) {
  const res = await act(page, action);
  expect(res.ok(), `${JSON.stringify(action)} → ${await res.text()}`).toBe(
    true,
  );
}

/** Wait for Chirp Bot to have said a line of `kind` (it posts after the reply). */
async function botLine(page: Page, kind: string, about?: string) {
  let found: Snapshot["chirp"]["lines"][number] | undefined;
  await expect
    .poll(
      async () => {
        found = (await snapshot(page)).chirp.lines.find(
          (l) => l.kind === kind && (!about || l.about === about),
        );
        return Boolean(found);
      },
      { timeout: 20_000, message: `Chirp Bot ${kind} line` },
    )
    .toBe(true);
  return found!;
}

async function moveStart(startsAt: string) {
  const res = await rest(
    "lorne",
    "PATCH",
    `passport_occasions?id=eq.${night}`,
    {
      starts_at: startsAt,
    },
  );
  expect(res.status, JSON.stringify(res.json)).toBe(200);
}

async function shot(page: Page, name: string, full = false) {
  if (!process.env.ALIVE_SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${process.env.ALIVE_SHOTS}/${name}.png`,
    fullPage: full,
  });
}

async function noSidewaysScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(client);
}

/** Every visible button and link is a thumb-sized target. */
async function noTinyTargets(page: Page) {
  const tiny = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a, main summary")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== "hidden" &&
          r.height < 32
        );
      })
      .map((el) =>
        (el.textContent || el.getAttribute("aria-label") || "").trim(),
      )
      .slice(0, 5),
  );
  expect(tiny, `undersized targets: ${tiny.join(" | ")}`).toEqual([]);
}

async function declareTeam(p: Person, team: string) {
  await p.page.getByRole("button", { name: "Pick my team" }).click();
  const picker = p.page.getByRole("dialog", { name: /WHO DO YOU BLEED FOR/i });
  await picker.getByLabel("Find your team").fill(team.split(" ").pop()!);
  await picker.getByRole("radio", { name: team, exact: true }).click();
  // The moment: the team's colours, the crest, "It's official".
  const moment = p.page.getByRole("dialog", {
    name: `${p.name} bleeds for the ${team}`,
  });
  await expect(moment).toBeVisible();
  await expect(moment).toContainText("It's official");
}

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });

test("one whole hockey night: invite, identity, game plan, picks, Chirp Bot, the Cup, the morning after", async ({
  browser,
}) => {
  test.setTimeout(480_000);

  // ============================================================ INVITATION
  const lornePage = await phone(browser);
  await lornePage.goto("/hockey");
  await signUp(lornePage, "lorne");
  await lornePage.getByLabel("Your name").fill("Lorne");
  await lornePage.getByLabel("Opponent").fill("Wild");
  // Two days from now on Vancouver's calendar (a UTC date is a day ahead
  // every evening, which put the game outside Chirp Bot's 72-hour window).
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await lornePage.getByLabel("Game date").fill(in2);
  await lornePage.getByLabel("Puck drop time").fill("19:00");
  await lornePage.getByRole("button", { name: "Start it" }).click();
  await expect(lornePage).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  night = lornePage.url().split("/").pop()!;
  await lornePage.getByRole("button", { name: /Skip/ }).click();
  const lorne: Person = {
    who: "lorne",
    name: "Lorne",
    page: lornePage,
    id: (await snapshot(lornePage)).state.meId,
  };

  // The welcome, not a setup screen: the game, and the two questions.
  const welcome = lorne.page.getByRole("region", { name: /game night/ });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("Wild at Canucks");
  await shot(lorne.page, "01-host-welcome");

  // ============================================== WHO DO YOU BLEED FOR? (host)
  await declareTeam(lorne, "Calgary Flames");
  await shot(lorne.page, "02-host-team-moment");
  await lorne.page.getByRole("button", { name: "Let's go" }).click();
  await welcome
    .getByRole("button", { name: "At the arena", exact: true })
    .click();
  // Both answered: the welcome has done its job.
  await expect(welcome).toBeHidden();
  const flames = await botLine(lorne.page, "welcome", lorne.id);
  expect(flames.text).toMatch(/Flames|Calgary|Lorne/);

  // ------------------------------------------- the coworkers join by link
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
  const danny = await join("danny", "Danny");
  const priya = await join("priya", "Priya");

  // A guest's first look: who's going, the game, when and where.
  const alexWelcome = alex.page.getByRole("region", { name: /game night/ });
  await expect(alexWelcome).toContainText("Lorne");
  await expect(alexWelcome).toContainText("Rogers Arena");
  await shot(alex.page, "03-guest-welcome");

  await declareTeam(alex, "Toronto Maple Leafs");
  await shot(alex.page, "04-alex-leafs-moment");
  await alex.page.getByRole("button", { name: "Let's go" }).click();
  await alexWelcome
    .getByRole("button", { name: "At the arena", exact: true })
    .click();

  await declareTeam(danny, "Vancouver Canucks");
  await danny.page.getByRole("button", { name: "Let's go" }).click();
  await danny.page
    .getByRole("region", { name: /game night/ })
    .getByRole("button", { name: "At the arena", exact: true })
    .click();

  // ------------------------------------------------- the peanut gallery
  await declareTeam(priya, "Edmonton Oilers");
  await priya.page.getByRole("button", { name: "Let's go" }).click();
  await priya.page
    .getByRole("region", { name: /game night/ })
    .getByRole("button", { name: "From the couch", exact: true })
    .click();
  await botLine(priya.page, "couch", priya.id);
  const leafs = await botLine(alex.page, "welcome", alex.id);
  expect(leafs.text.length).toBeGreaterThan(10);

  // Identity persists: a fresh load, everybody's team and where they watch.
  await alex.page.reload();
  await openTab(alex.page, "Group");
  const roster = alex.page.getByRole("region", { name: "Who's in" });
  await expect(roster).toContainText("Calgary Flames");
  await expect(roster).toContainText("Toronto Maple Leafs");
  await expect(roster).toContainText("Vancouver Canucks");
  await expect(roster).toContainText("From the couch");
  await expect(roster).toContainText(/3 at the arena, 1 in the peanut gallery/);
  await expect(
    alex.page.locator('[title="Lorne · Calgary Flames"]').first(),
  ).toBeVisible();
  await shot(alex.page, "05-roster-identity", true);
  // The database agrees, and nobody can change anybody else's.
  const forged = await rest(
    "alex",
    "PATCH",
    `passport_occasion_members?occasion_id=eq.${night}&user_id=eq.${lorne.id}`,
    { watching: "couch", nhl_team: "TOR" },
  );
  expect(forged.json).toEqual([]);
  expect((await snapshot(lorne.page)).crowd?.where[lorne.id]).toBe("arena");
  // Only 'arena' or 'couch', even on your own row.
  const skybox = await rest(
    "alex",
    "PATCH",
    `passport_occasion_members?occasion_id=eq.${night}&user_id=eq.${alex.id}`,
    { watching: "skybox" },
  );
  expect(skybox.status).toBe(400);
  // Nobody can post Chirp Bot's line about somebody else's couch first.
  const squat = await rest("alex", "POST", "passport_occasion_moments", {
    occasion_id: night,
    actor_id: alex.id,
    kind: "chirp",
    bot_key: `couch:${lorne.id}`,
    bot_line: "cw.1",
  });
  expect(squat.status).toBe(400);

  // =================================================== THE GAME PLAN
  await lorne.page.reload();
  await openTab(lorne.page, "Plan");
  const plan = lorne.page.getByRole("region", { name: "Our game plan" });
  await expect(plan).toBeVisible();
  for (const stop of ["Pregame", "Meet up", "Game time", "After"])
    await expect(
      lorne.page.getByRole("region", { name: stop, exact: true }),
    ).toBeVisible();
  // The pregame is the main event (three venue cards on the page), so the
  // plan is longer than the old accordion — but not a corridor of forms.
  const planHeight = await lorne.page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  expect(planHeight).toBeLessThan(6500);
  await noSidewaysScroll(lorne.page);
  await noTinyTargets(lorne.page);
  await shot(lorne.page, "10-game-plan-compact", true);

  // ------------------------------------- Explore: Passport's venue cards
  const pregame = lorne.page.getByRole("region", {
    name: "Pregame",
    exact: true,
  });
  await pregame.getByRole("button", { name: /^Find one in Passport/ }).click();
  const explore = lorne.page.getByRole("dialog", { name: /Near Rogers Arena/ });
  await expect(explore).toBeVisible();
  const addFirst = explore
    .getByRole("button", { name: /^Add .+ and vote$/ })
    .first();
  await expect(addFirst).toBeVisible({ timeout: 30_000 });
  // Photographs, not a list of names.
  await expect(explore.locator("img").first()).toBeVisible();
  await shot(lorne.page, "11-explore-venue-cards");
  const lornePlace = (await addFirst.getAttribute("aria-label"))!
    .replace(/^Add /, "")
    .replace(/ and vote$/, "");
  await addFirst.click();
  // It moves up to "On the vote", as its full card, with Lorne's vote on it.
  await expect(
    explore
      .getByRole("region", { name: "On the vote" })
      .getByRole("button", { name: `Vote for ${lornePlace}` }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await shot(lorne.page, "11b-explore-on-the-vote");
  await explore.getByRole("button", { name: "Close explore" }).click();
  await expect(explore).toBeHidden();

  // ---------------------------- one vote: places, the concourse, typed names
  const alexPregame = alex.page.getByRole("region", {
    name: "Pregame",
    exact: true,
  });
  await openTab(alex.page, "Plan");
  const ballot = alexPregame;
  await expect(
    ballot.getByRole("button", { name: `Vote for ${lornePlace}` }),
  ).toBeVisible();
  await expect(
    ballot.getByRole("button", { name: /Vote for .*concourse/i }),
  ).toBeVisible();
  // Alex adds a place of his own straight from the cards on the page.
  const bet = alexPregame
    .getByRole("button", { name: /^Add .+ and vote$/ })
    .first();
  const alexPlace = (await bet.getAttribute("aria-label"))!
    .replace(/^Add /, "")
    .replace(/ and vote$/, "");
  await bet.click();
  await expect(
    ballot.getByRole("button", { name: `Vote for ${alexPlace}` }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await noTinyTargets(alex.page);
  await shot(alex.page, "12-pregame-one-vote", true);

  // Danny backs Lorne's, says something, then jumps ship to Alex's.
  await openTab(danny.page, "Plan");
  const dannyPregame = danny.page.getByRole("region", {
    name: "Pregame",
    exact: true,
  });
  await dannyPregame
    .getByRole("button", { name: `Vote for ${lornePlace}` })
    .click();
  await expect(
    dannyPregame.getByRole("button", { name: `Vote for ${lornePlace}` }),
  ).toHaveAttribute("aria-pressed", "true");
  await ok(danny.page, {
    type: "say",
    text: "Whoever picked the concourse is fired",
  });
  // Typed names count the same.
  await dannyPregame
    .getByLabel("Somewhere else? Type a name")
    .fill("Danny's basement");
  await dannyPregame.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    dannyPregame.getByRole("button", { name: "Vote for Danny's basement" }),
  ).toBeVisible();
  await dannyPregame
    .getByRole("button", { name: `Vote for ${alexPlace}` })
    .click();
  const jump = await botLine(danny.page, "switch", danny.id);
  expect(jump.text).toContain(lornePlace);
  expect(jump.text).toContain(alexPlace);

  // -------------------------------------------- meet up, asked in one place
  await lorne.page.reload();
  await openTab(lorne.page, "Plan");
  const meet = lorne.page.getByRole("region", { name: "Meet up", exact: true });
  // Nobody is voting on a meeting spot: the pregame is where we meet.
  await expect(meet).toContainText(/pregame/i);
  await meet
    .getByRole("button", { name: /Directions & host controls/ })
    .click();
  await meet
    .getByRole("button", { name: "Override the meeting point" })
    .click();
  const override = lorne.page.getByRole("form", {
    name: "Override the meeting point",
  });
  await override
    .getByLabel("Where exactly (optional)", { exact: true })
    .fill("Under the Bobby Lou statue");
  await override.getByLabel("Time", { exact: true }).fill("18:30");
  await override.getByRole("button", { name: "Make it official" }).click();
  await expect(meet).toContainText("The host's call");
  await expect(meet).toContainText("Under the Bobby Lou statue");
  await expect(meet).toContainText("6:30");
  await shot(lorne.page, "13-meet-up-official");

  // Alex sees one meeting point, and directions only when asked.
  await alex.page.reload();
  await openTab(alex.page, "Plan");
  await expect(
    alex.page.getByRole("region", { name: "Meet up", exact: true }),
  ).toContainText("Under the Bobby Lou statue");
  const game = alex.page.getByRole("region", {
    name: "Game time",
    exact: true,
  });
  await expect(game.getByRole("link", { name: /Google Maps/ })).toHaveCount(0);
  await game.getByRole("button", { name: "Seats & directions" }).click();
  await expect(
    game.getByRole("link", { name: /Walking directions|Google Maps/ }).first(),
  ).toBeVisible();
  await shot(alex.page, "14-directions-on-demand", true);

  // Priya on the couch: no meetup, no seats, no Arena Mode — the rest is hers.
  await priya.page.reload();
  await openTab(priya.page, "Plan");
  await expect(
    priya.page.getByRole("region", { name: "Meet up", exact: true }),
  ).toHaveCount(0);
  await expect(
    priya.page.getByRole("region", { name: "Game time", exact: true }),
  ).toContainText("From the couch");
  await expect(priya.page.getByRole("link", { name: /Arena/ })).toHaveCount(0);
  await shot(priya.page, "15-couch-plan");

  // ============================================================ PREDICTIONS
  // Danny goes first and goes big. Sealed until puck drop, for everybody:
  // sealing your own opens nobody else's (night-migration.sql + the server).
  await ok(danny.page, {
    type: "respond",
    promptId: "final-score",
    value: [7, 1],
  });
  const peek = await rest(
    "alex",
    "GET",
    `passport_occasion_responses?occasion_id=eq.${night}&prompt_id=eq.final-score&user_id=eq.${danny.id}`,
  );
  expect(peek.json).toEqual([]);
  const picks: [Person, [number, number]][] = [
    [lorne, [3, 2]],
    [alex, [2, 4]],
    [priya, [4, 3]],
  ];
  for (const [p, score] of picks)
    await ok(p.page, {
      type: "respond",
      promptId: "final-score",
      value: score,
    });
  // Alex has sealed his own now — and still cannot read Danny's, from the
  // database or from anything the server sends the page.
  const stillSealed = await rest(
    "alex",
    "GET",
    `passport_occasion_responses?occasion_id=eq.${night}&prompt_id=eq.final-score&select=user_id`,
  );
  // NIGHT_OFF=1: a database without night-migration.sql still leaks at
  // PostgREST — that is what the migration is for — but the server must not.
  if (process.env.NIGHT_OFF) expect(stillSealed.json).toHaveLength(4);
  else expect(stillSealed.json).toEqual([{ user_id: alex.id }]);
  const alexSees = (await snapshot(alex.page)).state.responses.filter(
    (r) => r.promptId === "final-score",
  );
  expect(alexSees.map((r) => r.participantId)).toEqual([alex.id]);
  for (const p of [priya, danny, lorne])
    await ok(p.page, {
      type: "respond",
      promptId: "first-team",
      value: "canucks",
    });
  await openTab(priya.page, "Play");
  await expect(
    priya.page.getByRole("region", { name: "Bold predictions" }),
  ).toBeVisible();
  await priya.page.getByText("How to win the Cup").click();
  await shot(priya.page, "20-couch-picks-and-how-to-win", true);

  // A secret mission for Alex, from the host.
  await ok(lorne.page, {
    type: "addToy",
    family: "mission",
    input: {
      text: "Get Danny to say 'analytics' out loud before the second.",
      targetId: alex.id,
      phaseId: "before",
      points: 3,
      edge: 1,
    },
  });
  const mission = (await snapshot(alex.page)).state.addedPrompts.find(
    (p) => p.family === "mission",
  )!;
  await ok(alex.page, { type: "consent", promptId: mission.id, agreed: true });

  // ============================================================ PUCK DROP
  await moveStart(new Date(Date.now() - 5 * 60_000).toISOString());
  // Picks are locked now — by the server, not just the page.
  const late = await act(danny.page, {
    type: "respond",
    promptId: "final-score",
    value: [1, 0],
  });
  expect(late.status()).toBe(422);
  // Chirp Bot reads out the boldest call: Danny's 7–1.
  const sealed = await botLine(lorne.page, "picks");
  expect(sealed.text).toContain("Danny");
  expect(sealed.text).toContain("7–1");
  await danny.page.goto(`/hockey/${night}`);
  await shot(danny.page, "30-game-time-danny");

  // Chat keeps working whatever the model is doing.
  await ok(priya.page, { type: "say", text: "Couch report: snacks secured." });
  // On the couch, a period opens on the chat: that's where the game is.
  await priya.page.goto(`/hockey/${night}`);
  await expect(
    priya.page.getByText("Couch report: snacks secured."),
  ).toBeVisible();
  await shot(priya.page, "31-couch-chat-during-period");
  // At the arena it's "phones away" — with the chat one tap off, at a whistle.
  await danny.page.reload();
  await expect(danny.page.getByText("Put your phone away")).toBeVisible();
  await danny.page
    .getByRole("button", { name: /At a whistle\? Open the chat/ })
    .click();
  await expect(
    danny.page.getByText("Couch report: snacks secured."),
  ).toBeVisible();
  await expect(
    danny.page.locator('[data-chirp-bot="picks"]').first(),
  ).toBeVisible();
  await shot(danny.page, "32-arena-peek-at-chat");
  // One tap and the phone is away again.
  await danny.page
    .getByRole("button", { name: /Phones away — back to the game/ })
    .click();
  await expect(danny.page.getByText("Put your phone away")).toBeVisible();

  // Alex pulls off his secret mission during the game: Chirp Bot notices,
  // and never says what it was.
  await ok(alex.page, { type: "respond", promptId: mission.id, value: true });
  const won = await botLine(lorne.page, "mission", alex.id);
  expect(won.text).toContain("Alex");
  expect(won.text).not.toContain("analytics");
  // The host calls it, and the Cup has a leader mid-game: a lead change.
  await ok(lorne.page, { type: "callIt", promptId: mission.id, value: true });
  // (Alex's own view: a secret mission's answer is his until it locks, so
  // the standings that count it are his — missions are viewer-dependent.)
  const lead = await botLine(alex.page, "lead", alex.id);
  expect(lead.text).toContain("Alex");
  expect(lead.text).toMatch(/\d+ points/);

  // ========================================================= AFTER THE GAME
  await moveStart(new Date(Date.now() - 3.5 * 3600_000).toISOString());
  await act(alex.page, { type: "cue", promptId: mission.id });
  await ok(lorne.page, {
    type: "callIt",
    promptId: "final-score",
    value: [3, 2],
  });
  await ok(lorne.page, {
    type: "callIt",
    promptId: "first-team",
    value: "canucks",
  });
  // Lorne called the exact score: the Cup is his, and Chirp Bot says so.
  const verdict = await botLine(danny.page, "final");
  expect(verdict.text).toContain("Lorne");

  await lorne.page.goto(`/hockey/${night}`);
  await openTab(lorne.page, "Play");
  const champion = lorne.page.getByRole("region", {
    name: "Lorne",
  });
  await expect(
    lorne.page.getByText("Sycle Cup champion", { exact: true }),
  ).toBeVisible();
  await expect(champion).toContainText("points");
  await noSidewaysScroll(lorne.page);
  await shot(lorne.page, "40-after-champion");
  await shot(lorne.page, "41-after-play-full", true);
  await openTab(alex.page, "Plan");
  await alex.page.goto(`/hockey/${night}`);
  await openTab(alex.page, "Plan");
  await expect(
    alex.page.getByRole("region", { name: "What's next", exact: true }),
  ).toBeVisible();
  await shot(alex.page, "42-after-whats-next");
  await priya.page.goto(`/hockey/${night}#chat`);
  await expect(
    priya.page.locator('[data-chirp-bot="final"]').first(),
  ).toBeVisible();
  await shot(priya.page, "43-chat-final-verdict", true);

  // ========================================================= THE NEXT DAY
  await moveStart(new Date(Date.now() - 16 * 3600_000).toISOString());
  await danny.page.goto(`/hockey/${night}`);
  await openTab(danny.page, "Plan");
  await expect(
    danny.page.getByRole("region", { name: "Run it back" }),
  ).toBeVisible();
  await expect(
    danny.page.getByRole("region", { name: "How the night went" }),
  ).toBeVisible();
  await shot(danny.page, "50-morning-run-it-back", true);
  await openTab(danny.page, "Play");
  await shot(danny.page, "51-morning-recap", true);
});
