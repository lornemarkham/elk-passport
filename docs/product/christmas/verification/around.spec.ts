import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * **Christmas Around You — the owner's acceptance test, on a phone.**
 *
 *   Open Christmas with Vernon selected → see real upcoming things →
 *   change location to Kelowna → see Kelowna's → select an event → add it to
 *   a Christmas adventure → add a light display → share the adventure.
 *
 * Real GoTrue accounts and Postgres RLS (stack.mjs); Atlas is the stand-in
 * serving Atlas's real corpus of 2026-10-24. Run with the same server as
 * christmas.spec.ts:
 *
 *   E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification around.spec
 */
const SHOTS = path.resolve(__dirname, "../screenshots");
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS === "1")
    await page.screenshot({
      path: path.join(SHOTS, `${name}.png`),
      fullPage: true,
    });
};
const stamp = Date.now().toString(36);

test("Vernon, then Kelowna: an event and a light display become a shared Christmas adventure", async ({
  page,
}) => {
  // 1 — Vernon is where Christmas opens, with real upcoming things.
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around Vernon/ }),
  ).toBeVisible();
  await expect(page.getByTestId("atlas-down")).toHaveCount(0);
  await expect(
    page.getByTestId("around-soon").getByTestId("find-card").first(),
  ).toContainText("Craft Culture Holiday Market 2026");
  await expect(page.getByTestId("around-lights-pins")).toContainText(
    "SilverStar Annual Light Up",
  );
  await shot(page, "08-around-vernon");

  // 2 — Kelowna.
  await page
    .getByTestId("town-chips")
    .getByRole("link", { name: "Kelowna", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around Kelowna/ }),
  ).toBeVisible();
  const event = page
    .getByTestId("around-soon")
    .locator('[data-testid="find-card"]', {
      hasText: "Craft Culture Holiday Market 2026",
    });
  await expect(event).toContainText("Dates from Atlas");
  await expect(event).toContainText("4 km");
  await expect(page.getByTestId("around-lights-pins")).not.toContainText(
    "SilverStar",
  );
  await shot(page, "09-around-kelowna");

  // 3 — the event, and a light display, into one Christmas day.
  await event.getByTestId("pick-find").click();
  const light = page
    .getByTestId("around-lights-pins")
    .locator('[data-testid="pin-card"]', { hasText: "Kelowna Light Up" });
  await light.getByTestId("add-to-tour").click();
  await expect(page.getByTestId("pick-tray")).toContainText(
    "2 in your Christmas day",
  );
  await page.getByTestId("plan-picks").click();
  await expect(page).toHaveURL(/\/christmas\/plan\?.*lights=seed-kelowna/);
  await page.getByTestId("plan-sign-in").click();

  // 4 — an account, then the plan, on the day Atlas dates the market.
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`kelowna-${stamp}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("jingle-all-the-way-9");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/christmas\/plan/);
  const picks = page.getByTestId("plan-picks-list");
  await expect(picks).toContainText("Craft Culture Holiday Market 2026");
  await expect(picks).toContainText("Downtown Kelowna Light Up");
  await expect(picks).toContainText("Light display · from the community map");
  await page.getByTestId("plan-shape-evening").click();
  await page.getByTestId("plan-town").selectOption("kelowna");
  await page.getByTestId("plan-date").fill("2026-12-04");
  await page.getByTestId("plan-title").fill("Kelowna Christmas night");
  await page.getByTestId("plan-start").click();
  await page.waitForURL(/\/christmas\/adventure\//, { timeout: 90_000 });

  // 5 — both are on the adventure, and it can be shared.
  await expect(
    page.getByRole("heading", { name: "Kelowna Christmas night" }),
  ).toBeVisible();
  await expect(page.locator("#plan")).toContainText(
    "Craft Culture Holiday Market 2026",
  );
  await expect(page.locator("#plan")).toContainText(
    "Downtown Kelowna Light Up",
  );
  await shot(page, "10-around-adventure");
  await page.getByRole("button", { name: "Link for one person" }).click();
  const invite = (
    await page.getByTestId("invite-url").first().textContent()
  )?.trim();
  expect(invite).toMatch(/\/adventures\/join\//);

  // 6 — the person it was shared with can open it.
  const guest = await page
    .context()
    .browser()!
    .newContext({
      viewport: { width: 390, height: 844 },
    });
  const g = await guest.newPage();
  await g.goto(new URL(invite!).pathname);
  await expect(g.getByRole("link", { name: "Sign in to join" })).toBeVisible();
  await guest.close();
});
