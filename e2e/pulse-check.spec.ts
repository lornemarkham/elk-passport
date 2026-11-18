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
 * **Pulse Check on phones**: SEE IT → SUBMIT IT → INVESTIGATE IT → PUBLISH IT
 * → SHARE IT → DISCUSS IT.
 *
 * Someone sees "Kelowna General Hospital is operating at 147% capacity" on
 * Facebook, brings a screenshot, reads real news pages through People's
 * Pulse, publishes, copies the suggested comment, and a second phone arrives
 * from Facebook through that link, reads the evidence, votes and adds an
 * experience. Then the asker corrects the check.
 *
 * Needs a server with a Pulse store and internet access: the evidence pages
 * are real public news articles, opened by the server. Set PULSE_SHOTS=<dir>
 * for the screenshots used as evidence.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const SHOTS = process.env.PULSE_SHOTS;
const RUN = Math.random().toString(36).slice(2, 6);
const CLAIM = `Kelowna General Hospital is operating at 147% capacity. (${RUN})`;
const SOURCES = {
  y2022:
    "https://www.castanetkamloops.net/news/Kelowna/359694/KGH-operating-at-115-capacity-dealing-with-70-COVID-patients",
  y2017:
    "https://globalnews.ca/news/3163634/kelowna-hospital-at-130-per-cent-capacity-iha-says-outbreaks-to-blame",
  y2025:
    "https://www.castanetkamloops.net/news/BC/589963/Why-are-BCs-emergency-departments-so-crowded",
};
const contexts: BrowserContext[] = [];
let ipSeq = Math.floor(Math.random() * 200);
let checkUrl = "";
let sharedUrl = "";

async function phone(browser: Browser) {
  ipSeq += 1;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1",
    extraHTTPHeaders: {
      "x-forwarded-for": `10.8.${RUN.charCodeAt(0)}.${ipSeq % 250}`,
    },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  contexts.push(ctx);
  return ctx;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
  });
}

async function noSidewaysScroll(page: Page) {
  const wide = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(wide, "no sideways scrolling").toBeLessThanOrEqual(1);
}

/** A real PNG screenshot, drawn in the browser, so the phone's shrink step runs. */
async function screenshotFile(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1170;
    c.height = 1400;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#1877f2";
    g.fillRect(0, 0, c.width, 120);
    g.fillStyle = "#111";
    g.font = "bold 56px sans-serif";
    g.fillText("Kelowna General Hospital is", 60, 320);
    g.fillText("operating at 147% capacity.", 60, 400);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(b64, "base64");
}

async function addSource(page: Page, url: string, stance: string) {
  await page.getByTestId("check-source-url").fill(url);
  await page.getByTestId("check-source-read").click();
  const preview = page.getByTestId("check-source-preview");
  await expect(preview).toBeVisible({ timeout: 25_000 });
  await expect(preview).toContainText(
    "The claim's figure doesn't appear on this page.",
  );
  await page.getByTestId(`check-stance-${stance}`).check();
  await page.getByTestId("check-source-add").click();
}

test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

