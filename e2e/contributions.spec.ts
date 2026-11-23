import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * **Universal community contributions** (owner brief 2026-11-23, mission
 * 1005), on a phone:
 *
 *   on Christmas, tap "+ Suggest a Stop" → name, kind, place → send → thanks,
 *   pending, milestones → "+ Suggest another" keeps the kind → the same
 *   button on Hockey Night captures `hockey` → twelve quick suggestions all
 *   go in (there is no daily cap) and the thirteenth is asked to pause for a
 *   minute → the administrator sees them all in one queue, edits, approves
 *   one (First Discovery), rejects one as a duplicate → the contributor's
 *   progress shows one approved → the public sees nothing.
 *
 * Needs the memory store and the test identity:
 *
 *   INSIDERS_STORE=memory INSIDERS_TEST_IDENTITY=on ADMIN_EMAILS=admin@insiders.test
 *
 * Skipped where the server isn't set up that way.
 */
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36);
const NAME = `Long John's Pub ${RUN}`;
const DEVICE = `e2e${RUN}deviceabc`;

async function as(context: BrowserContext, email: string, baseURL: string) {
  await context.addCookies([
    { name: "insiders-as", value: encodeURIComponent(email), url: baseURL },
  ]);
}

test.beforeAll(async ({ request }) => {
  const r = await request.get("/ambassadors");
  test.skip(r.status() !== 200, "insiders not served");
});

