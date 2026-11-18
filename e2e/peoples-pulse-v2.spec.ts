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
 * **People's Pulse V2 on phones**: create a Pulse, share it, watch it spread
 * across provinces, compare my circle with everyone, and share a results
 * card. One serial story on any server with a People's Pulse store.
 * Set PULSE_SHOTS=<dir> to save the phone screenshots used as evidence.
 */

test.describe.configure({ mode: "serial" });

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1",
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
const QUESTION = `Should every school in Canada start later in the morning? (${RUN})`;
let host: BrowserContext;
let hostPage: Page;
let pulseUrl = "";
let hostLink = "";
let danaLink = "";
const contexts: BrowserContext[] = [];

async function phone(browser: Browser) {
  const ctx = await browser.newContext(PHONE);
  contexts.push(ctx);
  return ctx;
}

async function vote(page: Page, answer: string, province: string) {
  await expect(page.getByTestId("pulse-ballot")).toBeVisible();
  if (
    !(await page
      .getByLabel("Your province or territory", { exact: true })
      .isVisible())
  )
    await page.getByText("Where are you?").click();
  await page
    .getByLabel("Your province or territory", { exact: true })
    .selectOption(province);
  await page.getByRole("radio", { name: answer }).check({ force: true });
  // A ballot younger than 0.7 s is refused as not-a-person; Playwright is faster.
  await page.waitForTimeout(800);
  await page.getByTestId("pulse-vote").click();
  await expect(page.getByTestId("pulse-voted")).toBeVisible();
}

/** A new phone opens `url`, votes, and returns its own share link. */
async function friend(
  browser: Browser,
  url: string,
  answer: string,
  province: string,
) {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto(url);
  await vote(page, answer, province);
  const link = await page.getByTestId("pulse-ask-link").textContent();
  await page.close();
  return link ?? "";
}

test.afterAll(async () => {
  for (const c of contexts) await c.close().catch(() => undefined);
});

test("a person creates a Pulse from the Labs page on a phone", async ({
  browser,
}) => {
  host = await phone(browser);
  hostPage = await host.newPage();
  await hostPage.goto("/labs/pulse");
  await hostPage.getByTestId("pulse-create-cta").click();
  const started = Date.now();
  await hostPage.getByLabel("Your question", { exact: true }).fill(QUESTION);
  await hostPage.waitForTimeout(Math.max(0, 2_700 - (Date.now() - started)));
  await hostPage.getByTestId("pulse-create-submit").click();
  await expect(hostPage).toHaveURL(/\/labs\/pulse\/[a-z2-9]{8}\?new=1$/);
  pulseUrl = hostPage.url().replace(/\?new=1$/, "");
  hostLink =
    (await hostPage.getByTestId("pulse-share-url").first().textContent()) ?? "";
  expect(hostLink).toMatch(/\?c=[a-z2-9]{8}$/);
});

test("the creator votes and sees a results view built for a phone", async () => {
  await vote(hostPage, "Yes", "BC");
  await expect(hostPage.getByTestId("pulse-ask-circle")).toBeVisible();
  // Nobody has joined yet: the comparison explains when it will appear.
  await expect(hostPage.getByTestId("pulse-ask-waiting")).toContainText(
    "Nobody has answered through your link yet",
  );
  await expect(hostPage.getByTestId("pulse-shifts-wait")).toBeVisible();
});

test("people answer through two different links, across two provinces", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  // Dana arrives with no link at all, so she starts a second network.
  danaLink = await friend(browser, pulseUrl, "No", "ON");
  expect(danaLink).toMatch(/\?c=[a-z2-9]{8}$/);
  expect(danaLink).not.toBe(hostLink);
  // Five answer through the host's link (BC); the first of them shares onward.
  const first = await friend(browser, hostLink, "Yes", "BC");
  await friend(browser, first, "No", "BC");
  for (const a of ["Yes", "No", "Yes", "No"])
    await friend(browser, hostLink, a, "BC");
  // Five answer through Dana's link (ON).
  for (const a of ["No", "No", "Yes", "No", "No"])
    await friend(browser, danaLink, a, "ON");
});

