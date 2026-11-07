import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **On the hill, on two phones**: START YOUR SNOW DAY on both, tell the crew
 * things in one tap (a guest's go to the chat, because only the host may
 * announce), find each other — opt-in, mutual, temporary — and stop. Real
 * accounts on the real local stack (stack.mjs, with the location migration).
 */
const SHOTS = path.resolve(__dirname, "screenshots");
const PASSWORD = `pd-${randomBytes(12).toString("base64url")}`;
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-hill-${stamp}@example.test`;

async function shot(page: Page, name: string) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// Two spots about 220 m apart on a mountain road in Squamish.
const LORNE_SPOT = { latitude: 49.7016, longitude: -123.1558, accuracy: 6 };
const JESS_SPOT = { latitude: 49.7036, longitude: -123.1558, accuracy: 9 };

async function phone(browser: Browser, spot: typeof LORNE_SPOT) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write", "geolocation"],
    geolocation: spot,
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

const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true }).click();

test("start, tell the crew, find each other, stop", async ({ browser }) => {
  const lorne = await phone(browser, LORNE_SPOT);
  await lorne.goto("/auth");
  await signUp(lorne, "lorne");
  await lorne.goto("/snow/new");
  await lorne.getByLabel("Name the day").fill("Hill Day");
  await lorne.getByLabel("Your name").fill("Lorne");
  await lorne.getByRole("button", { name: "Skiing" }).click();
  await lorne.getByRole("button", { name: "Advanced" }).click();
  await lorne.getByLabel(/Plan it together, live/).check();
  await lorne.getByRole("button", { name: "Create the day" }).click();
  await expect(lorne.getByTestId("day-title")).toHaveText("Hill Day");

  await tab(lorne, "Crew");
  await lorne.getByRole("button", { name: "Invite the crew" }).click();
  await expect(lorne.getByRole("status")).toContainText("Invite link copied");
  const invite = await lorne.evaluate(() => navigator.clipboard.readText());

  const jess = await phone(browser, JESS_SPOT);
  await jess.goto(invite);
  await expect(
    jess.getByRole("heading", { name: "Join the snow day" }),
  ).toBeVisible();
  await jess.getByLabel("Your name").fill("Jess");
  await jess.getByRole("button", { name: "Snowboarding" }).click();
  await jess.getByRole("button", { name: "Beginner" }).click();
  await jess.getByRole("button", { name: "I'm in" }).click();
  await jess.waitForURL(/\/auth/);
  await signUp(jess, "jess");
  await jess.getByLabel("Your name").fill("Jess");
  await jess.getByRole("button", { name: "Snowboarding" }).click();
  await jess.getByRole("button", { name: "Beginner" }).click();
  await jess.getByRole("button", { name: "I'm in" }).click();
  await expect(jess.getByTestId("you-are")).toHaveText("You are Jess");

  // ---- both start; one person starting never starts anyone else's day
  await tab(lorne, "On the hill");
  await lorne.getByTestId("start-day").click();
  await expect(lorne.getByTestId("companion")).toBeVisible();
  await tab(jess, "On the hill");
  await expect(jess.getByTestId("start")).toBeVisible();
  await jess.getByTestId("start-day").click();
  await shot(jess, "10-start-your-day");

  // ---- a guest's quick update goes to the chat (announce is host-only)
  await jess.getByTestId("big-last-run").click();
  await expect(jess.getByTestId("sent")).toContainText(
    "Everyone down together",
  );
  await expect(jess.getByTestId("problem")).toHaveCount(0);
  await tab(lorne, "Crew");
  await expect(lorne.getByTestId("chat-messages")).toContainText(
    "Last run! Everyone down together",
    { timeout: 20_000 },
  );
  await tab(lorne, "On the hill");

  // ---- nothing is shared until someone chooses
  await expect(lorne.getByTestId("find-crew")).toContainText("Optional");
  await expect(lorne.getByTestId("sharing-on")).toHaveCount(0);

  // ---- Lorne shares; Jess is not sharing, so neither sees the other
  await lorne.getByTestId("share-60").click();
  await expect(lorne.getByTestId("sharing-on")).toContainText("left");
  await expect(lorne.getByTestId("nobody")).toBeVisible();
  await expect(jess.getByTestId("sharing-on")).toHaveCount(0);
  await expect(jess.getByTestId("crew-positions")).toHaveCount(0);

  // ---- Jess shares: now each finds the other, in words
  await jess.getByTestId("share-30").click();
  await expect(jess.getByTestId("crew-positions")).toContainText("Lorne", {
    timeout: 20_000,
  });
  await expect(jess.getByTestId("crew-positions")).toContainText(
    /about 2\d0 m south of you/,
  );
  await expect(lorne.getByTestId("crew-positions")).toContainText("Jess", {
    timeout: 20_000,
  });
  await expect(lorne.getByTestId("crew-positions")).toContainText(
    /about 2\d0 m north of you/,
  );
  await shot(lorne, "11-find-your-crew");

  // ---- Stop is immediate and mutual
  await jess.getByTestId("stop-sharing").click();
  await expect(jess.getByTestId("sharing-on")).toHaveCount(0);
  await expect(lorne.getByTestId("nobody")).toBeVisible({ timeout: 20_000 });

  // ---- "We're done" ends a share too
  await jess.getByTestId("share-30").click();
  await expect(lorne.getByTestId("crew-positions")).toContainText("Jess", {
    timeout: 20_000,
  });
  await lorne.getByTestId("big-leave").click();
  await lorne.getByTestId("end-day").click();
  await expect(lorne.getByTestId("companion")).toContainText("Day's done");
  await lorne
    .getByRole("button", { name: "Back on the hill", exact: true })
    .click();
  await expect(lorne.getByTestId("sharing-on")).toHaveCount(0);

  // ---- a signed-out stranger gets nothing
  const stranger = await phone(browser, LORNE_SPOT);
  const dayId = new URL(lorne.url()).pathname.split("/").pop();
  const res = await stranger.request.get(`/snow/api/${dayId}/location`);
  expect([401, 404]).toContain(res.status());
});
