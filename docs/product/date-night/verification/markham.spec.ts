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

test("Lorne invites Jess; both plan, pack and see each other", async ({
  browser,
}) => {
  const lorne = await phone(browser);
  await lorne.goto("/datenight");
  await lorne.getByRole("link", { name: "Sign in to begin" }).click();
  await signUp(lorne, "lorne");
  await lorne.goto("/datenight");
  await shot(lorne, "00-front-door");
  await lorne.getByRole("button", { name: "Open our adventure" }).click();
  await lorne.waitForURL(/\/night\//);
  await expect(
    lorne.getByRole("heading", { level: 1, name: "The Markham Adventure ❤️" }),
  ).toBeVisible();
  await expect(lorne.getByTestId("idea")).toHaveCount(6);
  await expect(lorne.getByTestId("packing").getByRole("checkbox")).toHaveCount(
    7,
  );
  await noSideways(lorne);
  await shot(lorne, "01-lorne-board");

  // King Eddie is Lorne's own idea: it must not claim to be verified.
  await expect(idea(lorne, "King Eddie")).toContainText("Not in Atlas");
  await expect(idea(lorne, "King Eddie")).toContainText("never swim alone");

  // The invitation: copied text carries the words and one private link.
  await lorne.getByRole("button", { name: "Send the invitation" }).click();
  await expect
    .poll(() => lorne.evaluate(() => navigator.clipboard.readText()), {
      timeout: 10_000,
    })
    .toContain("/adventures/join/");
  const text = await lorne.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("You've been invited on a questionable adventure. ❤️");
  const link = text.match(/https?:\/\/\S+\/adventures\/join\/\S+/)![0];

  // Lorne votes.
  await idea(lorne, "King Eddie")
    .getByRole("button", { name: "Love it" })
    .click();

  // A stranger with no account sees the invitation but not the adventure.
  const stranger = await phone(browser);
  await stranger.goto(new URL(link).pathname);
  await expect(stranger.getByTestId("invitation")).toContainText(
    "questionable adventure",
  );
  await expect(stranger.getByText("Help me plan our adventure.")).toBeVisible();
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
  await expect(lorne.getByTestId("idea")).toHaveCount(8);

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

  // The plan reads the votes; the host locks it.
  await idea(jess, "Hot springs and pie")
    .getByRole("button", { name: "Love it" })
    .click();
  await idea(lorne, "Hot springs and pie")
    .getByRole("button", { name: "Love it" })
    .click();
  await expect(lorne.getByTestId("plan")).toContainText("Hot springs and pie");
  await lorne.getByRole("button", { name: "Lock it in" }).first().click();
  await expect(lorne.getByTestId("plan")).toContainText("Locked in");

  // Persistence: a fresh load on each phone shows the same night.
  await jess.reload();
  await lorne.reload();
  await noSideways(jess);
  await expect(
    idea(jess, "King Eddie").getByRole("button", { name: "Maybe" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(jess.getByTestId("plan")).toContainText("Locked in");
  await shot(jess, "03-jess-board");
  await shot(lorne, "04-lorne-board-after");
});
