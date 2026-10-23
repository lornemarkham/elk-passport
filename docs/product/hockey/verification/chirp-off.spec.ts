import { expect, test, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Before chirp-migration.sql: the night exactly as it was.**
 *
 * Run against a stack started with `HOCKEY_CHIRP=0` (no `nhl_team`, no
 * `bot_*` columns, the original moments policy) — which is production until
 * somebody pastes the migration. The night loads, the chat works, and there
 * is no team ask, no Chirp Bot and no Chirp Someone; the actions say so
 * plainly instead of failing.
 *
 *   HOCKEY_CHIRP=0 node docs/product/hockey/verification/stack.mjs start
 *   CHIRP_OFF=1 E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification chirp-off
 */

test.skip(!process.env.CHIRP_OFF, "needs a stack started with HOCKEY_CHIRP=0");

const stamp = Date.now().toString(36);

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page
    .getByLabel("Email address")
    .fill(`${who}-off-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("no migration: the night and its chat work, with no teams and no Chirp Bot", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/hockey");
  await signUp(page, "host");
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const night = page.url().split("/").pop()!;
  await page.getByRole("button", { name: /Skip/ }).click();

  await expect(page.getByText("WHO DO YOU BLEED FOR?")).toHaveCount(0);
  await openTab(page, "Chat");
  await page.getByLabel("Say something to the group").fill("still works");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("still works")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "🔥 Chirp Someone" }),
  ).toHaveCount(0);

  const snap = await (
    await page.request.get(`/hockey/api/occasions/${night}`)
  ).json();
  expect(snap.chirp).toMatchObject({ available: false, lines: [], fans: {} });

  const act = (data: unknown) =>
    page.request.post(`/hockey/api/occasions/${night}/actions`, {
      data: data as never,
    });
  expect((await act({ type: "setTeam", team: "CGY" })).status()).toBe(409);
  expect((await act({ type: "chirpLook" })).ok()).toBe(true);
  await openTab(page, "Group");
  await expect(
    page.getByRole("button", { name: "Who do you bleed for?" }),
  ).toHaveCount(0);
  await context.close();
});
