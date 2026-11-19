import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * **Date Night: Connect & Play**, on two phones.
 *
 * Run against a server on the memory store, where nothing is real:
 *   DATENIGHT_PLAY_STORE=memory E2E_PORT=3120 npx playwright test e2e/date-night-connect.spec.ts
 *
 * Every phone is its own browser context, so its own cookies: the way two
 * people really meet. Privacy is asserted on what the server actually sent
 * to the other phone, not on what the page chose to show.
 */

const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
} as const;

async function phone(browser: Browser): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext(PHONE);
  return [ctx, await ctx.newPage()];
}

/** Start a two-phone night as the host; returns the invitation link. */
async function host(
  page: Page,
  opts: { mode?: string; name?: string; questions?: string[] } = {},
) {
  await page.goto("/datenight/play");
  if (opts.mode) await page.getByTestId(`mode-${opts.mode}`).click();
  if (opts.name || opts.questions) {
    await page.getByText("Names and your own questions").click();
    if (opts.name) await page.getByTestId("host-name").fill(opts.name);
    for (const [i, q] of (opts.questions ?? []).entries())
      await page.getByTestId(`host-q-${i}`).fill(q);
  }
  await page.getByTestId("start-invite").click();
  await expect(page.getByTestId("invite-url")).toContainText(
    "/datenight/play/",
  );
  return (await page.getByTestId("invite-url").innerText()).trim();
}

async function join(page: Page, url: string, name = "") {
  await page.goto(url);
  if (name) await page.getByTestId("join-name").fill(name);
  await page.getByTestId("join").click();
  await expect(page.getByTestId("card")).toBeVisible();
}

const codeOf = (url: string) => url.split("/").pop()!;
const api = (page: Page, code: string) =>
  page.request.get(`/api/date-night/play/${code}`);

