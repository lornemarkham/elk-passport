import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";

/**
 * **Two real colleagues use one conference.**
 *
 *   Alice starts it → opens a link and a code → a signed-out visitor learns
 *   nothing → Bob (a phone) signs up *through the link* and joins → Carol joins
 *   by code and stays hidden → Bob chooses to be seen and Alice sees him →
 *   everybody agrees on the headcount, and nobody sees Carol's name → a
 *   stranger gets 404 everywhere → the server is restarted (phase 2) and all of
 *   it is still there → Alice removes Bob → Bob is out at once.
 *
 * Separate browser contexts (separate cookie jars, separate sessions), each
 * signing up through Passport's own /auth page against a real GoTrue. No mocked
 * authentication; every permission is the database's.
 *
 *   phase 1  E2E_PHASE=before   (default)   writes /tmp/conference-acceptance.json
 *   restart the server by PID
 *   phase 2  E2E_PHASE=after                reads it
 */

const PASSWORD = "see-you-in-vancouver-9";
const STATE = "/tmp/conference-acceptance.json";
const phase = process.env.E2E_PHASE ?? "before";
const stamp = Date.now().toString(36);

type Saved = { id: string; token: string; code: string; stamp: string };
const saved = (): Saved => JSON.parse(fs.readFileSync(STATE, "utf8"));
const emailFor = (who: string, s: string) => `${who}-${s}@example.test`;

async function signUp(page: Page, who: string, s: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who, s));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function logIn(page: Page, who: string, s: string) {
  await page.getByLabel("Email address").fill(emailFor(who, s));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function person(browser: Browser, mobile = false) {
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : {},
  );
  return { context, page: await context.newPage() };
}

test.describe.configure({ mode: "serial" });

