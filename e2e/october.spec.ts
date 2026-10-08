import { expect, test } from "@playwright/test";

/**
 * **The October journeys a person actually takes, in a real browser.**
 *
 * Everything else in this repository is a unit or component test. They are
 * good and they did not catch any of the three things that were wrong in
 * production this week: a navigation that highlighted nothing on the domain
 * most people arrive at, an Atlas URL with a stray `/api` on the end, and a
 * password-reset link pointing at localhost. All three are only visible when
 * something drives the whole product.
 *
 * So these are deliberately few and deliberately end-to-end. They are not
 * trying to cover the surface area — the unit tests do that. They are trying
 * to notice when a real journey stops working.
 *
 * ## What they will not do
 *
 * They do not sign in. Creating a real session needs either a real inbox or a
 * seeded test user with a password in CI, and a brittle login fixture that
 * breaks every other week protects nothing. The authenticated half of the
 * save loop is covered deterministically in
 * `src/lib/labs/october/chooseRoundTrip.test.tsx`, and the one step a human
 * must still take is written down in `docs/RELEASE.md`.
 */

test.describe("arriving", () => {
  // **The mapped-domain root is deliberately not tested here.** It depends on
  // a forged `Host` header, and Playwright strips that in both the page and
  // the request context — a test that cannot send the header cannot assert
  // what the header does. The rewrite itself is covered by
  // `src/lib/domains/experience-domains.test.ts`, the nav behaviour by
  // `OctoberNav.test.tsx`, and the two together are confirmed against the
  // real domain in the production smoke step in `docs/RELEASE.md`.

  test("Discover is marked current on its own route too", async ({ page }) => {
    await page.goto("/october/discover");
    await expect(page.getByTestId("october-nav-discover")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Passport's own root is still Passport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("october-nav-discover")).toHaveCount(0);
  });

  test("Discover renders possibilities, not an empty shell", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    const results = page.locator(
      '[data-testid="row"], [data-testid="tile"], [data-testid="lead"]',
    );
    await expect(results.first()).toBeVisible();
    expect(await results.count()).toBeGreaterThan(2);
  });
});

test.describe("finding something", () => {
  test("search crosses films, things to make and what is on", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    await page.getByLabel("Search everything").fill("pumpkin");

    const results = page.locator('[data-testid="row"], [data-testid="tile"]');
    await expect(results.first()).toBeVisible();
    // The whole hypothesis of this product is one pool. If a search for
    // pumpkin ever comes back from a single catalogue, that has broken.
    const sources = await results.evaluateAll((nodes) => [
      ...new Set(nodes.map((n) => (n as HTMLElement).dataset.source)),
    ]);
    expect(sources.length).toBeGreaterThan(1);
  });

  test("an intent reshapes the page in place and can be taken back off", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    await expect(page.getByTestId("opening")).toBeVisible();

    await page
      .getByTestId("phrase")
      .filter({ hasText: "make something" })
      .click();
    await expect(page.getByTestId("asked")).toBeVisible();
    await expect(page.getByTestId("asked-chip")).toHaveCount(1);
    // October is still on the page — filtering must not replace the product.
    await expect(page.getByTestId("asked")).toContainText(/October|Vernon|,/);

    await page.getByRole("button", { name: /← October/ }).click();
    await expect(page.getByTestId("opening")).toBeVisible();
  });

  test("the full filter set is one press away and not before", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    await expect(page.getByTestId("filters")).toHaveCount(0);
    await page.getByTestId("open-filters").click();
    await expect(page.getByTestId("filter")).toHaveCount(13);
  });
});

test.describe("opening something and coming back", () => {
  test("a result opens, and back returns to Discover with the search intact", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    await page.getByLabel("Search everything").fill("pumpkin");

    const first = page
      .locator('[data-testid="row"], [data-testid="tile"]')
      .first();
    await expect(first).toBeVisible();
    const name = (await first.locator("h3").first().innerText()).trim();

    await first.locator("h3 a").first().click();
    await page.waitForLoadState("domcontentloaded");
    // Whatever kind of thing it was, its own page names it.
    await expect(page.locator("h1, h2").first()).toContainText(
      name.slice(0, 12),
      { ignoreCase: true },
    );

    await page.goBack();
    await expect(page.getByLabel("Search everything")).toHaveValue("pumpkin");
    await expect(
      page.locator('[data-testid="row"], [data-testid="tile"]').first(),
    ).toBeVisible();
  });
});

test.describe("choosing, signed out", () => {
  test("invites a sign-in rather than hiding that choosing exists", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    const signIn = page.getByRole("link", { name: /sign in to choose/i });
    await expect(signIn.first()).toBeVisible();
    // And it comes back here afterwards, rather than dumping you on a homepage.
    await expect(signIn.first()).toHaveAttribute(
      "href",
      /returnTo=%2Foctober%2Fdiscover/,
    );
  });

  test("My October asks a visitor to sign in", async ({ page }) => {
    await page.goto("/october/mine");
    await expect(page.locator("body")).toContainText(/sign in/i);
  });
});

test.describe("auth links point at this origin, never at localhost in production", () => {
  test("the sign-in page offers the flows the product actually has", async ({
    page,
  }) => {
    await page.goto("/auth");
    // Placeholder rather than label: the email inputs have no accessible
    // name, which is recorded as an accessibility gap rather than papered
    // over here.
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
  });

  test("a recovery request is sent with a callback on this very origin", async ({
    page,
    baseURL,
  }) => {
    // The production bug was a recovery link to `localhost:3000/?code=...`.
    // Supabase chooses the final URL, but what *we* ask for is ours to get
    // right, and this is the request that asks.
    await page.goto("/auth/forgot");

    const asked = page.waitForRequest((request) =>
      request.url().includes("/auth/v1/recover"),
    );
    await page.getByPlaceholder(/email/i).fill("nobody@example.invalid");
    await page
      .getByRole("button", { name: /send|reset|link/i })
      .first()
      .click();

    const request = await asked;
    const redirectTo = new URL(request.url()).searchParams.get("redirect_to");
    expect(redirectTo).toBeTruthy();
    expect(redirectTo!).toContain(`${baseURL}/auth/callback`);
    expect(redirectTo!).toContain("next=%2Fauth%2Fupdate-password");
  });

  test("a callback with no code lands on a useful message, not a crash", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/auth\?notice=link-incomplete/);
    await expect(page.locator("body")).not.toContainText(/stack|at Object\./i);
  });

  test("an expired or reused link says so rather than 500ing", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=definitely-not-a-real-code");
    await expect(page).toHaveURL(/\/auth\?notice=link-expired/);
  });
});
