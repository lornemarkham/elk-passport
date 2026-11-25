import { expect, test } from "@playwright/test";

/**
 * **Christmas cards open the event, and Save is one thing** (owner brief
 * M1117). Runs against the M1042 Atlas stand-in:
 *
 *   node scripts/critic/atlas-mock.mjs e2e/fixtures/christmas-events/m1042-placed.json 3146 &
 *   ATLAS_API_URL=http://127.0.0.1:3146 … next start -p 3120
 *   E2E_CHRISTMAS_EVENTS=1 E2E_PORT=3120 npx playwright test e2e/christmas-event-page.spec.ts
 */
test.skip(
  process.env.E2E_CHRISTMAS_EVENTS !== "1",
  "needs the M1042 Atlas stand-in (see the header)",
);

const DISCOVER = "/christmas/discover?at=vernon&km=50&all=near";

test("the whole card opens the event; its buttons do not", async ({ page }) => {
  await page.goto(DISCOVER);
  const card = page.getByTestId("find-card").first();
  const title = (await card.getByTestId("find-title").innerText()).trim();
  await expect(card).not.toContainText("Details & source");
  await expect(card).not.toContainText("Add to My Christmas List");
  await expect(card.getByTestId("find-details")).toHaveText(/View event/);

  // A bare patch of the card (right of the badge row, or the picture) opens the event.
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  await page.mouse.click(box.x + box.width - 24, box.y + 30);
  await expect(page).toHaveURL(/\/christmas\/event\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // The Christmas bar stays.
  await expect(page.getByTestId("christmas-nav")).toBeVisible();

  // Save does not navigate.
  await page.goto(DISCOVER);
  const first = page.getByTestId("find-card").first();
  await first.getByTestId("save-find").click();
  await expect(page).toHaveURL(/\/christmas\/discover/);
});

test("Save is one action: Saved, and tapping again removes it", async ({
  page,
}) => {
  await page.goto(DISCOVER);
  const card = page.getByTestId("find-card").first();
  const save = card.getByTestId("save-find");
  await expect(save).toHaveText("Save");
  await save.click();
  await expect(save).toHaveText("Saved");
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pick-tray")).toContainText(
    "1 in My Christmas List",
  );
  await page.goto("/christmas/list");
  await expect(page.getByTestId("list-added-item")).toHaveCount(1);
  await page.goto(DISCOVER);
  const again = page.getByTestId("find-card").first().getByTestId("save-find");
  await expect(again).toHaveText("Saved");
  await again.click();
  await expect(again).toHaveText("Save");
  await expect(page.getByTestId("pick-tray")).toHaveCount(0);
});

test("every event link on the page opens a real event page", async ({
  page,
}) => {
  await page.goto(DISCOVER);
  const hrefs = await page
    .getByTestId("find-details")
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  expect(hrefs.length).toBeGreaterThan(5);
  for (const href of new Set(hrefs)) {
    expect(href).toMatch(/^\/christmas\/event\/[0-9a-f-]{36}$/);
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
    const html = await res.text();
    expect(html, href).toContain('data-testid="event-page"');
  }
});

test("the event page: facts, Save, directions, and provenance folded away", async ({
  page,
}) => {
  await page.goto("/christmas/event/1c99bcd7-3ff4-45ea-b8f9-e7ed67f177aa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Frostival 2026 Downtown Vernon",
  );
  await expect(page.getByTestId("event-facts")).toContainText("Nov 27");
  await expect(page.getByTestId("event-where")).toContainText("Vernon");
  await expect(page.getByTestId("event-description")).toContainText(
    "free street festival",
  );
  await expect(page.getByTestId("event-directions")).toBeVisible();
  const provenance = page.getByTestId("event-provenance");
  await expect(provenance).not.toHaveAttribute("open", "");
  await provenance.locator("summary").click();
  await expect(provenance).toContainText("Where this comes from");
  const save = page.getByTestId("save-event");
  await save.click();
  await expect(save).toContainText("Saved");
  await save.click();
  await expect(save).toHaveText("Save");
  // No sideways scroll on a phone.
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(wide).toBe(false);
});
