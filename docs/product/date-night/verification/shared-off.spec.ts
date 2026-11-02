import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * **Before the packing and memories migrations** (mission 495). Run with
 * `SHARED_OFF=1` against a stack where
 * `20261101000000_passport_adventure_together.sql` and
 * `20261102100000_passport_adventure_packing.sql` are not applied — the
 * state production may be in. The night still starts and plans; packing and
 * memories say they aren't switched on, and don't open as if they worked.
 */
test.skip(process.env.SHARED_OFF !== "1", "needs a stack without them");

test("packing and memories say they're off, and the night still works", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`off-${stamp}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("first-date-forever-7");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
  await page.goto("/datenight");
  await page.getByRole("button", { name: "Let's find some trouble" }).click();
  await page.waitForURL(/\/night\//);

  for (const id of ["packing-panel", "memories-panel"]) {
    const panel = page.getByTestId(id);
    await expect(panel).toHaveAttribute("data-off", "true");
    await expect(panel).toContainText("Not switched on yet");
    await expect(panel.locator("summary")).toHaveCount(0);
  }
  await expect(page.getByTestId("invite-card")).not.toContainText("packs");

  // Planning doesn't depend on them.
  await page
    .getByTestId("evening")
    .filter({ hasText: "King Eddie Lake" })
    .getByTestId("choose-evening")
    .click();
  await expect(page.getByTestId("evening-plan")).toBeVisible();
  if (process.env.SHOTS === "1") {
    const dir = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
    fs.mkdirSync(dir, { recursive: true });
    await page.getByTestId("packing-panel").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(dir, "markham-13-shared-off.png"),
    });
  }
});
