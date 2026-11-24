import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * **My Christmas List is one place** (owner brief, mission 1060).
 *
 *   Discover an event → Save → My Christmas List → Build a day → Save as an
 *   adventure → open it — on a phone and on a desktop — and the earlier
 *   adventures: listed, open, doable again from today, nobody else's.
 *
 * Real GoTrue + RLS (stack.mjs). Past adventures are made through the app's
 * own start route and then moved to last season with SQL, because the app
 * refuses to start one in the past. Atlas is the stand-in on 2026-11-14's
 * corpus.
 *
 *   E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification christmas-list
 */

const SHOTS = path.resolve(__dirname, "../screenshots");
const PASSWORD = "jingle-all-the-way-9";
const CANYON = "cbabfb38-71fc-4043-af55-a8e16456caed";
const GONE = "11111111-2222-4333-8444-555555555555";
const stamp = Date.now().toString(36);

async function shot(page: Page, name: string) {
  if (process.env.SHOTS === "1")
    await page.screenshot({
      path: path.join(SHOTS, `${name}.png`),
      fullPage: true,
    });
}

async function signUp(page: Page, who: string) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`${who}-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

/** An adventure made by the app, then moved to last year. */
async function pastAdventure(page: Page, title: string, refs: string[]) {
  const made = await page.request.post("/christmas/api/start", {
    data: {
      title,
      shape: "evening",
      startsOn: "2026-12-20",
      townId: "north-vancouver",
      atlasRefs: refs,
      sketch: false,
    },
  });
  expect(made.status()).toBe(201);
  const { id } = (await made.json()) as { id: string };
  const sql = postgres(process.env.ADVENTURES_STACK_PG!);
  await sql`update passport_adventures set starts_on = '2025-12-20', ends_on = null where id = ${id}`;
  await sql.end();
  return id;
}

for (const [name, viewport, mobile] of [
  ["phone", { width: 390, height: 844 }, true],
  ["desktop", { width: 1280, height: 900 }, false],
] as const) {
  test(`${name}: discover → save → list → build a day → adventure → open; earlier adventures`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();

    // Signed out, the list is honest and offers a way on.
    await page.goto("/christmas/list");
    await expect(page.getByTestId("list-empty")).toContainText("Sign in");
    await signUp(page, `${name}-alice`);

    // ---------------------------------------------------- discover → save
    await page.goto("/christmas/discover?at=north-vancouver&theme=lights");
    const canyon = page.locator(`[data-find="${CANYON}"]`);
    await expect(canyon).toContainText("Canyon Lights");
    await canyon.getByTestId("save-find").click();
    await expect(canyon.getByTestId("save-find")).toContainText("Saved");

    // ---------------------------------------------------------- the list
    await page.goto("/christmas/list");
    const item = page.locator(
      `[data-testid="list-saved-item"][data-find="${CANYON}"]`,
    );
    await expect(item).toContainText("Canyon Lights");
    await expect(page.getByTestId("list-count")).toContainText(
      "1 thing on your list",
    );
    // Added on this device AND saved: one entry, not two.
    await page.goto("/christmas/discover?at=north-vancouver&theme=lights");
    await page
      .locator(`[data-find="${CANYON}"]`)
      .getByTestId("pick-find")
      .click();
    await page.goto("/christmas/list");
    await expect(page.getByTestId("list-count")).toContainText(
      "1 thing on your list",
    );
    await expect(page.getByTestId("list-saved-item")).toHaveCount(1);
    // Nothing yet planned: the section offers a next action, not a dead end.
    await expect(page.getByTestId("plans-empty")).toContainText(
      "No Christmas plans yet",
    );
    await expect(page.getByTestId("plans-plan")).toBeVisible();
    await shot(page, `list-01-saved-${name}`);

    // -------------------------------------------- earlier adventures exist
    const oldId = await pastAdventure(page, "Last year's lights night", [
      CANYON,
      GONE,
    ]);
    const twin = await pastAdventure(page, "Last year's market day", []);
    await page.reload();
    const past = page.getByTestId("past-adventures");
    await expect(past).toContainText("Past adventures (2)");
    await expect(past).toHaveJSProperty("open", true);
    // An old link opens the real page (no redirect through /adventures).
    const row = past.getByTestId("my-adventure").first();
    await expect(row).toHaveAttribute("href", /^\/christmas\/adventure\//);
    await page.goto(`/christmas/adventure/${oldId}`);
    await expect(
      page.getByRole("heading", { name: "Last year's lights night" }),
    ).toBeVisible();
    await expect(page.locator("#plan")).toContainText("Canyon Lights");
    // …and the old /adventures link still lands on it.
    await page.goto(`/adventures/${oldId}`);
    await expect(page).toHaveURL(new RegExp(`/christmas/adventure/${oldId}`));
    await expect(
      page.getByRole("heading", { name: "Last year's lights night" }),
    ).toBeVisible();

    // ----------------------------------------------------- do this again
    await page.goto("/christmas/list");
    await page
      .getByTestId("past-adventures")
      .locator("li", { hasText: "Last year's lights night" })
      .getByTestId("do-again")
      .click();
    await expect(page).toHaveURL(/\/christmas\/plan\?again=/);
    const note = page.getByTestId("again-note");
    await expect(note).toContainText("Last year's lights night");
    await expect(note.getByTestId("again-kept")).toContainText("Canyon Lights");
    await expect(note.getByTestId("again-left")).toContainText(
      "no longer lists",
    );
    await shot(page, `list-02-again-${name}`);
    await page.getByTestId("plan-town").selectOption("north-vancouver");
    await page.getByTestId("plan-date").fill("2026-12-12");
    await page.getByTestId("plan-start").click();
    await page.waitForURL(/\/christmas\/adventure\//, { timeout: 90_000 });
    const againId = page.url().split("/").at(-1)!.split("?")[0]!;
    expect(againId).not.toBe(oldId);
    await expect(page.locator("#plan")).toContainText("Canyon Lights");
    await expect(page.locator("#plan")).not.toContainText("can't name");

    // ------------------------------------------------------ build a day
    await page.goto("/christmas/list");
    await expect(page.getByTestId("my-adventures")).toContainText(
      "Last year's lights night — again",
    );
    await page.getByTestId("plans-build").click();
    await expect(page).toHaveURL(/\/go\?/);
    await expect(page.getByTestId("go-day")).toBeVisible({ timeout: 90_000 });
    await page.getByTestId("go-adventure-date").fill("2026-12-13");
    await page.getByTestId("go-adventure-title").fill("Our Christmas Saturday");
    await page.getByTestId("go-save-new-adventure").click();
    await page.waitForURL(/\/christmas\/adventure\//, { timeout: 90_000 });
    await expect(
      page.getByRole("heading", { name: "Our Christmas Saturday" }),
    ).toBeVisible();
    const builtId = page.url().split("/").at(-1)!.split("?")[0]!;

    // And it is on My Christmas plans, and opens.
    await page.goto("/christmas/list");
    const mine = page.getByTestId("my-adventures");
    await expect(mine).toContainText("Our Christmas Saturday");
    await expect(mine).toContainText("Last year's lights night — again");
    // Nothing lost, nothing duplicated: 2 old + 1 again + 1 built = 4 in total.
    await expect(mine.getByTestId("my-adventure")).toHaveCount(4);
    await shot(page, `list-03-plans-${name}`);
    await mine.getByText("Our Christmas Saturday").click();
    await expect(page).toHaveURL(new RegExp(`/christmas/adventure/${builtId}`));
    await expect(
      page.getByRole("heading", { name: "Our Christmas Saturday" }),
    ).toBeVisible();

    // ----------------------------------------------------------- privacy
    const other = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const b = await other.newPage();
    await signUp(b, `${name}-bob`);
    await b.goto("/christmas/list");
    await expect(b.getByTestId("list-empty")).toBeVisible();
    await expect(b.getByTestId("my-adventure")).toHaveCount(0);
    await expect(b.getByTestId("list-saved-item")).toHaveCount(0);
    for (const id of [oldId, twin, againId, builtId]) {
      await b.goto(`/christmas/adventure/${id}`);
      await expect(b.getByText("Not found")).toBeVisible();
    }
    await b.goto(`/christmas/plan?again=${oldId}`);
    await expect(b.getByTestId("again-note")).toHaveCount(0);
    await other.close();
    await context.close();
  });
}
