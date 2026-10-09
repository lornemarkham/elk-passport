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
      /^\/auth\?next=%2Foctober%2Fdiscover$/,
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

/**
 * **The journeys that broke in production after thirteen tests said fine.**
 *
 * The existing suite checked that a signed-out visitor is *invited* to sign
 * in. It never followed the invitation. So a link to `/signin` — a route that
 * has never existed — sat in production looking exactly like a working one,
 * and a password reset begun in October finished in a different product.
 *
 * These follow the links.
 */
test.describe("an October visitor can reach authentication and get back", () => {
  test("Sign in to choose reaches real auth, not a dead route", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    const invite = page
      .getByRole("link", { name: /sign in to choose/i })
      .first();
    await expect(invite).toBeVisible();

    await invite.click();
    await page.waitForURL(/\/auth/);

    // The failure was `/signin`, which rendered Passport's "nothing at this
    // address" page and ejected the person from October entirely.
    expect(new URL(page.url()).pathname).toBe("/auth");
    await expect(page.locator("body")).not.toContainText(
      /nothing at this address/i,
    );
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
  });

  test("and auth knows to send them back to October", async ({ page }) => {
    await page.goto("/october/discover");
    await page
      .getByRole("link", { name: /sign in to choose/i })
      .first()
      .click();
    await page.waitForURL(/\/auth\?/);

    expect(new URL(page.url()).searchParams.get("next")).toBe(
      "/october/discover",
    );
  });

  test("the way out of auth is October, never generic Passport", async ({
    page,
  }) => {
    await page.goto("/auth?next=%2Foctober%2Fdiscover");
    const back = page.getByRole("link", { name: /^←\s*Back$/ });
    await expect(back).toHaveAttribute("href", "/october/discover");
  });

  test("a bare /auth offers a way out that is correct on either product", async ({
    page,
  }) => {
    // With nothing asked for, `/` is October's front door on the mapped
    // domain and Passport's home everywhere else — one href, right on both.
    await page.goto("/auth");
    await expect(
      page.getByRole("link", { name: /^←\s*Back$/ }),
    ).toHaveAttribute("href", "/");
  });
});

test.describe("password recovery keeps hold of where it began", () => {
  test("the forgot link carries the destination with it", async ({ page }) => {
    await page.goto("/auth?next=%2Foctober%2Fdiscover");
    const forgot = page.getByRole("link", { name: /forgot/i });
    await expect(forgot).toHaveAttribute(
      "href",
      "/auth/forgot?next=%2Foctober%2Fdiscover",
    );
  });

  test("the recovery email is asked to come back through October", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/auth/forgot?next=%2Foctober%2Fdiscover");

    const asked = page.waitForRequest((r) =>
      r.url().includes("/auth/v1/recover"),
    );
    await page.getByPlaceholder(/email/i).fill("nobody@example.invalid");
    await page
      .getByRole("button", { name: /send|reset|link/i })
      .first()
      .click();

    const redirectTo = new URL(
      new URL((await asked).url()).searchParams.get("redirect_to")!,
    );
    expect(redirectTo.origin).toBe(new URL(baseURL!).origin);
    expect(redirectTo.pathname).toBe("/auth/callback");
    // The whole point: update-password is told where the journey started, so
    // the sign-in after it can finish in the right product.
    const onward = redirectTo.searchParams.get("next")!;
    expect(onward).toContain("/auth/update-password");
    expect(onward).toContain(encodeURIComponent("/october/discover"));
  });
});

