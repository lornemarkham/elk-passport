import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **"Make the night come alive" deployed before alive-migration.sql** —
 * production's state until someone runs it in the SQL editor.
 *
 * Proves: the night loads and works; teams and Chirp Bot (chirp-migration.sql)
 * still work; nobody is asked where they're watching, nothing about the couch
 * is shown, and the API refuses to store it rather than failing somewhere else.
 *
 *   HOCKEY_ALIVE=0 node stack.mjs start   # chirp applied, alive not
 *   ALIVE_OFF=1 E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification alive-off
 */

test.skip(!process.env.ALIVE_OFF, "needs a stack started with HOCKEY_ALIVE=0");

const stamp = Date.now().toString(36);

test("without alive-migration.sql: the night works, the couch is simply absent", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/hockey");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page
    .getByLabel("Email address")
    .fill(`alive-off-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const night = page.url().split("/").pop()!;
  await page.getByRole("button", { name: /Skip/ }).click();

  const welcome = page.getByRole("region", { name: /game night/ });
  await expect(welcome).toContainText("Who do you bleed for?");
  await expect(welcome).not.toContainText("Where are you watching?");
  await expect(
    page.getByRole("region", { name: "Our game plan" }),
  ).toBeVisible();

  const snap = await (
    await page.request.get(`/hockey/api/occasions/${night}`)
  ).json();
  expect(snap.crowd.available).toBe(false);
  expect(snap.chirp.available).toBe(true);

  const refused = await page.request.post(
    `/hockey/api/occasions/${night}/actions`,
    { data: { type: "setWatching", where: "couch" } },
  );
  expect(refused.status()).toBe(409);

  // Teams still work, and the welcome goes once they're answered.
  await welcome.getByRole("button", { name: "Pick my team" }).click();
  await page
    .getByRole("dialog", { name: /WHO DO YOU BLEED FOR/i })
    .getByRole("radio", { name: "Calgary Flames" })
    .click();
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(welcome).toBeHidden();
  await openTab(page, "Group");
  await expect(
    page.getByRole("region", { name: "Where you're watching" }),
  ).toHaveCount(0);
  await expect(page.getByText("Calgary Flames").first()).toBeVisible();
  await context.close();
});
