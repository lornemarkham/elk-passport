import { expect, test, type Page } from "@playwright/test";

/**
 * **Discover → save → Pocket → My Stuff → a day → live it → remember it.**
 *
 * The owner's own test (brief 2026-11-08, P9), step for step, against real
 * Atlas records (a production corpus captured 2026-11-08, served by
 * `../../group-adventures/verification/atlas-standin.mjs`) and a real local
 * Supabase (`stack.mjs`: GoTrue sign-up, PostgREST, RLS):
 *
 *   1. Open Discovery.                 8. Create a collection.
 *   2. Save Sandhill Winery.           9. Build a day from selected ideas.
 *   3. Save Penticton Farmers' Market. 10. Adjust it.
 *   4. Save Peak of Christmas.         11. Save it.
 *   5. Open the Adventure Pocket.      12. Start it.
 *   6. Remove and restore an item.     13. Complete it.
 *   7. Open My Stuff.                  14. Find it under Memories.
 *
 * …and nothing saved is lost along the way: the board is read through the
 * API after every step that could lose something.
 */

const PASSWORD = "a-pretty-good-day-9";
const SHOTS = process.env.E2E_SHOTS ?? "/tmp/ghad-journey-shots";

const SANDHILL = "Sandhill Winery";
const MARKET = /Penticton Farmers['’] Market/;
const PEAK = "Peak of Christmas";

async function ideasHeld(page: Page): Promise<string[]> {
  const boards = await (await page.request.get("/api/boards")).json();
  if (!Array.isArray(boards)) return [];
  const ids = new Set<string>();
  for (const b of boards.filter((x) => (x.role ?? "owner") === "owner")) {
    const items = await (
      await page.request.get(`/api/boards/${b.id}/items`)
    ).json();
    for (const i of Array.isArray(items) ? items : []) ids.add(i.experienceId);
  }
  return [...ids];
}

/** Ask Discovery for something by name and save the card that answers. */
async function saveByName(page: Page, said: string, title: string | RegExp) {
  const input = page.getByTestId("ask-input");
  await input.fill(said);
  await page.getByTestId("ask-submit").click();
  const card = page
    .getByTestId("ask-answer")
    .getByTestId("possibility")
    .filter({ hasText: title })
    .first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  const before = (await ideasHeld(page)).length;
  // Retried: a press before Discovery hydrates does nothing.
  await expect(async () => {
    if ((await ideasHeld(page)).length === before)
      await card
        .getByRole("button", { name: "Save", exact: true })
        .click({ timeout: 2_000 });
    expect((await ideasHeld(page)).length).toBe(before + 1);
  }).toPass({ timeout: 45_000 });
  // The card stays where it was, marked, rather than vanishing under the finger.
  await expect(card).toContainText("Saved");
}

test("a new visitor discovers, saves, makes a day, lives it and remembers it", async ({
  page,
}, info) => {
  const who = `${info.project.name}-${Date.now().toString(36)}@example.test`;
  const shot = (name: string) =>
    page.screenshot({
      path: `${SHOTS}/${info.project.name}-${name}.png`,
      fullPage: false,
    });

  // ------------------------------------------------- 1. open Discovery
  await page.goto("/auth?next=/discovery");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(who);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/discovery/);

  // The bar is the journey, and nothing else (P0).
  const bar = page.getByRole("navigation", { name: "Go Have A Day" });
  for (const id of ["discover", "my-stuff", "build", "experiences"])
    await expect(page.getByTestId(`passport-nav-${id}`)).toBeVisible();
  await expect(bar.getByText("Places", { exact: true })).toHaveCount(0);

  // No board beside the results; they get the width (P1).
  await expect(page.getByTestId("ask-input")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByTestId("pocket-button")).toHaveCount(0);
  await shot("01-discovery");

  // ------------------------------------------------------ 2–4. save three
  await saveByName(page, SANDHILL, SANDHILL);
  await expect(
    page.getByText("Good find. Into the Pocket.").first(),
  ).toBeVisible();
  await expect(page.getByTestId("pocket-count")).toHaveText("1 idea saved");
  await saveByName(page, "Penticton Farmers' Market", MARKET);
  await saveByName(page, PEAK, PEAK);
  await expect(page.getByTestId("pocket-count")).toHaveText("3 ideas saved");
  await shot("02-three-saved");
  const saved = await ideasHeld(page);
  expect(saved).toHaveLength(3);

  // ------------------------------------------------- 5. open the Pocket
  await page.getByRole("button", { name: /3 ideas saved/ }).click();
  const pocket = page.getByTestId("pocket");
  await expect(pocket).toBeVisible();
  await expect(pocket.getByTestId("pocket-item")).toHaveCount(3);
  await expect(pocket).toContainText(SANDHILL);
  await expect(pocket).toContainText(PEAK);
  await shot("03-pocket");

  // ----------------------------------------- 6. remove one, and restore it
  const marketItem = pocket.getByTestId("pocket-item").filter({
    hasText: MARKET,
  });
  await marketItem.getByTestId("pocket-remove").click();
  await expect(pocket.getByTestId("pocket-item")).toHaveCount(2);
  expect(await ideasHeld(page)).toHaveLength(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(pocket.getByTestId("pocket-item")).toHaveCount(3);
  await expect
    .poll(async () => (await ideasHeld(page)).sort())
    .toEqual([...saved].sort());
  await pocket.getByTestId("pocket-keep-collecting").click();
  await expect(pocket).toHaveCount(0);

  // --------------------------------------------------- 7. open My Stuff
  await page.getByTestId("passport-nav-my-stuff").click();
  await expect(page).toHaveURL(/\/saved/);
  await expect(page.getByRole("heading", { name: "My Stuff" })).toBeVisible();
  for (const part of ["ideas", "collections", "adventures", "memories"])
    await expect(page.getByTestId(`my-stuff-${part}`)).toBeAttached();
  await expect(page.getByTestId("saved-review")).toContainText(
    "3 possibilities saved",
  );
  await shot("04-my-stuff");

  // --------------------------------------------- 8. create a collection
  await page.getByTestId("saved-plan").click();
  const ideas = page.getByTestId("my-stuff-ideas");
  for (const title of [SANDHILL, MARKET])
    await ideas
      .getByTestId("possibility")
      .filter({ hasText: title })
      .first()
      .getByTestId("saved-choose")
      .click();
  await expect(page.getByTestId("chosen-count")).toContainText("2 chosen");
  await page.getByTestId("saved-to-collection").click();
  const filing = page.getByTestId("plan-from-saved");
  await filing.getByTestId("collection-name").fill("Okanagan wine weekend");
  await filing.getByTestId("collection-submit").click();
  const collection = page
    .getByTestId("collection")
    .filter({ hasText: "Okanagan wine weekend" });
  await expect(collection).toBeVisible({ timeout: 15_000 });
  await expect(collection).toContainText("2 things");
  // Still three ideas: a collection groups, it does not move.
  await expect(page.getByTestId("saved-review")).toContainText(
    "3 possibilities saved",
  );
  expect((await ideasHeld(page)).length).toBeGreaterThanOrEqual(3);
  await shot("05-collection");

  // ------------------------------- 9. a day from selected Pocket ideas
  await page.getByTestId("passport-nav-discover").click();
  await page.getByRole("button", { name: /3 ideas saved/ }).click();
  // Peak of Christmas is in North Vancouver: not today's day from the Okanagan.
  await page.getByRole("checkbox", { name: `Use ${PEAK} in the day` }).click();
  const makeDay = page.getByTestId("pocket-make-day");
  await expect(makeDay).toContainText("with these 2");
  await makeDay.click();
  await expect(page).toHaveURL(/\/go\?with=/);
  const start = page.locator('[data-testid^="go-start-"]');
  if (
    await start
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)
  ) {
    const penticton = page.getByTestId("go-start-penticton");
    await ((await penticton.count()) > 0 ? penticton : start.first()).click();
  }
  await expect(page.getByTestId("go-day")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("go-good-day")).toHaveText(
    "Well, that looks like a pretty good day.",
  );
  const stops = page.locator('[data-testid="go-stop"] h3');
  await expect(stops.first()).toBeVisible();
  const first = (await stops.allTextContents()).map((s) => s.trim());
  // The chosen ideas are kept in the day.
  expect(first.join(" | ")).toContain(SANDHILL);
  expect(first.join(" | ")).toMatch(MARKET);
  await shot("06-day");

  // --------------------------------------------- 10. adjust it in words
  for (const said of ["Add somewhere for lunch", "Keep us within 30 minutes"]) {
    await page.getByTestId("go-change").fill(said);
    await page.getByTestId("go-change-submit").click();
    await expect(page.getByTestId("go-reply")).toBeVisible();
  }
  const adjusted = (await stops.allTextContents()).map((s) => s.trim());
  // Adjusting changed the day, not the person's choices.
  expect(adjusted.join(" | ")).toContain(SANDHILL);
  await shot("07-adjusted");

  // --------------------------------------------------- 11. save it
  await page.getByTestId("go-adventure-title").fill("Penticton Saturday");
  await page.getByTestId("go-save-new-adventure").click();
  await expect(page).toHaveURL(/\/adventures\/[0-9a-f]{32}$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Penticton Saturday" }),
  ).toBeVisible();
  const items = page
    .getByTestId("plan-day-section")
    .first()
    .getByTestId("plan-item");
  await expect(items).toHaveCount(adjusted.length);
  await shot("08-adventure");

  // ------------------------------------------------- 12. start it
  await expect(page.getByTestId("today-panel")).toBeVisible();
  await page.getByTestId("start-day").click();
  await expect(page.getByTestId("today-adjust")).toBeVisible();
  // Adjust during the day, and keep a memory.
  await page.getByTestId("behind-more").click();
  await expect(page.getByTestId("behind-note")).toBeVisible();
  await page.getByTestId("capture-note").click();
  await page.getByTestId("capture-note-text").fill("The view from the patio");
  await page.getByTestId("capture-note-save").click();
  await shot("09-started");

  // ----------------------------------------------- 13. complete it
  for (let i = 0; i < adjusted.length; i++)
    await page.getByTestId("today-done").first().click();
  await expect(page.getByTestId("open-recap")).toBeVisible();
  await page.getByTestId("open-recap").click();
  await expect(page).toHaveURL(/\/recap$/);
  await expect(page.getByText("The view from the patio")).toBeVisible();
  await expect(page.getByTestId("recap-again")).toBeVisible();
  await shot("10-recap");

  // ------------------------------------------ 14. find it in Memories
  await page.goto("/saved#memories");
  const memory = page
    .getByTestId("my-stuff-memories")
    .getByTestId("memory")
    .filter({ hasText: "Penticton Saturday" });
  await expect(memory).toBeVisible({ timeout: 15_000 });
  await expect(memory.getByTestId("memory-recap")).toHaveAttribute(
    "href",
    /\/recap$/,
  );
  await expect(
    page.getByTestId("my-stuff-adventures").getByText("Penticton Saturday"),
  ).toHaveCount(0);
  await memory.scrollIntoViewIfNeeded();
  await shot("11-memories");

  // ----------------------------------------- and nothing saved was lost
  expect((await ideasHeld(page)).sort()).toEqual([...saved].sort());
});
