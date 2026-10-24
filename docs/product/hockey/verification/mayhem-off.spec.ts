import { expect, test, type Browser, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * (Helpers shared with mayhem.spec.ts.)
 *
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

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-mayhem-off-${stamp}@example.test`;
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

interface Snapshot {
  state: {
    meId: string;
    addedPrompts: {
      id: string;
      family?: string;
      audience?: { only?: string };
    }[];
  };
  definition: {
    prompts: { id: string; scoring?: { points: number; label?: string } }[];
  };
  chirp: {
    on: boolean;
    fans: Record<string, string>;
    lines: { id: string; kind: string; text: string; about?: string }[];
  };
  play: {
    available: boolean;
    challenges: {
      id: string;
      kind: string;
      status: string;
      challenger_id: string;
      target_id: string;
    }[];
    ledger: { earner: string }[];
  };
}

let night = "";

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function phone(browser: Browser, width = 390) {
  const context = await browser.newContext({
    ...PHONE,
    viewport: { width, height: 844 },
  });
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

/** Straight to PostgREST with a member's own JWT: what a cheater with devtools has. */
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

async function refused(page: Page, action: unknown, status?: number) {
  const res = await act(page, action);
  expect(res.ok(), `${JSON.stringify(action)} should be refused`).toBe(false);
  if (status) expect(res.status()).toBe(status);
  return (await res.json().catch(() => ({}))) as { error?: string };
}

async function botLine(
  page: Page,
  kind: string,
  about?: string,
  timeout = 20_000,
) {
  let found: Snapshot["chirp"]["lines"][number] | undefined;
  await expect
    .poll(
      async () => {
        found = (await snapshot(page)).chirp.lines.find(
          (l) => l.kind === kind && (!about || l.about === about),
        );
        return Boolean(found);
      },
      { timeout, message: `Chirp Bot ${kind} line` },
    )
    .toBe(true);
  return found!;
}

async function moveStart(startsAt: Date) {
  const res = await rest(
    "lorne",
    "PATCH",
    `passport_occasions?id=eq.${night}`,
    { starts_at: startsAt.toISOString() },
  );
  expect(res.status, JSON.stringify(res.json)).toBe(200);
}

async function shot(page: Page, name: string, full = true) {
  if (!process.env.MAYHEM_SHOTS) return;
  await page.waitForTimeout(450);
  await page.screenshot({
    path: `${process.env.MAYHEM_SHOTS}/${name}.jpg`,
    fullPage: full,
    quality: 72,
    type: "jpeg",
  });
}

async function noSidewaysScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll, "sideways scroll").toBeLessThanOrEqual(client);
}

async function noTinyTargets(page: Page) {
  const tiny = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "main [role=tabpanel] button, main [role=tabpanel] a, main [role=tabpanel] summary, [role=dialog] button",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
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
  await p.page.getByRole("button", { name: "Pick my team" }).first().click();
  const picker = p.page.getByRole("dialog", { name: /WHO DO YOU BLEED FOR/i });
  await picker.getByLabel("Find your team").fill(team.split(" ").pop()!);
  await picker.getByRole("radio", { name: team, exact: true }).click();
  await expect(
    p.page.getByRole("dialog", { name: `${p.name} bleeds for the ${team}` }),
  ).toBeVisible();
  await p.page.getByRole("button", { name: "Let's go" }).click();
  await p.page
    .getByRole("region", { name: /game night/ })
    .getByRole("button", { name: "At the arena", exact: true })
    .click();
}

/** The Cup, as one phone draws it: every competitor's name and points, in order. */
async function standings(page: Page): Promise<string[]> {
  await page.reload();
  await openTab(page, "Play");
  const list = page.getByRole("list", { name: "Standings" });
  await expect(list).toBeVisible();
  return list.locator(":scope > li").evaluateAll((items) =>
    items.map((li) => {
      const name = li.querySelector("p")?.firstChild?.textContent?.trim() ?? "";
      const points =
        li
          .querySelector("[aria-label$='points']")
          ?.getAttribute("aria-label") ?? "";
      return `${name}: ${points}`;
    }),
  );
}

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
test.skip(
  process.env.MAYHEM_OFF !== "1",
  "needs a stack started with HOCKEY_MAYHEM=0",
);

/**
 * **Before mayhem-migration.sql: the night still works.** The redesigned
 * PLAY loads, the picks seal into the vault, the rivalry banner still reads
 * real allegiances (those predate this migration) — and nothing offers a
 * challenge the database cannot hold.
 */
test("PLAY without the mayhem migration", async ({ browser }) => {
  test.setTimeout(180_000);
  const lornePage = await phone(browser);
  await lornePage.goto("/hockey");
  await signUp(lornePage, "lorne");
  await lornePage.getByLabel("Your name").fill("Lorne");
  await lornePage.getByLabel("Opponent").fill("Wild");
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
  expect((await snapshot(lornePage)).play.available).toBe(false);
  const res = await lorne.page.request.post(
    `/hockey/api/occasions/${night}/invites`,
    { data: { label: "Alex" } },
  );
  const { token: invitation } = await res.json();
  const page = await phone(browser);
  await page.goto(`/hockey/join/${invitation}`);
  await page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(page, "alex");
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "I'm in" }).click();
  await expect(page).toHaveURL(new RegExp(`/hockey/${night}$`));
  const alex: Person = {
    who: "alex",
    name: "Alex",
    page,
    id: (await snapshot(page)).state.meId,
  };
  await declareTeam(lorne, "Calgary Flames");
  await declareTeam(alex, "Vancouver Canucks");

  await alex.page.reload();
  await openTab(alex.page, "Play");
  await expect(
    alex.page.getByRole("region", {
      name: "A Flames fan has entered Rogers Arena.",
    }),
  ).toBeVisible();
  await expect(
    alex.page.getByRole("button", { name: "Challenge Lorne" }),
  ).toHaveCount(0);
  await expect(
    alex.page.getByRole("region", { name: "Tonight's chaos" }),
  ).toHaveCount(0);
  await expect(
    alex.page.getByRole("region", { name: "Bold predictions" }),
  ).toBeVisible();
  await expect(
    alex.page.getByRole("region", { name: "The Sycle Cup" }),
  ).toBeVisible();
  const refusedIssue = await act(alex.page, {
    type: "issueChallenge",
    kind: "defend",
    targetId: lorne.id,
  });
  expect(refusedIssue.status()).toBe(409);
  for (const [promptId, value] of Object.entries({
    "final-score": [3, 1],
    "first-team": "canucks",
    overtime: false,
    "total-goals": 4,
    "host-beer": true,
    refs: lorne.id,
  }))
    await ok(alex.page, { type: "respond", promptId, value });
  await alex.page.reload();
  await openTab(alex.page, "Play");
  await expect(alex.page.getByText("In the vault.")).toBeVisible();
  await shot(alex.page, "50-without-migration", false);
  await noSidewaysScroll(alex.page);
});