test("one person cannot vote again through another link", async ({
  browser,
}) => {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto(hostLink);
  await vote(page, "Yes", "BC");
  await page.goto(danaLink);
  // Already counted: no ballot is offered, the results are.
  await expect(page.getByTestId("pulse-voted")).toBeVisible();
  await expect(page.getByTestId("pulse-ballot")).toHaveCount(0);
  const before = await page.getByTestId("pulse-total").textContent();
  // Even a hand-made second vote through the API is refused as a duplicate.
  const status = await page.evaluate(
    async ([id, ballot]) => {
      const res = await fetch(`/api/pulse/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: "o2", via: null, ballot }),
      });
      return (await res.json()).me?.option ?? null;
    },
    [pulseUrl.split("/").pop()!, "x.y"],
  );
  expect(status).toBeNull();
  await page.reload();
  expect(await page.getByTestId("pulse-total").textContent()).toBe(before);
});

test("Ask My Circle: my circle against everyone, and the link is stable", async () => {
  await hostPage.reload();
  const ask = hostPage.getByTestId("pulse-ask-circle");
  await expect(ask).toBeVisible();
  await expect(hostPage.getByTestId("pulse-ask-link")).toHaveText(hostLink);
  await expect(hostPage.getByTestId("pulse-ask-mine")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-ask-everyone")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-ask-gaps")).toContainText("pts");
  // The question is the very same one, and the votes are one shared set.
  await expect(hostPage.getByTestId("pulse-question")).toHaveText(QUESTION);
  await expect(hostPage.getByTestId("pulse-total")).toHaveText("14");
  await shot(hostPage, "v2-01-ask-my-circle");
});

test("Ask My Circle uses the phone's share sheet with the personal link", async () => {
  await hostPage.evaluate(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: unknown) => {
        (window as unknown as { __shared: unknown[] }).__shared.push(data);
      },
    });
  });
  await hostPage.getByTestId("pulse-ask-button").click();
  const shared = await hostPage.evaluate(
    () =>
      (window as unknown as { __shared: { url: string; text: string }[] })
        .__shared,
  );
  expect(shared).toHaveLength(1);
  expect(shared[0]!.url).toBe(hostLink);
  expect(shared[0]!.text).toContain(QUESTION);
});

test("the map shows provinces with enough votes, sample sizes, and hides the rest", async () => {
  const map = hostPage.getByTestId("pulse-map");
  await expect(map).toBeVisible();
  await expect(hostPage.getByTestId("pulse-tile-BC")).toHaveAttribute(
    "data-state",
    "shown",
  );
  await expect(hostPage.getByTestId("pulse-tile-ON")).toHaveAttribute(
    "data-state",
    "shown",
  );
  await expect(hostPage.getByTestId("pulse-tile-ON")).toContainText("n=6");
  await expect(hostPage.getByTestId("pulse-tile-QC")).toHaveAttribute(
    "data-state",
    "hidden",
  );
  await expect(hostPage.getByTestId("pulse-tile-QC")).toBeDisabled();
  await expect(hostPage.getByTestId("pulse-tile-QC")).not.toContainText("n=");
  await expect(hostPage.getByTestId("pulse-map-note")).toContainText(
    "Self-reported",
  );
  // Select a second province to compare.
  await hostPage.getByTestId("pulse-tile-ON").click();
  await expect(hostPage.getByTestId("pulse-map-row-ON")).toContainText(
    "Ontario (self-reported)",
  );
  await expect(hostPage.getByTestId("pulse-map-row-BC")).toBeVisible();
  await shot(hostPage, "v2-02-map");
});

test("opinion shifts and participation growth are drawn from the real votes", async () => {
  await expect(hostPage.getByTestId("pulse-shifts")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-shift-line-o1")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-timeline-referred")).toBeAttached();
  await shot(hostPage, "v2-03-shifts");
});

test("how it spread: counts only, and networks compared", async () => {
  await expect(hostPage.getByTestId("pulse-spread-summary")).toContainText(
    "came through a shared link",
  );
  await expect(hostPage.getByTestId("pulse-ripple")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-my-ripple")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-net-1")).toBeVisible();
  await expect(hostPage.getByTestId("pulse-net-2")).toBeVisible();
  // No code, hash or contact ever reaches the page's data.
  const snap = JSON.stringify(
    await hostPage.evaluate(
      async (id) => (await fetch(`/api/pulse/${id}`)).json(),
      pulseUrl.split("/").pop(),
    ),
  );
  const spreadJson = JSON.stringify(JSON.parse(snap).results.insights.spread);
  for (const link of [hostLink, danaLink])
    expect(spreadJson).not.toContain(link.split("?c=")[1]!);
  // Only labels and counts: every value is a number, a flag or "Network n".
  expect(spreadJson).not.toMatch(/"(?:circle|via|code|voter)"/);
  await shot(hostPage, "v2-04-spread");
});

test("the results card is a phone-sized picture, shareable as an image", async () => {
  const card = hostPage.getByTestId("pulse-results-card");
  await card.scrollIntoViewIfNeeded();
  const img = hostPage.getByTestId("pulse-card-image");
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBe(1080);
  const id = pulseUrl.split("/").pop();
  const circle = hostLink.split("?c=")[1];
  const plain = await hostPage.request.get(`/labs/pulse/${id}/card`);
  const mine = await hostPage.request.get(`/labs/pulse/${id}/card?c=${circle}`);
  const province = await hostPage.request.get(`/labs/pulse/${id}/card?p=BC`);
  for (const r of [plain, mine, province]) {
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
  }
  // A comparison changes the picture.
  expect((await mine.body()).equals(await plain.body())).toBe(false);
  expect((await province.body()).equals(await plain.body())).toBe(false);
  // Show my circle is on by default (the circle has enough votes).
  await expect(hostPage.getByTestId("pulse-card-image")).toHaveAttribute(
    "src",
    new RegExp(`card\\?c=${circle}$`),
  );
  await hostPage.evaluate(() => {
    (window as unknown as { __files: unknown[] }).__files = [];
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (d: { files?: File[] }) => Boolean(d.files?.length),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { files?: File[] }) => {
        (window as unknown as { __files: unknown[] }).__files.push(
          ...(d.files ?? []).map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })),
        );
      },
    });
  });
  await hostPage.getByTestId("pulse-card-share").click();
  await expect
    .poll(() =>
      hostPage.evaluate(
        () =>
          (window as unknown as { __files: { type: string; size: number }[] })
            .__files,
      ),
    )
    .toEqual([
      expect.objectContaining({ type: "image/png", size: expect.any(Number) }),
    ]);
  await shot(hostPage, "v2-05-results-card");
  await fs.promises
    .mkdir(SHOTS ?? "/tmp", { recursive: true })
    .catch(() => undefined);
  if (SHOTS) {
    fs.writeFileSync(path.join(SHOTS, "v2-card-circle.png"), await mine.body());
    fs.writeFileSync(
      path.join(SHOTS, "v2-card-everyone.png"),
      await plain.body(),
    );
  }
});

test("nothing on the results page scrolls sideways on a phone", async () => {
  expect(
    await hostPage.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("source check refuses addresses a server must not open", async ({
  request,
}) => {
  const status = await request.get("/api/pulse/source-check");
  expect(status.ok()).toBe(true);
  expect(typeof (await status.json()).ai).toBe("boolean");
  for (const url of [
    "https://localhost/secret",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/",
    "https://intranet/",
  ]) {
    const res = await request.post("/api/pulse/source-check", {
      data: { url },
      headers: { origin: new URL(pulseUrl).origin },
    });
    const body = await res.json();
    expect(body.ok, url).toBe(false);
    expect(body.reason).toMatch(/https:\/\/ link to a public web page/);
  }
});

test("the creation form offers the optional source check", async ({
  browser,
}) => {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto("/labs/pulse/new");
  await page.getByText("Add details").click();
  await expect(page.getByTestId("pulse-source-check")).toBeVisible();
  await expect(page.getByTestId("pulse-source-look")).toBeDisabled();
  await page
    .getByLabel("Link to the claim", { exact: true })
    .fill("https://localhost/poll");
  await page.getByTestId("pulse-source-look").click();
  await expect(page.getByTestId("pulse-source-check")).toContainText(
    "public web page",
  );
  // Nothing is filled in for the creator unless they choose it.
  await expect(page.getByLabel("What the figure measures")).toHaveValue("");
  await shot(page, "v2-06-source-check");
});

test("the Question of the Day shows on the landing page when one is featured", async ({
  browser,
}) => {
  test.skip(
    !process.env.PULSE_FEATURED,
    "needs a Pulse featured for today by an administrator (set PULSE_FEATURED to its question)",
  );
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto("/labs/pulse");
  await expect(page.getByTestId("pulse-today")).toContainText(
    process.env.PULSE_FEATURED!,
  );
  await shot(page, "v2-07-question-of-the-day");
});
