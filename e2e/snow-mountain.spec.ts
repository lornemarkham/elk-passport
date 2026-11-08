import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { parseConditions } from "../src/domain/snow/conditions";

/**
 * **The mountain companion, on a phone with gloves.**
 *
 * Start → conditions (mocked here: the real service is exercised by the
 * route's own unit test with a recorded answer, and a spec must not depend
 * on someone else's uptime) → big-button actions → lunch → heading out →
 * après vote → done → recap. Plus the failure paths: no forecast at all, and
 * a forecast that was fine once and then the signal went.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "app",
      "snow",
      "_server",
      "fixtures",
      "open-meteo-whistler-2026-11-07.json",
    ),
    "utf8",
  ),
);

/** The fixture's days, moved so "today" is the first one, as the route would. */
function conditionsBody(fetchedAt = new Date().toISOString()) {
  const start = new Date();
  const ymd = (offset: number) => {
    const d = new Date(start.getTime() + offset * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const daily = {
    ...FIXTURE.daily,
    time: FIXTURE.daily.time.map((_: string, i: number) => ymd(i)),
    sunrise: FIXTURE.daily.sunrise.map(
      (_: string, i: number) => `${ymd(i)}T08:12`,
    ),
    sunset: FIXTURE.daily.sunset.map(
      (_: string, i: number) => `${ymd(i)}T17:38`,
    ),
  };
  daily.temperature_2m_min[0] = -12;
  daily.snowfall_sum[0] = 8;
  daily.weather_code[0] = 73;
  return {
    conditions: parseConditions({ ...FIXTURE, daily }, fetchedAt),
  };
}

async function newDayOnCypress(page: Page, title: string) {
  await page.goto("/snow/new");
  await page.getByLabel("Name the day").fill(title);
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Skiing" }).click();
  await page.getByRole("button", { name: "Intermediate" }).click();
  await page.getByRole("button", { name: "Create the day" }).click();
  await expect(page.getByTestId("day-title")).toHaveText(title);
  await page
    .getByLabel("Add a mountain from Passport's list")
    .selectOption({ label: "Cypress Mountain" });
  await page
    .getByTestId("topic-mountain")
    .getByRole("button", { name: "Lock it in" })
    .click();
}

test("start the day, use it with gloves, finish it, relive it", async ({
  page,
}) => {
  await page.route("**/snow/api/conditions*", (r) =>
    r.fulfill({ json: conditionsBody() }),
  );
  await newDayOnCypress(page, "Gloves Day");

  // Plan shows the sky for the chosen mountain, honestly labelled.
  await expect(page.getByTestId("conditions")).toContainText(
    "Cypress Mountain",
  );
  await expect(page.getByTestId("conditions")).toContainText("Open-Meteo");
  await expect(page.getByTestId("conditions")).toContainText(
    "not a reading from the hill",
  );

  await page.getByRole("tab", { name: "On the hill" }).click();
  await expect(page.getByTestId("start")).toBeVisible();
  const startBtn = page.getByTestId("start-day");
  await expect(startBtn).toHaveText(/start your snow day/i);
  // Glove-sized: 64 px or more.
  expect((await startBtn.boundingBox())!.height).toBeGreaterThanOrEqual(60);
  await startBtn.click();

  await expect(page.getByTestId("companion")).toBeVisible();
  await expect(page.getByTestId("elapsed")).toBeVisible();
  for (const id of ["big-where", "big-lunch", "big-last-run", "big-leave"]) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(60);
    expect(box.width).toBeGreaterThanOrEqual(120);
  }
  // It remembers it was started.
  await page.reload();
  await page.getByRole("tab", { name: "On the hill" }).click();
  await expect(page.getByTestId("companion")).toBeVisible();

  // Where am I: one tap, in words.
  await page.getByTestId("big-where").click();
  await page
    .getByTestId("panel-where")
    .getByRole("button", { name: "Lift base" })
    .click();
  await page.getByRole("tab", { name: "On the hill" }).click();
  await expect(page.getByTestId("my-checkin")).toContainText("Lift base");

  // Lunch: a time, told to the crew.
  await page.getByTestId("big-lunch").click();
  await page
    .getByTestId("panel-lunch")
    .getByRole("button", { name: "12:30" })
    .click();
  await expect(page.getByTestId("sent")).toContainText("Lunch at 12:30");

  // Last run is the ritual, never a race.
  await page.getByTestId("big-last-run").click();
  await expect(page.getByTestId("sent")).toContainText(
    "Everyone down together",
  );

  // Heading out: leave time + suggest/vote an après place.
  await page.getByTestId("big-leave").click();
  await page
    .getByTestId("panel-leave")
    .getByRole("button", { name: "30 min" })
    .click();
  await expect(page.getByTestId("sent")).toContainText(
    "leaving the hill around",
  );
  await page.getByLabel("Suggest après").fill("Pub on Lonsdale");
  await page
    .getByTestId("topic-apres")
    .getByRole("button", { name: "Suggest" })
    .click();
  await page
    .getByTestId("topic-apres")
    .getByRole("button", { name: "Vote" })
    .click();
  await expect(page.getByTestId("topic-apres")).toContainText("LEADING");

  await page.getByTestId("end-day").click();
  await expect(page.getByTestId("companion")).toContainText("Day's done");
  await page.getByRole("button", { name: "Open the recap" }).click();
  await expect(page.getByTestId("recap")).toContainText("Gloves Day");
  await page.getByRole("tab", { name: "On the hill" }).click();
  await expect(
    page.getByRole("link", { name: "Plan another snow day" }),
  ).toBeVisible();
});

test("no forecast is said, never filled in", async ({ page }) => {
  await page.route("**/snow/api/conditions*", (r) =>
    r.fulfill({ status: 502, json: { error: "unreachable" } }),
  );
  await newDayOnCypress(page, "Quiet Day");
  await expect(page.getByTestId("conditions-failed")).toContainText(
    "Couldn't reach the forecast",
  );
  await expect(page.getByTestId("conditions-day")).toHaveCount(0);
});

test("a forecast that was fine keeps showing, marked old, when the signal goes", async ({
  page,
  context,
}) => {
  const old = new Date(Date.now() - 3 * 3600_000).toISOString();
  let fail = false;
  await page.route("**/snow/api/conditions*", (r) =>
    fail
      ? r.abort("connectionfailed")
      : r.fulfill({ json: conditionsBody(old) }),
  );
  await newDayOnCypress(page, "Chairlift Day");
  await expect(page.getByTestId("conditions")).toContainText("3 h ago");
  fail = true;
  await context.setOffline(true);
  await page.getByRole("tab", { name: "Get ready" }).click();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByTestId("conditions")).toContainText(
    "No signal right now",
  );
  await expect(page.getByTestId("conditions")).toContainText("3 h ago");
  await context.setOffline(false);
});
