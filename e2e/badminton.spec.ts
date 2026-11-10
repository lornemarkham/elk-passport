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
 * against a fresh server started with `COURTQUEUE_STORE=memory` (the
 * organizer code is then "organizer" unless COURTQUEUE_ORGANIZER_CODE says
 * otherwise). One serial story, because it is one night.
 */

const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const RUN = Math.random().toString(36).slice(2, 6);
const TODAY = localDate(Date.now());

test.describe.configure({ mode: "serial" });

async function player(
  baseURL: string,
  name: string,
  skill: number,
): Promise<APIRequestContext> {
  const api = await pwRequest.newContext({ baseURL });
  const r = await api.post("/api/badminton/me", {
    data: { action: "register", name, pin: "4321", skill },
  });
  if (r.status() === 503) test.skip(true, "CourtQueue store not configured");
  expect(r.ok(), `register ${name}: ${await r.text()}`).toBe(true);
  return api;
}

async function act(api: APIRequestContext, cmd: object, scope = "session") {
  const r = await api.post("/api/badminton/act", {
    data: { scope, sessionId: TODAY, cmd },
  });
  return { ok: r.ok(), body: await r.json() };
}

async function must(api: APIRequestContext, cmd: object) {
  const out = await act(api, cmd);
  expect(out.ok, `${JSON.stringify(cmd)}: ${out.body.error}`).toBe(true);
  return out.body.view;
}

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
  org = await player(baseURL!, `Org ${RUN}`, 3);
  const claim = await org.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok(), await claim.text()).toBe(true);
  const made = await org.post("/api/badminton/act", {
    data: { scope: "sessions", dates: [TODAY] },
  });
  expect(made.ok(), await made.text()).toBe(true);
});

test("four phones: register, check in, PLAY, get called, START, FINISH, score, confirm", async ({
  browser,
  baseURL,
}) => {
  // Phone A registers on the page itself, like everybody will on Thursday.
  const a = await phone(browser);
  await a.page.goto("/badminton");
  await expect(
    a.page.getByRole("heading", { name: "CourtQueue" }),
  ).toBeVisible();
  await a.page.getByRole("button", { name: "I'm new" }).click();
  await a.page.getByLabel("Your name").fill(`Ana ${RUN}`);
  await a.page.getByLabel(/Choose a PIN/).fill("2468");
  await a.page.getByText("Intermediate", { exact: true }).click();
  await a.page.getByRole("button", { name: "Join CourtQueue" }).click();
  await a.page.getByRole("button", { name: "I'M HERE" }).click();
  await a.page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(a.page.getByText("You're in line")).toBeVisible();
  await expect(a.page.getByText("#1", { exact: true })).toBeVisible();

  // Three friends tap PLAY on their own phones (through the API).
  const others = [];
  for (const n of ["Bo", "Cy", "Di"]) {
    const p = await player(baseURL!, `${n} ${RUN}`, 3);
    await must(p, { type: "check-in" });
    others.push(p);
  }
  await Promise.all(others.map((p) => must(p, { type: "play" })));

  // Phone A is called without touching anything.
  await expect(a.page.getByText("You're up!")).toBeVisible({ timeout: 8_000 });
  await expect(a.page.getByText("Everyone's first game tonight")).toBeVisible();
  // Intermediates are not sent to the expert court.
  await expect(
    a.page.getByText(/^(Beginner|Intermediate) Court ·/),
  ).toBeVisible();

  // A spectator phone sees the same court.
  const e = await phone(browser);
  const er = await e.ctx.request.post("/api/badminton/me", {
    data: { action: "register", name: `Ed ${RUN}`, pin: "1111", skill: 4 },
  });
  expect(er.ok()).toBe(true);
  await e.page.goto("/badminton");
  await e.page.getByRole("button", { name: "Courts" }).click();
  await expect(e.page.getByText("Called").first()).toBeVisible();

  await a.page.getByRole("button", { name: "START GAME" }).click();
  await expect(a.page.getByText(/^Playing ·/)).toBeVisible();
  await expect(e.page.getByText("Occupied")).toBeVisible({ timeout: 8_000 });
  await expect(e.page.getByText(`Ana ${RUN}`).first()).toBeVisible();

  // Phone A loses signal for a moment — and comes back.
  await a.ctx.setOffline(true);
  await expect(a.page.getByText("Reconnecting…")).toBeVisible({
    timeout: 15_000,
  });
  await a.ctx.setOffline(false);
  await expect(a.page.getByText("Reconnecting…")).toBeHidden({
    timeout: 10_000,
  });

  await a.page.getByRole("button", { name: "FINISH GAME" }).click();
  const scores = a.page.getByLabel(/^Score for/);
  await scores.nth(0).fill("21");
  await scores.nth(1).fill("17");
  await a.page.getByRole("button", { name: "Save 21–17 & finish" }).click();

  // The result shows on the spectator's phone, and a teammate confirms it.
  await expect(e.page.getByText("21–17")).toBeVisible({ timeout: 8_000 });
  const view = await (await others[0]!.get("/api/badminton/live")).json();
  const played = view.night.me.played[0];
  expect(played.minutes).toBeGreaterThanOrEqual(0);
  expect(played.startedAt).toBeLessThan(played.finishedAt);
  // Anyone but the player who entered the score may confirm it.
  const confirmer = others[0]!;
  await must(confirmer, { type: "confirm", gameId: played.id });
  await a.page.getByRole("button", { name: "Tonight" }).click();
  await expect(a.page.getByText("confirmed")).toBeVisible({ timeout: 8_000 });

  // The organizer's phone sees the night and can fix it.
  const o = await phone(browser);
  const cookies = await org.storageState();
  await o.ctx.addCookies(cookies.cookies);
  await o.page.goto("/badminton");
  await o.page.getByRole("button", { name: "Organize" }).click();
  await expect(
    o.page.getByRole("heading", { name: "Organizer" }),
  ).toBeVisible();
  await expect(o.page.getByText(`Ana ${RUN}`).first()).toBeVisible();

  await Promise.all([a.ctx.close(), e.ctx.close(), o.ctx.close()]);
});

