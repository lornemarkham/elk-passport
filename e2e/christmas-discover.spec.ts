import { expect, test, type Page } from "@playwright/test";

/**
 * **Christmas discovery** — the owner's acceptance tests A–H (2026-11-22),
 * carried onto the one landing page by owner brief M1128 ("One Beautiful
 * Experience"): WHERE | WHEN | HOW FAR said once, categories several at a
 * time and changed in place, a "tonight" that means tonight, and a search
 * origin that can be somewhere other than home. With `E2E_ATLAS=1` an Atlas
 * stand-in serves real listings; without it only the controls are checked.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

/** What the Everything chip says the page holds. */
const count = async (page: Page) =>
  Number(
    ((await page.getByTestId("chip-all").innerText()).match(/(\d+)\s*$/) ??
      [])[1],
  );

async function pickPlace(page: Page, id: string, onlyHere = false) {
  await page.getByTestId("location-change").first().click();
  await expect(page.getByTestId("location-picker")).toBeVisible();
  if (onlyHere) await page.getByTestId("location-only-here").check();
  await page.getByTestId("location-search").fill(id.replace(/-/g, " "));
  await page.getByTestId(`location-option-${id}`).click();
  await expect(page.getByTestId("location-picker")).toHaveCount(0);
}

test("the old Discover address opens the landing page's discovery, query and all", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon&theme=markets&all=near");
  await expect(page).toHaveURL(
    /\/christmas\?at=vernon&theme=markets#discover$/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around/ }),
  ).toBeAttached();
  await expect(page.getByTestId("chip-markets")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("A — Vernon: nearby Christmas, under three plain controls", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon#discover");
  await expect(page.getByTestId("control-where")).toContainText("Vernon");
  await expect(page.getByTestId("when-select")).toHaveValue("any");
  await expect(page.getByTestId("km-select")).toHaveValue("30");
  // No questionnaire; the optional filters are closed.
  await expect(page.getByTestId("more-filters")).not.toHaveAttribute(
    "open",
    "",
  );
  // The technical account of the list is there, on demand only.
  await expect(page.getByTestId("how-we-chose")).not.toHaveAttribute(
    "open",
    "",
  );
  if (WITH_ATLAS) {
    await expect(
      page.getByTestId("finder").getByTestId("find-card").first(),
    ).toBeVisible();
  }
});

test("B, C — categories are several at once, change in place, and keep the date", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon#discover");
  await expect(page.getByTestId("chip-all")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (!WITH_ATLAS) return;
  const open = page.locator(
    '[data-testid="categories"] button[data-testid^="chip-"]:not([data-testid="chip-all"])',
  );
  const ids = (
    await open.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid")!),
    )
  ).slice(0, 2);
  expect(ids.length).toBe(2);
  // Every chip offered has something in it.
  for (const chip of await open.all())
    expect(
      Number((await chip.innerText()).match(/(\d+)\s*$/)![1]),
    ).toBeGreaterThan(0);

  const navigations: string[] = [];
  page.on("request", (r) => {
    const h = r.headers();
    if (r.isNavigationRequest() || (h["rsc"] && !h["next-router-prefetch"]))
      navigations.push(r.url());
  });
  await page.getByTestId(ids[0]!).click();
  await page.getByTestId(ids[1]!).click();
  const both = ids.map((i) => i.replace("chip-", "")).join(",");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("theme"))
    .toBe(both);
  for (const id of ids)
    await expect(page.getByTestId(id)).toHaveAttribute("aria-pressed", "true");
  // Changed in the hand: no trip back to the server.
  expect(navigations).toEqual([]);
  // Un-choosing one keeps the other.
  await page.getByTestId(ids[0]!).click();
  await expect(page.getByTestId(ids[1]!)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("chip-all").click();
  await expect(page).not.toHaveURL(/theme=/);
});

test("C, D — Vernon tonight shows only what's confirmed; Any date widens it", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon#discover");
  const any = WITH_ATLAS ? await count(page) : 0;
  await page.getByTestId("when-select").selectOption("tonight");
  await expect(page).toHaveURL(/when=tonight/);
  await expect(page.getByTestId("when-select")).toHaveValue("tonight");
  if (WITH_ATLAS) {
    const tonight = await count(page);
    for (const badge of await page
      .getByTestId("finder")
      .getByTestId("find-confidence")
      .all())
      await expect(badge).toHaveText(/On now/);
    await expect(page.getByTestId("shelf-maybe")).toHaveCount(0);
    await page.getByTestId("when-select").selectOption("any");
    await expect(page).not.toHaveURL(/when=/);
    await expect.poll(() => count(page)).toBe(any);
    expect(any).toBeGreaterThanOrEqual(tonight);
  } else {
    await page.getByTestId("when-select").selectOption("any");
    await expect(page).not.toHaveURL(/when=/);
  }
});

test("E — a Port Moody resident searches around Downtown Vancouver within 5 km", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon#discover");
  await pickPlace(page, "port-moody");
  await expect(page).toHaveURL(/at=port-moody/);
  await pickPlace(page, "downtown-vancouver", true);
  await expect(page).toHaveURL(/at=downtown-vancouver/);
  await expect(page.getByTestId("location-bar").first()).toContainText(
    "just for Christmas",
  );
  await page.getByTestId("km-select").selectOption("5");
  await expect(page).toHaveURL(/km=5/);
  await expect(page.getByTestId("discover")).toContainText(
    "Christmas around Downtown Vancouver",
  );
  if (WITH_ATLAS) {
    for (const card of await page
      .getByTestId("shelf-near")
      .getByTestId("find-card")
      .all()) {
      const m = (await card.innerText()).match(/([\d.]+) km away/);
      if (m) expect(Number(m[1])).toBeLessThanOrEqual(5);
    }
  }
});

test("F — a wider radius finds at least as much", async ({ page }) => {
  const counts: number[] = [];
  for (const km of ["2", "10", "50"]) {
    await page.goto(`/christmas?at=vernon&km=${km}#discover`);
    await expect(page.getByTestId("km-select")).toHaveValue(km);
    await expect(page.getByTestId("chip-all")).toBeVisible();
    counts.push(await count(page));
  }
  if (WITH_ATLAS) {
    expect(counts[0]).toBeLessThanOrEqual(counts[1]!);
    expect(counts[1]).toBeLessThanOrEqual(counts[2]!);
  }
});

test.describe("G — on a phone", () => {
  test.use({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  test("the three controls fit, with no sideways scroll", async ({ page }) => {
    await page.goto("/christmas?at=vernon&when=tonight#discover");
    for (const id of ["control-where", "control-when", "control-far"])
      await expect(page.getByTestId(id)).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("H — Discover, My Christmas and the Lights Map are one tap apart", async ({
  page,
}) => {
  await page.goto("/christmas/list");
  await expect(page.getByTestId("xmas-nav-list")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goto("/christmas/lights?at=vernon");
  await expect(page.getByTestId("christmas-nav")).toBeVisible();
  await page.getByTestId("xmas-nav-home").click();
  await expect(page).toHaveURL(/\/christmas(\?|$)/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Christmas around/ }),
  ).toBeVisible();
});
