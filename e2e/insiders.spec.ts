import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * **The Local Insider Network, end to end** (ADR 018): the brief's seven
 * acceptance steps as one story, on the memory store.
 *
 * Run against a fresh server started with `INSIDERS_STORE=memory`,
 * `INSIDERS_TEST_IDENTITY=on`, `ADMIN_EMAILS=admin@insiders.test`,
 * `ADMIN_TOKEN=<anything>` and `ATLAS_API_URL` pointing at
 * `e2e/support/atlas-standin.mjs` (whose port is `E2E_ATLAS_STANDIN`). The
 * test identity is a cookie the server honours only on the memory store.
 * Skipped where the server isn't set up that way.
 */

const STANDIN = process.env.E2E_ATLAS_STANDIN;
const RUN = Math.random().toString(36).slice(2, 6);
const TITLE = `Kal Roller Disco ${RUN}`;
const ORGANIZER_URL = `https://rollers-${RUN}.example.ca/disco`;
const SAID = `${TITLE} — roller skating night at the Vernon Rec Centre, hosted by Vernon Roller Collective. December 12. Info: ${ORGANIZER_URL}`;

test.describe.configure({ mode: "serial" });

async function as(context: BrowserContext, email: string, baseURL: string) {
  await context.addCookies([
    { name: "insiders-as", value: encodeURIComponent(email), url: baseURL },
  ]);
}

test.beforeAll(async ({ request }) => {
  const r = await request.get("/ambassadors");
  test.skip(r.status() !== 200, "insiders not served");
});

test("1–2. a visitor shares a local event and Passport structures it", async ({
  page,
}) => {
  await page.goto("/local");
  await page.getByTestId("share-something").first().click();
  await expect(page).toHaveURL(/\/local\/share$/);
  const started = Date.now();
  await page.getByTestId("share-text").fill(SAID);
  await page.getByTestId("share-read").click();
  await expect(page.getByTestId("share-fields")).toBeVisible();
  await expect(page.getByTestId("f-title")).toHaveValue(TITLE);
  await expect(page.getByTestId("f-kind")).toHaveValue("event");
  await expect(page.getByTestId("f-town")).toHaveValue("Vernon");
  await expect(page.getByTestId("f-organizer")).toHaveValue(
    "Vernon Roller Collective",
  );
  await expect(page.getByTestId("f-organizerUrl")).toHaveValue(ORGANIZER_URL);
  await expect(page.getByTestId("f-interests")).toHaveValue("roller skating");
  await expect(page.getByTestId("f-starts")).toHaveValue(/^\d{4}-12-12$/);
  await page.getByTestId("f-provenance").fill("Poster at the rec centre");
  await page.getByTestId("share-send").click();
  await expect(page.getByTestId("share-done")).toContainText("Got it");
  // "Possible in under 60 seconds" — with the typing done by a machine, the
  // rest of the path must be far inside it.
  expect(Date.now() - started).toBeLessThan(60_000);

  // Not public until someone checks it.
  await page.goto("/local");
  await expect(page.getByText(TITLE)).toHaveCount(0);
});

test("3–4. an administrator checks the date, publishes, and Atlas is handed the organizer's page", async ({
  page,
  context,
  baseURL,
}) => {
  await as(context, "admin@insiders.test", baseURL!);
  await page.goto("/ambassadors");
  const row = page
    .getByTestId("review-queue")
    .locator(`[data-testid^="row-kal-roller-disco-${RUN}"]`)
    .filter({ hasText: TITLE });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("row-blockers")).toContainText(
    "Check the date against a source",
  );
  await expect(row.getByTestId("row-publish")).toBeDisabled();

  await row.getByTestId("row-edit").click();
  await row.getByTestId("e-dateSource").fill(ORGANIZER_URL);
  await row.getByTestId("e-dateChecked").check();
  await row.getByTestId("e-save").click();
  await expect(row.getByTestId("row-blockers")).toHaveCount(0);
  await row.getByTestId("row-publish").click();
  await expect(row).toHaveCount(0); // it left the queue

  await page.reload();
  const published = page
    .locator(`[data-testid^="row-kal-roller-disco-${RUN}"]`)
    .filter({
      hasText: TITLE,
    });
  await expect(published.getByTestId("row-status")).toHaveText(
    "Live on Go Have a Day",
  );
  if (STANDIN) {
    await expect(published).toContainText("Atlas: queued");
    const queued = await (
      await page.request.get(`${STANDIN}/admin/candidate-sources`, {
        headers: { "x-admin-token": "e2e" },
      })
    ).json();
    const mine = queued.candidates.find(
      (c: { url: string }) => c.url === ORGANIZER_URL,
    );
    expect(mine).toMatchObject({
      sourceType: "community-listing",
      discoveryBasis: "first-party-url",
    });
    expect(mine.reason).toContain(TITLE);
  }
  // The lead-time metric counts it.
  await expect(page.getByTestId("lead-times")).toContainText(TITLE);
});

