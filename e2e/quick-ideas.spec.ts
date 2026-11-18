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
 * **Passport Labs Quick Ideas on phones**: open "What do you want to know?",
 * pick an experience, create it, share it, collect answers from other
 * phones, and see meaningful results — Should I Do It?, Settle This, Is This
 * Normal? and Rank These, all on the one People's Pulse engine.
 *
 * Runs against any server with a People's Pulse store. Each phone gets its
 * own made-up address so per-network caps behave as they would for real
 * people. Set PULSE_SHOTS=<dir> to save the screenshots used as evidence.
 */

test.describe.configure({ mode: "serial" });

const SHOTS = process.env.PULSE_SHOTS;
const RUN = Math.random().toString(36).slice(2, 6);
const contexts: BrowserContext[] = [];
let ipSeq = Math.floor(Math.random() * 200);

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
      "x-forwarded-for": `10.9.${RUN.charCodeAt(0)}.${ipSeq % 250}`,
    },
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
  expect(wide).toBeLessThanOrEqual(1);
}

/** Fill the question, wait like a person, create, and return the share link. */
async function create(page: Page, label: string, question: string) {
  const started = Date.now();
  await page.getByLabel(label, { exact: true }).fill(question);
  return started;
}
async function submit(page: Page, started: number) {
  await page.waitForTimeout(Math.max(0, 2_700 - (Date.now() - started)));
  await page.getByTestId("pulse-create-submit").click();
  await expect(page).toHaveURL(/\/labs\/pulse\/[a-z2-9]{8}\?new=1$/);
  const link =
    (await page.getByTestId("pulse-share-url").first().textContent()) ?? "";
  expect(link).toMatch(/\?c=[a-z2-9]{8}$/);
  return link;
}

/** Choose an answer (or a ranking), optionally say why, and vote. */
async function answer(
  page: Page,
  pick: {
    option?: string;
    ranking?: string[];
    reason?: string;
    group?: string;
  },
) {
  await expect(page.getByTestId("pulse-ballot")).toBeVisible();
  if (pick.ranking) {
    for (const label of pick.ranking.slice(0, -1))
      await page
        .getByTestId("pulse-rank-ballot")
        .getByRole("button", { name: label, exact: true })
        .click();
    await expect(page.getByTestId("pulse-ranked")).toHaveCount(
      pick.ranking.length,
    );
  } else {
    await page
      .getByRole("radio", { name: pick.option!, exact: true })
      .check({ force: true });
  }
  if (pick.reason) await page.getByTestId("pulse-reason").fill(pick.reason);
  if (pick.group)
    await page
      .getByTestId("pulse-group-select")
      .selectOption({ label: pick.group });
  // A ballot younger than 0.7 s is refused as not-a-person; Playwright is faster.
  await page.waitForTimeout(800);
  await page.getByTestId("pulse-vote").click();
  await expect(page.getByTestId("pulse-voted")).toBeVisible();
}

async function friend(
  browser: Browser,
  url: string,
  pick: Parameters<typeof answer>[1],
) {
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await page.goto(url);
  await answer(page, pick);
  await page.close();
}

test.afterAll(async () => {
  for (const c of contexts) await c.close().catch(() => undefined);
});

test("Labs opens on 'What do you want to know?' with three ways in and five experiences", async ({
  browser,
}) => {
  const page = await (await phone(browser)).newPage();
  await page.goto("/labs/pulse");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What do you want to know?",
  );
  await expect(page.getByTestId("pulse-create-cta")).toContainText(
    "Ask everyone",
  );
  await expect(page.getByTestId("labs-ask-friends")).toContainText(
    "Ask your friends",
  );
  await expect(page.getByTestId("labs-compare")).toContainText(
    "Compare answers",
  );
  for (const kind of ["pulse", "decide", "settle", "normal", "rank"])
    await expect(page.getByTestId(`labs-exp-${kind}`)).toBeVisible();
  await expect(page.getByTestId("labs-template-which-to-buy")).toBeVisible();
  await expect(page.getByTestId("pulse-footer")).toHaveText("Powered by ELK");
  await noSidewaysScroll(page);
  await shot(page, "qi-01-labs-home");
});