test("Alice starts a conference; Bob and Carol join; they share one roster", async ({
  browser,
}) => {
  test.skip(phase !== "before", "phase 2 runs after a server restart");
  test.setTimeout(240_000);
  const alice = await person(browser);
  const bob = await person(browser, true);
  const carol = await person(browser);
  const eve = await person(browser);
  const visitor = await person(browser);

  // ── Alice ──
  await alice.page.goto("/conferences");
  await expect(
    alice.page.getByText("Conferences aren't open here yet."),
  ).toHaveCount(0);
  await alice.page.getByRole("link", { name: "Sign in to Passport" }).click();
  await signUp(alice.page, "alice", stamp);
  await alice.page.waitForURL("**/conferences");
  await alice.page.getByRole("link", { name: "Start a conference" }).click();
  await alice.page.getByLabel("What's it called?").fill("Sycle Vancouver 2026");
  await alice.page
    .getByLabel("Free-time ideas start from")
    .selectOption("vancouver");
  await alice.page.getByLabel("Starts").fill("2026-10-24");
  await alice.page.getByRole("button", { name: "Create it" }).click();
  await expect(
    alice.page.getByRole("heading", { name: "Organiser settings" }),
  ).toBeVisible();
  const id = alice.page.url().split("/conferences/")[1]!.split("/")[0]!;

  await alice.page.getByRole("button", { name: "Turn on a code" }).click();
  const code = (await alice.page
    .getByTestId("access-code")
    .textContent())!.trim();
  await alice.page.getByRole("button", { name: "New link" }).click();
  const token = (await alice.page
    .getByTestId("invite-link")
    .first()
    .getAttribute("data-token"))!;
  fs.writeFileSync(STATE, JSON.stringify({ id, token, code, stamp }));

  // ── A signed-out visitor holding the link: invited, but can't get in ──
  await visitor.page.goto(`/conferences/join/${token}`);
  await expect(
    visitor.page.getByRole("heading", { name: "Sycle Vancouver 2026" }),
  ).toBeVisible();
  await expect(visitor.page.getByText("Who's here")).toHaveCount(0);
  await expect(visitor.page.getByText(/need a Passport account/)).toBeVisible();
  const direct = await visitor.page.goto(`/conferences/${id}`);
  expect(direct?.status()).toBe(404);
  const api = await visitor.page.request.get(`/api/conferences/${id}/me`);
  expect([401, 404, 405]).toContain(api.status());

  // ── Bob, on a phone, signs up *through the link* and joins ──
  await bob.page.goto(`/conferences/join/${token}`);
  await bob.page.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(bob.page, "bob", stamp);
  await bob.page.waitForURL(`**/conferences/join/${token}`);
  await bob.page.getByRole("button", { name: "I'm in" }).click();
  await bob.page.waitForURL(`**/conferences/${id}`);
  await expect(bob.page.getByText("Who's here · 2")).toBeVisible();
  await expect(bob.page.getByTestId("visible-people")).toHaveCount(0);

  // ── Carol joins with the code, typed sloppily, and stays hidden ──
  await carol.page.goto("/conferences");
  await carol.page
    .getByLabel("Conference code")
    .fill(code.toLowerCase().replace(/-/g, " "));
  await carol.page.getByRole("button", { name: "Let me in" }).click();
  await carol.page.waitForURL("**/auth**");
  await signUp(carol.page, "carol", stamp);
  await carol.page.waitForURL("**/conferences");
  await carol.page
    .getByLabel("Conference code")
    .fill(code.toLowerCase().replace(/-/g, " "));
  await carol.page.getByRole("button", { name: "Let me in" }).click();
  await carol.page.waitForURL(`**/conferences/${id}`);
  await expect(carol.page.getByText("Who's here · 3")).toBeVisible();
  await carol.page.getByLabel("Your name here").fill("Carol (secret)");
  await carol.page.getByRole("button", { name: "Save" }).click();
  await expect(carol.page.getByText("Saved.")).toBeVisible();

  // ── Bob chooses to be seen. Alice and Carol see him; nobody sees Carol ──
  await bob.page.getByLabel("Your name here").fill("Bob");
  await bob.page.getByLabel("Show my name to other colleagues.").check();
  await bob.page.getByRole("button", { name: "Save" }).click();
  await expect(bob.page.getByText("Saved.")).toBeVisible();
  // Carol does not reload: the page keeps itself honest while it is open.
  await expect(carol.page.getByTestId("visible-people")).toHaveText("Bob", {
    timeout: 25_000,
  });
  await alice.page.goto(`/conferences/${id}`);
  await expect(alice.page.getByText("Who's here · 3")).toBeVisible();
  await expect(alice.page.getByTestId("visible-people")).toHaveText("Bob");
  await bob.page.reload();
  await expect(bob.page.getByText("Who's here · 3")).toBeVisible();
  await expect(bob.page.getByText("Carol")).toHaveCount(0);

  // ── The organiser sees everyone; Bob can't reach her settings ──
  // On the durable store Arrivals opens only with CONFERENCE_ARRIVALS=on (the
  // owner applied its migration). This server doesn't set it, so it stays shut
  // for everybody, the organiser included, and asks ADS-B nothing.
  await alice.page.goto(`/conferences/${id}/arrivals`);
  await expect(alice.page.getByText("Arrivals isn't open yet.")).toBeVisible();
  const closed = await alice.page.request.get(
    `/api/conferences/${id}/arrivals`,
  );
  expect(closed.status()).toBe(404);

  await alice.page.goto(`/conferences/${id}/admin`);
  await expect(
    alice.page.getByTestId("members").getByRole("listitem"),
  ).toHaveCount(3);
  await bob.page.goto(`/conferences/${id}/admin`);
  await bob.page.waitForURL(`**/conferences/${id}`);

  // ── A signed-in stranger can't tell it exists ──
  await eve.page.goto("/auth");
  await signUp(eve.page, "eve", stamp);
  await eve.page.waitForURL(/\/discovery|\/conferences/);
  for (const path of [
    `/conferences/${id}`,
    `/conferences/${id}/admin`,
    `/conferences/${id}/arrivals`,
    `/conferences/${id}/discover`,
  ]) {
    const res = await eve.page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  const wrongCode = await eve.page.goto("/conferences");
  expect(wrongCode?.status()).toBe(200);
  await eve.page.getByLabel("Conference code").fill("AAA-AAA-AAA");
  await eve.page.getByRole("button", { name: "Let me in" }).click();
  await expect(eve.page.getByText("That's not a code we know.")).toBeVisible();

  for (const p of [alice, bob, carol, eve, visitor]) await p.context.close();
});

test("after a server restart everything is still there, and removal is immediate", async ({
  browser,
}) => {
  test.skip(phase !== "after", "phase 1 sets this up");
  test.setTimeout(120_000);
  const { id, token, stamp: s } = saved();

  const alice = await person(browser);
  await alice.page.goto("/auth");
  await logIn(alice.page, "alice", s);
  await alice.page.waitForURL(/\/discovery|\/conferences/);
  await alice.page.goto("/conferences");
  await expect(alice.page.getByText("Sycle Vancouver 2026")).toBeVisible();
  await alice.page.goto(`/conferences/${id}`);
  await expect(alice.page.getByText("Who's here · 3")).toBeVisible();
  await expect(alice.page.getByTestId("visible-people")).toHaveText("Bob");

  const bob = await person(browser, true);
  await bob.page.goto("/auth");
  await logIn(bob.page, "bob", s);
  await bob.page.waitForURL(/\/discovery|\/conferences/);
  await bob.page.goto(`/conferences/${id}`);
  await expect(bob.page.getByText("Who's here · 3")).toBeVisible();
  await expect(bob.page.getByLabel("Your name here")).toHaveValue("Bob");
  // A used link takes somebody already in home rather than lecturing them.
  await bob.page.goto(`/conferences/join/${token}`);
  await bob.page.getByRole("button", { name: "I'm in" }).click();
  await bob.page.waitForURL(`**/conferences/${id}`);

  // ── Alice removes Bob. Bob's next request is a 404 ──
  await alice.page.goto(`/conferences/${id}/admin`);
  const bobRow = alice.page
    .getByTestId("members")
    .getByRole("listitem")
    .filter({ hasText: "Bob" });
  alice.page.once("dialog", (d) => d.accept());
  await bobRow.getByRole("button", { name: /Remove/ }).click();
  await expect(
    alice.page.getByTestId("members").getByRole("listitem"),
  ).toHaveCount(2);
  const gone = await bob.page.goto(`/conferences/${id}`);
  expect(gone?.status()).toBe(404);
  await bob.page.goto("/conferences");
  await expect(bob.page.getByText("Sycle Vancouver 2026")).toHaveCount(0);
});
