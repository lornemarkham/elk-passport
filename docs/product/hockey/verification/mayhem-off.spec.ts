import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import {
  type Person,
  act,
  declareTeam,
  night,
  noSidewaysScroll,
  ok,
  phone,
  shot,
  signUp,
  snapshot,
  setNight,
  peopleCalled,
} from "./mayhem-helpers";

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

peopleCalled("mayhem-off");
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
  setNight(lornePage.url().split("/").pop()!);
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
