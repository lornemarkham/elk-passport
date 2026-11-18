import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * **People's Pulse on phones**, the brief's success story end to end: open
 * it from Labs, create a question, share the link, have friends vote, watch
 * the results move, compare the circle with everyone — then report it.
 *
 * Runs against any server with a People's Pulse store: memory
 * (`PULSE_STORE=memory`) or the local Postgres stack (see
 * docs/product/pulse/PEOPLES-PULSE.md, "Verification"). One serial story.
 * Set PULSE_SHOTS=<dir> to save the phone screenshots used as evidence.
 */

test.describe.configure({ mode: "serial" });

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

const SHOTS = process.env.PULSE_SHOTS;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
  });
}

const RUN = Math.random().toString(36).slice(2, 6);
const QUESTION = `Should Vernon build a second sheet of ice at Kal Tire Place? (${RUN})`;
let pulseUrl = "";
let shareUrl = "";
let host: BrowserContext;
let hostPage: Page;

async function phone(browser: Browser) {
  return browser.newContext(PHONE);
}

async function vote(
  page: Page,
  answer: string,
  place?: { province: string; city?: string },
) {
  await expect(page.getByTestId("pulse-ballot")).toBeVisible();
  if (place) {
    const select = page.getByLabel("Your province or territory", {
      exact: true,
    });
    if (!(await select.isVisible()))
      await page.getByText("Where are you?").click();
    await page
      .getByLabel("Your province or territory", { exact: true })
      .selectOption(place.province);
    if (place.city)
      await page
        .getByLabel("Your city or town (optional)", { exact: true })
        .fill(place.city);
  }
  await page.getByRole("radio", { name: answer }).check({ force: true });
  // A ballot younger than 0.7 s is refused as not-a-person; Playwright is faster.
  await page.waitForTimeout(800);
  await page.getByTestId("pulse-vote").click();
  await expect(page.getByTestId("pulse-voted")).toBeVisible();
}

test("Labs lists People's Pulse, and its page says what it is", async ({
  browser,
}) => {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto("/labs");
  const card = page.getByTestId("labs-experience-pulse");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("labs-experience-status-pulse")).toHaveText(
    "Experimental",
  );
  await page.getByTestId("labs-experience-open-pulse").click();
  await expect(page).toHaveURL(/\/labs\/pulse$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What do you want to know?",
  );
  await expect(page.getByTestId("pulse-footer")).toHaveText("Powered by ELK");
  await expect(page.getByTestId("pulse-disclaimer")).toContainText(
    "not a scientific poll",
  );
  await shot(page, "01-landing");
  await ctx.close();
});

