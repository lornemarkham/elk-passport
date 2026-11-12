import { expect, test } from "@playwright/test";

/**
 * **Demo Night** from the live app: a member with no club session tonight
 * taps Courts, START DEMO NIGHT, and lands on four active courts of
 * fictional players, then runs a night. Run against a fresh server on the
 * memory store with the clock on a non-club evening:
 * `COURTQUEUE_STORE=memory COURTQUEUE_CLOCK=2026-11-11T20:18:00-07:00`.
 */
const RUN = Math.random().toString(36).slice(2, 6);

test("Courts with no session: START DEMO NIGHT, finish, score, rotate, override, extra game, break, reset", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const club: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("/api/badminton"))
      club.push(r.url());
  });
  const r = await ctx.request.post("/api/badminton/me", {
    data: {
      action: "register",
      name: `Member ${RUN}`,
      email: `member${RUN}@example.test`,
      pin: "8642",
    },
  });
  if (r.status() === 503) test.skip(true, "CourtQueue store not configured");
  expect(r.ok(), await r.text()).toBe(true);

  await page.goto("/badminton");
  await expect(page.getByTestId("try-demo-night")).toBeVisible();
  await page.getByRole("button", { name: "Courts", exact: true }).click();
  await expect(page.getByText("No club session tonight.")).toBeVisible();
  await expect(
    page.getByText("Want to see how CourtQueue works?"),
  ).toBeVisible();
  const before = club.length;
  await page.getByTestId("start-demo-night").click();

  // Four live courts, fictional players, clearly labelled.
  await expect(page.getByTestId("gn-demo-label")).toContainText(
    "25 fictional players",
  );
  await expect(
    page.locator('[data-testid^="gn-court-"][data-status="playing"]'),
  ).toHaveCount(4);
  await expect(page.getByTestId("gn-queue-row")).toHaveCount(9);
  await page.screenshot({ path: "test-results/demo-night-live.png" });

  // Finish a game with a score.
  const waiting = page.getByTestId("gn-queue-row");
  const firstInLine = await waiting
    .first()
    .locator("span.truncate")
    .innerText();
  await page.getByTestId("gn-finish-1").click();
  await page.getByTestId("gn-score-a-1").fill("21");
  await page.getByTestId("gn-score-b-1").fill("17");
  await page.getByTestId("gn-save-score-1").click();
  await expect(page.getByTestId("gn-result")).toHaveCount(1);
  await expect(page.getByTestId("gn-result-score")).toHaveText("21–17");
  await expect(
    page.locator('[data-testid^="gn-court-"][data-status="playing"]'),
  ).toHaveCount(4);
  // The front of the line went on court; the four who finished joined the back.
  await expect(waiting.first().locator("span.truncate")).not.toHaveText(
    firstInLine,
  );

  // Rotate every court.
  await page.getByTestId("gn-rotate").click();
  await expect(page.getByTestId("gn-result")).toHaveCount(5);

  // Extra game: the player at the back of the line jumps to the front.
  const back = await waiting.last().locator("span.truncate").innerText();
  await waiting.last().getByTestId("gn-extra-game").click();
  await expect(waiting.first().locator("span.truncate")).toHaveText(back);

  // Break: off the line.
  const n = await waiting.count();
  await waiting.nth(2).getByTestId("gn-break").click();
  await expect(waiting).toHaveCount(n - 1);

  // Override: put someone from the line on court 2.
  await page.getByTestId("gn-override-2").click();
  const off = page.getByLabel("Court 2: player to take off");
  const on = page.getByLabel("Court 2: player to put on");
  await off.selectOption({ index: 1 });
  await on.selectOption({ index: 1 });
  const onName = await on.locator("option:checked").innerText();
  await page.getByTestId("gn-swap-2").click();
  await expect(page.getByTestId("gn-court-2")).toContainText(onName);

  await page.screenshot({ path: "test-results/demo-night-after.png" });

  // Reset starts the night again.
  await page.getByTestId("gn-reset").click();
  await expect(page.getByTestId("gn-result")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="gn-court-"][data-status="playing"]'),
  ).toHaveCount(4);

  expect(club.length, "the demo never wrote to the club").toBe(before);
  await ctx.close();
});
