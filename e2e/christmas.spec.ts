import { expect, test, type Page } from "@playwright/test";

/**
 * **Go Have a Christmas, signed out** — what any visitor reaches. The whole
 * family journey (accounts, invites, announcements, memories) needs a real
 * auth stack and runs from docs/product/christmas/verification.
 *
 * With `E2E_ATLAS=1` (the critic's mock serving Atlas's committed corpus) the
 * pages show real Christmas finds; without it they must say Atlas isn't
 * answering rather than "nothing is on".
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

/** Change the place on the shared location bar (ADR 020; the town pills are gone). */
async function changePlace(page: Page, id: string) {
  await page.getByTestId("location-change").first().click();
  await expect(page.getByTestId("location-picker")).toBeVisible();
  await page.getByTestId("location-search").fill(id);
  await page.getByTestId(`location-option-${id}`).click();
  await expect(page.getByTestId("location-picker")).toHaveCount(0);
}

test("the Christmas page opens on the season and leads somewhere real", async ({
  page,
}) => {
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Christmas around/,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("countdown")).toBeVisible();
  if (WITH_ATLAS) {
    await expect(page.getByTestId("atlas-down")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("atlas-down")).toBeVisible();
  }
  await page.getByTestId("theme-markets").click();
  await expect(page).toHaveURL(/\/christmas\/discover\?theme=markets/);
  await expect(page.getByTestId("chip-markets")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (WITH_ATLAS)
    await expect(page.getByTestId("find-card").first()).toBeVisible();
});

test("a sentence becomes a plan, kept as said", async ({ page }) => {
  await page.goto("/christmas");
  await page
    .getByRole("textbox", { name: /What does your Christmas look like/ })
    .fill("We have Saturday afternoon, two kids and $100");
  await page.getByTestId("say-it-go").click();
  // Signed out, the planner asks to sign in and carries the sentence through.
  await expect(page).toHaveURL(/\/christmas\/plan\?shape=family-day/);
  await expect(page).toHaveURL(/who=family/);
  await expect(page.getByTestId("plan-sign-in")).toHaveAttribute(
    "href",
    /%2524100/,
  );
});

test("refining is a plain form, and the URL keeps every answer", async ({
  page,
}) => {
  await page.goto("/christmas/discover");
  await page.getByTestId("refine").locator("summary").click();
  await page.locator('select[name="at"]').selectOption("kelowna");
  await page.locator('input[name="ages"]').fill("5");
  await page.getByTestId("refine-submit").click();
  await expect(page).toHaveURL(/at=kelowna/);
  await expect(page).toHaveURL(/ages=5/);
  if (WITH_ATLAS)
    await expect(page.getByTestId("result-count")).toContainText(
      "checked for a 5-year-old",
    );
});

test("planning and an adventure ask a visitor to sign in, and come back", async ({
  page,
  request,
}) => {
  await page.goto("/christmas/plan?shape=evening");
  const signIn = page.getByTestId("plan-sign-in");
  await expect(signIn).toBeVisible();
  expect(await signIn.getAttribute("href")).toContain(
    encodeURIComponent("/christmas/plan?shape=evening"),
  );
  await page.goto("/christmas/adventure/not-a-real-one");
  await expect(
    page.getByText("Sign in to open this Christmas adventure"),
  ).toBeVisible();
  const start = await request.post("/christmas/api/start", { data: {} });
  expect(start.status()).toBe(401);
});

/**
 * **The no-account Christmas day: open, plan, save, share, reopen** — on a
 * phone (390px) and a desktop. The sign-in wall used to be the end of the road
 * for a visitor; now `/christmas/plan` hands the same sentence to the Day
 * Builder, which edits, keeps on this device and shares as words or a printed
 * page. Sharing *live* with later changes still needs an account (adventures).
 */