test("the expert court never takes a beginner; 25 is the limit and the waitlist moves up", async ({
  baseURL,
}) => {
  const beginner = await player(baseURL!, `Newbie ${RUN}`, 1);
  const experts = [];
  for (const n of ["X1", "X2", "X3"])
    experts.push(await player(baseURL!, `${n} ${RUN}`, 5));
  for (const p of [beginner, ...experts]) await must(p, { type: "check-in" });
  const live = await (await org.get("/api/badminton/live")).json();
  const ids = [beginner, ...experts].map(
    async (p) => (await (await p.get("/api/badminton/live")).json()).me.id,
  );
  const four = await Promise.all(ids);
  const expertCourtFree =
    live.night.courts.find((c: { id: number }) => c.id === 3).game === null;
  if (expertCourtFree) {
    const out = await act(org, { type: "assign", court: 3, slots: four });
    expect(out.ok).toBe(false);
    expect(out.body.error).toMatch(/never on the expert court/);
  }

  // Fill the night to 25, then one more.
  let view = (
    await (await org.get("/api/badminton/live")).json()
  ).sessions.find((s: { id: string }) => s.id === TODAY);
  const extra: APIRequestContext[] = [];
  for (let i = view.confirmed; i < 25; i++) {
    const p = await player(baseURL!, `Fill${i} ${RUN}`, 2);
    await must(p, { type: "register" });
    extra.push(p);
  }
  const late = await player(baseURL!, `Late ${RUN}`, 3);
  await must(late, { type: "register" });
  view = (await (await late.get("/api/badminton/live")).json()).sessions.find(
    (s: { id: string }) => s.id === TODAY,
  );
  expect(view.confirmed).toBe(25);
  expect(view.mine).toBe("waitlist");
  expect((await act(late, { type: "check-in" })).body.error).toMatch(
    /waitlist/,
  );
  // One cancels: the waitlist moves up on its own.
  await must(extra[0]!, { type: "cancel" });
  view = (await (await late.get("/api/badminton/live")).json()).sessions.find(
    (s: { id: string }) => s.id === TODAY,
  );
  expect(view.mine).toBe("confirmed");
});
