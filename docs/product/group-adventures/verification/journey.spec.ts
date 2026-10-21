import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";

/**
 * **Saved → Adventure → a planned, shared day — the whole journey.**
 *
 *   Alice (desktop) saves three things in Discovery → Saved → Plan with
 *   these → a new adventure → Plan it with Go Have a Day → refines the day
 *   in words → Save to the adventure → back on the adventure the day has
 *   its stops in order, travel between them and a print link → she moves a
 *   stop → invites Bob.
 *   Bob (phone) opens the link → signs up → joins → sees the same day →
 *   answers "I'm in" → can't reorder.
 *   A visitor opens the printed day — the shareable page — with no account.
 *   Charlie can't see the adventure.
 *   Alice signs in again, fresh: Saved lists the adventure, and the day is
 *   still there with the sentence it was built from.
 *
 * Real browsers, real `/auth` sign-up against a real GoTrue, every
 * permission Postgres's (stack.mjs). Atlas is `atlas-standin.mjs`: a saved
 * production candidates body, boards in memory, `/travel/legs` not served.
 *
 *   E2E_PORT=3120 npx playwright test -c docs/product/group-adventures/verification journey
 */

const PASSWORD = "a-whole-weekend-9";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-journey-${stamp}@example.test`;

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function signIn(page: Page, who: string) {
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

async function person(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  return { context, page: await context.newPage() };
}

/** A few days ahead in Vancouver: a real date for a day out. */
const DAY = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", {
  timeZone: "America/Vancouver",
});

test.describe.configure({ mode: "serial" });

test("Saved becomes a planned, shared adventure — and is still there later", async ({
  browser,
}) => {
  test.setTimeout(420_000);

  // ---------------------------------------------------- Alice discovers
  const alice = await person(browser);
  await alice.page.goto("/auth?next=/discovery");
  await signUp(alice.page, "alice");
  await expect(alice.page).toHaveURL(/^https?:\/\/[^/]+\/discovery/);

  const save = alice.page.getByRole("button", { name: "Save", exact: true });
  await expect(save.first()).toBeVisible({ timeout: 30_000 });
  const saved: string[] = [];
  for (let i = 0; i < 3; i++) {
    const button = save.first();
    const card = button.locator("xpath=ancestor::*[.//h3][1]");
    saved.push(((await card.locator("h3").first().textContent()) ?? "").trim());
    const before = await save.count();
    await button.click();
    // Saved: the card's button becomes "Saved", so there is one fewer.
    await expect(save).toHaveCount(before - 1, { timeout: 15_000 });
  }

  // ------------------------------------------------------- Saved → plan
  await alice.page.goto("/saved");
  await expect(alice.page.getByTestId("saved-review")).toContainText(
    "3 possibilities",
  );
  await alice.page.getByTestId("saved-plan").click();
  const choose = alice.page.getByTestId("saved-choose");
  await expect(choose).toHaveCount(3);
  for (let i = 0; i < 3; i++) await choose.nth(i).click();
  await expect(alice.page.getByTestId("chosen-count")).toContainText(
    "3 chosen",
  );
  await expect(alice.page.getByTestId("saved-make-day")).toHaveAttribute(
    "href",
    /^\/go\?with=/,
  );
  await alice.page.getByTestId("saved-to-adventure").click();
  await alice.page.getByLabel("A new adventure").check();
  await alice.page.getByLabel("Name it").fill("Vernon Saturday");
  await alice.page.getByLabel("Which day (optional)").fill(DAY);
  await alice.page
    .getByLabel("Starting from (optional)")
    .selectOption("vernon");
  await alice.page.getByTestId("saved-add-adventure").click();

  await expect(alice.page).toHaveURL(/\/adventures\/[0-9a-f]{32}$/);
  const adventureUrl = alice.page.url();
  await expect(
    alice.page.getByRole("heading", { name: "Vernon Saturday" }),
  ).toBeVisible();
  // Three ideas, nothing on the day yet.
  await expect(
    alice.page.getByRole("list", { name: "Ideas" }).getByTestId("plan-item"),
  ).toHaveCount(3);
  await alice.page.screenshot({
    path: "/home/lorne-markham/scratch/m-adv/shots/1-adventure-ideas.png",
    fullPage: true,
  });

  // ------------------------------------------- plan it with Go Have a Day
  await alice.page.getByTestId("plan-day").first().click();
  await expect(alice.page).toHaveURL(/\/go\?.*adventure=/);
  await expect(alice.page.getByTestId("go-day")).toBeVisible({
    timeout: 30_000,
  });
  const stops = alice.page.locator('[data-testid="go-stop"] h3');
  await expect(stops.first()).toBeVisible();

  // Refine it in words.
  await alice.page.getByTestId("go-change").fill("Keep us indoors");
  await alice.page.getByTestId("go-change-submit").click();
  await expect(alice.page.getByTestId("go-working-from")).toContainText(
    "Under cover",
  );
  const built = (await stops.allTextContents()).map((s) => s.trim());
  expect(built.length).toBeGreaterThan(0);

  await alice.page.getByTestId("go-save-adventure").click();
  await expect(alice.page.getByTestId("go-adventure-note")).toContainText(
    "Saved to Vernon Saturday",
  );
  await alice.page.screenshot({
    path: "/home/lorne-markham/scratch/m-adv/shots/2-go-saved.png",
    fullPage: true,
  });
  await alice.page
    .getByRole("link", { name: "Back to Vernon Saturday" })
    .click();

  // ------------------------------------- the day, back on the adventure
  await expect(alice.page).toHaveURL(adventureUrl);
  const day = alice.page.getByTestId("plan-day-section").first();
  await expect(day.getByTestId("plan-item")).toHaveCount(built.length);
  for (const [i, title] of built.entries()) {
    await expect(day.getByTestId("plan-item").nth(i)).toContainText(title);
  }
  await expect(day.getByTestId("day-ask")).toContainText("indoors");
  await expect(
    day.getByRole("link", { name: "Refine this day" }),
  ).toBeVisible();
  const print = day.getByTestId("print-day");
  await expect(print).toHaveAttribute("href", /^\/go\/print\?stops=/);
  if (built.length > 1) {
    // Travel between stops: never a made-up drive time.
    await expect(day.getByTestId("plan-leg").first()).toContainText(
      /straight line|by road|can't place/,
      { timeout: 15_000 },
    );
  }
  await alice.page.screenshot({
    path: "/home/lorne-markham/scratch/m-adv/shots/3-adventure-day.png",
    fullPage: true,
  });

  // Move the first stop later, by hand.
  if (built.length > 1) {
    await day.getByRole("button", { name: `Move ${built[0]} later` }).click();
    await expect(day.getByTestId("plan-item").nth(1)).toContainText(built[0]!);
    await expect(day.getByTestId("plan-item").nth(0)).toContainText(built[1]!);
  }
  const printHref = (await print.getAttribute("href"))!;

  // ------------------------------------------------------ invite Bob
  await alice.page.getByRole("button", { name: "Link for one person" }).click();
  const invite = (
    await alice.page.getByTestId("invite-url").first().textContent()
  )?.trim();
  expect(invite).toMatch(/\/adventures\/join\//);

  // ------------------------------------------------------- Bob, phone
  const bob = await person(browser, { ...devices["Pixel 7"] });
  await bob.page.goto(new URL(invite!).pathname);
  await expect(
    bob.page.getByRole("heading", { name: /You're invited/ }),
  ).toBeVisible();
  await expect(bob.page.getByText("Vernon Saturday")).toHaveCount(0);
  await bob.page.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(bob.page, "bob");
  await bob.page.getByRole("button", { name: /join/ }).click();
  await expect(
    bob.page.getByRole("heading", { name: "Vernon Saturday" }),
  ).toBeVisible();
  const bobsDay = bob.page.getByTestId("plan-day-section").first();
  await expect(bobsDay.getByTestId("plan-item")).toHaveCount(built.length);
  await expect(bobsDay.getByRole("button", { name: /^Move / })).toHaveCount(0);
  await bobsDay
    .getByTestId("plan-item")
    .first()
    .getByRole("button", { name: "I'm in" })
    .click();
  await expect(bobsDay.getByTestId("plan-item").first()).toContainText("1 in");
  await bob.page.screenshot({
    path: "/home/lorne-markham/scratch/m-adv/shots/4-bob-phone.png",
    fullPage: true,
  });

  // ------------------------------------- a visitor opens the shared day
  const visitor = await person(browser, { ...devices["iPhone 13"] });
  const printed = await visitor.page.goto(printHref);
  expect(printed?.status()).toBe(200);
  for (const title of built) {
    await expect(visitor.page.getByText(title).first()).toBeVisible();
  }
  await visitor.page.screenshot({
    path: "/home/lorne-markham/scratch/m-adv/shots/5-shared-print.png",
    fullPage: true,
  });

  // -------------------------------------------- Charlie stays outside
  const charlie = await person(browser);
  await charlie.page.goto("/auth?next=/adventures");
  await signUp(charlie.page, "charlie");
  await expect(charlie.page).toHaveURL(/^https?:\/\/[^/]+\/adventures$/);
  await charlie.page.goto(new URL(adventureUrl).pathname);
  await expect(charlie.page.getByText("Not found")).toBeVisible();
  await expect(charlie.page.getByText("Vernon Saturday")).toHaveCount(0);

  // ------------------------------------ Alice comes back another time
  await alice.context.close();
  const again = await person(browser);
  await again.page.goto("/auth?next=/saved");
  await signIn(again.page, "alice");
  await expect(again.page).toHaveURL(/^https?:\/\/[^/]+\/saved/);
  await again.page
    .getByTestId("saved-adventures")
    .getByRole("link", { name: /Vernon Saturday/ })
    .click();
  await expect(again.page).toHaveURL(adventureUrl);
  const later = again.page.getByTestId("plan-day-section").first();
  await expect(later.getByTestId("plan-item")).toHaveCount(built.length);
  await expect(later.getByTestId("day-ask")).toContainText("indoors");
  // Refine reopens Go Have a Day with the same sentence and the same stops.
  const refine = await later
    .getByRole("link", { name: "Refine this day" })
    .getAttribute("href");
  const reopened = new URL(refine!, "http://x").searchParams;
  expect(reopened.get("say")).toContain("indoors");
  expect(reopened.get("adventure")).toBe(adventureUrl.split("/").pop());

  for (const p of [bob, visitor, charlie, again]) await p.context.close();
});
