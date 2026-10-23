import { expect, test } from "@playwright/test";
import { openDecision } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **The dinner vote as a coworker meets it, at 390 px.**
 *
 * Needs the real candidates body served as production serves it today — no
 * `presentationImage`, only each place's own `heroUrl` (README, "Atlas stand-in
 * modes"). Proves what `PRESENTATION-POLISH.md` changed:
 *
 *   real, photographed places lead and the concourse is the alternative under
 *   them (since small release 1: the concourse is the last, compact row of
 *   the vote, and the places are three at a time under "Explore places &
 *   vote") → an `http://` photograph is asked for over https → nothing on a card
 *   is a logo, an icon or a banner → a place added to the vote moves above the
 *   concourse.
 */
const stamp = Date.now().toString(36);

test("real places lead; the concourse is the easy way out; no logo passes for a photo", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/hockey");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`polish-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Pat");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: /Skip/ }).click();

  await openDecision(page, "Before the game");
  const near = page.getByRole("region", { name: "Places near Rogers Arena" });
  const cards = near.getByRole("article");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  await expect(cards).toHaveCount(3);

  // The concourse is one compact row, the easy way out.
  const concourse = page.locator('[data-option="Just eat in the concourse"]');
  expect((await concourse.boundingBox())!.height).toBeLessThan(110);
  await expect(
    concourse.getByRole("button", { name: /Vote for/ }),
  ).toBeEnabled();
  // Every place, for judging the pictures.
  await near.getByRole("button", { name: /^See all \d+ places$/ }).click();

  // Let the pictures settle, then judge every one that is still on a card.
  await page.waitForTimeout(6_000);
  const pictures = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>("article img")].map(
      (img) => ({
        src: img.src,
        w: img.naturalWidth,
        h: img.naturalHeight,
      }),
    ),
  );
  expect(pictures.length).toBeGreaterThan(0);
  for (const p of pictures) {
    expect(p.src, "no http:// photograph on an https-able page").not.toMatch(
      /^http:\/\//,
    );
    expect(p.src).not.toMatch(/logo|arrow|menumock/i);
  }
  // A picture that loaded is big enough to be a photograph. (One that failed
  // or was too small has been replaced by the designed no-photo card.)
  const loaded = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>("article img")]
      .filter((img) => img.complete && img.naturalWidth > 0)
      .map((img) => [img.naturalWidth, img.naturalHeight]),
  );
  for (const [w, h] of loaded) {
    expect(w).toBeGreaterThanOrEqual(400);
    expect(h).toBeGreaterThanOrEqual(240);
  }

  // Adding a place puts it on the vote, above the concourse.
  await near.getByRole("button", { name: "Add Shark Club and vote" }).click();
  const dinner = page.getByRole("region", {
    name: "Where are we going before?",
  });
  const shark = dinner.locator('[data-option="Shark Club"]');
  await expect(shark).toBeVisible({ timeout: 15_000 });
  const [sharkBox, easyBox] = await Promise.all([
    shark.boundingBox(),
    concourse.boundingBox(),
  ]);
  expect(sharkBox!.y).toBeLessThan(easyBox!.y);
  await context.close();
});
