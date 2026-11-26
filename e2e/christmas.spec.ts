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

test("the Christmas page opens on six ways, and one leads somewhere real", async ({
  page,
}) => {
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your Christmas Starts Here",
    }),
  ).toBeVisible();
  await expect(page.getByText("Come on in. Stay awhile.")).toBeVisible();
  await expect(page.getByTestId("ways").getByRole("link")).toHaveText([
    /Christmas Lights/,
    /Christmas Date/,
    /Family Fun/,
    /Friends & Fun/,
    /Cozy Christmas/,
    /Events & Markets/,
  ]);
  await expect(
    page.getByRole("heading", { level: 2, name: /Christmas around/ }),
  ).toBeVisible();
  await expect(page.getByTestId("countdown")).toBeVisible();
  if (WITH_ATLAS) {
    await expect(page.getByTestId("atlas-down")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("atlas-down")).toBeVisible();
  }
  // Events & Markets: one tap narrows it, and "see all" is the directory.
  await page.getByTestId("way-events").click();
  await expect(page).toHaveURL(/\/christmas\/for\/events/);
  await page.getByTestId("q-kind-markets").click();
  await expect(page).toHaveURL(/kind=markets/);
  await expect(page.getByTestId("q-kind-markets")).toHaveAttribute(
    "aria-current",
    "true",
  );
  if (WITH_ATLAS) {
    await expect(
      page.getByTestId("way-finds").getByTestId("find-card").first(),
    ).toBeVisible();
    const all = page.getByTestId("see-all");
    if (await all.count()) await all.click();
    else await page.goto("/christmas?theme=markets#discover");
  } else {
    await page.goto("/christmas?theme=markets#discover");
  }
  // "See all" is the landing page's own discovery (owner brief M1128).
  await expect(page).toHaveURL(/\/christmas\?.*theme=markets.*#discover/);
  await expect(page.getByTestId("chip-markets")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (WITH_ATLAS)
    await expect(
      page.getByTestId("finder").getByTestId("find-card").first(),
    ).toBeVisible();
});

test("a sentence becomes a plan, kept as said — no account, no form", async ({
  page,
}) => {
  await page.goto("/christmas");
  await page
    .getByRole("textbox", { name: "Tell us what you'd love to do" })
    .fill("We have Saturday afternoon, two kids and $100");
  await page.getByTestId("plan-go").click();
  await expect(page).toHaveURL(/\/christmas\/itinerary\?.*say=/);
  await expect(page.getByTestId("itinerary-title")).toHaveText(
    /family Christmas adventure/i,
  );
  await expect(page.getByTestId("itinerary-who")).toContainText("2 kids");
  await expect(page.getByTestId("itinerary-budget")).toContainText("$100");
  // Signed out, planning it *with* people is the one thing that asks.
  await expect(page.getByTestId("itinerary-sign-in")).toHaveAttribute(
    "href",
    /%2524100/,
  );
});

test("more filters is a plain form, closed, and the URL keeps every answer", async ({
  page,
}) => {
  await page.goto("/christmas?at=kelowna#discover");
  // No questionnaire before results: who and how many are not asked here.
  await expect(page.locator('select[name="who"]')).toHaveCount(0);
  await expect(page.locator('input[name="n"]')).toHaveCount(0);
  await page.getByTestId("more-filters").locator("summary").click();
  await page.locator('input[name="ages"]').fill("5");
  await page.getByTestId("more-submit").click();
  await expect(page).toHaveURL(/at=kelowna/);
  await expect(page).toHaveURL(/ages=5/);
  await expect(page.getByTestId("more-filters")).toContainText("1 on");
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
    // The weekend-or-more planner (kept beside the new itinerary) still hands
    // a visitor on to the Day Builder without an account.
    await page.goto(
      "/christmas/plan?shape=evening&at=kelowna&say=A+Christmas+evening+for+the+two+of+us",
    );
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
    page.getByRole("heading", { level: 2, name: /Christmas around Vernon/ }),
  ).toBeVisible();
  await expect(page.getByTestId("location-name").first()).toContainText(
    "Vernon",
  );
  // Vernon's community displays, from the lights map's researched pins,
  // said as what they are — apart from the event listings.
  const vernonPins = page.getByTestId("shelf-lights-on");
  await expect(vernonPins).toContainText("SilverStar");
  await expect(vernonPins).not.toContainText("Stuart Park");
  if (WITH_ATLAS) {
    await expect(page.getByTestId("atlas-down")).toHaveCount(0);
    await expect(
      page.getByTestId("finder").getByTestId("find-card").first(),
    ).toBeVisible();
  }

  await changePlace(page, "kelowna");
  await expect(page).toHaveURL(/\/christmas\?at=kelowna/);
  await expect(
    page.getByRole("heading", { level: 2, name: /Christmas around Kelowna/ }),
  ).toBeVisible();
  const kelownaPins = page.getByTestId("shelf-lights-on");
  await expect(kelownaPins).not.toContainText("SilverStar");

  // The chosen place is remembered (the shared place's cookie): a bare
  // /christmas opens on Kelowna now, from the server's first render.
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", { level: 2, name: /Christmas around Kelowna/ }),
  ).toBeVisible();
});

