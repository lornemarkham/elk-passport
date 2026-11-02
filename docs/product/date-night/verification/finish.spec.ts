import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Date Night: finish, polish & ship** (FINISH-POLISH-SHIP.md). The
 * journey the brief asked for, on two phones and a desktop, against the
 * real local stack:
 *
 *  - Together's buttons hold still through the 15-second background
 *    refresh (they used to grey out with it: the "Text Jess" flicker), and
 *    a disabled one says what's missing.
 *  - Make it, then Send to Jess: the link exists before the share sheet
 *    opens, it's shown, it can be copied, and nothing claims it was sent.
 *  - Jess opens the link, joins, sees whose turn it is, answers; Lorne sees
 *    her answer and the turn moves.
 *  - Soundtrack for tonight: a bad paste is explained; a Spotify link with
 *    `?si=` is saved, opened, previewed and sent; the recommendations are
 *    Spotify playlists; Jess sees the same soundtrack.
 *  - Memories: Jess shares a photo; Lorne sees it load.
 *  - Desktop: no share sheet, so Send to Jess copies, and says so; the
 *    composer works from the keyboard.
 */

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
const PASSWORD = "first-date-forever-7";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-fp-${stamp}@example.test`;
const PLAYLIST = "37i9dQZF1DX9wC1KY45plY"; // Classic Road Trip Songs

async function shot(page: Page, name: string, fullPage = false) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `finish-${name}.png`),
    fullPage,
  });
}

/** A phone whose share sheet keeps what was shared, for the test to read. */
async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async (data: { text?: string }) => {
        const shared = JSON.parse(
          sessionStorage.getItem("shared") ?? "[]",
        ) as string[];
        shared.push(data.text ?? "");
        sessionStorage.setItem("shared", JSON.stringify(shared));
      },
    });
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

async function signIn(page: Page, who: string) {
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

type RoomName = "Adventure" | "Change it" | "Together" | "Memories" | "Invite";
const tab = (page: Page, name: RoomName) =>
  page.getByRole("tab", { name: new RegExp(`^${name}`) });
async function room(page: Page, name: RoomName) {
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
}

async function settle(page: Page) {
  await expect(page.getByTestId("evening-plan")).toHaveCount(1);
  await expect(page.locator("main[data-busy]")).toHaveCount(0);
}

async function writes(
  page: Page,
  act: () => Promise<unknown>,
  path: RegExp = /\/api\/night\/[^/]+\/plan$/,
) {
  const done = page.waitForResponse(
    (r) =>
      path.test(new URL(r.url()).pathname) && r.request().method() !== "GET",
  );
  await act();
  expect((await done).ok()).toBe(true);
  await settle(page);
}

async function lastShared(page: Page, count: number) {
  const shared = () =>
    page.evaluate(
      () => JSON.parse(sessionStorage.getItem("shared") ?? "[]") as string[],
    );
  await expect.poll(async () => (await shared()).length).toBe(count);
  const text = (await shared()).at(-1)!;
  const link = text.match(/https?:\/\/\S+/)![0];
  return { text, link, path: link.replace(/^https?:\/\/[^/]+/, "") };
}

/** Nothing on the page says a message went: only the person can send it. */
async function claimsNothing(page: Page) {
  await expect(page.getByText(/\b(sent|delivered) to /i)).toHaveCount(0);
  await expect(page.getByText(/message sent/i)).toHaveCount(0);
}

test("Date Night, finished: send, answer, turns, soundtrack, memories", async ({
  browser,
}) => {
  test.setTimeout(480_000);
  const lorne = await phone(browser);

  await lorne.goto("/auth");
  await signUp(lorne, "lorne");
  await lorne.goto("/datenight");
  await lorne.getByRole("button", { name: "Let's find some trouble" }).click();
  await lorne.waitForURL(/\/night\//);
  const nightPath = new URL(lorne.url()).pathname;
  await writes(lorne, () =>
    lorne
      .getByTestId("evening")
      .filter({ hasText: "King Eddie Lake" })
      .getByTestId("choose-evening")
      .click(),
  );

  // ---------------------------------------------- buttons that hold still
  await room(lorne, "Together");
  await lorne.getByTestId("make-predict").click();
  const make = lorne.getByTestId("make-send");
  await expect(make).toBeDisabled();
  await expect(lorne.getByTestId("make-missing")).toHaveText(
    "Pick your guess at what Jess chooses.",
  );
  await lorne.getByLabel("This", { exact: true }).fill("Sunrise");
  await lorne.getByLabel("That", { exact: true }).fill("Sunset");
  await lorne.getByTestId("guess-1").click();
  await expect(make).toBeEnabled();
  await expect(make).toHaveText("Make it for Jess");
  await expect(lorne.getByTestId("make-missing")).toHaveCount(0);
  // Through more than one 15-second background refresh, it never greys out.
  const flickers = await lorne.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="make-send"]',
    )!;
    let off = 0;
    const end = Date.now() + 33_000;
    while (Date.now() < end) {
      if (button.isConnected && button.disabled) off++;
      await new Promise((r) => setTimeout(r, 100));
    }
    return off;
  });
  expect(flickers).toBe(0);
  await shot(lorne, "01-ready-to-make");

  // ----------------------------------------- make it, then send to Jess
  await writes(lorne, () => make.click(), /\/items$/);
  const ready = lorne.getByTestId("ready-to-send");
  await expect(ready).toContainText("Made. Now send it to Jess.");
  await expect(ready).toContainText("Nothing is sent until you press send");
  await expect(lorne.getByTestId("ready-link")).toHaveValue(
    /\/adventures\/join\/[^?]+\?next=%2Fnight%2F/,
  );
  await shot(lorne, "02-made-now-send");
  await lorne.getByTestId("ready-send").click();
  const pick = await lastShared(lorne, 1);
  expect(pick.text).toContain("Sunrise or Sunset");
  expect(pick.link).toBe(await lorne.getByTestId("ready-link").inputValue());
  await claimsNothing(lorne);
  await lorne.getByTestId("ready-copy").click();
  await expect
    .poll(() => lorne.evaluate(() => navigator.clipboard.readText()))
    .toContain(pick.link);
  const mine = lorne.getByTestId("play").filter({ hasText: "Sunrise" });
  await expect(mine.getByTestId("turn")).toHaveText("Jess's turn");
  await expect(lorne.getByTestId("plays-turns")).toContainText(
    "Jess's turn · 1",
  );
  await expect(mine.getByTestId("text-partner")).toHaveText(/Send to Jess/);
  await expect(mine.getByTestId("copy-link")).toHaveText(/Copy link/);

  // --------------------------------------------------------- soundtrack
  const music = lorne.getByTestId("soundtrack");
  await expect(music).toContainText("Soundtrack for tonight");
  await expect(lorne.getByTestId("soundtrack-drive")).toContainText(
    "minutes in the car",
  );
  const moods = music.getByTestId("soundtrack-mood");
  await expect(moods.first()).toBeVisible();
  for (const href of await music
    .getByTestId("soundtrack-moods")
    .getByRole("link")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href"))))
    expect(href).toMatch(
      /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]{22}$/,
    );
  await expect(music.locator('[data-mood="country-backroads"]')).toBeVisible();
  const input = lorne.getByTestId("soundtrack-input");
  await input.fill("https://music.apple.com/ca/playlist/x");
  await expect(lorne.getByTestId("soundtrack-save")).toBeDisabled();
  await expect(lorne.getByTestId("soundtrack-why")).toContainText(
    "isn't a Spotify link",
  );
  await input.fill(`https://open.spotify.com/playlist/${PLAYLIST}?si=abc123`);
  await lorne.getByTestId("soundtrack-name").fill("Backroads and bad singing");
  await writes(
    lorne,
    () => lorne.getByTestId("soundtrack-save").click(),
    /\/items$/,
  );
  await expect(lorne.getByTestId("soundtrack-title")).toHaveText(
    "Backroads and bad singing",
  );
  await expect(lorne.getByTestId("soundtrack-open")).toHaveAttribute(
    "href",
    `https://open.spotify.com/playlist/${PLAYLIST}`,
  );
  await lorne.getByTestId("soundtrack-preview").click();
  await expect(lorne.getByTestId("soundtrack-player")).toHaveAttribute(
    "src",
    new RegExp(`^https://open\\.spotify\\.com/embed/playlist/${PLAYLIST}`),
  );
  await lorne.getByTestId("soundtrack-share").click();
  const song = await lastShared(lorne, 2);
  expect(song.text).toContain("Our soundtrack for tonight");
  expect(song.link).toBe(`https://open.spotify.com/playlist/${PLAYLIST}`);
  await claimsNothing(lorne);
  // Saving another replaces it rather than piling up.
  await writes(
    lorne,
    () =>
      music
        .getByRole("button", { name: /Use Songs to Sing in the Car/ })
        .click(),
    /\/items$/,
  );
  await expect(lorne.getByTestId("soundtrack-title")).toHaveText(
    "Songs to Sing in the Car",
  );
  await lorne.reload();
  await settle(lorne);
  await room(lorne, "Together");
  await expect(lorne.getByTestId("soundtrack-now")).toHaveCount(1);
  await expect(lorne.getByTestId("suggestions")).toHaveCount(0);
  await shot(lorne, "03-soundtrack", true);

  // ---------------------------------------- Jess opens it and answers
  const jess = await phone(browser);
  await jess.goto(pick.path);
  await jess.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(jess, "jess");
  await jess.waitForURL(/adventures\/join\//);
  await jess.getByRole("button", { name: "I'm in — join" }).click();
  await jess.waitForURL(/\/night\/[^?]+\?p=[0-9a-f-]{36}/);
  await settle(jess);
  const theirs = jess.getByTestId("play").filter({ hasText: "Sunrise" });
  await expect(theirs.getByTestId("turn")).toHaveText("Your turn");
  await expect(jess.getByTestId("plays-turns")).toContainText("Your turn · 1");
  await shot(jess, "04-jess-your-turn");
  await writes(jess, () => theirs.getByTestId("answer-1").click(), /\/items$/);
  await expect(theirs.getByTestId("play-result")).toContainText("called it");
  await expect(theirs.getByTestId("turn")).toHaveText("Done ✓");
  await expect(theirs.getByTestId("text-partner")).toHaveText(/Tell lorne-fp-/);
  await expect(jess.getByTestId("soundtrack-title")).toHaveText(
    "Songs to Sing in the Car",
  );
  await expect(jess.getByTestId("soundtrack-now")).toContainText(
    "from lorne-fp-",
  );

  // Lorne sees it without doing anything (the 15-second refresh).
  await expect(mine.getByTestId("play-result")).toContainText(
    /jess-fp-\S+ picked Sunset/,
    { timeout: 25_000 },
  );
  await expect(mine.getByTestId("turn")).toHaveText("Done ✓");

  // ---------------------------------------------------------- memories
  await room(jess, "Memories");
  await jess.getByLabel("A moment worth keeping").fill("The lake at sunset.");
  await jess
    .locator('input[type="file"]')
    .setInputFiles(
      path.resolve(__dirname, "../../../../public/datenight/campfire.jpg"),
    );
  await expect(jess.getByText("Photo ready")).toBeVisible();
  await writes(
    jess,
    () => jess.getByRole("button", { name: "Share", exact: true }).click(),
    /\/moments$/,
  );
  await lorne.reload();
  await settle(lorne);
  await room(lorne, "Memories");
  const photo = lorne.getByTestId("memories").locator("img").first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(lorne.getByTestId("memories")).toContainText(
    "The lake at sunset.",
  );
  await shot(lorne, "05-memories", true);

  // ------------------------------------- a desktop, by keyboard, no sheet
  const desk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const desktop = await desk.newPage();
  await signIn(desktop, "lorne");
  await desktop.goto(`${nightPath}#together`);
  await settle(desktop);
  await desktop.getByTestId("make-dare").focus();
  await desktop.keyboard.press("Enter");
  await expect(desktop.getByTestId("composer")).toBeVisible();
  await desktop.getByLabel("The words").fill("");
  await expect(desktop.getByTestId("make-missing")).toHaveText(
    "Write something first, or tap Another.",
  );
  await desktop.getByLabel("The words").fill("Howl at the moon. Once.");
  await desktop.getByTestId("make-send").focus();
  const made = desktop.waitForResponse(
    (r) =>
      /\/items$/.test(new URL(r.url()).pathname) &&
      r.request().method() === "POST",
  );
  await desktop.keyboard.press("Enter");
  expect((await made).ok()).toBe(true);
  await expect(desktop.getByTestId("ready-link")).toHaveValue(
    /\/night\/[^?]+\?p=[0-9a-f-]{36}$/,
  );
  await desktop.getByTestId("ready-send").click();
  await expect
    .poll(() => desktop.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/Howl at the moon\. Once\.\nhttp:\/\/\S+\/night\/\S+\?p=/);
  await expect(
    desktop.getByText(/^Link copied\. Paste it into a message to jess-fp-/),
  ).toBeVisible();
  await claimsNothing(desktop);
  await shot(desktop, "06-desktop-copied");
});
