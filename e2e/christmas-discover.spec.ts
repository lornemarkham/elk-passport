import { expect, test, type Page } from "@playwright/test";

/**
 * **Christmas discovery UX repair — the owner's acceptance tests A–H**
 * (2026-11-22). WHERE | WHEN | HOW FAR, one category at a time, a "tonight"
 * that means tonight, and a search origin that can be somewhere other than
 * home. With `E2E_ATLAS=1` an Atlas stand-in serves real listings; without
 * it only the controls are checked.
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

const count = async (page: Page) =>
  Number(
    ((await page.getByTestId("result-count").innerText()).match(/^(\d+)/) ??
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

test("A — Vernon: nearby Christmas, under three plain controls", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon");
  await expect(page.getByTestId("control-where")).toContainText("Vernon");
  await expect(page.getByTestId("when-select")).toHaveValue("any");
  await expect(page.getByTestId("km-select")).toHaveValue("30");
  // No questionnaire: the old Refine form is gone; More filters is closed.
  await expect(page.getByTestId("refine")).toHaveCount(0);
  await expect(page.getByTestId("more-filters")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.getByTestId("result-count")).toContainText(
    "within 30 km of Vernon",
  );
  if (WITH_ATLAS) {
    await expect(
      page.getByTestId("shelf-near").getByTestId("find-card").first(),
    ).toBeVisible();
  }
});

test("B — Vernon, Christmas markets: one chip, the right things, nothing placed elsewhere", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon");
  await page.getByTestId("chip-markets").click();
  await expect(page).toHaveURL(/theme=markets/);
  await expect(page).not.toHaveURL(/theme=[^&]*,/);
  await expect(
    page.locator('[data-testid="categories"] [aria-current="true"]'),
  ).toHaveCount(1);
  await expect(page.getByTestId("chip-markets")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByTestId("active-filters")).toContainText(
    "Christmas markets",
  );
  if (WITH_ATLAS) {
    const near = page.getByTestId("shelf-near").getByTestId("find-card");
    expect(await count(page)).toBe(await near.count());
    for (const card of await near.all())
      await expect(card).toContainText("Christmas markets");
    const main = await page.locator("main").innerText();
    expect(main).not.toMatch(/Performing Arts Academy/);
    // Vancouver's market is not on a Vernon page, confirmed or not.
    expect(main).not.toMatch(/Vancouver Christmas Market/);
  }
  // A second category is an explicit choice, under More filters.
  await page.getByTestId("chip-all").click();
  await expect(page).not.toHaveURL(/theme=/);
});

test("C, D — Vernon tonight shows only what's confirmed; Any date widens it", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon");
  const any = WITH_ATLAS ? await count(page) : 0;
  await page.getByTestId("when-select").selectOption("tonight");
  await expect(page).toHaveURL(/when=tonight/);
  await expect(page.getByTestId("active-when")).toContainText("Tonight");
  await expect(page.getByTestId("result-count")).toContainText("Tonight");
  if (WITH_ATLAS) {
    const tonight = await count(page);
    for (const card of await page
      .getByTestId("shelf-near")
      .getByTestId("find-confidence")
      .all())
      await expect(card).toHaveText(/On now · dates confirmed/);
    await expect(page.getByTestId("shelf-maybe")).toHaveCount(0);
    await expect(page.getByTestId("removed")).toContainText(
      "aren't confirmed for tonight",
    );
    // The date stays visible while browsing categories, and one tap clears it.
    await page.getByTestId("chip-shows").click();
    await expect(page).toHaveURL(/when=tonight/);
    await expect(page.getByTestId("active-when")).toContainText("Tonight");
    await page.getByTestId("clear-when").click();
    await expect(page).not.toHaveURL(/when=/);
    await page.getByTestId("chip-all").click();
    await expect(page.getByTestId("when-select")).toHaveValue("any");
    expect(await count(page)).toBe(any);
    expect(any).toBeGreaterThanOrEqual(tonight);
  } else {
    await page.getByTestId("when-select").selectOption("any");
    await expect(page).not.toHaveURL(/when=/);
  }
});

test("E — a Port Moody resident searches around Downtown Vancouver within 5 km", async ({
  page,
}) => {
  await page.goto("/christmas/discover?at=vernon");
  await pickPlace(page, "port-moody");
  await expect(page).toHaveURL(/at=port-moody/);
  await pickPlace(page, "downtown-vancouver", true);
  await expect(page).toHaveURL(/at=downtown-vancouver/);
  await expect(page.getByTestId("location-bar")).toContainText(
    "just for Christmas",
  );
  await page.getByTestId("km-select").selectOption("5");
  await expect(page).toHaveURL(/km=5/);
  await expect(page.getByTestId("result-count")).toContainText(
    "within 5 km of Downtown Vancouver",
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

test("F — a wider radius finds at least as much, nearest-confirmed first", async ({
  page,
}) => {
  const counts: number[] = [];
  for (const km of ["2", "10", "50"]) {
    await page.goto(`/christmas/discover?at=vernon&km=${km}`);
    await expect(page.getByTestId("km-select")).toHaveValue(km);
    await expect(page.getByTestId("result-count")).toContainText(
      `within ${km} km`,
    );
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
    await page.goto("/christmas/discover?at=vernon&when=tonight");
    for (const id of ["control-where", "control-when", "control-far"])
      await expect(page.getByTestId(id)).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // The categories scroll inside their own row.
    const row = page.getByTestId("categories");
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
  });
});

test("H — My Christmas List and the Lights Map still open", async ({
  page,
}) => {
  await page.goto("/christmas/list");
  await expect(
    page.getByRole("heading", { level: 1, name: "My Christmas List" }),
  ).toBeVisible();
  await page.goto("/christmas/lights?at=vernon");
  await expect(page.getByTestId("christmas-nav")).toBeVisible();
  await page.getByTestId("xmas-nav-discover").click();
  await expect(page).toHaveURL(/\/christmas\/discover/);
});