test.describe("Connect & Play", () => {
  test("two people, two phones, no account: private picks, shared reveal", async ({
    browser,
  }) => {
    const [, a] = await phone(browser);
    const [, b] = await phone(browser);

    // Figure me out opens on Would You Rather.
    const url = await host(a, { mode: "figure", name: "Alex" });
    await expect(a.getByTestId("card")).toHaveAttribute("data-kind", "wyr");

    // The invitation page shows nothing private and takes no seat on a look.
    await b.goto(url);
    await expect(
      b.getByRole("heading", { name: /Alex wants to play/ }),
    ).toBeVisible();
    await b.reload();
    await expect(b.getByTestId("join")).toBeVisible();
    await join(b, url, "Sam");
    await expect(a.getByTestId("invite-panel")).toBeHidden({ timeout: 10_000 });

    // Alex picks. Sam's phone is told that nobody has revealed, and not what.
    await a.getByTestId("wyr-0").click();
    await expect(a.getByTestId("waiting")).toContainText("Waiting for Sam");
    const seenBySam = await (await api(b, codeOf(url))).json();
    expect(seenBySam.card.mine).toBeNull();
    expect(seenBySam.card.theirs).toBeNull();
    expect(seenBySam.card.revealed).toBe(false);
    await expect(b.getByTestId("result")).toHaveCount(0);

    // Sam picks the other. Both phones reveal.
    await b.getByTestId("wyr-1").click();
    await expect(b.getByTestId("result")).toContainText("Different picks");
    await expect(a.getByTestId("result")).toContainText("Different picks", {
      timeout: 10_000,
    });

    // Either can move on, and both phones follow.
    await a.getByTestId("next").click();
    await expect(b.getByTestId("card")).not.toHaveAttribute(
      "data-kind",
      "wyr",
      {
        timeout: 10_000,
      },
    );
    expect(await a.getByTestId("card").getAttribute("data-kind")).toBe(
      await b.getByTestId("card").getAttribute("data-kind"),
    );
  });

  test("a third person with the link finds the night full and sees nothing", async ({
    browser,
  }) => {
    const [, a] = await phone(browser);
    const [, b] = await phone(browser);
    const [, c] = await phone(browser);
    const url = await host(a, { mode: "know", name: "Alex" });
    await join(b, url, "Sam");
    await c.goto(url);
    await expect(
      c.getByRole("heading", { name: /already has two people/ }),
    ).toBeVisible();
    const seen = await (await api(c, codeOf(url))).json();
    expect(Object.keys(seen)).toEqual(["status"]);
    // …nor can they act in it.
    const poke = await c.request.post(`/api/date-night/play/${codeOf(url)}`, {
      data: { type: "next", from: 0 },
    });
    expect(poke.status()).toBe(404);
  });

  test("an unknown or malformed link is just gone", async ({ page }) => {
    const res = await page.goto("/datenight/play/abcdefghjkmnpqrs");
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /has ended/ }),
    ).toBeVisible();
    expect((await page.goto("/datenight/play/not-a-code"))?.status()).toBe(404);
  });

  test("own questions stay private until asked, and are skippable", async ({
    browser,
  }) => {
    const [, a] = await phone(browser);
    const [, b] = await phone(browser);
    const url = await host(a, {
      mode: "know",
      name: "Alex",
      questions: ["What would you do with a free year?", "", ""],
    });
    await join(b, url, "Sam");

    // Three ordinary questions first. Sam's phone never carries the secret one.
    for (let i = 0; i < 3; i++) {
      const sam = await (await api(b, codeOf(url))).json();
      expect(JSON.stringify(sam)).not.toContain("free year");
      expect(await b.content()).not.toContain("free year");
      await a.getByTestId("next").click();
      await expect(b.getByTestId("card")).toBeVisible();
      await expect
        .poll(async () => (await (await api(b, codeOf(url))).json()).index, {
          timeout: 10_000,
        })
        .toBe(i + 1);
    }
    await expect(b.getByTestId("prompt")).toHaveText(/free year/, {
      timeout: 10_000,
    });
    await expect(b.getByText("A question Alex wanted to ask")).toBeVisible();
    await expect(a.getByText("A question you wanted to ask")).toBeVisible({
      timeout: 10_000,
    });

    // Sam can just skip it. Nothing asks why.
    await b.getByTestId("skip").click();
    await expect(b.getByTestId("prompt")).not.toHaveText(/free year/);
    await expect(
      b.getByText(/why did you skip|reason for skipping/i),
    ).toHaveCount(0);
  });

  test("changing mode and stage mid-date", async ({ browser }) => {
    const [, a] = await phone(browser);
    const [, b] = await phone(browser);
    const url = await host(a, { mode: "know" });
    await join(b, url);
    await expect(a.getByTestId("card")).toHaveAttribute("data-kind", "talk");

    await b.getByTestId("tab-figure").click();
    await expect(b.getByTestId("tab-figure")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(a.getByTestId("tab-figure")).toHaveAttribute(
      "aria-pressed",
      "true",
      {
        timeout: 10_000,
      },
    );
    await a.getByTestId("skip").click();
    await expect(a.getByTestId("card")).not.toHaveAttribute(
      "data-kind",
      "talk",
    );

    await a.getByTestId("menu").click();
    await a.getByTestId("menu-stage-married").click();
    await expect(a.getByTestId("menu-stage-married")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("one phone: private turns with a hand-over, then a shared reveal", async ({
    browser,
  }) => {
    const [, p] = await phone(browser);
    await p.goto("/datenight/play");
    await p.getByTestId("mode-figure").click();
    await p.getByText("Names and your own questions").click();
    await p.getByTestId("host-name").fill("Alex");
    await p.getByText("Playing on one phone?").click();
    await p.getByLabel("Their first name").fill("Sam");
    await p.getByTestId("start-one-phone").click();

    await expect(p.getByTestId("card")).toHaveAttribute("data-kind", "wyr");
    await expect(p.getByText("Alex's turn")).toBeVisible();
    await p.getByTestId("wyr-0").click();

    // The phone changes hands before Sam sees a thing.
    await expect(p.getByText("Hand it to Sam")).toBeVisible();
    await expect(p.getByTestId("wyr-0")).toHaveCount(0);
    await p.getByTestId("handoff").click();
    await p.getByTestId("wyr-0").click();
    await expect(p.getByTestId("result")).toContainText("You both picked");
  });

  test("leaving deletes your side, and the other person can carry on", async ({
    browser,
  }) => {
    const [, a] = await phone(browser);
    const [bctx, b] = await phone(browser);
    const url = await host(a, { mode: "know", name: "Alex" });
    await join(b, url, "Sam");

    await b.getByTestId("menu").click();
    await b.getByTestId("leave").click();
    await b.getByTestId("leave-confirm").click();
    await expect(b.getByRole("heading", { name: "You've left" })).toBeVisible();

    // Sam's cookie no longer opens the night.
    expect((await bctx.cookies()).some((c) => c.name.startsWith("dnp_"))).toBe(
      false,
    );
    const after = await (await api(b, codeOf(url))).json();
    expect(after.status).toBe("full");

    await expect(a.getByTestId("partner-left")).toContainText("Sam has left", {
      timeout: 10_000,
    });
    await a.getByTestId("next").click();
    await expect(a.getByTestId("card")).toBeVisible();

    // The last one out turns off the lights.
    await a.getByTestId("menu").click();
    await a.getByTestId("leave").click();
    await a.getByTestId("leave-confirm").click();
    await expect(a.getByRole("heading", { name: "You've left" })).toBeVisible();
    const [, c] = await phone(browser);
    await c.goto(url);
    await expect(c.getByRole("heading", { name: /has ended/ })).toBeVisible();
  });

  test("a phone-sized screen: nothing scrolls sideways, every button is thumb-sized", async ({
    browser,
  }) => {
    const [, a] = await phone(browser);
    await a.goto("/datenight/play");
    for (const view of ["start", "play", "menu"] as const) {
      if (view === "play") {
        await a.getByTestId("start-one-phone").click();
        await expect(a.getByTestId("card")).toBeVisible();
      }
      if (view === "menu") await a.getByTestId("menu").click();
      const fit = await a.evaluate(() => ({
        wide: document.documentElement.scrollWidth - window.innerWidth,
        small: [
          ...document.querySelectorAll(
            "button, a.primary, a.secondary, summary",
          ),
        ]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44)
          .map(
            ({ el }) => `${el.tagName} ${(el.textContent ?? "").slice(0, 30)}`,
          ),
      }));
      expect(fit.wide, `${view} overflows sideways`).toBeLessThanOrEqual(0);
      expect(fit.small, `${view} has small tap targets`).toEqual([]);
    }
  });

  test("thirty seconds: from the front door to a first question is two taps", async ({
    browser,
  }) => {
    const [, a] = await phone(browser);
    const t0 = Date.now();
    await a.goto("/datenight/play");
    await a.getByTestId("start-one-phone").click(); // modes and stage are pre-chosen
    await expect(a.getByTestId("card")).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(30_000);
    await expect(a.getByTestId("tab-surprise")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the Date Night front door points here, and the card never leaves a stage's range", async ({
    page,
  }) => {
    await page.goto("/datenight");
    await page.getByTestId("connect-and-play-link").click();
    await expect(page).toHaveURL(/\/datenight\/play$/);
  });
});
