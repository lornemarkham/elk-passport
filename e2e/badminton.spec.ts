import {
  expect,
  request as pwRequest,
  test,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";
import { localDate } from "../src/lib/courtqueue/clock";

/**
 * CourtQueue end to end, several phones at once, on the memory store. Run
 * against a fresh server started with `COURTQUEUE_STORE=memory` and
 * `COURTQUEUE_CLOCK` set to a club night after 8:00 am (sign-up is only
 * possible on the day), e.g. `2026-11-12T18:45:00-07:00`. The organizer code
 * is "organizer" unless COURTQUEUE_ORGANIZER_CODE says otherwise. One serial
 * story, because it is one night.
 */

const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const RUN = Math.random().toString(36).slice(2, 6);
let TODAY = "";

test.describe.configure({ mode: "serial" });

async function player(
  baseURL: string,
  name: string,
): Promise<APIRequestContext> {
  const api = await pwRequest.newContext({ baseURL });
  const r = await api.post("/api/badminton/me", {
    data: { action: "register", name, pin: "4321" },
  });
  if (r.status() === 503) test.skip(true, "CourtQueue store not configured");
  expect(r.ok(), `register ${name}: ${await r.text()}`).toBe(true);
  return api;
}

async function act(
  api: APIRequestContext,
  cmd: object,
  sessionId = TODAY,
  scope = "session",
) {
  const r = await api.post("/api/badminton/act", {
    data: { scope, sessionId, cmd },
  });
  return { ok: r.ok(), body: await r.json() };
}

async function must(api: APIRequestContext, cmd: object) {
  const out = await act(api, cmd);
  expect(out.ok, `${JSON.stringify(cmd)}: ${out.body.error}`).toBe(true);
  return out.body.view;
}

const live = async (api: APIRequestContext) =>
  (await api.get("/api/badminton/live")).json();

async function phone(browser: Browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  return { ctx, page: await ctx.newPage() };
}

let org: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  org = await player(baseURL!, `Org ${RUN}`);
  TODAY = localDate((await live(org)).now);
  const claim = await org.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok(), await claim.text()).toBe(true);
  const made = await org.post("/api/badminton/act", {
    data: { scope: "sessions", dates: [TODAY] },
  });
  expect(made.ok(), await made.text()).toBe(true);
});

