import { expect, test } from "@playwright/test";

/**
 * **Come on in. Stay awhile.** — the Christmas hero (owner brief M1127).
 * It asks nothing: no links, no fields, no place or distance. Two small
 * buttons only — the fire's sound, off until asked, and a pause. One verse
 * at a time, and nothing on the page moves when they change.
 */

test("the hero asks nothing, and the choices wait below it", async ({
  page,
}) => {
  await page.goto("/christmas?at=vernon");
  const hearth = page.getByTestId("hearth");
  await expect(
    hearth.getByRole("heading", {
      level: 1,
      name: "Your Christmas Starts Here",
    }),
  ).toBeVisible();
  await expect(hearth.getByText("Come on in. Stay awhile.")).toBeVisible();
  await expect(hearth.getByTestId("countdown")).toContainText(
    /sleep|Christmas|New Year/,
  );
  await expect(page.getByTestId("bethlehem")).toBeAttached();
  await expect(hearth.getByRole("link")).toHaveCount(0);
  await expect(hearth.locator("input, select, textarea")).toHaveCount(0);
  await expect(hearth.getByRole("button")).toHaveCount(2);
  // Everything that used to be up here is kept, just below.
  const ready = page.getByTestId("ready");
  for (const id of [
    "pill-advent",
    "pill-new-year",
    "entry-lights",
    "entry-tonight",
    "entry-plan",
  ])
    await expect(ready.getByTestId(id)).toBeAttached();
  await expect(ready.getByTestId("location-change").first()).toBeAttached();
  // The sound is off until somebody asks for it.
  await expect(page.getByTestId("hearth-sound")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("hearth-sound")).toHaveAccessibleName(
    "Hear the fire",
  );
  // Nothing scrolls sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the verses fade one to the next without moving the page, and pause", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __shift: number }).__shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!e.hadRecentInput)
          (window as unknown as { __shift: number }).__shift += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/christmas?at=vernon");
  const verse = page.getByTestId("verse").locator("[data-on]");
  await expect(verse).toContainText("Come on in. Stay awhile.");
  await expect(verse).toContainText("All is calm, all is bright.", {
    timeout: 12_000,
  });
  await expect(verse).toContainText("Silent Night");
  const shift = await page.evaluate(
    () => (window as unknown as { __shift: number }).__shift,
  );
  expect(shift).toBeLessThan(0.02);
  await page.getByTestId("hearth-pause").click();
  await expect(page.getByTestId("hearth-pause")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(8_000);
  await expect(verse).toContainText("All is calm, all is bright.");
});

test.describe("reduced motion", () => {
  test("a still room: one verse, no pause needed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/christmas?at=vernon");
    await expect(page.getByTestId("hearth")).toHaveAttribute("data-still", "");
    await expect(page.getByTestId("hearth-pause")).toHaveCount(0);
    await page.waitForTimeout(8_000);
    await expect(page.getByTestId("verse").locator("[data-on]")).toContainText(
      "Come on in. Stay awhile.",
    );
  });
});