test("5–7. it appears on Go Have a Day, by interest, linking to the organizer", async ({
  page,
}) => {
  await page.goto("/local?interest=roller%20skating");
  const card = page.locator(`[data-testid^="insider-kal-roller-disco-${RUN}"]`);
  await expect(card).toBeVisible();
  await expect(card.getByTestId("insider-when")).toContainText("December 12");
  await expect(card.getByTestId("insider-out")).toHaveAttribute(
    "href",
    ORGANIZER_URL,
  );
  await expect(page.getByTestId("insider-squealing-pig")).toHaveCount(0);

  // Discovery, someone saying what they're into.
  await page.goto("/discovery?ask=roller%20skating");
  const locals = page.getByTestId("local-insiders");
  await expect(locals).toBeVisible({ timeout: 30_000 });
  await expect(
    locals.locator(`[data-testid^="insider-kal-roller-disco-${RUN}"]`),
  ).toBeVisible();
  await expect(locals.getByTestId("share-something")).toBeVisible();

  // And dirt biking finds the Pigs — as past races, never as upcoming.
  await page.goto("/discovery?ask=dirt%20biking");
  const pig = page
    .getByTestId("local-insiders")
    .getByTestId("insider-squealing-pig");
  await expect(pig).toBeVisible({ timeout: 30_000 });
  await expect(pig.getByTestId("insider-when")).toContainText(
    "next date not announced yet",
  );
});

test("moderation: anyone can report or claim; it reaches the reviewer and changes nothing", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/local/vernon-jazz-jam");
  const before = await page.getByTestId("insider-when").textContent();
  await page.getByTestId("flag-report").click();
  await page.getByTestId("flag-text").fill(`Moved to Thursdays ${RUN}`);
  await page.getByTestId("flag-send").click();
  await expect(page.getByTestId("flag-sent")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("insider-when")).toHaveText(before!);

  const admin = await browser.newContext();
  await as(admin, "admin@insiders.test", baseURL!);
  const review = await admin.newPage();
  await review.goto("/ambassadors");
  await expect(
    review.getByTestId("row-vernon-jazz-jam").getByTestId("row-flags"),
  ).toContainText(`Moved to Thursdays ${RUN}`);
  await admin.close();
});

test("ambassadors: invited, sharing as themselves, following their own; nobody else gets in", async ({
  browser,
  baseURL,
  request,
}) => {
  const email = `jess-${RUN}@insiders.test`;
  const admin = await browser.newContext();
  await as(admin, "admin@insiders.test", baseURL!);
  const a = await admin.newPage();
  await a.goto("/ambassadors");
  await a.getByTestId("invite-email").fill(email);
  await a.getByTestId("invite-name").fill("Jess");
  await a.getByTestId("invite-send").click();
  await expect(a.getByTestId("ambassadors-admin")).toContainText(email);
  await admin.close();

  const jess = await browser.newContext();
  await as(jess, email, baseURL!);
  const j = await jess.newPage();
  await j.goto("/local/share");
  await expect(j.getByTestId("share-as")).toContainText("Jess");
  await j
    .getByTestId("share-text")
    .fill(
      `Okanagan Ukulele Circle ${RUN} — ukulele song circle, Mondays 7-9pm in Armstrong. https://uke-${RUN}.example.ca`,
    );
  await j.getByTestId("share-read").click();
  await expect(j.getByTestId("f-town")).toHaveValue("Armstrong");
  await j.getByTestId("share-send").click();
  await expect(j.getByTestId("share-done")).toBeVisible();
  await j.goto("/ambassadors");
  const mine = j.getByTestId("my-contributions");
  await expect(mine).toContainText(`Okanagan Ukulele Circle ${RUN}`);
  await expect(mine.getByTestId("row-status").first()).toHaveText(
    "Waiting for review",
  );
  // An untrusted ambassador has no review queue and no admin tools.
  await expect(j.getByTestId("review-queue")).toHaveCount(0);
  await expect(j.getByTestId("ambassadors-admin")).toHaveCount(0);
  await jess.close();

  // A stranger who is signed in is not an ambassador.
  const other = await browser.newContext();
  await as(other, `someone-${RUN}@insiders.test`, baseURL!);
  const o = await other.newPage();
  await o.goto("/ambassadors");
  await expect(o.getByTestId("not-ambassador")).toBeVisible();
  await other.close();

  // Signed out: a sign-in button, and the actions refuse.
  const r = await request.post("/api/insiders/listings/night-pig", {
    data: { action: "decide", decision: "withdraw" },
  });
  expect(r.status()).toBe(401);
  const invite = await request.post("/api/insiders/ambassadors", {
    data: { action: "invite", email: "x@y.ca", name: "X" },
  });
  expect(invite.status()).toBe(401);
});
