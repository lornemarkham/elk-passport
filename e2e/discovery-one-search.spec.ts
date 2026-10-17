import { mkdirSync } from "node:fs";
import { devices, expect, test, type Page } from "@playwright/test";

/**
 * **One search, one conversation, one Discovery.**
 *
 * The acceptance tests for removing Discovery's second search box. Against
 * the Atlas stand-in serving the committed real candidates body
 * (`scripts/critic/atlas-mock.mjs`), so every card is a real Atlas subject.
 *
 *   node scripts/critic/atlas-mock.mjs docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz 3141
 *   ATLAS_API_URL=http://127.0.0.1:3141 … npx next start -p 3140
 *   E2E_PORT=3140 npx playwright test e2e/discovery-one-search.spec.ts
 *
 * Screenshots land in `docs/product/discovery-one-search/`.
 */
const SHOTS = "docs/product/discovery-one-search";

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function say(page: Page, said: string) {
  const before = await page.getByTestId("ask-turn").count();
  await page.getByTestId("ask-input").fill(said);
  await page.getByTestId("ask-submit").click();
  await expect(page.getByTestId("ask-turn")).toHaveCount(before + 1);
  await expect(page.getByTestId("ask-answer")).toBeVisible();
}

const said = (page: Page) =>
  page.evaluate(() =>
    new URLSearchParams(window.location.search).getAll("ask"),
  );
const answerTitles = (page: Page) =>
  page
    .getByTestId("ask-answer")
    .getByTestId("possibility-link")
    .evaluateAll((links) => links.map((l) => l.getAttribute("aria-label")));
const sectionTitles = (page: Page) =>
  page
    .getByTestId("discovery-section")
    .getByTestId("possibility-link")
    .evaluateAll((links) => links.map((l) => l.getAttribute("aria-label")));