test("one phone, every stage: REGISTERED → READY → WAITING → YOU'RE UP → PLAYING → FINISHED", async ({
  browser,
  baseURL,
}) => {
  const a = await phone(browser);
  await a.page.goto("/badminton");
  await expect(
    a.page.getByRole("heading", { name: "CourtQueue" }),
  ).toBeVisible();
  await a.page.getByRole("button", { name: "I'm new" }).click();
  await a.page.getByLabel("Your name").fill(`Ana ${RUN}`);
  await a.page.getByLabel(/Choose a PIN/).fill("2468");
  // Joining asks for a name and a PIN only; the optional journey question
  // comes after, on Home.
  await expect(
    a.page.getByText(/Beginner|Intermediate|Advanced|rate yourself/),
  ).toHaveCount(0);
  await expect(
    a.page.getByText(
      "Everyone is welcome. Come play, meet people, and have fun!",
    ),
  ).toBeVisible();
  await a.page.getByRole("button", { name: "Join CourtQueue" }).click();
  const phase = a.page.getByTestId("phase");

  // "Where are you in your badminton journey?" — optional, one tap, asked once.
  await expect(
    a.page.getByText("Where are you in your badminton journey?"),
  ).toBeVisible();
  await a.page.getByRole("button", { name: /^Beginner/ }).click();
  await expect(
    a.page.getByText("Where are you in your badminton journey?"),
  ).toHaveCount(0);

  await expect(phase).toHaveText("NOT SIGNED UP");
  await expect(
    a.page.getByText("Coldstream Elementary School Gym"),
  ).toBeVisible();
  await a.page.getByRole("button", { name: "SIGN ME UP" }).click();
  await expect(phase).toHaveText("REGISTERED");
  // Playing mood — optional, friendly, changeable.
  await expect(
    a.page.getByText("What's your playing mood tonight?"),
  ).toBeVisible();
  await a.page.getByLabel(/Find My Rhythm/).click();
  await expect(a.page.getByLabel(/Find My Rhythm/)).toBeChecked();
  await a.page.getByLabel(/Challenge Me/).click();
  await expect(a.page.getByLabel(/Challenge Me/)).toBeChecked();
  await expect(a.page.getByLabel(/Happy to Help/)).toBeVisible();
  // Level and mood are private: the Me card has no level tag.
  await a.page.getByRole("button", { name: "I'M HERE" }).click();
  await expect(phase).toHaveText("READY TO PLAY");
  await a.page.getByRole("button", { name: "JOIN THE QUEUE" }).click();
  await expect(phase).toHaveText("WAITING");
  await expect(a.page.getByText("#1", { exact: true })).toBeVisible();

  // Three friends sign up and join the queue on their own phones.
  const others = [];
  for (const n of ["Bo", "Cy", "Di"]) {
    const p = await player(baseURL!, `${n} ${RUN}`);
    await must(p, { type: "register" });
    await must(p, { type: "check-in" });
    others.push(p);
  }
  await Promise.all(others.map((p) => must(p, { type: "play" })));

  // Phone A is called without touching anything: the whole screen says so.
  const takeover = a.page.getByRole("alertdialog");
  await expect(takeover).toBeVisible({ timeout: 8_000 });
  await expect(takeover.getByText(/^COURT \d$/)).toBeVisible();
  await expect(takeover.getByText("YOU'RE UP!")).toBeVisible();
  await expect(
    takeover.getByText("Everyone's first game tonight"),
  ).toBeVisible();
  const court = Number(
    (await takeover.getByText(/^COURT \d$/).textContent())!.slice(-1),
  );

  // Someone who isn't one of the four cannot start it.
  const ed = await player(baseURL!, `Ed ${RUN}`);
  await must(ed, { type: "register" });
  await must(ed, { type: "check-in" });
  const gameId = (await live(others[0]!)).night.me.game.id;
  const outsider = await act(ed, { type: "start", gameId });
  expect(outsider.ok).toBe(false);
  expect(outsider.body.error).toMatch(/Only the four/);

  // A spectator phone sees the same court, called.
  const e = await phone(browser);
  await e.ctx.addCookies((await ed.storageState()).cookies);
  await e.page.goto("/badminton");
  await expect(e.page.getByTestId(`court-${court}`)).toHaveAttribute(
    "data-status",
    "called",
  );

  await takeover.getByRole("button", { name: "START GAME" }).click();
  await expect(phase).toHaveText("PLAYING");
  await expect(takeover).toBeHidden();
  await expect(e.page.getByTestId(`court-${court}`)).toHaveAttribute(
    "data-status",
    "playing",
    { timeout: 8_000 },
  );
  await expect(e.page.getByTestId(`court-${court}`)).toContainText("Ana");

  // Phone A loses signal for a moment — and comes back.
  await a.ctx.setOffline(true);
  await expect(a.page.getByText("Reconnecting…")).toBeVisible({
    timeout: 15_000,
  });
  await a.ctx.setOffline(false);
  await expect(a.page.getByText("Reconnecting…")).toBeHidden({
    timeout: 10_000,
  });

  // FINISH: there is no score to enter, and the court is free at once.
  await a.page.getByRole("button", { name: "FINISH GAME" }).click();
  await expect(a.page.getByLabel(/Score/)).toHaveCount(0);
  await a.page
    .getByRole("dialog", { name: "Finish game" })
    .getByRole("button", { name: "Finish game" })
    .click();
  await expect(phase).toHaveText("FINISHED");
  await expect(a.page.getByText(/thanks for playing/i)).toBeVisible();
  await expect(e.page.getByTestId(`court-${court}`)).not.toHaveAttribute(
    "data-status",
    "playing",
    { timeout: 8_000 },
  );
  // Nobody was put back in line by themselves.
  const after = await live(org);
  expect(after.night.queue).toHaveLength(0);

  // No scores, winners or levels anywhere on the player's phone.
  const played = (await live(others[0]!)).night.me.played[0];
  expect(played.startedAt).toBeLessThan(played.finishedAt);
  expect(JSON.stringify(await live(others[0]!))).not.toMatch(
    /skill|"score"|"winner"/i,
  );
  await expect(
    a.page.getByText(/Beginner|Intermediate|Expert|Advanced|won–lost/),
  ).toHaveCount(0);

  // BACK IN THE QUEUE, only when tapped.
  await a.page.getByRole("button", { name: "BACK IN THE QUEUE" }).click();
  await expect(phase).toHaveText("WAITING");

  // The organizer's phone sees the night and the game's times.
  const o = await phone(browser);
  await o.ctx.addCookies((await org.storageState()).cookies);
  await o.page.goto("/badminton");
  await o.page.getByRole("button", { name: "Organize" }).click();
  await expect(
    o.page.getByRole("heading", { name: "Organizer" }),
  ).toBeVisible();
  await expect(o.page.getByText(`Ana ${RUN}`).first()).toBeVisible();

  await Promise.all([a.ctx.close(), e.ctx.close(), o.ctx.close()]);
});