test("a person creates a Pulse with a published claim, from a phone", async ({
  browser,
}) => {
  host = await phone(browser);
  hostPage = await host.newPage();
  await hostPage.goto("/labs/pulse");
  await hostPage.getByTestId("pulse-create-cta").click();
  await expect(hostPage).toHaveURL(/\/labs\/pulse\/new$/);
  const started = Date.now();
  await hostPage.getByLabel("Your question", { exact: true }).fill(QUESTION);
  await hostPage.getByText("A city or town").click();
  await hostPage
    .getByLabel("Province or territory", { exact: true })
    .selectOption("BC");
  await hostPage.getByLabel("City or town", { exact: true }).fill("vernon");
  await hostPage.getByText("Add details").click();
  await hostPage
    .getByLabel("The claim", { exact: true })
    .fill("An article reports that 65% of residents support a second sheet.");
  await hostPage.getByLabel("Published percentage", { exact: true }).fill("65");
  await hostPage
    .getByLabel("Who published it", { exact: true })
    .fill("Okanagan Example News");
  await hostPage
    .getByLabel("Link to the claim", { exact: true })
    .fill("https://example.com/second-sheet");
  await shot(hostPage, "02-create");
  // A person needs a moment; the form refuses anything faster than 2.5 s.
  await hostPage.waitForTimeout(Math.max(0, 2_700 - (Date.now() - started)));
  await hostPage.getByTestId("pulse-create-submit").click();
  await expect(hostPage).toHaveURL(/\/labs\/pulse\/[a-z2-9]{8}\?new=1$/);
  pulseUrl = hostPage.url().replace(/\?new=1$/, "");
  await expect(hostPage.getByTestId("pulse-question")).toHaveText(QUESTION);
  await expect(hostPage.getByText("Vernon, BC").first()).toBeVisible();
  const share = hostPage.getByTestId("pulse-share").first();
  await expect(share).toContainText("Your Pulse is live");
  shareUrl =
    (await hostPage.getByTestId("pulse-share-url").first().textContent()) ?? "";
  expect(shareUrl).toMatch(/\/labs\/pulse\/[a-z2-9]{8}\?c=[a-z2-9]{8}$/);
  // Every sharing route is there, and SMS/email carry the link.
  for (const id of ["pulse-copy", "pulse-sms", "pulse-email"])
    await expect(hostPage.getByTestId(id).first()).toBeVisible();
  expect(
    await hostPage.getByTestId("pulse-sms").first().getAttribute("href"),
  ).toContain(encodeURIComponent(shareUrl));
  expect(
    await hostPage.getByTestId("pulse-email").first().getAttribute("href"),
  ).toContain(encodeURIComponent(shareUrl));
  // Nothing on a phone scrolls sideways, however long the link.
  expect(
    await hostPage.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await shot(hostPage, "03-created-share");
});

test("copy link puts the referral link on the clipboard", async () => {
  await host.grantPermissions(["clipboard-read", "clipboard-write"]);
  await hostPage.getByTestId("pulse-copy").first().click();
  await expect(hostPage.getByTestId("pulse-copy").first()).toHaveText(/Copied/);
  expect(await hostPage.evaluate(() => navigator.clipboard.readText())).toBe(
    shareUrl,
  );
});

test("a shared link unfolds into a rich preview", async ({ request }) => {
  const html = await (await request.get(pulseUrl)).text();
  expect(html).toContain(`property="og:title" content="${QUESTION}"`);
  const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(og).toBeTruthy();
  const img = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
  expect((await img.body()).length).toBeGreaterThan(10_000);
});

test("the host votes; results appear only after voting", async () => {
  await expect(hostPage.getByTestId("pulse-results")).toHaveCount(0);
  await vote(hostPage, "Yes", { province: "BC", city: "Vernon" });
  await expect(hostPage.getByTestId("pulse-total")).toHaveText("1");
  await expect(hostPage.getByTestId("pulse-bar-o1")).toContainText(
    "Your answer",
  );
});

test("friends vote through the link — one vote each — and the host watches it live", async ({
  browser,
}) => {
  const friends: BrowserContext[] = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await phone(browser);
    friends.push(ctx);
    const page = await ctx.newPage();
    await page.goto(shareUrl);
    await expect(page.getByTestId("pulse-question")).toHaveText(QUESTION);
    await vote(page, i < 4 ? "No" : "Yes", { province: "BC", city: "Vernon" });
    if (i === 0) await shot(page, "04-friend-results");
    // The same browser again: no ballot, its answer kept, a second POST is a no-op.
    await page.reload();
    await expect(page.getByTestId("pulse-voted")).toBeVisible();
    await expect(page.getByTestId("pulse-ballot")).toHaveCount(0);
  }
  const again = await friends[0]!.request.post(
    `${pulseUrl.replace("/labs/pulse/", "/api/pulse/")}/vote`,
    {
      data: { option: "o1", ballot: "x.y" },
    },
  );
  expect(again.status()).toBe(400); // no valid ballot
  // Without reloading, the host's page catches up: 6 votes.
  await expect(hostPage.getByTestId("pulse-total")).toHaveText("6", {
    timeout: 15_000,
  });
  for (const f of friends) await f.close();
});