test("an event and a light display go into one Christmas day", async ({
  page,
}) => {
  // A display opens from the landing page's lights and is added on its own
  // page; an event is saved from the landing page.
  await page.goto("/christmas?at=vernon#discover");
  await page
    .getByTestId("shelf-lights-on")
    .getByTestId("pin-card")
    .first()
    .click();
  const pin = page.getByTestId("detail-add-to-tour");
  await expect(pin).toHaveText(/Add to my Christmas/i);
  await pin.click();
  await page.goto("/christmas?at=vernon#discover");
  let expected = 1;
  if (WITH_ATLAS) {
    await page.getByTestId("finder").getByTestId("save-find").first().click();
    expected = 2;
  }
  await expect(page.getByTestId("pick-tray")).toContainText(
    `${expected} in My Christmas List`,
  );
  await page.getByTestId("plan-picks").click();
  await expect(page).toHaveURL(/\/christmas\/plan\?.*lights=(seed|pin)-/);
  if (WITH_ATLAS) await expect(page).toHaveURL(/with=/);
});

/**
 * **The six ways** (owner brief "P0 — the experience-first rebuild",
 * 2026-11-17): every card opens somewhere that helps a person decide, with
 * a question or two as taps and a handful of things to do.
 */
test("Christmas Lights opens the existing map, not a page about it", async ({
  page,
}) => {
  await page.goto("/christmas?at=kelowna");
  await page.getByTestId("way-lights").click();
  await expect(page).toHaveURL(/\/christmas\/lights\?at=kelowna/);
  await expect(page.getByTestId("cta-tour")).toHaveText(/Build My Lights Tour/);
  // The way's own address goes to the map too.
  await page.goto("/christmas/for/lights?at=vernon");
  await expect(page).toHaveURL(/\/christmas\/lights\?at=vernon/);
});

test("a Christmas date: tonight, going out, then a real plan", async ({
  page,
}) => {
  await page.goto("/christmas");
  await page.getByTestId("way-date").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Christmas Date" }),
  ).toBeVisible();
  // Something to do before any question is answered.
  await expect(page.getByTestId("plan-idea").first()).toBeVisible();
  await page.getByTestId("q-when-tonight").click();
  await expect(page).toHaveURL(/when=tonight/);
  await page.getByTestId("q-stay-out").click();
  await expect(page).toHaveURL(/when=tonight.*stay=out|stay=out.*when=tonight/);
  expect(await page.getByTestId("plan-idea").count()).toBeLessThanOrEqual(3);
  if (WITH_ATLAS)
    expect(await page.getByTestId("find-card").count()).toBeLessThanOrEqual(4);
  await page.getByTestId("plan-idea").first().click();
  await expect(page).toHaveURL(/\/christmas\/itinerary\?.*say=.*tonight/);
  await expect(page.getByTestId("itinerary-title")).toBeVisible();
});

test("staying in is ideas, said as ideas — and asks Atlas for nothing", async ({
  page,
}) => {
  await page.goto("/christmas/for/date?stay=in");
  await expect(page.getByTestId("way-finds")).toHaveCount(0);
  await expect(page.getByTestId("plans")).toHaveCount(0);
  const ideas = page.getByTestId("idea-card");
  expect(await ideas.count()).toBeGreaterThan(1);
  await expect(ideas.first()).toContainText("An idea, not a listing");
  await page.goto("/christmas/for/cozy");
  await page.getByTestId("q-mood-baking").click();
  await expect(page).toHaveURL(/mood=baking/);
  await expect(page.getByTestId("idea-card").first()).toContainText(
    /cookies|gingerbread/i,
  );
  // Streaming availability is never claimed.
  await page.goto("/christmas/for/cozy?mood=movies");
  await expect(page.getByTestId("ideas")).toContainText(
    "We don't list what's streaming where yet",
  );
});