test("the season schedule, cancelled nights, and no sign-up for another day", async ({
  browser,
}) => {
  const o = await phone(browser);
  await o.ctx.addCookies((await org.storageState()).cookies);
  await o.page.goto("/badminton");
  await o.page.getByRole("button", { name: "Schedule" }).click();
  await expect(
    o.page.getByRole("heading", { name: "Vernon Badminton Club" }),
  ).toBeVisible();
  await expect(
    o.page.getByText("October 5, 2026 – April 15, 2027"),
  ).toBeVisible();
  await expect(o.page.getByText("7:00–9:00 pm")).toBeVisible();
  await expect(o.page.getByText("6:30–8:30 pm")).toBeVisible();
  // The organizer marks a crossed-out date.
  await o.page.getByRole("button", { name: /^Monday Dec 21/ }).click();
  await o.page.getByLabel("Why (shown to players)").fill("Winter break");
  await o.page.getByRole("button", { name: "Cancel this night" }).click();
  await expect(
    o.page.getByLabel("Monday Dec 21 — cancelled: Winter break"),
  ).toBeVisible();
  await expect(o.page.getByText("Winter break").first()).toBeVisible();

  // The server refuses: a cancelled night, and any night that isn't today.
  const made = await org.post("/api/badminton/act", {
    data: { scope: "sessions", dates: ["2026-12-21", "2026-12-24"] },
  });
  expect(made.ok()).toBe(true);
  const cancelled = await act(org, { type: "register" }, "2026-12-21");
  expect(cancelled.body.error).toMatch(/cancelled/);
  const future = await act(org, { type: "register" }, "2026-12-24");
  expect(future.body.error).toMatch(/8:00 am on Thursday Dec 24/);

  // Put it back.
  await o.page.getByRole("button", { name: /^Monday Dec 21/ }).click();
  await o.page.getByRole("button", { name: "Put this night back on" }).click();
  await expect(o.page.getByLabel("Monday Dec 21, 7:00–9:00 pm")).toBeVisible();
  await o.ctx.close();
});

test("24 phones, three courts: every phone agrees, nobody waits twice for nothing", async ({
  baseURL,
}) => {
  // Make room: everyone from the first story gives their spot away.
  for (const r of (await live(org)).organizer.roster)
    if (r.status === "confirmed")
      await must(org, { type: "cancel", playerId: r.person.id });
  const phones: APIRequestContext[] = [];
  for (let i = 0; i < 24; i++)
    phones.push(await player(baseURL!, `Sim${i} ${RUN}`));
  // Everybody checks in and joins the queue.
  await Promise.all(phones.map((p) => must(p, { type: "register" })));
  await Promise.all(phones.map((p) => must(p, { type: "check-in" })));
  await Promise.all(phones.map((p) => must(p, { type: "play" })));
  const ids = await Promise.all(phones.map(async (p) => (await live(p)).me.id));
  const byId = new Map(ids.map((id, i) => [id, phones[i]!]));

  const shape = (v: {
    night: {
      courts: {
        id: number;
        game: {
          id: string;
          status: string;
          slots: ({ id: string } | null)[];
        } | null;
      }[];
      queue: { person: { id: string } }[];
    };
  }) =>
    JSON.stringify({
      courts: v.night.courts.map((c) => [
        c.id,
        c.game?.id,
        c.game?.status,
        c.game?.slots.map((s) => s?.id),
      ]),
      queue: v.night.queue.map((q) => q.person.id),
    });

  for (let round = 0; round < 4; round++) {
    const views = await Promise.all(phones.map(live));
    expect(new Set(views.map(shape)).size, `round ${round}`).toBe(1);
    const courts = views[0].night.courts;
    // Every court in use has four assigned players; nobody is in two places.
    const seated = courts.flatMap(
      (c: { game: { slots: { id: string }[] } | null }) =>
        c.game ? c.game.slots.map((s) => s.id) : [],
    );
    expect(new Set(seated).size).toBe(seated.length);
    for (const c of courts)
      if (c.game) expect(c.game.slots.filter(Boolean)).toHaveLength(4);
    // Start, finish, and the four tap back in.
    for (const c of courts) {
      if (!c.game) continue;
      const four = c.game.slots.map((s: { id: string }) => byId.get(s.id)!);
      if (c.game.status === "called")
        await must(four[0]!, { type: "start", gameId: c.game.id });
      await must(four[1]!, {
        type: "finish",
        gameId: c.game.id,
      });
      await Promise.all(
        four.map((p: APIRequestContext) => must(p, { type: "play" })),
      );
    }
  }
  const o = (await live(org)).organizer;
  const finished = o.games.filter(
    (g: { status: string }) => g.status === "finished",
  );
  expect(finished.length).toBeGreaterThanOrEqual(10);
  for (const g of finished) {
    expect(g.startedAt).toBeLessThan(g.finishedAt);
  }
  const here = o.roster.filter(
    (r: { here: boolean; person: { id: string } }) =>
      r.here && ids.includes(r.person.id),
  );
  const games = here.map((r: { games: number }) => r.games);
  expect(Math.max(...games) - Math.min(...games)).toBeLessThanOrEqual(2);
});

