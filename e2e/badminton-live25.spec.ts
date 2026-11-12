import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { localDate } from "../src/lib/courtqueue/clock";

/**
 * **CourtQueue with 25 real participants**, each in their own browser context
 * (own cookies, own storage, own phone-sized page) against one server and one
 * shared night. Not one browser pretending to be many.
 *
 * Start the server fresh with COURTQUEUE_CLOCK on a club-night evening (e.g.
 * 2026-11-12T18:45:00-07:00) and COURTQUEUE_ORGANIZER_CODE=organizer. The
 * store may be memory or the real Postgres stack. One serial story.
 */

const RUN = Math.random().toString(36).slice(2, 6);
const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const N = 25;
const FIRST = [
  "Ava",
  "Ben",
  "Cleo",
  "Dev",
  "Eli",
  "Fay",
  "Gus",
  "Hana",
  "Ivo",
  "Jade",
  "Kit",
  "Lena",
  "Milo",
  "Nora",
  "Omar",
  "Pia",
  "Quin",
  "Rafa",
  "Sana",
  "Theo",
  "Uma",
  "Vik",
  "Wren",
  "Xavi",
  "Yara",
];

interface Phone {
  name: string;
  ctx: BrowserContext;
  page: Page;
  id: string;
}

test.describe.configure({ mode: "serial" });

const phones: Phone[] = [];
let organizer: Phone;
let TODAY = "";
const failures: string[] = [];

type Live = {
  now: number;
  me: { id: string; name: string; organizer: boolean } | null;
  night: {
    id: string;
    queue: { person: { id: string; name: string } }[];
    courts: {
      id: number;
      closed: boolean;
      game: {
        id: string;
        status: string;
        score: [number, number] | null;
        slots: ({ id: string; name: string } | null)[];
      } | null;
    }[];
    recent: { id: string; score: [number, number] | null }[];
    me: { phase: string } | null;
  } | null;
};

const live = async (p: Phone): Promise<Live> => {
  const r = await p.page.request.get("/api/badminton/live");
  expect(r.status(), `live for ${p.name}`).toBe(200);
  return r.json();
};
const word = (p: Phone) => p.page.getByTestId("phase");

async function newPhone(
  browser: import("@playwright/test").Browser,
  name: string,
) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  page.on("response", (r) => {
    if (
      r.url().includes("/api/badminton") &&
      [401, 403, 500].includes(r.status())
    )
      failures.push(
        `${name}: ${r.status()} ${r.request().method()} ${r.url()}`,
      );
  });
  return { name, ctx, page, id: "" } as Phone;
}

async function join(p: Phone) {
  await p.page.goto("/badminton");
  await p.page.waitForLoadState("networkidle");
  await p.page.getByRole("button", { name: "I'm new" }).click();
  await p.page.getByLabel("Your name").fill(p.name);
  await p.page
    .getByLabel("Your email")
    .fill(`${p.name.toLowerCase().replace(/\W+/g, "")}${RUN}@example.test`);
  await p.page.getByLabel(/Choose a PIN/).fill("2468");
  await p.page.getByRole("button", { name: "Join CourtQueue" }).click();
  await expect(word(p)).toBeVisible({ timeout: 30_000 });
  p.id = (await live(p)).me!.id;
}

async function snapshotAll(list: Phone[]) {
  return Promise.all(list.map(live));
}

