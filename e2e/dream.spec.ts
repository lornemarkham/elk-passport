import { test, expect, type Page } from "@playwright/test";

/**
 * **Dream (`/labs/dream`, M1130), in a real browser.**
 *
 * - **Real:** the Next server, Passport's readers and Day Builder, the
 *   endpoint, the browser, the URL as the conversation, the hand-off to `/go`.
 * - **Stand-in Atlas:** `scripts/critic/atlas-mock.mjs` serving a committed
 *   snapshot of a real `/discovery/candidates` body. The places are Atlas's;
 *   the server is not Atlas.
 * - **Needs `GHAD_DREAM=on`** on the server under test (`next start` is
 *   production, where Dream is off). Without it the suite says so and skips.
 */

const KIDS =
  "I have two kids tomorrow, $40 and four hours. Find skating and hot chocolate within 10 km.";

async function open(page: Page, query = "") {
  const response = await page.goto(`/labs/dream${query}`);
  test.skip(
    response?.status() === 404,
    "Dream is off on this server — start it with GHAD_DREAM=on",
  );
}

const scenes = (page: Page) => page.locator("section[aria-labelledby^=scene-]");

test.describe("Dream", () => {
  test("opens on the three lines, one box and two doors — nothing asked first", async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Dream when you don’t.",
    );
    await expect(
      page.getByLabel("Tell me about the day you want"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Surprise me" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Help me figure it out" }),
    ).toBeVisible();
    // Traditional browsing is one tap away, never replaced.
    await expect(
      page.getByRole("link", { name: "Discover" }).last(),
    ).toHaveAttribute("href", "/discovery");
  });

  test("a sentence becomes scenes of real places, said back, and kept in the URL", async ({
    page,
  }) => {
    await open(page);
    await page.getByLabel("Tell me about the day you want").fill(KIDS);
    await page.keyboard.press("Enter");
    await expect(scenes(page).first()).toBeVisible();
    await expect(page.getByText("$40", { exact: true })).toBeVisible();
    await expect(page.getByText("within 10 km of Vernon, BC")).toBeVisible();
    expect(new URL(page.url()).searchParams.getAll("say")).toEqual([KIDS]);
    // Every lead names what Atlas lists for it.
    await expect(
      scenes(page)
        .first()
        .getByText(/^Atlas lists/),
    ).toBeVisible();
  });

  test("changing one thing leaves the rest alone, and Back undoes it", async ({
    page,
  }) => {
    await open(page, `?say=${encodeURIComponent(KIDS)}&at=vernon`);
    await expect(scenes(page)).toHaveCount(2);
    await page.getByLabel("Change anything").fill("skip the hot chocolate");
    await page.keyboard.press("Enter");
    await expect(scenes(page)).toHaveCount(1);
    await expect(page.getByText("within 10 km of Vernon, BC")).toBeVisible();
    expect(new URL(page.url()).searchParams.getAll("say")).toHaveLength(2);
    await page.goBack();
    await expect(scenes(page)).toHaveCount(2);
  });

  test("go when ready: the day opens in Go Have a Day with the same places", async ({
    page,
  }) => {
    await open(page, `?say=${encodeURIComponent(KIDS)}&at=vernon`);
    const go = page.getByRole("link", { name: /Plan it, save it, start it/ });
    await expect(go).toBeVisible();
    const href = await go.getAttribute("href");
    expect(href).toMatch(/^\/go\?say=/);
    expect(href).toContain("at=vernon");
    expect(new URL(href!, "http://x").searchParams.get("with")).toBeTruthy();
    await go.click();
    await expect(page).toHaveURL(/\/go\?/);
    await expect(page.getByTestId("go-day")).toBeVisible({ timeout: 30_000 });
  });

  test("help me figure it out: four pairs of real photographs, then an answer", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: "Help me figure it out" }).click();
    const question = page.locator("#figure-q");
    await expect(question).toBeVisible();
    const pairs = page.locator(
      "section[aria-labelledby=figure-q] button[aria-label]",
    );
    for (let i = 0; i < 4; i++) {
      if (!(await question.isVisible().catch(() => false))) break;
      await expect(pairs).toHaveCount(2);
      await pairs.first().click();
      await page.waitForTimeout(600);
    }
    await expect(scenes(page).first()).toBeVisible();
    // The taps were written as a sentence the person can read.
    expect(new URL(page.url()).searchParams.get("say")).toBeTruthy();
  });

  test("surprise me deals real places, and deals again", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Surprise me" }).click();
    await expect(scenes(page).first()).toBeVisible();
    const first = await scenes(page)
      .first()
      .locator("h2, a span")
      .first()
      .textContent();
    await page
      .getByRole("button", { name: "Surprise me again" })
      .first()
      .click();
    await expect
      .poll(async () =>
        scenes(page)
          .first()
          .locator("a[aria-label$='— details']")
          .getAttribute("aria-label"),
      )
      .not.toBe(first);
  });

  test("reduced motion holds the reel still", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await open(page);
    const reel = page.locator("[data-still]");
    await expect(reel).toHaveCount(1);
    await context.close();
  });
});
