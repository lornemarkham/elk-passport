import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Powder Day on two phones.** Lorne and Jess are two browser contexts —
 * separate cookies, separate storage, nothing shared but the server — signed
 * in as two real accounts on a real local Supabase. They end up in ONE day:
 * the crew list, votes, chat and a photo cross between them. A third account
 * and a signed-out visitor cannot open it.
 */
const SHOTS = path.resolve(__dirname, "screenshots");
// A fresh password per run: nothing credential-shaped is committed.
const PASSWORD = `pd-${randomBytes(12).toString("base64url")}`;
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-snow-${stamp}@example.test`;

async function shot(page: Page, name: string) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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

const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true }).click();

// A real 2x2 PNG, so the photo route decodes in a browser.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2P8z8Dwn4EIwDiqkL4KAD7sBP2GkoZ4AAAAAElFTkSuQmCC",
  "base64",
);

test("two phones, one snow day", async ({ browser }) => {
  // ---------------------------------------------------- Lorne starts it
  const lorne = await phone(browser);
  await lorne.goto("/auth");
  await signUp(lorne, "lorne");
  await lorne.goto("/snow/new");
  await lorne.getByLabel("Name the day").fill("Powder Friday");
  await lorne.getByLabel("Your name").fill("Lorne");
  await lorne.getByRole("button", { name: "Skiing" }).click();
  await lorne.getByRole("button", { name: "Advanced" }).click();
  await lorne.getByLabel(/Plan it together, live/).check();
  await lorne.getByRole("button", { name: "Create the day" }).click();
  await expect(lorne.getByTestId("day-title")).toHaveText("Powder Friday");
  const dayUrl = lorne.url();
  expect(dayUrl).toMatch(/\/snow\/day\/[a-f0-9]{32}$/);
  await expect(lorne.getByText("Online — shared with the crew")).toBeVisible();

  const pick = lorne.getByLabel("Add a mountain from Passport's list");
  await tab(lorne, "Plan");
  await pick.selectOption({ label: "Cypress Mountain" });
  await pick.selectOption({ label: "Grouse Mountain" });

  // ------------------------------------------------- the invite link
  await tab(lorne, "Crew");
  await lorne.getByRole("button", { name: "Invite the crew" }).click();
  await expect(lorne.getByRole("status")).toContainText("Invite link copied");
  const invite = await lorne.evaluate(() => navigator.clipboard.readText());
  expect(invite).toMatch(/\/snow\/join\?t=/);
  await shot(lorne, "10-shared-crew");

  // ------------------------------------------------ Jess joins, on her own phone
  const jess = await phone(browser);
  await jess.goto(invite);
  await expect(
    jess.getByRole("heading", { name: "Join the snow day" }),
  ).toBeVisible();
  await jess.getByLabel("Your name").fill("Jess");
  await jess.getByRole("button", { name: "Snowboarding" }).click();
  await jess.getByRole("button", { name: "Beginner" }).click();
  await jess.getByRole("button", { name: "I'm in" }).click();
  // Not signed in yet: Passport asks, and brings her back to the same invite.
  await jess.waitForURL(/\/auth/);
  await signUp(jess, "jess");
  await expect(
    jess.getByRole("heading", { name: "Join the snow day" }),
  ).toBeVisible();
  await jess.getByLabel("Your name").fill("Jess");
  await jess.getByRole("button", { name: "Snowboarding" }).click();
  await jess.getByRole("button", { name: "Beginner" }).click();
  await jess.getByRole("button", { name: "I'm in" }).click();
  await expect(jess.getByTestId("day-title")).toHaveText("Powder Friday");
  expect(jess.url()).toBe(dayUrl);
  await expect(jess.getByTestId("you-are")).toHaveText("You are Jess");

  // Both phones show the same crew — Lorne's arrives by itself.
  await tab(jess, "Crew");
  await expect(jess.getByTestId("crew-list")).toContainText("Lorne");
  await expect(jess.getByTestId("crew-list")).toContainText("Jess");
  await expect(lorne.getByTestId("crew-list")).toContainText("Jess", {
    timeout: 20_000,
  });

  // ---------------------------------------------------------- votes
  await tab(jess, "Plan");
  const jessMountain = jess.getByTestId("topic-mountain");
  await expect(
    jessMountain.locator("li").filter({ hasText: "Cypress Mountain" }),
  ).toBeVisible();
  await jessMountain
    .locator("li")
    .filter({ hasText: "Cypress Mountain" })
    .getByRole("button", { name: "Vote" })
    .click();
  await tab(lorne, "Plan");
  const lorneMountain = lorne.getByTestId("topic-mountain");
  await expect(lorneMountain.getByText("LEADING")).toBeVisible({
    timeout: 20_000,
  });
  // Jess is not the host: locking it in is Lorne's.
  await jessMountain
    .getByRole("button", { name: "Lock it in" })
    .first()
    .click();
  await expect(jess.getByTestId("problem")).toHaveText(
    "Only the host can do that.",
  );
  await lorneMountain
    .getByRole("button", { name: "Lock it in" })
    .first()
    .click();
  await expect(lorneMountain.getByText("LOCKED IN")).toBeVisible();
  await expect(jessMountain.getByText("LOCKED IN")).toBeVisible({
    timeout: 20_000,
  });

  // ----------------------------------------------------------- chat
  await tab(jess, "Crew");
  await jess.getByLabel("Message the crew").fill("Bringing the hot chocolate");
  await jess.getByRole("button", { name: "Send" }).click();
  await tab(lorne, "Crew");
  await expect(lorne.getByTestId("chat-messages")).toContainText(
    "Bringing the hot chocolate",
    { timeout: 20_000 },
  );
  await lorne.getByLabel("Message the crew").fill("Leaving at 7:45 sharp");
  await lorne.getByRole("button", { name: "Send" }).click();
  await expect(jess.getByTestId("chat-messages")).toContainText(
    "Leaving at 7:45 sharp",
    { timeout: 20_000 },
  );
  await shot(jess, "11-shared-chat");

  // ------------------------------------------------ the host announces
  // ADR 014: announcements are the core's notices — the host's alone. Jess
  // has no form for one; she answers in chat. What Lorne posts reaches her.
  await expect(jess.getByLabel("Post an update")).toHaveCount(0);
  await lorne.getByLabel("Post an update").fill("Lifts open at 9");
  await lorne.getByRole("button", { name: "Post", exact: true }).click();
  await expect(jess.getByTestId("announcements")).toContainText(
    "Lifts open at 9",
    { timeout: 20_000 },
  );

  // -------------------------------------------- a prediction and a photo
  await tab(lorne, "Get ready");
  await lorne
    .getByLabel("Write a prediction")
    .fill("We take a group photo at the top.");
  await lorne
    .getByTestId("predictions")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await tab(jess, "Get ready");
  const call = jess
    .getByTestId("predictions")
    .locator("li")
    .filter({ hasText: "group photo at the top" });
  await expect(call).toBeVisible({ timeout: 20_000 });
  await call.getByRole("button").first().click(); // Jess calls it
  await expect(call.getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // …and Lorne sees her call on his own phone.
  await expect(
    lorne
      .getByTestId("predictions")
      .locator("li")
      .filter({ hasText: "group photo at the top" })
      .getByText(/1/)
      .first(),
  ).toBeVisible({ timeout: 20_000 });

  await tab(jess, "Memories");
  await jess
    .getByLabel("Add a photo")
    .setInputFiles({ name: "chair.png", mimeType: "image/png", buffer: PNG });
  await expect(jess.getByTestId("photos").locator("img")).toHaveCount(1);
  await tab(lorne, "Memories");
  const photo = lorne.getByTestId("photos").locator("img");
  await expect(photo).toHaveCount(1, { timeout: 20_000 });
  await expect(photo).toHaveAttribute(
    "src",
    /\/snow\/api\/[a-f0-9]{32}\/photo\//,
  );
  // The picture itself loads for a member…
  const src = await photo.getAttribute("src");
  const own = await lorne.request.get(src!);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toMatch(/^image\/(jpeg|png)$/);
  await shot(lorne, "12-shared-memories");

  // ---------------------------------------------------------- points
  // Jess already has points (her photo); a challenge adds to them, and
  // Lorne's phone shows the new total.
  const jessRow = (page: Page) =>
    page
      .getByTestId("standings")
      .locator("ol > li")
      .filter({ hasText: "Jess" });
  const ptsOf = async (page: Page) =>
    Number((await jessRow(page).textContent())!.match(/(\d+) pts/)![1]);
  await tab(lorne, "Challenges");
  await expect(jessRow(lorne)).toContainText("pts");
  const before = await ptsOf(lorne);
  await tab(jess, "Challenges");
  await jess
    .getByRole("button", { name: /^Mark done:/ })
    .first()
    .click();
  await expect(
    jess.getByRole("button", { name: /^Undo:/ }).first(),
  ).toBeVisible();
  await expect(async () =>
    expect(await ptsOf(lorne)).toBeGreaterThan(before),
  ).toPass({ timeout: 20_000 });
  const points = await ptsOf(lorne);

  // ------------------------------- a new session finds all of it again
  // A fresh browser, nothing carried over: only the database remembers.
  const again = await phone(browser);
  await again.goto(dayUrl);
  await again
    .getByRole("main")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await again.waitForURL(/\/auth/);
  await again.getByRole("tab", { name: "Log In" }).click();
  await again.getByLabel("Email address").fill(emailFor("jess"));
  await again.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await again.getByRole("button", { name: "Log in" }).click();
  await again.waitForURL(dayUrl);
  await expect(again.getByTestId("you-are")).toHaveText("You are Jess");
  await tab(again, "Plan");
  await expect(
    again.getByTestId("topic-mountain").getByText("LOCKED IN"),
  ).toBeVisible();
  await tab(again, "Crew");
  await expect(again.getByTestId("chat-messages")).toContainText(
    "Bringing the hot chocolate",
  );
  await expect(again.getByTestId("announcements")).toContainText(
    "Lifts open at 9",
  );
  await expect(again.getByTestId("chat-messages")).toContainText(
    "Leaving at 7:45 sharp",
  );
  await tab(again, "Get ready");
  const kept = again
    .getByTestId("predictions")
    .locator("li")
    .filter({ hasText: "group photo at the top" });
  await expect(kept.getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await tab(again, "Memories");
  await expect(again.getByTestId("photos").locator("img")).toHaveCount(1);
  await tab(again, "Challenges");
  await expect(jessRow(again)).toContainText(`${points} pts`);
  await again.context().close();

  // ------------------------------------- strangers and signed-out visitors
  const mallory = await phone(browser);
  await mallory.goto("/auth");
  await signUp(mallory, "mallory");
  await mallory.goto(dayUrl);
  await expect(
    mallory.getByRole("heading", { name: "This day isn't on this phone" }),
  ).toBeVisible();
  expect((await mallory.request.get(src!)).status()).toBe(404);
  const visitor = await phone(browser);
  await visitor.goto(dayUrl);
  await expect(
    visitor.getByRole("heading", { name: "Sign in to open this snow day" }),
  ).toBeVisible();
  expect((await visitor.request.get(src!)).status()).toBe(401);
});