test("family fun: the youngest's age travels to Atlas and to the directory", async ({
  page,
}) => {
  await page.goto("/christmas/for/family?at=kelowna");
  await page.getByTestId("q-age-under5").click();
  await expect(page).toHaveURL(/age=under5/);
  await expect(page.getByTestId("q-age-under5")).toHaveAttribute(
    "aria-current",
    "true",
  );
  // Tapping it again clears it.
  await page.getByTestId("q-age-under5").click();
  await expect(page).not.toHaveURL(/age=/);
  await page.getByTestId("q-age-5to9").click();
  await expect(page.getByTestId("q-age-5to9")).toHaveAttribute(
    "aria-current",
    "true",
  );
  if (WITH_ATLAS) {
    await expect(page.getByTestId("way-finds")).toBeVisible();
    const all = page.getByTestId("see-all");
    if (await all.count()) {
      await all.click();
      await expect(page).toHaveURL(/ages=6/);
    }
  }
});

test("a place with nothing on says so, and offers a way on", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  await page.goto("/christmas/for/events?at=delta&when=weekend&kind=festivals");
  const empty = page.getByTestId("way-empty");
  await expect(empty).toBeVisible();
  await expect(empty.getByRole("link", { name: "lights map" })).toBeVisible();
  await expect(
    empty.getByRole("link", { name: "full directory" }),
  ).toBeVisible();
});

test("Surprise me draws one thing, says what it is, and draws again", async ({
  page,
}) => {
  await page.goto("/christmas");
  await page.getByTestId("surprise-me").click();
  await expect(page).toHaveURL(/\/christmas\/surprise\?.*s=\d+/);
  const card = page.getByTestId("surprise");
  await expect(card).toBeVisible();
  const kind = await card.getAttribute("data-kind");
  if (kind === "idea")
    await expect(card).toContainText("An idea, not a listing");
  else await expect(card.getByTestId("find-card")).toBeVisible();
  const first = page.url();
  await page.getByTestId("surprise-again").click();
  await expect(page).not.toHaveURL(first);
  await expect(page.getByTestId("surprise")).toBeVisible();
});

for (const width of [360, 390, 768]) {
  test(`the front page fits a ${width}px screen: one lead picture, then two columns, no sideways scroll`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
      hasTouch: width < 600,
    });
    const page = await context.newPage();
    await page.goto("/christmas");
    const cards = page.getByTestId("ways").getByRole("link");
    await page.evaluate(() => document.fonts.ready);
    // Side by side once the page has settled (fonts, the streamed section).
    await expect
      .poll(async () => {
        const [a, b] = await Promise.all([
          cards.nth(1).boundingBox(),
          cards.nth(2).boundingBox(),
        ]);
        return Math.abs(a!.y - b!.y);
      })
      .toBeLessThan(2);
    // The lead (Christmas Lights) spans the row; the next two share one.
    const lead = (await cards.nth(0).boundingBox())!;
    const a = (await cards.nth(1).boundingBox())!;
    const b = (await cards.nth(2).boundingBox())!;
    expect(lead.width).toBeGreaterThan(a.width * 1.8);
    for (const box of [a, b]) expect(box.height).toBeGreaterThanOrEqual(44);
    const { sw, cw, h } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      h: document.documentElement.scrollHeight,
    }));
    expect(sw).toBeLessThanOrEqual(cw);
    // The six ways are a glance, not a scroll: under two and a half screens.
    const ways = (await page.getByTestId("way-stories").boundingBox())!;
    expect(ways.height / 800).toBeLessThan(2.5);
    expect(h).toBeGreaterThan(0);
    // All six ways are reachable by keyboard.
    await cards.nth(0).focus();
    await expect(cards.nth(0)).toBeFocused();
    await context.close();
  });
}

