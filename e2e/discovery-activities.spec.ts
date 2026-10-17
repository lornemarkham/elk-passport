import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * **Every activity, findable** — the acceptance tests for the activity
 * explorer (owner's brief, 2026-10-16; ADR 007).
 *
 * Production Discovery offered four activities for a whole region. Against
 * the Atlas stand-in serving the committed real candidates body
 * (`scripts/critic/atlas-mock.mjs`), so every chip counts real Atlas subjects:
 *
 *   node scripts/critic/atlas-mock.mjs docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz 3141
 *   ATLAS_API_URL=http://127.0.0.1:3141 … npx next start -p 3140
 *   E2E_PORT=3140 npx playwright test e2e/discovery-activities.spec.ts
 *
 * Screenshots land in `docs/product/discovery-activities/`.
 */
const SHOTS = "docs/product/discovery-activities";

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function openExplorer(page: Page) {
  await page.getByTestId("activity-explorer-open").first().click();
  const explorer = page.getByTestId("activity-explorer");
  await expect(explorer).toBeVisible();
  return explorer;
}

const chip = (page: Page, key: string) =>
  page.getByTestId("activity-explorer").locator(`[data-activity="${key}"]`);

test.describe("the activity explorer", () => {
  test("keeps the front door to one box and one quiet link", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await expect(page.getByRole("textbox")).toHaveCount(1);
    // One on the front door; the row's own sits folded under Refine.
    await expect(
      page.getByTestId("activity-explorer-open").locator("visible=true"),
    ).toHaveCount(1);
    await expect(page.getByTestId("activity-explorer")).toHaveCount(0);
  });

  test("lists far more than four activities, rare ones included", async ({
    page,
  }) => {
    await page.goto("/discovery");
    const explorer = await openExplorer(page);
    await expect(explorer.getByTestId("activity-shelf")).toHaveCount(9);
    const keys = new Set(
      await explorer
        .getByTestId("activity-chip")
        .evaluateAll((chips) =>
          chips.map((c) => c.getAttribute("data-activity")),
        ),
    );
    expect(keys.size).toBeGreaterThan(40);
    for (const key of [
      "birdwatching",
      "skiing",
      "snowshoeing",
      "cross-country-skiing",
      "skating",
      "kayaking",
      "paddleboarding",
      "mountain-biking",
      "climbing",
      "camping",
      "wildlife-watching",
      "photography",
      "bowling",
      "museums",
      "theatre",
      "live-music",
    ])
      expect(keys, key).toContain(key);
    // Skiing in October is listed, and says when it usually is.
    await expect(chip(page, "skiing").first()).toContainText("Dec–Mar");
    await shoot(page, "desktop-01-explorer");
  });

  test("finds an activity by a person's word", async ({ page }) => {
    await page.goto("/discovery");
    const explorer = await openExplorer(page);
    await explorer.getByTestId("activity-explorer-filter").fill("birds");
    await expect(explorer.getByTestId("activity-chip")).toHaveCount(1);
    await expect(chip(page, "birdwatching")).toBeVisible();
    await shoot(page, "desktop-02-filter-birds");
  });

  test("birdwatching answers with the places Atlas says offer it", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await openExplorer(page);
    await chip(page, "birdwatching").first().click();
    await expect(page.getByTestId("activity-explorer")).toHaveCount(0);
    const answer = page.getByTestId("ask-answer");
    await expect(page.getByTestId("ask-heading")).toHaveText(/^Birdwatching/);
    await expect(answer).toContainText("Allan Brooks Nature Centre");
    await expect(answer).toContainText(/Bird/);
    // An Activity entity titled "Birdwatching" is not the answer to it.
    await expect(answer).not.toContainText("The name you said");
    await shoot(page, "desktop-03-birdwatching");
  });

  test("skiing in October answers with ski hills, and the calendar", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await openExplorer(page);
    await chip(page, "skiing").first().click();
    const answer = page.getByTestId("ask-answer");
    await expect(page.getByTestId("ask-heading")).toHaveText(/^Skiing/);
    await expect(answer).toContainText(/Silver ?Star Mountain Resort/);
    await expect(answer).toContainText(/usually runs December to March/);
    await shoot(page, "desktop-04-skiing");
  });

  test("the sentence box understands the same vocabulary", async ({ page }) => {
    await page.goto("/discovery");
    await page.getByTestId("ask-input").fill("somewhere to go birdwatching");
    await page.getByTestId("ask-submit").click();
    await expect(page.getByTestId("ask-understood")).toContainText(
      "birdwatching",
    );
    await expect(page.getByTestId("ask-answer")).toContainText(
      "Allan Brooks Nature Centre",
    );
  });
});