test("submit, investigate and publish a claim from a phone", async ({
  browser,
}) => {
  const page = await (await phone(browser)).newPage();
  await page.goto("/check");
  await expect(
    page.getByRole("heading", { name: "Seen a claim? Check it." }),
  ).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, "check-01-home");
  await page.getByTestId("check-start").click();

  // SEE IT: a Facebook link (which can't be read), a screenshot, the claim.
  await page
    .getByTestId("check-link")
    .fill("https://www.facebook.com/share/p/1AbCdEfGh/");
  await page.getByTestId("check-link-read").click();
  await expect(page.getByTestId("check-link-note")).toContainText(
    "Facebook doesn't let us read posts",
  );
  await page.getByTestId("check-file").setInputFiles({
    name: "Screenshot 2026-11-18.png",
    mimeType: "image/png",
    buffer: await screenshotFile(page),
  });
  await expect(page.getByTestId("check-file-preview")).toContainText(
    "Kept private",
  );
  await page.getByTestId("check-claim-input").fill(CLAIM);
  await expect(page.getByTestId("check-seen-on")).toHaveValue("facebook");
  await noSidewaysScroll(page);
  await shot(page, "check-02-see-it");
  await page.getByTestId("check-next-1").click();

  // WHY: the asker's own words, kept apart from the claim.
  await page
    .getByTestId("check-why-input")
    .fill(
      "I saw this on Facebook. Is the hospital really operating at 147% capacity?",
    );
  await page.getByTestId("check-scope-city").check({ force: true });
  await page.getByTestId("check-city").fill("Kelowna");
  await shot(page, "check-03-why");
  await page.getByTestId("check-next-2").click();

  // INVESTIGATE: the claim read by rules, where to look, real sources read.
  const analysis = page.getByTestId("check-analysis");
  await expect(analysis).toContainText("147%");
  await expect(analysis).toContainText("Capacity of what");
  await expect(page.getByTestId("check-leads")).toContainText(
    "Interior Health",
  );
  await addSource(page, SOURCES.y2022, "context");
  await addSource(page, SOURCES.y2017, "context");
  await expect(page.getByTestId("check-picked")).toHaveCount(2);
  // A verdict needs a source of its own kind: context alone can't support or contradict.
  await expect(page.getByTestId("check-assess-supported")).toBeDisabled();
  await expect(page.getByTestId("check-assess-contradicted")).toBeDisabled();
  await expect(page.getByTestId("check-assess-partly")).toBeDisabled();
  await expect(page.getByTestId("check-assess-insufficient")).toBeChecked();
  await page
    .getByTestId("check-summary")
    .fill(
      "The published figures I found were 115% (February 2022) and 130% (January 2017). None of them says 147%, and none is current.",
    );
  await noSidewaysScroll(page);
  await shot(page, "check-04-investigate");
  await page.getByTestId("check-next-3").click();

  // PUBLISH: the question type, and four confirmations.
  await page.getByTestId("check-ask-fact").check();
  await expect(page.getByTestId("check-publish")).toBeDisabled();
  for (const k of ["accurate", "publicSubject", "noPersonal", "notVerified"])
    await page.getByTestId(`check-confirm-${k}`).check();
  await shot(page, "check-05-publish");
  // A person takes longer than a script: the form refuses anything sent within 2.5 s.
  await page.waitForTimeout(2_600);
  await page.getByTestId("check-publish").click();
  await page.waitForURL(
    /\/check\/kelowna-general-hospital-is-operating-at-147-capacity-[a-z0-9]+-[a-z2-9]{8}\?new=1/,
  );
  checkUrl = page.url().replace(/\?.*$/, "");

  // SHARE IT: link, the suggested comment, edit, copy.
  const share = page.getByTestId("check-share");
  await expect(share).toContainText("Now post it under the original.");
  await expect(page.getByTestId("check-share-url")).toContainText("?c=", {
    timeout: 15_000,
  });
  sharedUrl = (await page.getByTestId("check-share-url").textContent())!.trim();
  const comment = page.getByTestId("check-comment");
  await expect(comment).toHaveValue(
    `🤔 Is this true?\n\nI came across this claim and wanted to know what the evidence actually says.\n\n🔎 Check the sources and have your say on People's Pulse:\n\n${sharedUrl}`,
  );
  await page.getByTestId("check-copy-comment").click();
  await expect(page.getByTestId("check-copy-comment")).toContainText(
    "Comment copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    sharedUrl,
  );
  await comment.fill(`Found the published numbers — not 147%.\n\n${sharedUrl}`);
  await page.getByTestId("check-copy-comment").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `Found the published numbers — not 147%.\n\n${sharedUrl}`,
  );
  await page.getByTestId("check-copy-link").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    sharedUrl,
  );
  await noSidewaysScroll(page);
  await shot(page, "check-06-share");

  // The page: claim, the asker's reason, the assessment and its limits.
  await expect(page.getByTestId("check-claim")).toContainText(CLAIM);
  await expect(page.getByTestId("check-why")).toContainText(
    "I saw this on Facebook",
  );
  const assess = page.getByTestId("check-assessment");
  await expect(assess).toHaveAttribute("data-assessment", "insufficient");
  await expect(assess).toContainText("Not independently verified");
  await expect(page.getByTestId("check-sources-context")).toContainText(
    "115 per cent",
  );
  await expect(page.getByTestId("check-limits")).toContainText(
    "no automatic web search",
  );
  await expect(page.getByTestId("check-limits")).toContainText(
    "Facebook doesn't let us read posts",
  );
  // The asker can see their own screenshot, privately.
  await expect(
    page.getByText("Your screenshot — only you can see this"),
  ).toBeVisible();
  const file = await page.request.get(
    `/api/pulse/check/${checkUrl.slice(-8)}/file`,
  );
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/jpeg");
  expect(file.headers()["cache-control"]).toContain("private");
  await shot(page, "check-07-page-asker");
});