test("1. on Christmas, a stop is suggested in well under a minute, no account", async ({
  page,
}) => {
  await page.goto("/christmas");
  const started = Date.now();
  const open = page.getByTestId("suggest-open");
  await expect(open).toBeVisible();
  await expect(open).toHaveAttribute("data-experience", "christmas");
  await open.click();
  const sheet = page.getByTestId("suggest-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { level: 2 })).toHaveText(
    "Suggest a Stop",
  );
  await page.getByTestId("suggest-name").fill(NAME);
  await page.getByTestId("suggest-cat-restaurant").click();
  await page.getByTestId("suggest-location").fill("SilverStar village centre");
  await page.getByTestId("suggest-more").click();
  await page.getByTestId("suggest-when").fill("Fridays 7–10 pm in December");
  await page.getByTestId("suggest-website").fill("longjohns.example");
  // A person reads the form; a script does not. The server wants two seconds.
  await page.waitForTimeout(2100);
  await page.getByTestId("suggest-send").click();
  await expect(page.getByTestId("suggest-done")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(page.getByTestId("suggest-thanks")).toContainText(
    /in for review/,
  );
  await expect(page.getByTestId("suggest-status")).toContainText(
    "not public yet",
  );
  const m = page.getByTestId("milestones");
  await expect(m).toContainText("0 approved");
  await expect(m).toContainText("1 waiting for review");
  await expect(m.getByTestId("milestone-1")).toHaveAttribute(
    "data-earned",
    "false",
  );
  await expect(m).toContainText("Counted on this phone");
  await page.screenshot({
    path: "docs/product/contributions/screenshots/01-christmas-thanks.png",
  });

  // Suggest another: the kind is kept, the name is not.
  await page.getByTestId("suggest-another").click();
  await expect(page.getByTestId("suggest-form")).toBeVisible();
  await expect(page.getByTestId("suggest-name")).toHaveValue("");
  await expect(page.getByTestId("suggest-cat-restaurant")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("suggest-close").click();
  await expect(sheet).toHaveCount(0);
});

test("2. the same button on Hockey Night captures where it came from", async ({
  page,
}) => {
  await page.goto("/hockey");
  const open = page.getByTestId("suggest-open");
  await expect(open).toHaveAttribute("data-experience", "hockey");
  await open.click();
  await expect(page.getByTestId("suggest-sheet")).toContainText("Hockey Night");
  // Hockey's mount pre-picks restaurants: the likeliest thing missing near an arena.
  await expect(page.getByTestId("suggest-cat-restaurant")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("suggest-close").click();
  for (const path of ["/snow", "/datenight", "/discovery"]) {
    await page.goto(path);
    await expect(
      page
        .locator(
          '[data-testid="suggest-open"], [data-testid="share-something"]',
        )
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  }
});

test("3. twelve in a row all go in — no daily cap — and the thirteenth is asked to pause, not to come back tomorrow", async ({
  request,
}) => {
  const send = (i: number) =>
    request.post("/api/contributions/submit", {
      data: {
        experience: "christmas",
        category: "christmas-display",
        name: `Display ${RUN} ${i}`,
        location: `${i} Candy Cane Lane, Vernon`,
        town: "Vernon",
        device: DEVICE,
        openedFor: 5000,
      },
    });
  for (let i = 0; i < 12; i++) {
    const r = await send(i);
    expect(r.status(), `submission ${i}`).toBe(201);
    const body = (await r.json()) as {
      suggestion: { status: string };
      repeat: boolean;
    };
    expect(body.suggestion.status).toBe("pending");
    expect(body.repeat).toBe(false);
  }
  const r = await send(12);
  expect(r.status()).toBe(429);
  const body = (await r.json()) as {
    error: string;
    retryAfterSeconds?: number;
  };
  expect(body.error).toMatch(/minute/);
  expect(body.error).not.toMatch(/tomorrow/);
  expect(Number(r.headers()["retry-after"])).toBeGreaterThan(0);
  expect(Number(r.headers()["retry-after"])).toBeLessThanOrEqual(60);

  // The same person sending the same thing twice is one suggestion.
  const again = await request.post("/api/contributions/submit", {
    data: {
      experience: "christmas",
      category: "christmas-display",
      name: `Display ${RUN} 3`,
      location: `3 Candy Cane Lane, Vernon`,
      town: "Vernon",
      device: `${DEVICE}2`,
      openedFor: 5000,
    },
  });
  // A different device: not a repeat of its own, but a lookalike for the reviewer.
  expect(again.status()).toBe(201);
  expect(((await again.json()) as { lookalike: boolean }).lookalike).toBe(true);

  // Their progress: twelve waiting, none approved.
  const mine = await request.get(`/api/contributions/mine?device=${DEVICE}`);
  expect(mine.status()).toBe(200);
  const progress = (
    (await mine.json()) as { progress: { approved: number; pending: number } }
  ).progress;
  expect(progress).toMatchObject({ approved: 0, pending: 12 });
});

test("4. a visitor sees nothing of the queue", async ({ request }) => {
  expect((await request.get("/api/contributions/review")).status()).toBe(404);
  const page = await request.get("/contribute/review");
  expect(await page.text()).toContain("This page is for the administrator");
});

test("5. the administrator reviews every experience in one queue: edit, approve, reject, copy", async ({
  page,
  context,
  baseURL,
}) => {
  await as(context, "admin@insiders.test", baseURL!);
  await page.goto("/contribute/review");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Community suggestions",
  );
  const list = page.getByTestId("queue-list");
  const card = list.locator("li").filter({ hasText: NAME }).first();
  await expect(card).toBeVisible();
  await expect(card.getByTestId("card-experience")).toHaveText("Christmas");
  await expect(card).toContainText("Restaurant or café");
  await expect(card).toContainText("SilverStar village centre");
  await expect(card).toContainText("Fridays 7–10 pm in December");
  await expect(card).toContainText("https://longjohns.example/");
  await expect(card.getByTestId("card-status")).toContainText("Pending review");
  await page.screenshot({
    path: "docs/product/contributions/screenshots/02-admin-queue.png",
    fullPage: false,
  });

  // Edit the words first.
  await card.getByTestId("card-edit-toggle").click();
  await card.getByTestId("edit-name").fill(`${NAME} & Grill`);
  await card.getByTestId("edit-save").click();
  await expect(card.getByTestId("card-name")).toHaveText(`${NAME} & Grill`);

  // Approve: it counts now, and it moves to the Approved queue; the website
  // is handed to Atlas (not configured here, said so).
  await card.getByTestId("card-approve").click();
  await expect(card).toHaveCount(0);
  await page.getByTestId("queue-approved").click();
  const approved = page
    .getByTestId("queue-list")
    .locator("li")
    .filter({ hasText: `${NAME} & Grill` })
    .first();
  await expect(approved.getByTestId("card-status")).toContainText("Approved");
  await expect(approved.getByTestId("card-atlas")).toContainText(
    /not-configured|queued|failed/,
  );

  // Copy for Atlas: the facts, never the contributor.
  await approved.getByTestId("card-copy").click();
  await expect(approved.getByTestId("card-said")).toContainText(/Atlas/);
  // Headless Chromium has no clipboard: the block is shown to copy by hand,
  // and it carries the facts and the provenance, never the contributor.
  const block = approved.getByTestId("card-copy-text");
  if (await block.count()) {
    await expect(block).toHaveValue(/Name: Long John's Pub/);
    await expect(block).toHaveValue(
      /Source: community suggestion via Passport Christmas/,
    );
    await expect(block).not.toHaveValue(/anon_|v_/);
  }

  // The twelve displays: one is a lookalike of the other device's; reject
  // that one as a duplicate. It leaves Pending for Rejected.
  await page.getByTestId("queue-pending").click();
  const dup = page
    .getByTestId("queue-list")
    .locator("li")
    .filter({ hasText: `Display ${RUN} 3` })
    .filter({ has: page.getByTestId("card-lookalike") })
    .first();
  await expect(dup).toBeVisible();
  await dup.getByTestId("card-reject-toggle").click();
  await dup.getByTestId("reject-reason").selectOption("duplicate");
  await dup.getByTestId("reject-confirm").click();
  await expect(dup).toHaveCount(0);
  await page.getByTestId("queue-declined").click();
  await expect(
    page
      .getByTestId("queue-list")
      .locator("li")
      .filter({ hasText: `Display ${RUN} 3` })
      .first()
      .getByTestId("card-status"),
  ).toContainText("Rejected");

  await page.getByTestId("queue-approved").click();
  await expect(
    page.getByTestId("queue-list").locator("li").filter({ hasText: NAME }),
  ).toHaveCount(1);
});

test("6. the contributor's progress counts the approval, not the pending or rejected ones", async ({
  request,
}) => {
  // The approved one came from the browser's device token; approve one of the API device's too.
  const review = await request.get("/api/contributions/review");
  expect(review.status()).toBe(404); // still a visitor on this request context
  const mine = await request.get(`/api/contributions/mine?device=${DEVICE}2`);
  const body = (await mine.json()) as {
    progress: {
      approved: number;
      pending: number;
      earned: { title: string }[];
    };
  };
  expect(body.progress.approved).toBe(0);
  expect(body.progress.pending).toBe(0); // rejected as a duplicate: counts for nothing
});

test("7. approving one of the twelve earns First Discovery on that device", async ({
  page,
  context,
  baseURL,
  request,
}) => {
  await as(context, "admin@insiders.test", baseURL!);
  await page.goto("/contribute/review");
  const card = page
    .getByTestId("queue-list")
    .locator("li")
    .filter({ hasText: `Display ${RUN} 0` })
    .first();
  await card.getByTestId("card-approve").click();
  // Approved, so it leaves the Pending queue.
  await expect(card).toHaveCount(0);
  const mine = await request.get(`/api/contributions/mine?device=${DEVICE}`);
  const body = (await mine.json()) as {
    progress: {
      approved: number;
      pending: number;
      current?: { title: string };
    };
  };
  expect(body.progress.approved).toBe(1);
  expect(body.progress.pending).toBe(11);
  expect(body.progress.current?.title).toBe("First Discovery");
});