for (const [label, viewport] of [
  ["phone 390px", { width: 390, height: 844 }],
  ["desktop", { width: 1280, height: 900 }],
] as const) {
  test(`a visitor plans, keeps, shares and reopens a Christmas day — ${label}`, async ({
    browser,
  }) => {
    test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 600,
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    // open
    await page.goto("/christmas");
    await changePlace(page, "kelowna");
    await expect(page).toHaveURL(/at=kelowna/);
    await page
      .getByRole("textbox", { name: /What does your Christmas look like/ })
      .fill("A Christmas evening for the two of us");
    await page.getByTestId("say-it-go").click();
    // plan: the wall offers a way on without an account
    await page.getByTestId("plan-no-account").click();
    await expect(page).toHaveURL(/\/go\?say=/);
    await expect(page.getByTestId("go-day")).toBeVisible();
    await expect(page.getByTestId("go-stop").first()).toBeVisible();
    // save: on this device
    await page.getByTestId("go-keep-day").click();
    await expect(page.getByTestId("go-note")).toContainText("this device");
    // share: the printed page is a link anyone can open
    const href = await page.getByTestId("go-print").getAttribute("href");
    expect(href).toContain("/go/print?");
    const friend = await context.newPage();
    await friend.goto(href!);
    await expect(friend.locator("body")).toContainText(/Christmas/i);
    await friend.close();
    // reopen: kept days list it on /go
    await page.goto("/go");
    await expect(page.getByTestId("go-kept-day")).toHaveCount(1);
    await page.getByTestId("go-kept-open").click();
    await expect(page.getByTestId("go-stop").first()).toBeVisible();
    await context.close();
  });
}

test("the sign-in wall offers a way on without an account", async ({
  page,
}) => {
  await page.goto("/christmas/plan?shape=family-day&ages=5&at=kelowna");
  const link = page.getByTestId("plan-no-account");
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  expect(href).toMatch(/^\/go\?say=/);
  expect(href).toContain("at=kelowna");
});

test("Christmas opens on Vernon, shows real things, and follows a move to Kelowna", async ({
  page,
}) => {
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around Vernon/ }),
  ).toBeVisible();
  await expect(page.getByTestId("location-name").first()).toContainText(
    "Vernon",
  );
  // Vernon's lights come from the community map's researched displays, and
  // are named for what they are: local listings, apart from Atlas's finds.
  const vernonLights = page.getByTestId("around-lights-pins");
  await expect(vernonLights).toContainText("SilverStar Annual Light Up");
  await expect(page.getByTestId("around-soon-pins")).toContainText("Frostival");
  await expect(vernonLights).not.toContainText("Stuart Park");
  await expect(
    page
      .getByText(/local listings checked by a person, not from Atlas/)
      .first(),
  ).toBeVisible();
  if (WITH_ATLAS) {
    await expect(page.getByTestId("atlas-down")).toHaveCount(0);
    await expect(
      page.getByTestId("around-soon").getByTestId("find-card").first(),
    ).toBeVisible();
  }

  await changePlace(page, "kelowna");
  await expect(page).toHaveURL(/\/christmas\?at=kelowna/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around Kelowna/ }),
  ).toBeVisible();
  const kelownaLights = page.getByTestId("around-lights-pins");
  await expect(kelownaLights).toContainText(/Kelowna Light Up|Tree of Hope/);
  await expect(kelownaLights).not.toContainText("SilverStar");
  await expect(page.getByTestId("around-soon-pins")).not.toContainText(
    "Frostival",
  );

  // The chosen place is remembered (the shared place's cookie): a bare
  // /christmas opens on Kelowna now, from the server's first render.
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around Kelowna/ }),
  ).toBeVisible();
});

test("an event and a light display go into one Christmas day", async ({
  page,
}) => {
  await page.goto("/christmas");
  const pin = page
    .getByTestId("around-lights-pins")
    .getByTestId("add-to-tour")
    .first();
  await expect(pin).toHaveText(/Add to my Christmas day/);
  await pin.click();
  let expected = 1;
  if (WITH_ATLAS) {
    await page
      .getByTestId("around-soon")
      .getByTestId("pick-find")
      .first()
      .click();
    expected = 2;
  }
  await expect(page.getByTestId("pick-tray")).toContainText(
    `${expected} in your Christmas day`,
  );
  await page.getByTestId("plan-picks").click();
  await expect(page).toHaveURL(/\/christmas\/plan\?.*lights=(seed|pin)-/);
  if (WITH_ATLAS) await expect(page).toHaveURL(/with=/);
});