test("a visitor from Facebook reads, votes and adds an experience", async ({
  browser,
}) => {
  const page = await (await phone(browser)).newPage();
  await page.goto(sharedUrl, { referer: "https://l.facebook.com/" });
  await expect(page.getByTestId("check-claim")).toContainText(CLAIM);
  // Nobody else sees the screenshot, on the page or at its address.
  await expect(page.getByText("Your screenshot")).toHaveCount(0);
  await expect(page.locator("img[src*='/file']")).toHaveCount(0);
  expect(
    (
      await page.request.get(`/api/pulse/check/${checkUrl.slice(-8)}/file`)
    ).status(),
  ).toBe(404);
  await expect(page.getByTestId("check-correct")).toHaveCount(0);

  // PUBLIC OPINION, apart from the evidence.
  const opinion = page.getByTestId("check-opinion");
  await expect(opinion).toContainText(
    "They never decide whether the claim is true.",
  );
  await page.waitForTimeout(900);
  await opinion.getByText("Unsure", { exact: true }).click();
  await opinion.getByTestId("pulse-vote").click();
  await expect(opinion.getByTestId("pulse-voted")).toBeVisible();
  await expect(page.getByTestId("check-assessment")).toHaveAttribute(
    "data-assessment",
    "insufficient",
  );

  // PERSONAL EXPERIENCE, in its own place; other people's health details refused.
  await page.getByTestId("check-post-type-experience").check({ force: true });
  await page
    .getByTestId("check-post-body")
    .fill("My neighbour was diagnosed with cancer and waited in the hallway.");
  await page.getByTestId("check-post-send").click();
  await expect(
    page.getByTestId("check-post-form").getByRole("alert"),
  ).toContainText("medical details");
  await page
    .getByTestId("check-post-body")
    .fill(
      "I was in the KGH emergency department last week and there were beds in the hallway.",
    );
  await page.getByTestId("check-post-send").click();
  await expect(page.getByTestId("check-posts-experience")).toContainText(
    "beds in the hallway",
  );
  await page.getByTestId("check-post-type-question").check({ force: true });
  await page
    .getByTestId("check-post-body")
    .fill("Which day was the 147% figure supposed to be from?");
  await page.getByTestId("check-post-send").click();
  await expect(page.getByTestId("check-posts-question")).toContainText(
    "Which day",
  );
  await expect(page.getByTestId("check-posts-experience")).not.toContainText(
    "Which day",
  );
  await noSidewaysScroll(page);
  await shot(page, "check-08-visitor");
});

test("the asker adds a correction, kept in a visible history", async () => {
  // Same browser as the asker: the first context.
  const page = await contexts[0]!.newPage();
  await page.goto(checkUrl);
  await page.getByTestId("check-correct").locator("summary").click();
  await addSource(page, SOURCES.y2025, "context");
  await page
    .getByTestId("check-correct-note")
    .fill("Added a December 2025 report: most B.C. hospitals run over 100%.");
  await page.getByTestId("check-correct-save").click();
  const history = page.getByTestId("check-history");
  await expect(history).toContainText("Corrections · 1", { timeout: 15_000 });
  await expect(history).toContainText("by the person who asked");
  await expect(history).toContainText("Added a December 2025 report");
  await expect(
    page.getByTestId("check-sources-context").getByTestId("check-source"),
  ).toHaveCount(3);
  await shot(page, "check-09-corrected");
});

test("link previews show the claim and status, never the screenshot", async ({
  request,
}) => {
  const html = await (await request.get(checkUrl)).text();
  const meta = (p: string) =>
    new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]*)"`).exec(
      html,
    )?.[1] ?? "";
  expect(meta("og:title")).toContain("Is this true?");
  expect(meta("og:title")).toContain("147% capacity");
  expect(meta("og:description")).toMatch(/^Insufficient evidence — so far/);
  const image = meta("og:image");
  expect(image).toContain("/opengraph-image");
  expect(image).not.toContain("/file");
  const png = await request.get(
    new URL(image).pathname + new URL(image).search,
  );
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  if (SHOTS)
    fs.writeFileSync(
      path.join(SHOTS, "check-10-preview.png"),
      await png.body(),
    );
});

test("discovery finds it, by place too, and a second asker is told it exists", async ({
  browser,
}) => {
  const page = await (await phone(browser)).newPage();
  await page.goto("/check?p=BC");
  await expect(page.getByTestId("check-shelf-local")).toContainText(CLAIM);
  await expect(page.getByTestId("check-shelf-recent")).toContainText(CLAIM);
  await expect(page.getByTestId("check-shelf-updated")).toContainText(CLAIM);
  await expect(page.getByTestId("check-shelf-discussed")).toContainText(CLAIM);
  await noSidewaysScroll(page);
  await shot(page, "check-11-discover");

  await page.goto("/check/new");
  await page
    .getByTestId("check-claim-input")
    .fill(`Is Kelowna General Hospital operating at 147% capacity? (${RUN})`);
  await page.getByTestId("check-next-1").click();
  await page.getByTestId("check-next-2").click();
  await expect(page.getByTestId("check-duplicates")).toContainText(CLAIM);
});

test("the People's Pulse hub leads to Pulse Check, and V1 still works", async ({
  browser,
}) => {
  const page = await (await phone(browser)).newPage();
  await page.goto("/labs/pulse");
  await expect(page.getByTestId("labs-hub-title")).toBeVisible();
  await page.getByTestId("labs-pulse-check").click();
  await expect(page).toHaveURL(/\/check$/);
  // A check's poll at its People's Pulse address goes to the check.
  await page.goto(`/labs/pulse/${checkUrl.slice(-8)}`);
  await expect(page).toHaveURL(checkUrl);
});
