import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **The whole Date Night, on phones, against a real stack.**
 *
 * Lorne has a Passport account; the operator runs the one setup line; Jess
 * opens the link with no account and answers; Lorne reads it; a stranger
 * and a signed-out visitor cannot.
 */

const STACK =
  process.env.STACK ?? `${process.env.HOME}/passport/scratch/date-night-stack`;
const SHOTS = process.env.SHOTS_DIR ?? path.resolve(__dirname, "screenshots");
const PASSWORD = "first-date-forever-7";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-dn-${stamp}@example.test`;
const KALAMALKA = "Kalamalka Lake Park";

async function shot(page: Page, name: string, fullPage = false) {
  if (process.env.SHOTS !== "1") return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

function env(): Record<string, string> {
  return Object.fromEntries(
    fs
      .readFileSync(path.join(STACK, "env"), "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

async function operator(sql: string, args: unknown[]) {
  const pg = createRequire(path.join(STACK, "node_modules/"))("pg");
  const db = new pg.Client(env().ADVENTURES_STACK_PG);
  await db.connect();
  try {
    return (await db.query(sql, args)).rows;
  } finally {
    await db.end();
  }
}

async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
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

test("Jess answers without an account; only Lorne can read it", async ({
  browser,
}) => {
  // Lorne signs up from the private page's own sign-in link.
  const lorne = await phone(browser);
  await lorne.goto("/lorne-and-jess/answers");
  await expect(lorne.getByTestId("signed-out")).toBeVisible();
  await lorne.getByRole("link", { name: "Sign in" }).click();
  await signUp(lorne, "lorne");
  await lorne.goto("/lorne-and-jess/answers");
  // Not set up yet: Postgres does not admit he owns anything.
  await expect(lorne.getByTestId("not-yours")).toBeVisible();

  // The operator's one line in the SQL editor.
  await operator(
    `select public.passport_date_night_setup($1, $2, 'Lorne ❤️ Jess', '2026-11-02', 'America/Vancouver', 'Around Vernon')`,
    ["lorne-and-jess", emailFor("lorne")],
  );
  await lorne.reload();
  await expect(lorne.getByTestId("no-answers")).toBeVisible();

  // Jess: a phone, no account.
  const jess = await phone(browser);
  await jess.goto("/lorne-and-jess");
  await expect(
    jess.getByRole("heading", { level: 1, name: "Lorne ❤️ Jess" }),
  ).toBeVisible();
  await expect(
    jess.getByText("Tomorrow, November 2, we're going on an adventure."),
  ).toBeVisible();
  await expect(jess.getByTestId("conditions")).toContainText("Sunset");
  await noSideways(jess);
  await shot(jess, "01-invitation");

  const plunge = jess.getByTestId("idea-cold-plunge");
  await expect(plunge).toContainText("Passport doesn't know King Eddie yet");
  await plunge.getByText(/Check first/).click();
  await expect(plunge).toContainText("never alone");
  await plunge.getByRole("button", { name: "Yes please" }).click();
  await expect(plunge).toHaveAttribute("data-pick", "yes");
  await jess
    .getByTestId("idea-sunset")
    .getByRole("button", { name: "Maybe" })
    .click();
  await jess
    .getByTestId("idea-bird-hunting")
    .getByRole("button", { name: "Not this time" })
    .click();
  await expect(jess.getByTestId("idea-viewpoint")).toContainText(
    "Ideas from Atlas",
  );
  await shot(jess, "02-ideas", true);

  await jess.getByLabel("Add an idea").fill("Hot springs, then pie");
  await jess
    .getByTestId("own-ideas")
    .getByRole("button", { name: "Add" })
    .click();
  await expect(jess.getByTestId("own-ideas")).toContainText(
    "Hot springs, then pie",
  );

  await jess.getByRole("button", { name: new RegExp(KALAMALKA) }).click();
  await jess.getByLabel("Add a place").fill("The lake with the old dock");
  await jess.getByTestId("places").getByRole("button", { name: "Add" }).click();

  await jess.getByRole("radio", { name: /Bring it/ }).click();
  await jess.getByRole("button", { name: "Hot chocolate" }).click();
  await jess.getByRole("button", { name: "Smokies on the fire" }).click();
  await jess
    .getByPlaceholder("A craving, a place, a no-go")
    .fill("No mushrooms please");
  await jess
    .getByPlaceholder("Say anything…")
    .fill("Can't wait. Bring the big thermos ❤️");
  await noSideways(jess);
  await shot(jess, "03-filled", true);

  await jess.getByRole("button", { name: "Send to Lorne ❤️" }).click();
  await expect(jess.getByTestId("sent")).toBeVisible();
  await shot(jess, "04-sent");
  // A reload remembers she sent it.
  await jess.reload();
  await expect(jess.getByRole("button", { name: "Sent ✓" })).toBeVisible();

  // A stranger with an account, and nobody at all, see nothing of it.
  const mallory = await phone(browser);
  await mallory.goto("/auth?next=/lorne-and-jess/answers");
  await signUp(mallory, "mallory");
  await mallory.goto("/lorne-and-jess/answers");
  await expect(mallory.getByTestId("not-yours")).toBeVisible();
  await expect(mallory.locator("body")).not.toContainText("thermos");
  const nobody = await phone(browser);
  await nobody.goto("/lorne-and-jess/answers");
  await expect(nobody.getByTestId("signed-out")).toBeVisible();
  await expect(nobody.locator("body")).not.toContainText("thermos");
  // Not through the API either: there is no read endpoint, and GET is refused.
  const get = await nobody.request.get("/api/date-night/lorne-and-jess");
  expect(get.status()).toBe(405);

  // Lorne reads every part of it.
  await lorne.reload();
  const answer = lorne.getByTestId("answer").first();
  await expect(answer).toContainText("Can't wait. Bring the big thermos ❤️");
  await expect(answer).toContainText("Cold plunge at King Eddie");
  await expect(answer).toContainText("Sunset adventure");
  await expect(answer).toContainText("Hot springs, then pie");
  await expect(answer).toContainText(KALAMALKA);
  await expect(answer).toContainText("The lake with the old dock");
  await expect(answer).toContainText("Bring it");
  await expect(answer).toContainText("Hot chocolate");
  await expect(answer).toContainText("No mushrooms please");
  await noSideways(lorne);
  await shot(lorne, "05-lorne-reads", true);
});

test("before the database step, nothing is lost", async ({ browser }) => {
  const jess = await phone(browser);
  await jess.route("**/api/date-night/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"not ready","off":true}',
    }),
  );
  await jess.goto("/lorne-and-jess");
  await jess
    .getByTestId("idea-sunset")
    .getByRole("button", { name: "Yes please" })
    .click();
  await jess.getByPlaceholder("Say anything…").fill("Kept safe");
  await jess.getByRole("button", { name: "Send to Lorne ❤️" }).click();
  await expect(jess.getByText(/it's all kept on this phone/)).toBeVisible();
  await jess.reload();
  await expect(jess.getByPlaceholder("Say anything…")).toHaveValue("Kept safe");
  await expect(jess.getByTestId("idea-sunset")).toHaveAttribute(
    "data-pick",
    "yes",
  );
});
