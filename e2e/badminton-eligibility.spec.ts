import {
  expect,
  request as pwRequest,
  test,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";
import { localDate } from "../src/lib/courtqueue/clock";

/**
 * **Configurable court eligibility** (owner decision 2026-11-12). Real
 * server, real API, one organizer on a phone-sized page. Start the server as
 * for `badminton.spec.ts`: `COURTQUEUE_STORE=memory` and `COURTQUEUE_CLOCK`
 * on a club-night evening. One serial story.
 *
 * **Shared-night caution.** The club and tonight's night are one document each,
 * so a test that goes live and sets court limits would disturb the other
 * badminton specs running at the same time on the same server. The default run
 * therefore only exercises the organizer's screen without changing what any
 * court allows; the full API flow (beginners kept off an advanced court) runs
 * when `E2E_ISOLATED_CLUB=1` is set against a server nothing else uses.
 */

const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const RUN = Math.random().toString(36).slice(2, 6);
let TODAY = "";

test.describe.configure({ mode: "serial" });

async function join(baseURL: string, name: string) {
  const api = await pwRequest.newContext({ baseURL });
  const r = await api.post("/api/badminton/me", {
    data: {
      action: "register",
      name,
      email: `${name.replace(/\W+/g, "")}@example.test`,
      pin: "4321",
    },
  });
  if (r.status() === 503) test.skip(true, "CourtQueue store not configured");
  expect(r.ok(), await r.text()).toBe(true);
  return api;
}
const post = (api: APIRequestContext, data: object) =>
  api.post("/api/badminton/act", { data });
const sess = async (api: APIRequestContext, cmd: object) => {
  const r = await post(api, { scope: "session", sessionId: TODAY, cmd });
  expect(r.ok(), `${JSON.stringify(cmd)}: ${await r.text()}`).toBe(true);
};
const club = async (api: APIRequestContext, cmd: object) => {
  const r = await post(api, { scope: "club", cmd });
  expect(r.ok(), `${JSON.stringify(cmd)}: ${await r.text()}`).toBe(true);
};
const live = async (api: APIRequestContext) =>
  (await api.get("/api/badminton/live")).json();

let org: APIRequestContext;
const adv: APIRequestContext[] = [];
const beg: APIRequestContext[] = [];

const ISOLATED = process.env.E2E_ISOLATED_CLUB === "1";

test.beforeAll(async ({ baseURL }) => {
  org = await join(baseURL!, `EOrg ${RUN}`);
  TODAY = localDate((await live(org)).now);
  const claim = await org.post("/api/badminton/me", {
    data: { action: "organizer", code: CODE },
  });
  expect(claim.ok(), await claim.text()).toBe(true);
  await post(org, { scope: "sessions", dates: [TODAY] });
  if (!ISOLATED) return;
  for (let i = 0; i < 4; i++) {
    adv.push(await join(baseURL!, `Adv${i} ${RUN}`));
    beg.push(await join(baseURL!, `Beg${i} ${RUN}`));
    await club(adv[i]!, { type: "journey", level: "advanced" });
    await club(beg[i]!, { type: "journey", level: "beginner" });
  }
});

test.afterAll(async () => {
  // Leave the club as found: open play.
  await club(org, { type: "play-mode", mode: "open" });
});

async function organizerPage(browser: Browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addCookies((await org.storageState()).cookies);
  const page = await ctx.newPage();
  await page.goto("/badminton");
  await page.getByRole("button", { name: /Organize/ }).click();
  return { ctx, page };
}

test("the organizer's screen switches between open and guided play", async ({
  browser,
}) => {
  const { ctx, page } = await organizerPage(browser);
  await expect(page.getByTestId("mode-explainer")).toContainText(
    "Everyone is eligible for every court",
  );
  await expect(page.getByTestId("court-eligibility")).toHaveCount(0);
  await page.getByRole("button", { name: "Guided play" }).click();
  await expect(page.getByTestId("court-eligibility")).toBeVisible();
  await expect(page.getByLabel("Who may play on Court 2")).toHaveValue("");
  expect((await live(org)).organizer.mode).toBe("guided");
  await page.getByRole("button", { name: "Open play" }).click();
  await expect(page.getByTestId("court-eligibility")).toHaveCount(0);
  expect((await live(org)).organizer.mode).toBe("open");
  await ctx.close();
});

test.describe("on a server of its own (E2E_ISOLATED_CLUB=1)", () => {
  test.skip(!ISOLATED, "changes court limits on the shared night");

  test("courts and limits are set from the phone and kept by the club", async ({
    browser,
  }) => {
    const { ctx, page } = await organizerPage(browser);
    await page.getByRole("button", { name: "Guided play" }).click();
    await page.getByLabel("Who may play on Court 2").selectOption("advanced");
    await page.getByRole("button", { name: "More courts" }).click();
    await expect(page.getByText("Courts at the venue: 5")).toBeVisible();
    const v = await live(org);
    expect(v.organizer.mode).toBe("guided");
    expect(v.organizer.courts).toHaveLength(5);
    expect(v.organizer.courts[1].minLevel).toBe("advanced");
    await ctx.close();
  });

  test("beginners are never put on the advanced court; advanced players are", async () => {
    await club(org, { type: "court", court: 1, patch: { minLevel: null } });
    for (const p of [...adv, ...beg]) {
      await sess(p, { type: "register" });
      await sess(p, { type: "check-in" });
    }
    await sess(org, { type: "go-live" });
    for (const p of beg) await sess(p, { type: "play" });
    let v = await live(org);
    expect(v.night.courts[1].game, "no beginner on court 2").toBeNull();
    for (const p of adv) await sess(p, { type: "play" });
    v = await live(org);
    const game = v.night.courts[1].game;
    expect(game, "advanced players fill court 2").not.toBeNull();
    const names: string[] = game.slots.map((x: { name: string }) => x.name);
    expect(names.every((n) => n.startsWith("Adv"))).toBe(true);
    expect(v.organizer.fairness.rows.length).toBeGreaterThan(0);
  });

  test("switching back to open play puts every court on offer again", async () => {
    await club(org, { type: "play-mode", mode: "open" });
    const v = await live(org);
    expect(v.organizer.mode).toBe("open");
    expect(v.organizer.placements).toEqual([]);
  });
});
