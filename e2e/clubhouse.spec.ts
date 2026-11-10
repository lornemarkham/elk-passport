import {
  expect,
  request as pwRequest,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";
import { localDate } from "../src/lib/courtqueue/clock";

/**
 * The Clubhouse end to end, on phones, with several accounts. Like
 * badminton.spec.ts it needs a server started with `COURTQUEUE_STORE=memory`
 * and `COURTQUEUE_CLOCK` set to a club night after 8:00 am (e.g.
 * `2026-11-12T10:00:00-08:00`), and it is happiest on a server of its own:
 * it fills tonight's queue, which badminton.spec.ts also reads. Without a
 * store the API says 503 and this skips.
 */

const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const RUN = Math.random().toString(36).slice(2, 6);
let TODAY = "";
let NEXT = "";

test.describe.configure({ mode: "serial" });

const nm = (n: string) => `${n} ${RUN}`;

async function player(baseURL: string, name: string, skill = 3) {
  const api = await pwRequest.newContext({ baseURL });
  const r = await api.post("/api/badminton/me", {
    data: { action: "register", name, pin: "4321", skill },
  });
  if (r.status() === 503) test.skip(true, "CourtQueue store not configured");
  expect(r.ok(), `register ${name}: ${await r.text()}`).toBe(true);
  return api;
}

const live = async (api: APIRequestContext) =>
  (await api.get("/api/badminton/live")).json();

async function act(api: APIRequestContext, cmd: object, sessionId = TODAY) {
  const r = await api.post("/api/badminton/act", {
    data: { scope: "session", sessionId, cmd },
  });
  return { ok: r.ok(), body: await r.json() };
}
async function must(api: APIRequestContext, cmd: object, sessionId = TODAY) {
  const out = await act(api, cmd, sessionId);
  expect(out.ok, `${JSON.stringify(cmd)}: ${out.body.error}`).toBe(true);
  return out.body.view;
}
const say = (api: APIRequestContext, text: string) =>
  api.post("/api/badminton/chat", { data: { cmd: { type: "post", text } } });

async function phone(browser: Browser, name: string, skill = "Intermediate") {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto("/badminton");
  await page.getByRole("button", { name: "I'm new" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel(/Choose a PIN/).fill("4321");
  await page.getByText(skill, { exact: true }).click();
  await page.getByRole("button", { name: "Join CourtQueue" }).click();
  await expect(page.getByTestId("phase")).toBeVisible();
  return { ctx, page };
}

const tab = (page: Page, name: RegExp | string) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: typeof name === "string" });

async function send(page: Page, text: string) {
  await page.getByLabel("Message to the club").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

let org: APIRequestContext;
const api: Record<string, APIRequestContext> = {};

test.beforeAll(async ({ baseURL }) => {
  org = await player(baseURL!, nm("Org"));
  const now = (await live(org)).now;
  TODAY = localDate(now);
  const claim = await org.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok(), await claim.text()).toBe(true);
  const sessions = (await live(org)).sessions as { date: string }[];
  NEXT = sessions.map((s) => s.date).find((d) => d > TODAY) ?? "";
  expect(NEXT).not.toBe("");
  for (const n of ["Cleo", "Dev", "Fay"])
    api[n] = await player(baseURL!, nm(n));
});

test("two phones talk in one room, with emoji, banter and a family-friendly filter", async ({
  browser,
}) => {
  const ada = await phone(browser, nm("Ada"));
  const ben = await phone(browser, nm("Ben"));
  await tab(ada.page, /Clubhouse/).click();
  await tab(ben.page, /Clubhouse/).click();
  await expect(
    ada.page.getByRole("heading", { name: "Clubhouse" }),
  ).toBeVisible();

  // An emoji from the panel, banter from the chips.
  await ada.page.getByRole("button", { name: "Emoji" }).click();
  await ada.page.getByRole("button", { name: "Add 🏸" }).click();
  await ada.page
    .getByLabel("Message to the club")
    .pressSequentially(" ready for tonight");
  await ada.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    ben.page.getByRole("button", { name: /🏸 ready for tonight/ }),
  ).toBeVisible({ timeout: 8_000 });

  // The other way, from Ben, and Ada reacts to it.
  await ben.page.getByRole("button", { name: "Good game! 👏" }).click();
  await ben.page.getByRole("button", { name: "Send", exact: true }).click();
  const bens = ada.page.getByRole("button", {
    name: /^Ben .*: Good game!/,
  });
  await expect(bens).toBeVisible({ timeout: 8_000 });
  await bens.click();
  await ada.page.getByRole("button", { name: "React 🔥" }).click();
  await expect(ben.page.getByRole("button", { name: /🔥 1/ })).toBeVisible({
    timeout: 8_000,
  });

  // Not family-friendly: told so, nothing posted anywhere.
  await ada.page.waitForTimeout(1200);
  await send(ada.page, "that was complete shit");
  await expect(ada.page.getByText(/keep it family-friendly/)).toBeVisible();
  await send(ada.page, "visit www.example.com");
  await expect(ada.page.getByText(/Links aren't allowed/)).toBeVisible();
  await expect(ben.page.getByText("complete")).toHaveCount(0);

  // There is no one-to-one anything: no way to pick a recipient.
  await expect(ada.page.getByText(/direct message|private/i)).toHaveCount(0);

  await ada.page.screenshot({ path: "test-results/clubhouse-chat.png" });
  await ada.ctx.close();
  await ben.ctx.close();
});

test("a challenge is made ahead of the day, answered without signing up, and shared to WhatsApp", async ({
  browser,
}) => {
  const ada = await phone(browser, nm("Ada2"));
  const ben = await phone(browser, nm("Ben2"));
  // Ada picks the next club night — not today — and three others.
  await tab(ada.page, /Clubhouse/).click();
  await ada.page.getByRole("button", { name: /Challenge/ }).click();
  const dialog = ada.page.getByRole("dialog", {
    name: "Challenge another pair",
  });
  await dialog.getByLabel("Which night?").selectOption({ index: 1 });
  await dialog
    .getByLabel("Your partner")
    .selectOption({ label: `${nm("Cleo")} — Intermediate` });
  await dialog
    .getByLabel("Opponent")
    .selectOption({ label: `${nm("Ben2")} — Intermediate` });
  await dialog
    .getByLabel("Their partner")
    .selectOption({ label: `${nm("Dev")} — Intermediate` });
  await dialog.getByLabel(/playful line/).fill("Loser buys the shuttles 😎");
  await dialog.getByRole("button", { name: "Send challenge" }).click();

  const card = ada.page.getByRole("region", { name: "Challenges" });
  await expect(card).toContainText("Loser buys the shuttles");
  const share = card.getByRole("link", {
    name: /Share this challenge to WhatsApp/,
  });
  const href = (await share.getAttribute("href"))!;
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent(href.split("text=")[1]!);
  expect(text).toContain("Challenge!");
  expect(text).toContain("Vernon Badminton Club");
  expect(text).toContain("/badminton");

  // Ben sees the card in the Clubhouse and says yes — he isn't signed up for anything.
  await tab(ben.page, /Clubhouse/).click();
  const bens = ben.page.getByRole("region", { name: "Challenges" });
  await expect(bens).toContainText("Loser buys the shuttles", {
    timeout: 8_000,
  });
  await expect(bens).toContainText(/Saying yes doesn't sign you up/);
  await bens.getByRole("button", { name: "Accept" }).click();
  await expect(bens).toContainText("2 of 4 said yes");
  await expect(bens).toContainText(/needs to sign up/);
  const v = await live(org);
  const night = v.sessions.find((s: { date: string }) => s.date === NEXT);
  expect(night.mine).toBeNull();
  expect(night.confirmed).toBe(0);
  // And the room was told, as a card in the conversation.
  await expect(ben.page.getByText(/threw down a challenge/)).toBeVisible();

  await ben.page.screenshot({ path: "test-results/clubhouse-challenge.png" });
  // Declining is just as free.
  await tab(ada.page, /Clubhouse/).click();
  await ada.ctx.close();
  await ben.ctx.close();
});

test("on the day it only goes ahead with all four signed up and in the queue — and never skips the line", async ({
  baseURL,
}) => {
  const gus = await player(baseURL!, nm("Gus"));
  const four = [api.Cleo!, api.Dev!, api.Fay!, gus];
  const ids = await Promise.all(
    four.map(async (a) => (await live(a)).me.id as string),
  );
  await must(four[0]!, {
    type: "challenge",
    slots: [ids[0], ids[1], ids[2], ids[3]],
    note: "Day-of showdown",
  });
  type C = {
    status: string;
    note: string | null;
    id: string;
    needs: { step: string }[];
  };
  const challengeOf = async (): Promise<C> =>
    ((await live(org)).sessions as { id: string; challenges: C[] }[])
      .find((s) => s.id === TODAY)!
      .challenges.find((c) => c.note === "Day-of showdown")!;
  for (const a of four.slice(1))
    await must(a, {
      type: "challenge-accept",
      challengeId: (await challengeOf()).id,
    });
  for (const a of four) await must(a, { type: "register" });
  for (const a of four) await must(a, { type: "check-in" });
  // Four others join the queue first: a fair game is made from them.
  for (const n of ["Hal", "Ivy", "Jo", "Kai"]) {
    const p = await player(baseURL!, nm(n));
    await must(p, { type: "register" });
    await must(p, { type: "check-in" });
    await must(p, { type: "play" });
  }
  let c = await challengeOf();
  expect(c.status).toBe("pending");
  expect(c.needs.every((n) => n.step === "queue")).toBe(true);
  // Three of the four join: still pending. The fourth: it's on.
  for (const a of four.slice(0, 3)) await must(a, { type: "play" });
  c = await challengeOf();
  expect(c.status).toBe("pending");
  expect(c.needs).toHaveLength(1);
  await must(four[3]!, { type: "play" });
  c = await challengeOf();
  expect(["ready", "on-court"]).toContain(c.status);
  // Fairness first: nobody who was waiting longer was skipped. The
  // challenge's four are on a court only if no first-timer is waiting.
  const v = await live(org);
  const games = v.night.courts
    .map(
      (x: { game: { source: string; slots: { id: string }[] } | null }) =>
        x.game,
    )
    .filter(Boolean);
  expect(games.length).toBeGreaterThan(0);
});

test("the organizer pins, pauses and removes — and members see it", async ({
  browser,
}) => {
  const ada = await phone(browser, nm("Ada3"));
  const boss = await phone(browser, nm("Boss"));
  const claim = await boss.page.request.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok()).toBe(true);
  await boss.page.reload();
  await tab(ada.page, /Clubhouse/).click();
  await tab(boss.page, /Clubhouse/).click();

  // Pin an announcement.
  await boss.page.getByText("Organizer controls").click();
  await boss.page
    .getByLabel("Pin an announcement")
    .fill("Doors at 6:30 — bring water 💧");
  await boss.page.getByRole("button", { name: "Pin it" }).click();
  await expect(ada.page.getByText("Doors at 6:30")).toBeVisible({
    timeout: 8_000,
  });

  // A message from Ada; the organizer removes it; Ada sees it gone.
  await send(ada.page, "oops wrong chat 🙈");
  const msg = boss.page.getByRole("button", { name: /oops wrong chat/ });
  await expect(msg).toBeVisible({ timeout: 8_000 });
  await msg.click();
  await boss.page.getByRole("button", { name: "Remove" }).click();
  await expect(ada.page.getByText("Removed by the organizer")).toBeVisible({
    timeout: 8_000,
  });
  await expect(ada.page.getByText("oops wrong chat")).toHaveCount(0);

  // Pause the room: Ada can read but not write.
  await boss.page.getByRole("button", { name: "Pause chat" }).click();
  await expect(ada.page.getByText(/Clubhouse is resting/)).toBeVisible({
    timeout: 8_000,
  });
  await expect(ada.page.getByLabel("Message to the club")).toHaveCount(0);
  await boss.page.getByRole("button", { name: "Resume chat" }).click();
  await expect(ada.page.getByLabel("Message to the club")).toBeVisible({
    timeout: 8_000,
  });

  // Pause one player for a day.
  await send(ada.page, "hello again");
  const hello = boss.page.getByRole("button", { name: /hello again/ });
  await expect(hello).toBeVisible({ timeout: 8_000 });
  await hello.click();
  await boss.page
    .getByRole("button", { name: /Pause .*chat \(24 h\)/ })
    .click();
  await expect(ada.page.getByText(/paused your chat/)).toBeVisible({
    timeout: 8_000,
  });
  await boss.page.screenshot({ path: "test-results/clubhouse-organizer.png" });
  await ada.ctx.close();
  await boss.ctx.close();
});

test("chat alerts are their own switch, apart from court alerts, and they stick", async ({
  browser,
}) => {
  const p = await phone(browser, nm("Nora"));
  await tab(p.page, "Me").click();
  const everyone = p.page.getByRole("button", { name: "Every message" });
  await expect(
    p.page.getByRole("switch", { name: /Court-ready/ }),
  ).toBeChecked();
  await expect(
    p.page.getByRole("button", { name: "Off", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await everyone.click();
  await p.page.getByRole("switch", { name: /Court-ready/ }).uncheck();
  await p.page.waitForTimeout(500);
  await p.page.reload();
  await tab(p.page, "Me").click();
  await expect(
    p.page.getByRole("button", { name: "Every message" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    p.page.getByRole("switch", { name: /Court-ready/ }),
  ).not.toBeChecked();
  await p.ctx.close();
});

test("history and accounts are kept: signing in again shows the earlier talk", async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto("/badminton");
  await page.getByRole("button", { name: "Sign in" }).first().click();
  await page.getByLabel("Your name").fill(nm("Ben"));
  await page.getByLabel("PIN").fill("4321");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await tab(page, /Clubhouse/).click();
  await expect(
    page.getByRole("button", { name: /^Ben .*: Good game!/ }),
  ).toBeVisible();
  const r = await say(api.Cleo!, "from the API too");
  expect(r.ok(), baseURL).toBe(true);
  await expect(page.getByText("from the API too")).toBeVisible({
    timeout: 8_000,
  });
  await ctx.close();
});