test.describe("no control is offered that cannot work", () => {
  test("no Google button while the provider is unavailable", async ({
    page,
  }) => {
    await page.goto("/auth");
    // Previously rendered disabled with the reason in a `title` — invisible
    // on a phone and to most screen readers.
    await expect(
      page.getByRole("button", { name: /continue with google/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/^or$/)).toHaveCount(0);
  });
});

test.describe("the auth form can be used without seeing it", () => {
  test("every input has an accessible name", async ({ page }) => {
    await page.goto("/auth");
    await expect(
      page.getByRole("textbox", { name: /email address/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test("including on the forgot screen", async ({ page }) => {
    await page.goto("/auth/forgot");
    await expect(
      page.getByRole("textbox", { name: /email address/i }),
    ).toBeVisible();
  });
});

/**
 * **Every card goes somewhere, and the account page comes back.**
 *
 * The suite above follows the links out of October into auth. It did not
 * follow the links *into* a possibility, and six of the seventeen cards on
 * production pointed at `/october/discover` — the page the reader was already
 * standing on. The cause was `detailReady` requiring an `imageUrl`, so Atlas
 * declining to vouch for a photograph silently produced a dead link.
 *
 * These drive the whole product, because that is the only place the defect was
 * visible: the unit tests were all green while it shipped.
 */
test.describe("nothing on Discover is a link to Discover", () => {
  test("every card opens something other than the page it is on", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    const titles = page.locator(
      '[data-testid="lead"] h2 a, [data-testid="lead"] h3 a, [data-testid="tile"] h3 a, [data-testid="row"] h3 a',
    );
    await expect(titles.first()).toBeVisible();

    const hrefs = await titles.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("href") ?? ""),
    );
    expect(hrefs.length).toBeGreaterThan(5);
    expect(hrefs.filter((h) => h === "/october/discover")).toEqual([]);
    expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
  });

  test("a card with no photograph still opens its own page", async ({
    page,
  }) => {
    await page.goto("/october/discover");
    // `data-has-image="false"` is the treatment for a subject Atlas holds no
    // usable picture for — 118 of the 144 October subjects, so this is the
    // common case rather than the edge one.
    const bare = page.locator('[data-has-image="false"]').first();
    await expect(bare).toBeVisible();

    const name = (await bare.locator("h3").first().innerText()).trim();
    const to = await bare.locator("h3 a").first().getAttribute("href");
    expect(to).not.toBe("/october/discover");

    await bare.locator("h3 a").first().click();
    // A subject page is a remote read against Atlas and can take seconds the
    // first time; waiting for the load state alone resolved on the page we
    // were still standing on.
    await page.waitForURL((url) => url.pathname !== "/october/discover", {
      timeout: 30_000,
    });
    await expect(page.locator("h1, h2").first()).toContainText(
      name.slice(0, 12),
      { ignoreCase: true },
    );
    await expect(page.locator("body")).not.toContainText(
      /nothing at this address/i,
    );
  });
});

test.describe("the account page is reachable from October and gives October back", () => {
  test("a signed-out reader is asked to sign in and kept pointed at October", async ({
    page,
  }) => {
    await page.goto("/account?next=%2Foctober%2Fdiscover");
    const invite = page.getByRole("link", { name: /sign in/i }).first();
    // Auth returns to the account page, which still knows where October was.
    await expect(invite).toHaveAttribute(
      "href",
      /\/auth\?next=.*october.*discover/,
    );
  });

  test("October's bar hands the account page the path, not a bare link", async ({
    page,
  }) => {
    await page.goto("/october/mine");
    const signIn = page.getByTestId("october-sign-in");
    // Signed out the bar shows a way in rather than a name; either way it must
    // carry where the reader stands, which is what used to be thrown away.
    await expect(signIn).toHaveAttribute(
      "href",
      "/auth?next=%2Foctober%2Fmine",
    );
  });
});

/**
 * **A shared page should not announce a different product than the one you
 * are in.**
 *
 * `/account` and the three auth screens are one implementation serving
 * October and Passport. On production they only ever rendered as Passport: a
 * cream page titled *Your account — Passport*, offering to remember what you
 * were "into" for a product you may never have heard of.
 */
test.describe("October keeps hold of a reader through the shared pages", () => {
  test("the account page is October when it was reached from October", async ({
    page,
  }) => {
    await page.goto("/account?next=%2Foctober%2Fdiscover");
    const shell = page.locator("main[data-theme]");
    await expect(shell).toHaveAttribute("data-theme", "october");
    await expect(shell).toHaveAttribute("data-experience", "October");
    await expect(page).toHaveTitle(/Your account — October/);
    // October's own bar, so the way back is the one the reader already knows.
    await expect(page.getByTestId("october-nav-discover")).toBeVisible();
  });

  test("and it names October rather than Passport in its own copy", async ({
    page,
  }) => {
    await page.goto("/account?next=%2Foctober%2Fdiscover");
    await expect(page.locator("body")).toContainText(/Browsing October/i);
    await expect(page.locator("body")).not.toContainText(/tell Passport/i);
  });

  test("signing in from October looks like October", async ({ page }) => {
    await page.goto("/auth?next=%2Foctober%2Fdiscover");
    await expect(page.locator("[data-theme]").first()).toHaveAttribute(
      "data-theme",
      "october",
    );
    await expect(page).toHaveTitle(/Sign in — October/);
    // The wordmark said ELK Passport at the one moment a product is asking
    // to be trusted with a password.
    await expect(page.locator("body")).not.toContainText("ELK Passport");
  });

  test("so does recovering a password begun in October", async ({ page }) => {
    await page.goto("/auth/forgot?next=%2Foctober%2Fdiscover");
    await expect(page.locator("[data-theme]").first()).toHaveAttribute(
      "data-theme",
      "october",
    );
    await expect(page.locator("body")).not.toContainText("ELK Passport");
  });

  test("and setting the new one at the end of it", async ({ page }) => {
    await page.goto("/auth/update-password?next=%2Foctober%2Fdiscover");
    await expect(page.locator("[data-theme]").first()).toHaveAttribute(
      "data-theme",
      "october",
    );
  });
});

/**
 * **Generic Passport has to stay generic Passport.**
 *
 * The account page's cream was written as literal hex, so it could not be
 * themed at all. Those literals are tokens now and the cream is a named
 * `passport` theme holding the very same values — which is only worth doing
 * if nothing on Passport moved.
 */
test.describe("Passport is untouched", () => {
  test("its account page keeps its own palette and its own name", async ({
    page,
  }) => {
    await page.goto("/account");
    const shell = page.locator("main[data-theme]");
    await expect(shell).toHaveAttribute("data-theme", "passport");
    await expect(page).toHaveTitle(/Your account — Passport/);
    await expect(shell).toHaveCSS("background-color", "rgb(236, 223, 196)");
    // October's bar belongs to October.
    await expect(page.getByTestId("october-nav-discover")).toHaveCount(0);
  });

  test("its sign-in page is themed by nothing at all, as before", async ({
    page,
  }) => {
    await page.goto("/auth");
    // Not `data-theme="passport"` either: these pages inherit `:root`, and
    // the named passport theme is the account surface's own cream.
    await expect(page.locator("[data-theme]")).toHaveCount(0);
    await expect(page.locator("body")).toContainText("ELK Passport");
  });
});

/**
 * **Every page needs a heading, and the detail template needs to stop
 * repeating itself.**
 */
test.describe("the finishing defects", () => {
  test("the Draconids page has a heading, not a styled paragraph", async ({
    page,
  }) => {
    await page.goto("/quick/draconids");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).not.toBeEmpty();
  });

  test("a detail page offers one action area, not two", async ({ page }) => {
    await page.goto("/october/discover");
    const first = page
      .locator('[data-testid="row"] h3 a, [data-testid="tile"] h3 a')
      .first();
    await first.click();
    await page.waitForURL((url) => url.pathname !== "/october/discover", {
      timeout: 30_000,
    });

    const body = page.locator("body");
    for (const control of ["Sign in to save", "Official site", "Directions"]) {
      const count = await page.getByRole("link", { name: control }).count();
      expect(count, `${control} should appear at most once`).toBeLessThan(2);
    }
    await expect(body).toBeVisible();
  });

  test("a label used for several rows is printed once", async ({ page }) => {
    // Grizzli's four "Music & Activity Schedule" lines printed the heading
    // four times, and "What to Expect" three more.
    await page.goto(
      "/passport/d6669552-d390-4ab1-9b81-4a2d800ccc56?kind=events",
    );
    // `body`, not `main`: a composed subject renders its own `<main>` inside
    // the route's, and two of them is a strict-mode violation rather than a
    // page defect.
    const text = (await page.locator("body").innerText()).toLowerCase();
    expect(text.split("music & activity schedule").length - 1).toBe(1);
    expect(text.split("what to expect").length - 1).toBe(1);
    // And the address no longer stutters.
    expect(text).not.toContain("2550 boucherie rd, 2550 boucherie rd");
  });

  test("a five-month season is not shown as one continuous event", async ({
    page,
  }) => {
    await page.goto(
      "/passport/2cd9a809-0a47-4b4d-92b7-043f33338578?kind=events",
    );
    const text = await page.locator("body").innerText();
    expect(text).toContain("May 2, 2026");
    expect(text).toContain("Oct 10, 2026");
    // The clock was the only part claiming it never stopped.
    expect(text).not.toMatch(/May 2, 2026 9:00/);
  });
});
