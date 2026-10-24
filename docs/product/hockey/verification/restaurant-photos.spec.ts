import { expect, test } from "@playwright/test";
import { openExplore } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Every restaurant on the dinner vote shows a real photograph.**
 *
 * Run against a build whose `ATLAS_API_URL` is *real* Atlas (production's
 * corpus), not the synthetic stand-in — the point is the photographs Atlas
 * actually holds for the places Hockey Night actually offers:
 *
 *   - no card falls back to "No photo Passport can vouch for yet"
 *   - every picture that is on a card decoded to a size a card can crop
 *   - none of the arena's ticket-holder lounges, no coffee counter, no place
 *     shut on game day is offered (`pregame.ts`)
 *   - voting still works on a photographed card
 *
 * `HOCKEY_SHOTS=<dir>` also writes screenshots of the vote at phone and
 * desktop width, which is how the pictures get looked at by a person.
 */
const stamp = Date.now().toString(36);
const SHOTS = process.env.HOCKEY_SHOTS;

for (const [label, viewport, mobile] of [
  ["phone", { width: 390, height: 844 }, true],
  ["desktop", { width: 1280, height: 900 }, false],
] as const) {
  test(`the dinner vote is photographs — ${label}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    await page.goto("/hockey");
    await page.getByRole("tab", { name: "Sign Up" }).click();
    await page
      .getByLabel("Email address")
      .fill(`photos-${label}-${stamp}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("Your name").fill("Pat");
    await page.getByRole("button", { name: "Start it" }).click();
    await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: /Skip/ }).click();

    // Every place near the arena, as Passport's cards, in Explore.
    const near = await openExplore(page);
    await expect(near.getByRole("article").first()).toBeVisible({
      timeout: 60_000,
    });
    // Cards load their pictures lazily as they scroll into view.
    await near.getByRole("article").last().scrollIntoViewIfNeeded();
    for (const article of await near.getByRole("article").all()) {
      await article.scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(8_000);

    const cards = await near.getByRole("article").evaluateAll((els) =>
      els.map((el) => {
        const img = el.querySelector("img");
        return {
          name: el.getAttribute("aria-label") ?? "",
          noPhoto: /No photo Passport can vouch for/i.test(
            el.textContent ?? "",
          ),
          loaded: !!img && img.complete && img.naturalWidth > 0,
          w: img?.naturalWidth ?? 0,
          h: img?.naturalHeight ?? 0,
          src: img?.src ?? "",
        };
      }),
    );
    console.log(
      `${label}: ${cards.length} cards\n` +
        cards
          .map(
            (c) => `  ${c.loaded ? "PHOTO" : "none "} ${c.w}x${c.h} ${c.name}`,
          )
          .join("\n"),
    );
    expect(cards.length).toBeGreaterThanOrEqual(24);
    for (const c of cards) {
      expect(c.noPhoto, `${c.name} fell back to the no-photo card`).toBe(false);
      expect(c.loaded, `${c.name}: ${c.src} did not render`).toBe(true);
      expect(c.src).not.toMatch(/^http:\/\//);
    }
    // Nothing that is not somewhere an ordinary group could eat before the game.
    const names = cards.map((c) => c.name);
    for (const refused of [
      "Madrí Excepcional Lounge",
      "Konica Minolta Champion's Club",
      "Molson Hockey House",
      "Rogers Studio Lounge",
      "Hoxton Gastown",
      "MEAT & BREAD",
      "Blenz Coffee",
    ])
      expect(names).not.toContain(refused);

    if (SHOTS) {
      await near.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${SHOTS}/vote-${label}.png`,
        fullPage: true,
      });
    }

    // Voting survives: back the first photographed card and see it as yours.
    const first = near.getByRole("article").first();
    await first
      .getByRole("button", { name: /^(Add .* and vote|Back .*)$/ })
      .click();
    await expect(
      near
        .getByRole("region", { name: "On the vote" })
        .getByRole("button", { pressed: true }),
    ).toBeVisible({ timeout: 20_000 });
    await context.close();
  });
}