test("every court takes anyone; 25 is the limit and the waitlist moves up", async ({
  baseURL,
}) => {
  const newcomer = await player(baseURL!, `Newbie ${RUN}`);
  // 24 are in; the newcomer takes the 25th spot and one more waits.
  await must(newcomer, { type: "register" });
  const late = await player(baseURL!, `Late ${RUN}`);
  await must(late, { type: "register" });
  let view = (await live(late)).sessions.find(
    (s: { id: string }) => s.id === TODAY,
  );
  expect(view.confirmed).toBe(25);
  expect(view.mine).toBe("waitlist");
  expect((await act(late, { type: "check-in" })).body.error).toMatch(
    /waitlist/,
  );
  // One cancels: the waitlist moves up on its own.
  const roster = (await live(org)).organizer.roster;
  const leaving = roster.find(
    (r: { status: string; here: boolean }) =>
      r.status === "confirmed" && !r.here,
  );
  await must(org, { type: "cancel", playerId: leaving.person.id });
  view = (await live(late)).sessions.find(
    (s: { id: string }) => s.id === TODAY,
  );
  expect(view.mine).toBe("confirmed");
});

test("Grow: My Journey is private and Learn teaches without links", async ({
  browser,
}) => {
  const a = await phone(browser);
  await a.page.goto("/badminton");
  await a.page.getByRole("button", { name: "I'm new" }).click();
  await a.page.getByLabel("Your name").fill(`Gro ${RUN}`);
  await a.page.getByLabel(/Choose a PIN/).fill("1357");
  await a.page.getByRole("button", { name: "Join CourtQueue" }).click();
  await a.page.getByRole("button", { name: /Not now/ }).click();
  await a.page.getByRole("button", { name: /Grow/ }).click();
  await expect(
    a.page.getByRole("heading", { name: "My Badminton Journey" }),
  ).toBeVisible();
  await a.page.getByRole("radio", { name: "Intermediate" }).click();
  await expect(
    a.page.getByRole("radio", { name: "Intermediate" }),
  ).toHaveAttribute("aria-checked", "true");
  await a.page.getByLabel("A goal of mine").fill("Rally for twenty hits");
  await a.page.getByRole("button", { name: "Add" }).click();
  await expect(a.page.getByText("Rally for twenty hits")).toBeVisible();
  await a.page.getByLabel("A relaxed handshake grip").click();
  await expect(a.page.getByLabel("A relaxed handshake grip")).toBeChecked();
  await a.page.getByRole("tab", { name: "Learn" }).click();
  for (const t of [
    "Grip and serving",
    "Footwork",
    "Clears and drops",
    "Doubles positioning",
    "Communication",
    "Improving consistency",
  ])
    await expect(a.page.getByText(t, { exact: true })).toBeVisible();
  await a.page.getByRole("button", { name: /Doubles positioning/ }).click();
  await expect(
    a.page.getByRole("img", { name: /front and back to attack/ }),
  ).toBeVisible();
  await expect(a.page.locator('main a[href^="http"]')).toHaveCount(0);
  // Nothing wider than the phone.
  const wide = await a.page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(wide).toBe(false);
});

test("See a night: three made-up nights run on the real rules", async ({
  page,
}) => {
  await page.goto("/badminton/demo");
  await expect(page.getByText("Play. Learn. Grow. Together.")).toBeVisible();
  for (const t of [
    "A new player joins comfortably",
    "Experienced players enjoy a challenging match",
    "A newer player chooses to challenge a stronger player",
  ])
    await expect(
      page.getByRole("heading", { name: new RegExp(t) }),
    ).toBeVisible();
  await expect(page.getByText("Maya & Sam")).toBeVisible();
  await expect(page.getByText(/invited game/)).toBeVisible();
});
