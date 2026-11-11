import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **Sesh Wars, end to end, on a phone.**
 *
 * 1. The brief's success journey, in Demo Mode: Snow → SESH WARS →
 *    SilverStar → a feature → watch → chirp → challenge → post → vote →
 *    skip to the buzzer → crowned → patches. Nothing leaves the phone.
 * 2. The real thing on the local stack (stack.mjs with the Sesh Wars
 *    migration and its Storage stand-in): two riders on their own accounts
 *    upload real video (a WebM recorded in the browser from a canvas), one
 *    challenges the other, a third votes and chirps.
 *
 *   node docs/product/snow/verification/stack.mjs start
 *   (next dev or next start -p 3132 with the stack's env)
 *   E2E_PORT=3132 npx playwright test -c docs/product/snow/verification sesh
 */
const SHOTS = path.resolve(__dirname, "screenshots/sesh-wars");
const PASSWORD = `sw-${randomBytes(12).toString("base64url")}`;
const stamp = Date.now().toString(36);

async function shot(page: Page, name: string) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: process.env.FULL === "1",
  });
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

test("demo: the whole success journey", async ({ browser }) => {
  const page = await phone(browser);
  await page.goto("/snow");
  await page
    .getByRole("link", { name: /Sesh Wars — every feature has a champion/ })
    .click();
  await page.waitForURL(/\/snow\/sesh-wars$/);
  await shot(page, "01-real-landing");
  await page.getByRole("link", { name: "Try the demo mountain" }).click();
  await page.waitForURL(/\/snow\/sesh-wars\/demo$/);
  await expect(page.getByText("Demo mode")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Every feature has a champion/i }),
  ).toBeVisible();
  await shot(page, "02-demo-landing");

  // Choose SilverStar, find a feature.
  await page.getByRole("link", { name: /SilverStar.*features/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "SilverStar" }),
  ).toBeVisible();
  await shot(page, "03-mountain");
  await page
    .getByRole("link", { name: /Starlight Rail/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Starlight Rail" }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo · fictional feature").first(),
  ).toBeVisible();
  await expect(page.getByText("Today's Champion")).toBeVisible();
  await shot(page, "04-feature");

  // Watch someone hit it: Juniper's clip.
  await page.goto("/snow/sesh-wars/demo/c/dc-bait");
  await expect(
    page.getByRole("heading", { level: 1, name: "Juniper" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Play Juniper's clip/ }).click();
  await expect(
    page.getByRole("img", { name: /not real footage/ }),
  ).toBeVisible();
  await shot(page, "05-clip");

  // React and chirp.
  await page.getByRole("button", { name: /SICK!/ }).click();
  await expect(page.getByRole("button", { name: /SICK!/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByPlaceholder("Chirp…")
    .fill("Okay Juniper, that was clean. Watch this.");
  await page.getByRole("button", { name: "Chirp it" }).click();
  await expect(
    page.getByText("Okay Juniper, that was clean. Watch this."),
  ).toBeVisible();
  // The line holds in the demo too.
  await page.getByPlaceholder("Chirp…").fill("you're such a loser");
  await page.getByRole("button", { name: "Chirp it" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Chirp the riding, not the rider" }),
  ).toBeVisible();

  // Challenge them, post my own.
  await page.getByRole("link", { name: "⚔️ Challenge this rider" }).click();
  await expect(
    page.getByRole("heading", { name: /Answer the challenge/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Snowboard", exact: true }).click();
  await page
    .getByPlaceholder("What did you land?")
    .fill("Boardslide to fakie. Your move.");
  await page.getByLabel(/I filmed this/).check();
  await page.getByLabel(/open, resort-built feature/).check();
  await shot(page, "06-answer");
  await page.getByRole("button", { name: "⚔️ Throw down" }).click();
  await page.waitForURL(/\/demo\/x\//);
  await expect(
    page.getByRole("heading", { name: "Head to head" }),
  ).toBeVisible();
  await expect(
    page.getByText("You're in this one. No voting for yourself!"),
  ).toBeVisible();
  // First patch for the first clip.
  await expect(
    page.getByRole("dialog", { name: "Patch earned" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "First Flight patch" }),
  ).toBeVisible();
  await shot(page, "07-patch-first-flight");
  await page.getByRole("button", { name: "Stitch it on" }).click();
  const mine = page.url();

  // Vote in someone else's challenge — once.
  await page.goto("/snow/sesh-wars/demo/f/d-ss-comet");
  await page.getByRole("link", { name: /⚔️/ }).first().click();
  await page
    .getByRole("button", { name: /^Vote / })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "✓ Your vote" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Vote / })).toBeDisabled();
  await shot(page, "08-voted");

  // People vote; the buzzer goes; a champion is crowned.
  await page.goto(mine);
  await page
    .getByRole("button", { name: "⏩ Demo: skip to the buzzer" })
    .click();
  await expect(page.getByText("👑 You takes it")).toBeVisible();
  await expect(page.getByText("WINNER", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Patch earned" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Rail Ace patch" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Style Commander patch" }),
  ).toBeVisible();
  await shot(page, "09-crowned");
  await page.getByRole("button", { name: "Stitch it on" }).click();

  await page.goto("/snow/sesh-wars/demo/f/d-ss-starlight");
  await expect(page.getByText("Today's Champion").locator("..")).toContainText(
    "You",
  );
  await page.goto("/snow/sesh-wars/demo/patches");
  await expect(page.getByText("Earned ✓")).toHaveCount(4);
  await shot(page, "10-patches");

  // A younger rider: adults cheer, they don't chirp or challenge.
  await page.goto("/snow/sesh-wars/demo/feed/silverstar");
  await expect(
    page.getByRole("heading", { name: /Chairlift feed/ }),
  ).toBeVisible();
  await shot(page, "11-feed");

  // The demo is this phone's alone: start over clears it.
  await page.getByRole("button", { name: "Start over" }).click();
  await page.goto("/snow/sesh-wars/demo/patches");
  await expect(page.getByText("Earned ✓")).toHaveCount(0);
});

/** A real, playable WebM, recorded in the page from a moving canvas. */
async function attachRecordedClip(page: Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const g = canvas.getContext("2d")!;
    const stream = canvas.captureStream(24);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    rec.start();
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const frame = () => {
        const t = (performance.now() - t0) / 1000;
        g.fillStyle = "#e6dbbf";
        g.fillRect(0, 0, 320, 180);
        g.fillStyle = "#4b5320";
        g.fillRect(40 + t * 120, 90 - Math.sin(t * 3) * 40, 24, 24);
        if (t < 1.4) requestAnimationFrame(frame);
        else done();
      };
      frame();
    });
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    const file = new File(parts, "lap.webm", { type: "video/webm" });
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function joinAs(page: Page, who: string) {
  await page.goto("/auth?next=%2Fsnow%2Fsesh-wars%2Fme");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page
    .getByLabel("Email address")
    .fill(`${who}-sesh-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
  await page.goto("/snow/sesh-wars/me");
  await page.getByLabel("Rider name").fill(`${who}${stamp.slice(-3)}`);
  await page.getByRole("button", { name: "Whistler Blackcomb" }).click();
  await page.getByRole("button", { name: "Snowboard" }).click();
  await page.getByRole("button", { name: "Wingman" }).click();
  await page.getByRole("button", { name: "18 or older" }).click();
  await page.getByRole("button", { name: "Join Sesh Wars" }).click();
  await page.waitForURL(/\/snow\/sesh-wars\/r\//);
}

async function postReal(page: Page, caption: string) {
  await page.getByRole("button", { name: "Snowboard", exact: true }).click();
  await attachRecordedClip(page);
  await expect(page.locator("video")).toBeVisible();
  await page.getByPlaceholder("What did you land?").fill(caption);
  await page.getByLabel(/I filmed this/).check();
  await page.getByLabel(/open, resort-built feature/).check();
}

test("real: upload, challenge, vote, chirp — on three accounts", async ({
  browser,
}) => {
  const ava = await phone(browser);
  await ava.goto("/snow/sesh-wars");
  test.skip(
    await ava.getByText("Sesh Wars is warming up").isVisible(),
    "the Sesh Wars migration is not applied here",
  );
  await joinAs(ava, "Ava");
  await ava.goto("/snow/sesh-wars/m/whistler-blackcomb");
  await expect(
    ava.getByText("Resort-listed · read 2026-11-10").first(),
  ).toBeVisible();
  await shot(ava, "20-real-mountain");
  await ava.locator('main a[href="/snow/sesh-wars/f/wb-ego"]').first().click();
  await expect(
    ava.getByRole("link", {
      name: /“We have opened small features at Ego Park/,
    }),
  ).toBeVisible();
  await ava.getByRole("link", { name: "🎥 Post a clip here" }).click();
  await ava.getByRole("button", { name: "Wingman" }).click();
  await ava.getByRole("button", { name: "Best Style" }).click();
  await postReal(ava, "First lap of the season");
  await shot(ava, "21-real-post");
  await ava.getByRole("button", { name: "Publish" }).click();
  await ava.waitForURL(/\/snow\/sesh-wars\/c\/[0-9a-f-]{36}$/, {
    timeout: 60_000,
  });
  await expect(ava.getByRole("dialog", { name: "Patch earned" })).toBeVisible();
  await ava.getByRole("button", { name: "Stitch it on" }).click();
  const clipUrl = ava.url();
  // It plays back from storage through a signed link.
  await ava.getByRole("button", { name: /^Play / }).click();
  await expect
    .poll(
      () =>
        ava.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await shot(ava, "22-real-clip");
  await expect(
    ava.getByRole("button", { name: "⚔️ Challenge this rider" }),
  ).toBeDisabled();

  const ben = await phone(browser);
  await joinAs(ben, "Ben");
  await ben.goto(clipUrl);
  await ben.getByRole("link", { name: "⚔️ Challenge this rider" }).click();
  await postReal(ben, "Same rail, more style");
  await ben.getByRole("button", { name: "⚔️ Throw down" }).click();
  await ben.waitForURL(/\/snow\/sesh-wars\/x\/[0-9a-f-]{36}$/, {
    timeout: 60_000,
  });
  await expect(
    ben.getByText(/23h 5\dm left|24h 0m left|23h \d+m left/),
  ).toBeVisible();
  const challengeUrl = ben.url();

  const cam = await phone(browser);
  await joinAs(cam, "Cam");
  await cam.goto(challengeUrl);
  await cam.getByRole("button", { name: /^Vote Ben/ }).click();
  await expect(cam.getByRole("button", { name: "✓ Your vote" })).toBeVisible();
  await cam.getByRole("button", { name: "Respect. Your move ⚔️" }).click();
  await expect(
    cam.getByRole("listitem").filter({ hasText: "Respect. Your move ⚔️" }),
  ).toBeVisible();
  await shot(cam, "23-real-voted");

  // Ava can't vote in her own; the tally is the database's.
  await ava.goto(challengeUrl);
  await expect(
    ava.getByText("You're in this one. No voting for yourself!"),
  ).toBeVisible();
  await expect(ava.getByLabel("Votes 0 to 1")).toBeVisible();

  // Signed out, the clip is still watchable and shareable (Ava is an adult).
  const visitor = await phone(browser);
  await visitor.goto(clipUrl);
  await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    visitor.getByText("Sign in to throw down a challenge."),
  ).toBeVisible();
});
