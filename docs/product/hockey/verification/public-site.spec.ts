import { expect, test } from "@playwright/test";
import {
  noSidewaysScroll,
  peopleCalled,
  phone,
  signUp,
} from "./mayhem-helpers";

/**
 * **The public hockey site** (mission 486, 2026-11-01).
 *
 * Against the stand-in league (`nhl-schedule-stub.mjs`: synthetic games
 * from "now", the league's real standings and leaders of 1 November 2026,
 * no club statistics):
 *
 *   1. signed out, every public page answers 200 on a phone with no
 *      sideways scroll: home, scores, standings, teams, a team
 *   2. a team page has a findable title, a description and SportsTeam
 *      structured data; an unknown team is a 404; the sitemap lists the
 *      public pages and nothing private
 *   3. My Hockey Nights and a night still ask a stranger to sign in
 *   4. a visitor taps the featured matchup's Create a Hockey Night, signs
 *      up, lands on My Hockey Nights with that game already chosen, and
 *      starts the night on it
 *   5. signed in, /hockey stays the public site and names their next night;
 *      the night's "Your nights" goes to My Hockey Nights
 *
 * Run:  NHL_API_BASE=http://127.0.0.1:54352 next start …
 *       E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification public-site
 */

peopleCalled("site");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });

const SHOTS = process.env.SITE_SHOTS;

test("signed out, every public page works on a phone", async ({ browser }) => {
  const page = await phone(browser);
  for (const [path, heading] of [
    ["/hockey", "Hockey is better with your crew."],
    ["/hockey/games", "Scores & schedule"],
    ["/hockey/standings", "Standings"],
    ["/hockey/standings?view=league", "Standings"],
    ["/hockey/teams", "Teams"],
    ["/hockey/teams/calgary-flames", "Flames"],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Hockey" }),
    ).toBeVisible();
    await noSidewaysScroll(page);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/${path.replace(/\W+/g, "-")}.png`,
        fullPage: true,
      });
  }
  // The real table, as the league published it: the Flames 6–8–0.
  await page.goto("/hockey/standings");
  await expect(
    page.getByRole("row").filter({ hasText: "CGY" }).first(),
  ).toContainText("12");
  await page.close();
});

test("a team page is findable; private pages are not listed", async ({
  browser,
}) => {
  const page = await phone(browser);
  await page.goto("/hockey/teams/calgary-flames");
  await expect(page).toHaveTitle(/Calgary Flames schedule, scores/);
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute("content");
  expect(description).toContain("6–8–0");
  const data = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? "{}",
  );
  expect(data).toMatchObject({
    "@type": "SportsTeam",
    name: "Calgary Flames",
    sport: "Ice hockey",
  });
  // No statistics from the stand-in: the section is simply absent.
  await expect(page.getByRole("heading", { name: "Player stats" })).toHaveCount(
    0,
  );
  expect((await page.goto("/hockey/teams/calgary"))?.status()).toBe(404);
  const map = await (await page.request.get("/hockey/sitemap.xml")).text();
  expect(map).toContain("/hockey/teams/calgary-flames");
  expect(map.match(/<url>/g)).toHaveLength(36);
  expect(map).not.toContain("my-nights");
  await page.close();
});

test("My Hockey Nights and a night still ask a stranger to sign in", async ({
  browser,
}) => {
  const page = await phone(browser);
  await page.goto("/hockey/my-nights");
  await expect(page).toHaveURL(/\/auth\?next=%2Fhockey%2Fmy-nights$/);
  await page.goto("/hockey/11111111-1111-4111-8111-111111111111");
  await expect(page).toHaveURL(/\/auth\?next=%2Fhockey%2F1111/);
  await page.close();
});

test("from the featured matchup to a night on that game", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await phone(browser);
  await page.goto("/hockey");
  const hero = page.getByRole("region", { name: "Featured matchup" });
  await expect(hero).toBeVisible();
  const button = hero.getByRole("link", { name: "Create a Hockey Night" });
  const href = (await button.getAttribute("href")) ?? "";
  const gameId = /game=(\d+)/.exec(href)?.[1];
  expect(gameId, href).toBeTruthy();
  expect(href).toContain("via=hero");
  // The first phone screen has the matchup and the button on it.
  const box = await button.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await button.click();
  await expect(page).toHaveURL(
    new RegExp(`/auth\\?next=%2Fhockey%2Fmy-nights%3Fgame%3D${gameId}`),
  );
  await signUp(page, "visitor");
  await expect(page).toHaveURL(
    new RegExp(`/hockey/my-nights\\?game=${gameId}`),
  );
  // The form is open on the game they chose.
  const chosen = page.getByRole("radio", { checked: true });
  await expect(chosen).toHaveCount(1);
  await page.getByLabel("Your name").fill("Visitor");
  await noSidewaysScroll(page);
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const night = page.url();

  // Signed in, /hockey is still the public site, and names the next night.
  await page.goto("/hockey");
  await expect(
    page.getByRole("region", { name: "Featured matchup" }),
  ).toBeVisible();
  const next = page.getByRole("link", { name: /Your next night/ });
  await expect(next).toHaveAttribute("href", new URL(night).pathname);

  // From the night, "Your nights" is My Hockey Nights.
  await page.goto(night);
  await page.getByRole("link", { name: "Your nights" }).click();
  await expect(page).toHaveURL(/\/hockey\/my-nights$/);
  await expect(page.getByText(/Your nights,/)).toBeVisible();
  await page.close();
});