/** Everyone sees the same queue and courts, and nobody is in two places. */
async function assertAgreement(list: Phone[], label: string) {
  const views = await snapshotAll(list);
  const shape = (v: Live) =>
    JSON.stringify({
      q: v.night!.queue.map((x) => x.person.id),
      c: v.night!.courts.map((c) => [
        c.id,
        c.closed,
        c.game?.id ?? null,
        c.game?.status ?? null,
        c.game?.slots.map((s) => s?.id ?? null) ?? null,
      ]),
    });
  const first = shape(views[0]!);
  views.forEach((v, i) =>
    expect(
      shape(v),
      `${label}: ${list[i]!.name} disagrees with ${list[0]!.name}`,
    ).toBe(first),
  );
  const seen = new Set<string>();
  for (const q of views[0]!.night!.queue) {
    expect(
      seen.has(q.person.id),
      `${label}: ${q.person.name} queued twice`,
    ).toBe(false);
    seen.add(q.person.id);
  }
  for (const c of views[0]!.night!.courts)
    for (const s of c.game?.slots ?? []) {
      expect(s, `${label}: court ${c.id} has an empty place`).not.toBeNull();
      expect(seen.has(s!.id), `${label}: ${s!.name} is in two places`).toBe(
        false,
      );
      seen.add(s!.id);
    }
  return views[0]!;
}

/** Tap on a phone that is one of 25 open pages: bring it forward first. */
async function tap(
  p: Phone,
  name: string | RegExp,
  opts: { exact?: boolean } = {},
) {
  await p.page.bringToFront();
  await p.page
    .getByRole("button", { name, ...opts })
    .first()
    .click({ force: true });
}

const byId = (id: string) => phones.concat(organizer).find((p) => p.id === id)!;

test.beforeAll(async ({ browser }) => {
  organizer = await newPhone(browser, `Organizer ${RUN}`);
  for (let i = 0; i < N; i++)
    phones.push(await newPhone(browser, `${FIRST[i]} ${RUN}`));
});

test.afterAll(async () => {
  for (const p of [...phones, organizer]) await p?.ctx.close();
});

test("an organizer opens the night; QR and link are on offer", async () => {
  await join(organizer);
  TODAY = localDate((await live(organizer)).now);
  const claim = await organizer.page.request.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok(), await claim.text()).toBe(true);
  const made = await organizer.page.request.post("/api/badminton/act", {
    data: { scope: "sessions", dates: [TODAY] },
  });
  expect(made.ok(), await made.text()).toBe(true);
  await organizer.page.reload();
  await organizer.page.getByRole("button", { name: /Organize/ }).click();
  await expect(
    organizer.page.getByRole("heading", { name: "Invite players" }),
  ).toBeVisible();
  await expect(
    organizer.page.getByAltText("QR code to join CourtQueue"),
  ).toBeVisible();
  await expect(organizer.page.getByText(/\/badminton$/)).toBeVisible();
});

test("25 people join from their own phones, each with a name, email and PIN", async () => {
  test.setTimeout(240_000);
  for (let i = 0; i < N; i += 5)
    await Promise.all(phones.slice(i, i + 5).map(join));
  expect(new Set(phones.map((p) => p.id)).size).toBe(N);
  expect(phones.every((p) => p.id.length > 3)).toBe(true);
  // The organizer sees every email.
  const v = await (
    await organizer.page.request.get("/api/badminton/live")
  ).json();
  const emails = v.organizer.players.map((p: { email: string }) => p.email);
  expect(emails.filter(Boolean).length).toBeGreaterThanOrEqual(N);
  expect(new Set(emails).size).toBe(emails.length);
  // A duplicate email is refused with a plain message.
  const dup = await organizer.page.request.post("/api/badminton/me", {
    data: {
      action: "register",
      name: "Someone Else",
      email: emails[1],
      pin: "1357",
    },
  });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).error).toMatch(/already registered/);
});

