import { expect, test, type Page } from "@playwright/test";

/**
 * **Natural Discovery: the five sentences a person actually types.**
 *
 * Against the Atlas stand-in serving the committed real candidates body
 * (`scripts/critic/atlas-mock.mjs`), so every pick is a real Atlas subject.
 * Asserts what is said and that nothing is invented — not which place leads,
 * because the fixture's calendar (2026-10-11) is not the machine's.
 *
 *   node scripts/critic/atlas-mock.mjs docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz 3131
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
 *   ATLAS_API_URL=http://127.0.0.1:3131 … npx next start -p 3130
 *   (the stand-in serves no distance readings, so the two sentences that name
 *   no town run without one: a chosen town needs Atlas's distance to answer)
 *   E2E_PORT=3130 npx playwright test e2e/discovery-natural.spec.ts
 */
async function say(page: Page, said: string) {
  const before = await page.getByTestId("ask-turn").count();
  await page.getByTestId("ask-input").fill(said);
  await page.getByTestId("ask-submit").click();
  await expect(page.getByTestId("ask-turn")).toHaveCount(before + 1);
  await expect(page.getByTestId("ask-answer")).toBeVisible();
}

const heard = (page: Page) => page.getByTestId("ask-understood");
const picks = (page: Page) =>
  page.getByTestId("ask-answer").getByTestId("possibility");

test.describe("five natural sentences", () => {
  test("'What can I do with my five-year-old today?' hears the child, the age and the day, and asks about nothing it was told", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "What can I do with my five-year-old today?");
    await expect(heard(page)).toContainText("with a 5-year-old");
    await expect(heard(page)).toContainText("today");
    expect(await picks(page).count()).toBeGreaterThan(1);
    // Age was given, so it is not asked for again.
    await expect(page.getByTestId("ask-gap-age")).toHaveCount(0);
    await expect(page.getByTestId("ask-unread")).toHaveCount(0);
  });

  test("'It's raining. Find something fun indoors.' hears the weather and shows only what Atlas reads as dry", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "It's raining. Find something fun indoors.");
    await expect(heard(page)).toContainText("staying dry");
    const answer = page.getByTestId("ask-answer");
    await expect(answer).toContainText(/indoors|under cover/i);
    expect(await picks(page).count()).toBeGreaterThan(1);
    // Nothing is presented as dry that Atlas did not say.
    await expect(answer).not.toContainText(/guaranteed|always dry/i);
  });

  test("'What can we do within 30 minutes of Vernon?' hears the town and the limit, and says what the limit rests on", async ({
    page,
  }) => {
    // No town chosen first: the sentence names it.
    await page.goto("/discovery");
    await say(page, "What can we do within 30 minutes of Vernon?");
    await expect(heard(page)).toContainText("up to 30 min away");
    expect(new URL(page.url()).searchParams.get("at")).toBe("vernon");
    await expect(page.getByTestId("ask-answer")).toContainText(
      /straight-line|drive estimate/i,
    );
  });

  test("'an hour from Salmon Arm' keeps the town, and does not turn 'Salmon' into an activity", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "Anything fun an hour from Salmon Arm?");
    expect(new URL(page.url()).searchParams.get("at")).toBe("salmon-arm");
    await expect(heard(page)).not.toContainText(/wildlife/i);
  });

  test("a place Passport cannot locate is said, and nothing is measured from it", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "Anything fun an hour from Tofino?");
    await expect(page.getByTestId("ask-gap-place")).toContainText("Tofino");
    expect(new URL(page.url()).searchParams.get("at")).toBeNull();
  });

  test("'Surprise me with something unusual.' answers at once, and each pick says why", async ({
    page,
  }) => {
    await page.goto("/discovery");
    await say(page, "Surprise me with something unusual.");
    await expect(heard(page)).toContainText("something unusual");
    expect(await picks(page).count()).toBeGreaterThan(2);
    // The reason is Atlas's count, not Passport's taste.
    await expect(page.getByTestId("ask-answer")).toContainText(/only|one of/i);
    await expect(page.getByTestId("ask-answer")).toContainText(
      /not a judgement of taste/i,
    );
  });

  test("'What's happening in Vancouver this weekend?' moves to Vancouver and reads the day", async ({
    page,
  }) => {
    await page.goto("/discovery?at=vernon");
    await say(page, "What's happening in Vancouver this weekend?");
    await expect(heard(page)).toContainText("what's on");
    await expect(heard(page)).toContainText("Saturday");
    expect(new URL(page.url()).searchParams.get("at")).toBe("vancouver");
  });
});