let decideUrl = "";
const DECISION = `Should I quit my job and start a bakery? (${RUN})`;

test("Should I Do It?: ask your friends privately, collect reasons, see advice", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const host = await (await phone(browser)).newPage();
  await host.goto("/labs/pulse");
  await host.getByTestId("labs-ask-friends").click();
  await expect(host.getByTestId("pulse-create-title")).toHaveText(
    "Should I Do It?",
  );
  await expect(host.getByTestId("pulse-decide-answers")).toContainText(
    "Not yet",
  );
  await expect(host.getByTestId("pulse-unlisted")).toBeChecked();
  await shot(host, "qi-02-decide-create");
  const started = await create(host, "What are you deciding?", DECISION);
  const link = await submit(host, started);
  decideUrl = link.split("?")[0]!;
  await expect(host.getByTestId("pulse-kind")).toHaveText("Should I Do It?");
  await noSidewaysScroll(host);

  await answer(host, {
    option: "Not yet",
    reason: "Save six months of rent first",
  });
  await expect(host.getByTestId("pulse-reasons-hidden")).toBeVisible();

  const said: [string, string][] = [
    ["Yes", "Life is short and your bread is amazing"],
    ["Yes", "Life is short, do it"],
    ["No", "Bakeries run on tiny margins"],
    ["Not yet", "Try a market stall first"],
  ];
  for (const [option, reason] of said)
    await friend(browser, link, { option, reason });

  await host.reload();
  const reasons = host.getByTestId("pulse-reasons");
  await expect(reasons).toContainText("Bakeries run on tiny margins");
  await expect(host.getByTestId("pulse-reasons-o1")).toContainText(
    "Life is short, do it",
  );
  await expect(
    host.getByTestId("pulse-common-word").filter({ hasText: "life" }),
  ).toBeVisible();
  await expect(host.getByTestId("pulse-circle-advice")).toContainText(
    "Try a market stall first",
  );
  await noSidewaysScroll(host);
  await shot(host, "qi-03-decide-results");
});

test("a private decision never appears on the public shelves", async ({
  browser,
}) => {
  const page = await (await phone(browser)).newPage();
  await page.goto("/labs/pulse");
  await expect(page.getByText(DECISION)).toHaveCount(0);
  // …but the link works for anyone who has it.
  await page.goto(decideUrl);
  await expect(page.getByTestId("pulse-question")).toHaveText(DECISION);
});

test("Settle This: two sides, five votes, a verdict", async ({ browser }) => {
  test.setTimeout(120_000);
  const host = await (await phone(browser)).newPage();
  await host.goto("/labs/pulse/new?kind=settle");
  await expect(host.getByTestId("pulse-create-title")).toHaveText(
    "Settle This",
  );
  const started = await create(
    host,
    "What's the argument?",
    `Does pineapple belong on pizza? (${RUN})`,
  );
  await host.getByLabel("Side 1", { exact: true }).fill("Yes, it does");
  await host.getByLabel("Side 2", { exact: true }).fill("No, never");
  const link = await submit(host, started);
  await answer(host, { option: "Yes, it does" });
  await expect(host.getByTestId("pulse-verdict")).toHaveAttribute(
    "data-status",
    "early",
  );
  for (const option of [
    "Yes, it does",
    "Yes, it does",
    "Yes, it does",
    "No, never",
  ])
    await friend(browser, link, { option });
  await host.reload();
  await expect(host.getByTestId("pulse-verdict")).toHaveAttribute(
    "data-status",
    "settled",
  );
  await expect(host.getByTestId("pulse-verdict")).toContainText(
    "Yes, it does wins",
  );
  await noSidewaysScroll(host);
  await shot(host, "qi-04-settle-results");
});