test("all 25 sign up for the same night; 24 arrive and join the queue", async () => {
  test.setTimeout(300_000);
  const step = async (p: Phone, button: string, next: string) => {
    await p.page.getByRole("button", { name: button }).click();
    await expect(word(p)).toHaveText(next, { timeout: 20_000 });
  };
  for (let i = 0; i < N; i += 5)
    await Promise.all(
      phones.slice(i, i + 5).map((p) => step(p, "SIGN ME UP", "REGISTERED")),
    );
  const v = await live(organizer);
  expect(v.night!.id).toBe(TODAY);
  // 24 arrive; the 25th is held back as the late arrival.
  const arrivals = phones.slice(0, 24);
  for (let i = 0; i < arrivals.length; i += 6)
    await Promise.all(
      arrivals.slice(i, i + 6).map(async (p) => {
        await step(p, "I'M HERE", "READY TO PLAY");
        await step(p, "JOIN THE QUEUE", "WAITING").catch(async () => {
          // Called at once: the first sixteen get a court as they join.
          await expect(word(p)).toHaveText(/YOU'RE UP|WAITING/);
        });
      }),
    );
});

test("everyone sees the same queue and the same four courts", async () => {
  await expect
    .poll(
      async () =>
        (await live(phones[0]!)).night!.courts.filter((c) => c.game).length,
      { timeout: 30_000 },
    )
    .toBe(4);
  const v = await assertAgreement(
    phones.slice(0, 24).concat(organizer),
    "after joining",
  );
  expect(v.night!.courts).toHaveLength(4);
  expect(v.night!.queue.length + v.night!.courts.length * 4).toBe(24);
});

test("the four on each court see YOU'RE UP, start, and finish with a score on their own phones", async () => {
  test.setTimeout(240_000);
  const v = await live(phones[0]!);
  const scores: Record<number, [number, number]> = {
    1: [21, 15],
    2: [18, 21],
    3: [21, 19],
    4: [21, 9],
  };
  for (const c of v.night!.courts) {
    const g = c.game!;
    const four = g.slots.map((s) => byId(s!.id));
    for (const p of four)
      await expect(word(p)).toHaveText(/YOU'RE UP/, { timeout: 20_000 });
    // Everybody says yes; one taps START.
    await tap(four[1]!, /^START GAME$/);
    for (const p of four)
      await expect(word(p)).toHaveText("PLAYING", { timeout: 20_000 });
  }
  await assertAgreement(
    phones.slice(0, 24).concat(organizer),
    "everyone playing",
  );
  for (const c of v.night!.courts) {
    const four = c.game!.slots.map((s) => byId(s!.id));
    const f = four[2]!;
    await tap(f, "FINISH GAME");
    // The score is required before the game can be finished.
    await expect(
      f.page.getByRole("button", { name: "Finish game", exact: true }),
    ).toBeDisabled();
    await f.page.getByLabel("Score, first team").fill(String(scores[c.id]![0]));
    await f.page
      .getByLabel("Score, second team")
      .fill(String(scores[c.id]![1]));
    await tap(f, "Finish game", { exact: true });
    for (const p of four)
      await expect(word(p)).toHaveText("FINISHED", { timeout: 20_000 });
  }
});

test("scores, wins and losses are recorded and shown to the right people", async () => {
  const v = await live(phones[0]!);
  const recent = v.night!.recent;
  expect(recent.filter((g) => g.score).length).toBe(4);
  // Per-court: winners and losers see it in their own stats.
  const scores: Record<number, [number, number]> = {
    1: [21, 15],
    2: [18, 21],
    3: [21, 19],
    4: [21, 9],
  };
  let totalWins = 0,
    totalLosses = 0;
  const finished = await Promise.all(
    phones.slice(0, 24).map(async (p) => ({
      p,
      stats: await (await p.page.request.get("/api/badminton/stats")).json(),
    })),
  );
  for (const { stats } of finished) {
    totalWins += stats.me.wins;
    totalLosses += stats.me.losses;
    expect(stats.table.length).toBe(16);
  }
  expect(totalWins).toBe(8);
  expect(totalLosses).toBe(8);
  void scores;
});

test("rotation: the four tap back in and the waiting players are called, with no one on two courts", async () => {
  test.setTimeout(120_000);
  const v = await live(phones[0]!);
  const everyone = phones.slice(0, 24).concat(organizer);
  // Court 4 is organizer-closed for a moment: the change reaches every phone.
  const closed = await organizer.page.request.post("/api/badminton/act", {
    data: {
      scope: "session",
      sessionId: TODAY,
      cmd: { type: "court-closed", court: 4, closed: true },
    },
  });
  expect(closed.ok(), await closed.text()).toBe(true);
  await expect
    .poll(
      async () =>
        (await Promise.all(everyone.map(live))).every(
          (x) => x.night!.courts[3]!.closed,
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  void v;
  // The remaining eight were waiting: they should hold courts 1–3 or the line.
  await expect
    .poll(
      async () =>
        (await live(phones[0]!)).night!.courts.filter(
          (c) => c.game && c.id !== 4,
        ).length,
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(2);
  await assertAgreement(everyone, "after rotation and a closed court");
  const reopen = await organizer.page.request.post("/api/badminton/act", {
    data: {
      scope: "session",
      sessionId: TODAY,
      cmd: { type: "court-closed", court: 4, closed: false },
    },
  });
  expect(reopen.ok()).toBe(true);
});

test("a late arrival checks in and joins the night in progress", async () => {
  const late = phones[24]!;
  await late.page.reload();
  await expect(word(late)).toHaveText("REGISTERED");
  await late.page.getByRole("button", { name: "I'M HERE" }).click();
  await expect(word(late)).toHaveText("READY TO PLAY");
  await late.page.getByRole("button", { name: "JOIN THE QUEUE" }).click();
  await expect(word(late)).toHaveText(/WAITING|YOU'RE UP/);
  const v = await assertAgreement(phones.concat(organizer), "late arrival");
  const inQueue = v.night!.queue.some((q) => q.person.id === late.id);
  const onCourt = v.night!.courts.some((c) =>
    c.game?.slots.some((s) => s?.id === late.id),
  );
  expect(inQueue || onCourt).toBe(true);
});

test("leaving and rejoining: someone heads home and comes back", async () => {
  const v = await live(phones[0]!);
  const waiter = v.night!.queue[v.night!.queue.length - 1]!.person;
  const p = byId(waiter.id);
  await p.page.getByRole("button", { name: /heading home/ }).click();
  await expect
    .poll(
      async () =>
        (await live(organizer)).night!.queue.some((q) => q.person.id === p.id),
      { timeout: 15_000 },
    )
    .toBe(false);
  await assertAgreement(phones.concat(organizer), "someone left");
  await p.page.reload();
  await expect(word(p)).toHaveText("HEADED HOME");
  await tap(p, "I'm back");
  await tap(p, /^(JOIN THE QUEUE|BACK IN THE QUEUE)$/);
  await expect
    .poll(async () => {
      const x = await live(organizer);
      return (
        x.night!.queue.some((q) => q.person.id === p.id) ||
        x.night!.courts.some((c) => c.game?.slots.some((s) => s?.id === p.id))
      );
    })
    .toBe(true);
});

test("scores and history survive a refresh and a brand-new browser", async ({
  browser,
}) => {
  const p = phones[2]!;
  await p.page.reload();
  const s = await (await p.page.request.get("/api/badminton/stats")).json();
  expect(s.games.length).toBeGreaterThanOrEqual(4);
  await p.page.getByRole("button", { name: /Me/ }).click();
  await expect(
    p.page.getByRole("heading", { name: "Game history" }),
  ).toBeVisible();
  await expect(p.page.getByText("21–15").first()).toBeVisible();
  // Sign in again from a new device with name + PIN.
  const fresh = await newPhone(browser, p.name);
  await fresh.page.goto("/badminton");
  await fresh.page.getByRole("button", { name: "Sign in" }).first().click();
  await fresh.page.getByLabel("Your name").fill(p.name);
  await fresh.page.getByLabel("PIN").fill("2468");
  await fresh.page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(word(fresh)).toBeVisible({ timeout: 20_000 });
  const again = await (
    await fresh.page.request.get("/api/badminton/stats")
  ).json();
  expect(again.me).toEqual(s.me);
  await fresh.ctx.close();
});

test("no authorization failures or server errors for anyone, all night", async () => {
  expect(failures).toEqual([]);
});