test("the host compares their circle, and BC, with everyone", async () => {
  const compare = hostPage.getByTestId("pulse-compare");
  await expect(compare.getByTestId("pulse-group-circle")).toBeVisible();
  await compare.getByTestId("pulse-group-circle").click();
  await expect(compare.getByTestId("pulse-row-group")).toContainText(
    "Your circle",
  );
  await expect(compare.getByTestId("pulse-row-group")).toContainText(
    "first 5 of 6 votes",
  );
  await expect(compare.getByTestId("pulse-circle-count")).toContainText(
    "5 people have voted through your link",
  );
  await compare.getByTestId("pulse-group-p:BC").click();
  await expect(compare.getByTestId("pulse-row-group")).toContainText(
    "British Columbia",
  );
  await expect(compare.getByTestId("pulse-group-c:Vernon, BC")).toBeVisible();
  // Yes 2 of 6 = 33% beside the published 65%.
  await expect(hostPage.getByTestId("pulse-claim-original")).toHaveText("65%");
  await expect(hostPage.getByTestId("pulse-claim-pulse")).toHaveText("33%");
  await expect(hostPage.getByTestId("pulse-claim")).toContainText(
    "can't confirm or disprove",
  );
  await expect(hostPage.getByTestId("pulse-timeline")).toBeVisible();
  await compare.getByTestId("pulse-group-circle").click();
  await shot(hostPage, "05-host-compare");
});

test("a stranger's circle is empty and says so; the Pulse is on the shelves", async ({
  browser,
}) => {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto(pulseUrl);
  await page.getByText("Just show me the results").click();
  await expect(page.getByTestId("pulse-results")).toBeVisible();
  await page.getByTestId("pulse-group-circle").click();
  await expect(page.getByTestId("pulse-row-hidden")).toContainText(
    "Your circle has 0 votes",
  );
  await page.goto("/labs/pulse");
  await expect(
    page.getByTestId("pulse-card").filter({ hasText: QUESTION }).first(),
  ).toBeVisible();
  await expect(page.locator("#pulse-trending").locator("..")).toContainText(
    QUESTION,
  );
  await ctx.close();
});

test("the ballot works from the keyboard and its controls are big enough to tap", async ({
  browser,
}) => {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto(pulseUrl);
  await expect(page.getByTestId("pulse-ballot")).toBeVisible();
  for (const id of ["pulse-option-o1", "pulse-option-o2", "pulse-vote"]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("radio", { name: "No" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio", { name: "No" })).toBeChecked();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Vote" }).press("Enter");
  await expect(page.getByTestId("pulse-voted")).toBeVisible();
  await ctx.close();
});

test("refuses unsafe Pulses with a reason a person can act on", async ({
  browser,
}) => {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto("/labs/pulse/new");
  await page
    .getByLabel("Your question", { exact: true })
    .fill("Should everyone call Dave at 250-555-0199?");
  await page.waitForTimeout(2_700);
  await page.getByTestId("pulse-create-submit").click();
  await expect(
    page.getByRole("alert").filter({ hasText: "personal details" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/labs\/pulse\/new$/);
  await ctx.close();
});

test("three reports pause the Pulse; moderation is for administrators only", async ({
  browser,
  request,
}) => {
  for (let i = 0; i < 3; i++) {
    const ctx = await phone(browser);
    const page = await ctx.newPage();
    await page.goto(pulseUrl);
    await page.getByText("Report this Pulse").click();
    await page
      .getByRole("radio", { name: "Misleading or false framing" })
      .check();
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByTestId("pulse-report")).toContainText(
      "flagged for review",
    );
    await ctx.close();
  }
  await hostPage.reload();
  await expect(hostPage.getByTestId("pulse-review")).toBeVisible();
  const admin = await request.get("/api/pulse/admin");
  expect([401, 403]).toContain(admin.status());
  const page = await (await phone(browser)).newPage();
  await page.goto("/admin/pulse");
  await expect(page).not.toHaveURL(/\/admin\/pulse$/);
  await host.close();
});