test("Is This Normal?: anonymous ranges, nothing shown under five, then where you sit", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const host = await (await phone(browser)).newPage();
  await host.goto("/labs/pulse");
  await host.getByTestId("labs-compare").click();
  await expect(host.getByTestId("pulse-create-title")).toHaveText(
    "Is This Normal?",
  );
  const started = Date.now();
  await expect(host.getByTestId("pulse-topic-groceries")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const q = host.getByLabel("What do you want to compare?", { exact: true });
  await expect(q).toHaveValue(
    "What does your household spend on groceries a month?",
  );
  await q.fill(`What does your household spend on groceries a month? (${RUN})`);
  await shot(host, "qi-05-normal-create");
  const link = await submit(host, started);
  await answer(host, { option: "$700–$999", group: "2" });
  await expect(host.getByTestId("pulse-normal-hidden")).toBeVisible();
  await expect(host.getByTestId("pulse-normal-note")).toContainText(
    "not a representative sample",
  );

  for (const [option, group] of [
    ["$400–$699", "1"],
    ["$400–$699", "2"],
    ["$1,000–$1,399", "3–4"],
  ])
    await friend(browser, link, { option, group });
  await host.reload();
  await expect(host.getByTestId("pulse-normal-hidden")).toContainText(
    "4 answers so far",
  );
  await friend(browser, link, { option: "$1,400+", group: "5+" });
  await host.reload();
  await expect(host.getByTestId("pulse-distribution")).toBeVisible();
  await expect(host.getByTestId("pulse-normal-you")).toHaveText(
    "40% picked a lower range, 20% the same as you, 40% higher.",
  );
  await expect(host.getByTestId("pulse-normal")).toContainText(
    "No group has 5 answers yet.",
  );
  await noSidewaysScroll(host);
  await shot(host, "qi-06-normal-results");
});

let rankUrl = "";
test("Rank These: tap to rank, the group's order by points, a shareable card", async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const host = await (await phone(browser)).newPage();
  await host.goto("/labs/pulse/new?kind=rank");
  const started = await create(
    host,
    "What are people ranking?",
    `Rank these for movie night (${RUN})`,
  );
  for (const [i, item] of ["Dune", "Up", "Heat"].entries())
    await host.getByLabel(`Item ${i + 1}`, { exact: true }).fill(item);
  const link = await submit(host, started);
  rankUrl = link.split("?")[0]!;
  await host.getByRole("button", { name: "Up", exact: true }).click();
  await shot(host, "qi-07-rank-ballot");
  await host.getByRole("button", { name: "Take Up out" }).click();
  await answer(host, { ranking: ["Up", "Dune", "Heat"] });
  await friend(browser, link, { ranking: ["Up", "Heat", "Dune"] });
  await friend(browser, link, { ranking: ["Dune", "Up", "Heat"] });
  await host.reload();
  const items = host
    .getByTestId("pulse-ranking-everyone")
    .getByTestId("pulse-ranking-item");
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText("Up");
  await expect(items.first()).toContainText("67% put it first");
  await noSidewaysScroll(host);
  await shot(host, "qi-08-rank-results");

  const card = await request.get(
    `${rankUrl.replace(/^https?:\/\/[^/]+/, "")}/card`,
  );
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/png");
  if (SHOTS)
    fs.writeFileSync(
      path.join(SHOTS, "qi-09-rank-card.png"),
      await card.body(),
    );
});

test("templates start the one form with a head start", async ({ browser }) => {
  const page = await (await phone(browser)).newPage();
  await page.goto("/labs/pulse/new?t=change-my-mind");
  await expect(page.getByTestId("pulse-create-title")).toHaveText(
    "Change My Mind",
  );
  await expect(page.getByLabel("Your question", { exact: true })).toHaveValue(
    "Change my mind: ",
  );
  await expect(page.getByLabel("Answer 1", { exact: true })).toHaveValue(
    "Agree",
  );
  await expect(page.getByTestId("pulse-reasons-toggle")).toBeChecked();
  await page.goto("/labs/pulse/new?t=overpaying");
  await expect(page.getByTestId("pulse-topic-phone")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("pulse-topic-pay")).toHaveCount(0);
  await noSidewaysScroll(page);
  await shot(page, "qi-10-template-overpaying");
});
