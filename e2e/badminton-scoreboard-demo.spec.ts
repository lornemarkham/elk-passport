import { devices, expect, test, type Page } from "@playwright/test";

/**
 * **Badminton Game Night, the scoreboard demo** (`/badminton/game-night`),
 * on a desktop and on a phone: 25 fictional players, 4 doubles courts,
 * levels, a score entered by hand, wins and losses, the waiting queue with
 * estimated waits, automatic rotation, a reload that carries on, and Reset
 * Demo. No sign-in, server or database (owner brief M737, 2026-11-11).
 */

const recordOf = async (page: Page, name: string) =>
  page
    .locator(`[data-testid="gn-player-row"][data-player="${name}"]`)
    .getByTestId("gn-record")
    .innerText();

for (const [label, device] of [
  ["desktop", devices["Desktop Chrome"]],
  ["phone", devices["Pixel 7"]],
] as const) {
  test.describe(label, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });

    test("a whole scored night: courts, queue, a score, records, rotation, reload, reset", async ({
      page,
    }) => {
      await page.goto("/badminton/game-night");
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      await expect(page.getByTestId("gn-demo-label")).toContainText(
        "fictional",
      );
      await expect(page.getByTestId("gn-player-row")).toHaveCount(25);
      for (const court of [1, 2, 3, 4])
        await expect(page.getByTestId(`gn-court-${court}`)).toHaveAttribute(
          "data-status",
          "playing",
        );
      await expect(page.getByTestId("gn-queue-row")).toHaveCount(9);
      await expect(page.getByTestId("gn-wait").first()).toHaveText(/~\d+ min/);
      await expect(page.getByTestId("gn-clock")).toHaveText("7:00 pm");

      // Who is on court 1, team A? Their record moves when the score is in.
      const court1 = page.getByTestId("gn-court-1");
      const teamA = await court1
        .locator(".truncate.font-bold")
        .first()
        .innerText();
      expect(await recordOf(page, teamA)).toBe("0–0");

      await page.getByTestId("gn-advance-5").click();
      await expect(page.getByTestId("gn-clock")).toHaveText("7:05 pm");

      // A score that can't finish a game is refused…
      await page.getByTestId("gn-finish-1").click();
      await page.getByTestId("gn-score-a-1").fill("21");
      await page.getByTestId("gn-score-b-1").fill("20");
      await page.getByTestId("gn-save-score-1").click();
      await expect(
        page.getByTestId("gn-demo").getByRole("alert"),
      ).toContainText("first to 21");
      // …and a real one is kept.
      await page.getByTestId("gn-score-b-1").fill("17");
      await page.getByTestId("gn-save-score-1").click();
      await expect(page.getByTestId("gn-result-score").first()).toHaveText(
        "21–17",
      );
      expect(await recordOf(page, teamA)).toBe("1–0");

      // Rotation: the four went to the back, and four from the line took court 1.
      await expect(court1).toHaveAttribute("data-status", "playing");
      await expect(court1).not.toContainText(teamA);
      await expect(page.getByTestId("gn-queue-row").last()).toBeVisible();
      const lastFour = await page
        .getByTestId("gn-queue-row")
        .evaluateAll((rows) => rows.slice(-4).map((r) => r.textContent ?? ""));
      expect(lastFour.some((t) => t.includes(teamA))).toBe(true);

      // The night plays on by itself.
      await page.getByTestId("gn-advance-15").click();
      await page.getByTestId("gn-advance-15").click();
      await expect(page.getByTestId("gn-clock")).toHaveText("7:35 pm");
      expect(await page.getByTestId("gn-result").count()).toBeGreaterThan(3);

      // Kept in this browser: a reload carries on where it was.
      await page.reload();
      await expect(page.getByTestId("gn-clock")).toHaveText("7:35 pm");
      await expect(page.getByTestId("gn-result-score").last()).toBeVisible();
      expect(await recordOf(page, teamA)).toMatch(/^[1-9]\d*–\d+$/);

      // No sideways scrolling on any screen.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await page.getByTestId("gn-reset").click();
      await expect(page.getByTestId("gn-clock")).toHaveText("7:00 pm");
      await expect(page.getByTestId("gn-result")).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("gn-clock")).toHaveText("7:00 pm");
    });
  });
}