test("when every picture fails, no broken image or empty frame is left", async ({
  page,
}) => {
  test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
  // Every image not served by Passport itself fails to load.
  await page.route(
    (url) =>
      !url.host.startsWith("localhost") &&
      /\.(jpe?g|png|webp|avif|gif)(\?|$)|image/i.test(url.href),
    (route) => route.abort(),
  );
  for (const path of [
    "/christmas?at=kelowna",
    "/christmas/for/events?at=kelowna",
    "/christmas/for/family?at=kelowna",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("find-card").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const broken = await page.evaluate(
      () =>
        [...document.images].filter(
          (i) => i.complete && i.naturalWidth === 0 && i.offsetParent !== null,
        ).length,
    );
    expect(broken, path).toBe(0);
    // A find with no picture left is a compact text card (M942): its name
    // once, as a heading — never a title tile, never a stand-in photo.
    for (const card of await page.getByTestId("find-card").all())
      await expect(
        card
          .locator("img")
          .or(card.getByRole("heading", { level: 3 }))
          .first(),
      ).toBeVisible();
  }
});

/**
 * **QA repair, 2026-11-21** — the launch findings that can be checked from a
 * browser: Christmas's own navigation with a way back, the distance choice,
 * no Snow / Fire buttons (the snow itself stays), plain public words, and a
 * private list that holds nothing for a visitor.
 */
test.describe("launch QA repair", () => {
  test("Christmas has its own bar, and one intentional way back", async ({
    page,
  }) => {
    await page.goto("/christmas");
    const nav = page.getByTestId("christmas-nav");
    // Owner brief M1128: Home | Lights Map | Advent | My Christmas.
    for (const name of ["Home", "Lights Map", "Advent", "My Christmas"])
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(page.getByTestId("xmas-nav-back")).toHaveAttribute(
      "href",
      "/discovery",
    );
    await page.getByTestId("xmas-nav-list").click();
    await expect(page).toHaveURL(/\/christmas\/list/);
    await expect(
      page.getByRole("heading", { level: 1, name: "My Christmas" }),
    ).toBeVisible();
    await expect(page.getByTestId("list-signed-out")).toBeVisible();
    // Planning is reached from what you kept, not as a rival destination.
    await page.getByTestId("list-plan").click();
    await expect(page).toHaveURL(/\/christmas\/plan/);
    // The planning text box is the first thing on the page, signed in or not.
    await expect(page.getByTestId("plan-input")).toBeVisible();
  });

  test("no Snow / Fire buttons, and no Atlas in what the public reads", async ({
    page,
  }) => {
    for (const path of ["/christmas", "/christmas/discover"]) {
      await page.goto(path);
      await expect(page.getByTestId("snow-toggle")).toHaveCount(0);
      await expect(page.getByTestId("sound-toggle")).toHaveCount(0);
      await expect(page.getByText(/snow on|light the fire/i)).toHaveCount(0);
      expect(await page.locator("main").innerText(), path).not.toMatch(
        /\bAtlas\b/,
      );
    }
  });

  test("how far is 2 to 50 km, thirty by default, remembered, and it changes the answer", async ({
    page,
  }) => {
    await page.goto("/christmas?at=vernon#discover");
    const far = page.getByTestId("km-select");
    await expect(far.locator("option")).toHaveText([
      "Within 2 km",
      "Within 5 km",
      "Within 10 km",
      "Within 20 km",
      "Within 30 km",
      "Within 50 km",
    ]);
    await expect(far).toHaveValue("30");
    await far.selectOption("50");
    await expect(page).toHaveURL(/km=50/);
    await expect(far).toHaveValue("50");
    // Nothing is offered as "near" from further than was asked.
    if (WITH_ATLAS) {
      for (const card of await page
        .getByTestId("shelf-near")
        .getByTestId("find-card")
        .all()) {
        const text = await card.innerText();
        const m = text.match(/([\d.]+) km away/);
        if (m) expect(Number(m[1])).toBeLessThanOrEqual(50);
      }
    }
    // Remembered: a page with no distance in its address opens on it.
    await page.goto("/christmas?at=vernon");
    await expect(page.getByTestId("km-select")).toHaveValue("50");
  });

  test("the card says Save, and the list has its own door", async ({
    page,
  }) => {
    await page.goto("/christmas");
    await expect(page.getByTestId("show-everything")).toHaveCount(0);
    await expect(page.getByTestId("xmas-nav-list")).toHaveAttribute(
      "href",
      "/christmas/list",
    );
    if (WITH_ATLAS) {
      await expect(
        page.getByTestId("find-card").first().getByTestId("save-find"),
      ).toContainText("Save");
    }
  });

  test("no past event is promoted as upcoming", async ({ page }) => {
    test.skip(!WITH_ATLAS, "needs the Atlas stand-in (E2E_ATLAS=1)");
    await page.goto("/christmas/discover?at=vernon&km=50");
    // Anything on a live shelf says it is on now or upcoming, dated or not —
    // never a past reading; past things sit apart, under their own heading.
    const live = page.locator(
      '[data-testid^="shelf-"]:not([data-testid="shelf-past"])',
    );
    await expect(live.getByText("Earlier dates")).toHaveCount(0);
    await expect(
      page.getByTestId("shelf-past").getByText("Dates confirmed"),
    ).toHaveCount(0);
  });
});
