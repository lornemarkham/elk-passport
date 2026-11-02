import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * **Why packing says what it says** (SHARED-ADVENTURE.md). Production reported
 * "What we're bringing — Not switched on yet" with the packing table
 * applied. Until the shared-adventure mission (SHARED-ADVENTURE.md) the page turned every failure into that one
 * sentence; now it names the failure. Run once per state, with the stack put
 * into it first (`PACKING_TROUBLE=<kind>`, SHARED-ADVENTURE.md "Packing"):
 *
 * - `unseen`  — the table exists but PostgREST's schema cache predates it
 *   (the migration run without `NOTIFY pgrst, 'reload schema'` reaching it):
 *   PGRST205.
 * - `refused` — the table exists without the migration's grant to
 *   `authenticated`: 42501.
 * - `ok`      — after the fix: the list opens and takes an item.
 */
const kind = process.env.PACKING_TROUBLE;
test.skip(!kind, "needs the stack put into a packing state first");

test(`packing, ${kind}`, async ({ page }) => {
  const stamp = Date.now().toString(36);
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page
    .getByLabel("Email address")
    .fill(`pk-${kind}-${stamp}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("first-date-forever-7");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
  await page.goto("/datenight");
  await page.getByRole("button", { name: "Let's find some trouble" }).click();
  await page.waitForURL(/\/night\//);
  await page.getByRole("tab", { name: /^Together/ }).click();
  const panel = page.getByTestId("packing-panel");

  if (kind === "ok") {
    await expect(panel).not.toHaveAttribute("data-off", "true");
    await page.getByLabel("Add something to bring").fill("Hand warmers");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page
        .getByTestId("packing")
        .getByRole("checkbox", { name: /Hand warmers/ }),
    ).toBeVisible();
  } else {
    await expect(panel).toHaveAttribute("data-off", "true");
    const why = page.getByTestId("packing-panel-why");
    if (kind === "unseen") {
      await expect(panel).toContainText("Not switched on yet");
      await expect(why).toContainText("NOTIFY pgrst, 'reload schema';");
      await expect(why).toContainText("(PGRST205)");
    }
    if (kind === "refused") {
      await expect(panel).toContainText("Not switched on properly");
      await expect(why).toContainText("GRANTs are missing");
      await expect(why).toContainText("(42501)");
    }
  }
  if (process.env.SHOTS === "1") {
    const dir = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
    fs.mkdirSync(dir, { recursive: true });
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(dir, `magic-packing-${kind}.png`),
    });
  }
});