test.describe("one search", () => {
  test("there is one text box, and the old one is gone", async ({ page }) => {
    await page.goto("/discovery");
    await expect(page.getByTestId("ask-input")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(1);
    await expect(page.getByRole("search")).toHaveCount(1);
    await expect(page.getByPlaceholder(/Search places/)).toHaveCount(0);
    await expect(page.getByTestId("search-scope")).toHaveCount(0);
    await shoot(page, "desktop-01-arrive");
  });

  test("real results start on the first screen", async ({ page }) => {
    await page.goto("/discovery");
    const first = page.getByTestId("possibility").first();
    await expect(first).toBeVisible();
    const y = await first.evaluate(
      (el) => el.getBoundingClientRect().top + window.scrollY,
    );
    // Was 1,039px at 1440×900 with the second box above the results.
    expect(y).toBeLessThan(page.viewportSize()!.height);
    await expect(first).toHaveAttribute("data-has-image", /true|venue/);
  });

  test("search from the top finds a place by name", async ({ page }) => {
    await page.goto("/discovery");
    await say(page, "Davison Orchards");
    const titles = await answerTitles(page);
    // The place named leads; what follows is there because Atlas's own
    // description mentions it (the café at the orchard), and says so.
    expect(titles[0]).toMatch(/Davison/i);
    await expect(page.getByTestId("ask-answer")).toContainText(
      "The name you said",
    );
  });

  test("an old ?q= link becomes the first sentence, and only one state is written back", async ({
    page,
  }) => {
    await page.goto("/discovery?q=Davison+Orchards");
    await expect(page.getByTestId("ask-turn")).toHaveCount(1);
    await say(page, "with my daughter");
    expect(await said(page)).toEqual(["Davison Orchards", "with my daughter"]);
    expect(new URL(page.url()).searchParams.get("q")).toBeNull();
  });
});

test.describe("one conversation", () => {
  test("follow-ups keep what was said, constraints change in place, and the page listens", async ({
    page,
  }) => {
    await page.goto("/discovery?at=vernon");
    await say(page, "Something fun with my daughter.");
    await say(page, "Somewhere indoors.");
    await say(page, "Within 30 minutes.");
    await say(page, "Actually, somewhere we can eat too.");
    const heard = page.getByTestId("ask-understood");
    await expect(heard).toContainText("with a kid");
    await expect(heard).toContainText("staying dry");
    await expect(heard).toContainText("up to 30 min away");
    await expect(heard).toContainText("eat & drink");
    expect(await said(page)).toHaveLength(4);
    await shoot(page, "desktop-02-four-sentences");

    // Changing a constraint replaces it rather than adding another.
    await say(page, "Actually, outside is fine.");
    await expect(heard).not.toContainText("staying dry");
    await expect(heard).toContainText("with a kid");
  });

  test("results update with each sentence", async ({ page }) => {
    await page.goto("/discovery?at=vernon");
    await say(page, "Get outside");
    const outside = await sectionTitles(page);
    await say(page, "Actually, somewhere indoors");
    await expect
      .poll(async () => (await sectionTitles(page)).join("|"))
      .not.toBe(outside.join("|"));
  });

  test("clearing the conversation brings the page back", async ({ page }) => {
    await page.goto("/discovery");
    await say(page, "Somewhere indoors");
    await page.getByTestId("ask-clear").click();
    await expect(page.getByTestId("ask-turn")).toHaveCount(0);
    await expect(page.getByTestId("ask-answer")).toHaveCount(0);
    expect(await said(page)).toEqual([]);
    await expect(page.getByTestId("discovery-section").first()).toBeVisible();
  });

  test("an activity, said or tapped, is answered with places that do it", async ({
    page,
  }) => {
    // No town: the stand-in serves no distance readings, and with an origin
    // the "around here" activities need them.
    await page.goto("/discovery");
    await say(page, "Let's go hiking");
    await expect(page.getByTestId("ask-heading")).toContainText(/Hiking/i);
    expect((await answerTitles(page)).length).toBeGreaterThan(0);
    const alternative = page.getByTestId("ask-alternative").first();
    const label = (await alternative.textContent())!.trim();
    await alternative.click();
    await expect(page.getByTestId("ask-turn").last()).toContainText(label);
  });

  test("Refine still holds the rows, and a kind narrows the answer", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "Something fun this weekend");
    await page.getByTestId("ghad-refine").click();
    const kinds = page.locator('[data-testid="ghad-choice"][data-row="kind"]');
    await expect(kinds.first()).toBeVisible();
    await kinds
      .filter({ hasText: /Events/i })
      .first()
      .click();
    await expect(page.getByTestId("ask-answer")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("kind")).toBe("Event");
  });

  test("a card opens its entity page, and the way back carries the conversation", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "Davison Orchards");
    const link = page
      .getByTestId("ask-answer")
      .getByTestId("possibility-link")
      .first();
    const href = (await link.getAttribute("href"))!;
    expect(decodeURIComponent(href)).toContain("ask=Davison+Orchards");
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === href.split("?")[0] &&
          r.request().resourceType() !== "image",
      ),
      link.click(),
    ]);
    expect(response.status()).toBeLessThan(500);
    await expect(page).toHaveURL(new RegExp(href.split("?")[0]!));
  });
});

test.describe("when something is down", () => {
  test("the model is unavailable: the words alone still answer", async ({
    page,
  }) => {
    await page.route("**/api/discovery/ask", (route) =>
      route.fulfill({ status: 503, body: "down" }),
    );
    await page.goto("/discovery");
    await say(page, "Something fun with my daughter");
    await expect(page.getByTestId("ask-understood")).toContainText(
      "with a kid",
    );
    expect((await answerTitles(page)).length).toBeGreaterThan(0);
  });
});

// The phone, without the browser type (a describe cannot change that).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...PIXEL } = devices["Pixel 7"];

test.describe("phone", () => {
  test.use(PIXEL);

  // Kept short: headless Chromium on this host crashes an idle phone page on
  // Discovery after a few seconds (see the M300 notes).
  test("search from the top on a phone, results on the first screen, no sideways scroll", async ({
    page,
  }) => {
    await page.goto("/discovery");
    const first = page.getByTestId("possibility").first();
    await expect(first).toBeVisible();
    const y = await first.evaluate(
      (el) => el.getBoundingClientRect().top + window.scrollY,
    );
    expect(y).toBeLessThan(page.viewportSize()!.height);
    await shoot(page, "phone-01-arrive");
    await say(page, "Somewhere indoors with the kids");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await shoot(page, "phone-02-answer");
  });
});
