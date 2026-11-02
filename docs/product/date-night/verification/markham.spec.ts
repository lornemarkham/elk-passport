import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **The Markham Adventure, on two phones, against a real stack.** Lorne opens
 * it and sends the invitation; Jess opens the link in another browser, signs
 * up and joins; both vote, suggest, pack; each sees the other's choices, and
 * it all survives a reload. A stranger gets nothing.
 */

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
const PASSWORD = "first-date-forever-7";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-mk-${stamp}@example.test`;

async function shot(page: Page, name: string) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `markham-${name}.png`),
    fullPage: true,
  });
}

async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  // Headless Chromium has a share sheet nobody can tap; the copy is what
  // the test reads, so the sheet is taken away.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  return context.newPage();
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

async function noSideways(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

const idea = (page: Page, title: string) =>
  page.getByTestId("idea").filter({ hasText: title });

const evening = (page: Page, title: string) =>
  page.getByTestId("evening").filter({ hasText: title });

test("Lorne invites Jess; both plan, pack and see each other", async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const lorne = await phone(browser);
  await lorne.goto("/datenight");
  // The front door says when, but nothing about who or where.
  await expect(lorne.getByTestId("when")).toContainText("November 2");
  await expect(lorne.getByTestId("when")).toContainText("Around 5 PM");
  await expect(lorne.locator("main")).not.toContainText("Vernon");
  await expect(lorne.locator("main")).not.toContainText("Jess");
  await expect(lorne.locator("main")).not.toContainText("Kal");
  await shot(lorne, "00-front-door");
  await lorne.getByRole("link", { name: "Let's find some trouble" }).click();
  await signUp(lorne, "lorne");
  await lorne.goto("/datenight");
  await lorne.getByRole("button", { name: "Let's find some trouble" }).click();
  await lorne.waitForURL(/\/night\//);
  await expect(
    lorne.getByRole("heading", { level: 1, name: "The Markham Adventure" }),
  ).toBeVisible();

  // No questionnaire: the three evenings (and a surprise) are right there,
  // within the first two phone screens.
  const cards = lorne.getByTestId("evening");
  await expect(cards).toHaveCount(4);
  for (const title of [
    "Into the Wild",
    "Crazy Creek Escape",
    "Cold Water, Warm Fire",
  ])
    await expect(
      lorne.getByRole("tab", { name: new RegExp(title) }),
    ).toBeVisible();
  const top = await cards.first().boundingBox();
  expect(top!.y).toBeLessThan(844 * 2);
  await expect(evening(lorne, "Crazy Creek Escape")).toContainText(
    "Jess's Pick",
  );
  await expect(lorne.getByTestId("day-questions")).toBeHidden();
  await expect(lorne.getByTestId("idea")).toHaveCount(6);
  await expect(lorne.getByTestId("packing").getByRole("checkbox")).toHaveCount(
    7,
  );
  await noSideways(lorne);
  await shot(lorne, "01-lorne-choices");

  const plan = lorne.getByTestId("evening-plan");
  // Into the Wild: last light at a real place, scouting, no hunting after dark.
  await evening(lorne, "Into the Wild").getByTestId("choose-evening").click();
  await expect(plan).toContainText("Into the Wild");
  await expect(plan).toContainText("Silver Star Foothills");
  await expect(plan).toContainText("Sunset 5:33 pm");
  await expect(plan).toContainText("legal hunting ends at 6:33pm");
  await expect(lorne.getByTestId("plan-item")).toHaveCount(1);
  await shot(lorne, "02-into-the-wild");

  // Jess's pick isn't in Atlas: named and checked, not invented as a stop.
  await evening(lorne, "Crazy Creek Escape")
    .getByTestId("choose-evening")
    .click();
  await expect(plan).toContainText("Crazy Creek Hot Pools");
  await expect(plan).toContainText("Open till 10");
  await expect(lorne.getByTestId("plan-item")).toHaveCount(0);
  await shot(lorne, "03-crazy-creek");

  // Surprise: the composer's real places, after dark-safe.
  await evening(lorne, "Surprise Us").getByTestId("choose-evening").click();
  await expect(plan).toContainText("Passport's surprise");
  await expect(lorne.getByTestId("plan-item").first()).toBeAttached();

  // Cold Water, Warm Fire: the dip before sunset, dinner, a fire.
  await evening(lorne, "Cold Water, Warm Fire")
    .getByTestId("choose-evening")
    .click();
  await expect(plan).toContainText("The dip at Kal Beach");
  await expect(plan).toContainText("Dinner at BNA Brewing");
  await expect(lorne.getByTestId("beat")).toHaveCount(5);
  await expect(lorne.getByTestId("plan-item")).toHaveCount(2);
  await lorne.reload();
  await expect(lorne.getByTestId("evening-plan")).toContainText(
    "Cold Water, Warm Fire",
  );
  await expect(lorne.getByTestId("countdown")).toBeVisible();
  await noSideways(lorne);
  await shot(lorne, "04-cold-water-plan");

  // Advanced planning is still there, tucked away: the shared journey.
  await lorne.getByText("Times, travel, changes & the printable guide").click();
  await expect(lorne.getByTestId("plan-item").first()).toBeVisible();

  // King Eddie is Lorne's own idea: it must not claim to be verified.
  await expect(idea(lorne, "King Eddie")).toContainText("Not in Atlas");
  await expect(idea(lorne, "King Eddie")).toContainText("never swim alone");

  // The invitation: copied text carries the words and one private link.
  await lorne.getByRole("button", { name: "Invite Jess" }).click();
  await expect
    .poll(() => lorne.evaluate(() => navigator.clipboard.readText()), {
      timeout: 10_000,
    })
    .toContain("/adventures/join/");
  const text = await lorne.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Monday's taken. You're coming with me. ❤️");
  const link = text.match(/https?:\/\/\S+\/adventures\/join\/\S+/)![0];

  // Lorne votes.
  await idea(lorne, "King Eddie")
    .getByRole("button", { name: "Love it" })
    .click();

  // A stranger with no account sees the invitation but not the adventure.
  const stranger = await phone(browser);
  await stranger.goto(new URL(link).pathname);
  await expect(stranger.getByTestId("invitation")).toContainText(
    "Monday's taken",
  );
  await expect(stranger.getByText("Come and make it ours.")).toBeVisible();
  await expect(stranger.getByText("King Eddie")).toHaveCount(0);
  await shot(stranger, "02-invitation");

  // Jess follows the link on her own phone, signs up, comes straight back.
  const jess = await phone(browser);
  await jess.goto(new URL(link).pathname);
  await jess.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(jess, "jess");
  await jess.waitForURL(/adventures\/join\//);
  await jess.getByRole("button", { name: "I'm in — join" }).click();
  await jess.waitForURL(/\/night\//);
  await expect(idea(jess, "King Eddie")).toBeVisible();
  // Jess opens straight onto the plan Lorne picked, and can answer each stop.
  await expect(jess.getByTestId("evening-plan")).toContainText(
    "Cold Water, Warm Fire",
  );
  await expect(jess.getByText("Plan it yourself, stop by stop")).toHaveCount(0);
  await jess.getByText("Times, travel, changes & the printable guide").click();
  const firstStop = jess
    .getByTestId("plan-item")
    .first()
    .getByRole("group", { name: /Your answer on/ });
  await firstStop.getByRole("button", { name: "I'm in" }).click();
  // She can't change the plan, but she can push for her pick.
  await evening(jess, "Crazy Creek Escape")
    .getByRole("button", { name: "Suggest this one" })
    .click();
  await expect(idea(jess, "Let's do Crazy Creek Escape")).toBeVisible();
  await shot(jess, "02b-jess-day");

  // The link was for one person: the stranger cannot use it too.
  const nightPath = new URL(jess.url()).pathname;
  const mallory = await phone(browser);
  await mallory.goto("/auth");
  await signUp(mallory, "mallory");
  await mallory.goto(nightPath);
  await expect(mallory.getByText("isn't yours to see")).toBeVisible();
  await expect(mallory.getByText("King Eddie")).toHaveCount(0);

  // Jess votes and suggests; Lorne sees both.
  await idea(jess, "King Eddie").getByRole("button", { name: "Maybe" }).click();
  await expect(
    idea(jess, "King Eddie").getByTestId("their-vote"),
  ).toContainText("Love it");
  await jess.getByLabel("Suggest an adventure").fill("Hot springs and pie");
  await jess.getByLabel("Suggest an adventure").press("Enter");
  await expect(idea(jess, "Hot springs and pie")).toBeVisible();
  await lorne.reload();
  await expect(idea(lorne, "Hot springs and pie")).toBeVisible();
  await expect(
    idea(lorne, "King Eddie").getByTestId("their-vote"),
  ).toContainText("Maybe");

  // Passport's mystery pick is a real Atlas place, added for a vote.
  await lorne
    .getByRole("button", { name: /Let Passport pick a mystery/ })
    .click();
  await expect(lorne.getByTestId("idea")).toHaveCount(9);

  // Packing: Jess ticks, adds; Lorne sees it, with her name.
  const jessPack = jess.getByTestId("packing");
  await jessPack.getByRole("checkbox", { name: /Chairs/ }).click();
  await jess.getByLabel("Add something to bring").fill("Extra socks");
  await jess.getByLabel("Add something to bring").press("Enter");
  await expect(
    jessPack.getByRole("checkbox", { name: /Extra socks/ }),
  ).toBeVisible();
  await lorne.reload();
  const lornePack = lorne.getByTestId("packing");
  await expect(
    lornePack.getByRole("checkbox", { name: /Chairs/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(lornePack).toContainText("Extra socks");

  // Persistence: a fresh load on each phone shows the same night.
  await jess.reload();
  await lorne.reload();
  await noSideways(jess);
  await expect(
    idea(jess, "King Eddie").getByRole("button", { name: "Maybe" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(jess.getByTestId("evening-plan")).toContainText(
    "Cold Water, Warm Fire",
  );
  await shot(jess, "03-jess-board");
  await shot(lorne, "04-lorne-board-after");
});
