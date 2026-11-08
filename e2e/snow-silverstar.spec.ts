import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * **SilverStar, opening weekend, four people — the mission's acceptance
 * scenario, end to end.**
 *
 * Needs an Atlas answering: run with the SilverStar slice of production
 * Atlas (2026-11-08) behind `scripts/critic/atlas-mock.mjs` and
 * `E2E_ATLAS=1` (see docs/product/snow/ALIVE.md §6). The resort facts are
 * the ones published on skisilverstar.com and recorded with their check
 * date; the clock is pinned to that date so "opening weekend" is ahead.
 */

const SHOTS = path.join(
  __dirname,
  "..",
  "docs",
  "product",
  "snow",
  "screenshots",
);
const SENTENCE =
  "We're going to SilverStar opening weekend. Four people. Two skiers, one snowboarder and someone who doesn't ski. Make us an awesome day.";

async function card(page: Page, key: string) {
  const c = page.getByTestId(`card-${key}`);
  if ((await c.getAttribute("aria-expanded")) !== "true") await c.click();
  return page.locator(`#card-panel-${key}`);
}

for (const [label, viewport, touch] of [
  ["phone", { width: 390, height: 844 }, true],
  ["desktop", { width: 1280, height: 900 }, false],
] as const) {
  test.describe(label, () => {
    test.skip(!process.env.E2E_ATLAS, "needs an Atlas stand-in (E2E_ATLAS=1)");
    test.use({ viewport, hasTouch: touch });

    test(`SilverStar opening weekend, start to recap (${label})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.clock.setFixedTime(new Date("2026-11-08T10:00:00-08:00"));

      // 1–4: one sentence → mountain, date, crew.
      await page.goto("/snow/new");
      await page
        .getByLabel("Tell Passport about the day (optional)")
        .fill(SENTENCE);
      await expect(page.getByTestId("ask-read")).toContainText(
        "SilverStar · Opening weekend · 4 people (2 skiing, 1 snowboarding, 1 not skiing)",
      );
      await page.getByLabel("Your name").fill("Lorne");
      await page.getByRole("button", { name: "Skiing" }).click();
      await page
        .getByRole("button", { name: "Make us an awesome day" })
        .click();
      await expect(page.getByTestId("day-title")).toHaveText(
        "SilverStar opening weekend",
      );
      await expect(page.getByTestId("hero-mountain")).toHaveText("SilverStar");
      await expect(page.getByTestId("card-crew")).toContainText(
        "4 in · 2 skiing, 1 boarding, 1 not skiing",
      );

      // 2: official opening information, quoted, sourced, dated.
      const mountain = await card(page, "mountain");
      await expect(mountain.getByTestId("resort-facts")).toContainText(
        "Alpine Opening Day: November 27, 2026",
      );
      await expect(mountain.getByTestId("resort-facts")).toContainText(
        "checked today",
      );
      await expect(mountain.getByTestId("resort-facts")).toContainText(
        "Tentative",
      );
      await expect(
        mountain.getByRole("link", { name: "Hours ↗" }),
      ).toHaveAttribute(
        "href",
        /skisilverstar\.com\/the-mountain\/hours-of-operation/,
      );
      await expect(mountain.getByTestId("status-when-checked")).toContainText(
        "Not live",
      );

      // 3: the date, chosen visually.
      const date = await card(page, "date");
      await expect(date.getByTestId("date-opening")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(date.getByTestId("date-opening")).toContainText(
        "Sat, Nov 28",
      );
      await expect(date.getByTestId("date-season")).toContainText(
        "Inside SilverStar's published season",
      );
      await date.getByTestId("date-this-weekend").click();
      await expect(date.getByTestId("date-season")).toContainText(
        "Before SilverStar's published opening day",
      );
      await date.getByTestId("date-opening").click();
      await expect(date.getByTestId("date-opening")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 4: names and interests.
      await page.getByRole("tab", { name: "Crew" }).click();
      await page.getByRole("button", { name: "Edit Not skiing 1" }).click();
      await page.getByLabel("Not skiing 1's name").fill("Jess");
      await page
        .getByLabel("Not skiing 1's note")
        .fill("Doesn't ski — loves tubing");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByTestId("crew-list")).toContainText("Jess");
      await page.getByRole("tab", { name: "Plan" }).click();

      // 5: real Atlas experiences around the mountain, with photos.
      const around = page.getByTestId("around");
      await expect(around.getByTestId("pick").first()).toBeVisible();
      await around
        .getByRole("button", { name: "For someone not skiing" })
        .click();
      const tube = around.getByTestId("pick").filter({ hasText: "Tube Town" });
      await expect(tube).toContainText("Atlas says: Inner tubing, Tubing");
      await expect(tube.locator("img")).toHaveAttribute(
        "src",
        /tourismvernon\.com/,
      );
      await expect(around).toContainText("Brewer's Pond");

      // 6: lunch and après. Atlas has no lunch on the mountain: said, not invented.
      const lunch = await card(page, "meals");
      await expect(lunch.getByTestId("nearby-empty")).toContainText(
        "on SilverStar",
      );
      await expect(lunch).toContainText(
        "SilverStar's own list (14) — not in Atlas yet",
      );
      await expect(page.getByTestId("atlas-gaps")).toContainText(
        "What Atlas doesn't know",
      );
      const apres = await card(page, "apres");
      const firstApres = apres.getByTestId("pick").first();
      const apresName = (
        await firstApres.locator("p").first().innerText()
      ).trim();
      await firstApres.getByRole("button", { name: "Add to our day" }).click();
      await expect(apres.getByTestId("topic-apres")).toContainText(apresName);

      // 7: something for the person not skiing.
      const act = await card(page, "activity");
      await act
        .getByTestId("pick")
        .filter({ hasText: "Tube Town" })
        .getByRole("button", { name: "Add to our day" })
        .click();
      await expect(act.getByTestId("topic-activity")).toContainText(
        "Tube Town",
      );

      // 8: the day, built from all of it, with facts and suggestions apart.
      const plan = page.getByTestId("day-plan");
      await expect(plan.getByTestId("stop-lifts")).toContainText("9:00 am");
      await expect(plan.getByTestId("stop-lifts")).toContainText("Published");
      await expect(plan.getByTestId("stop-others-am")).toContainText(
        "Jess: Tube Town",
      );
      await expect(plan.getByTestId("stop-others-am")).toContainText(
        "Crew's pick",
      );
      await expect(plan.getByTestId("stop-lunch")).toContainText(
        "Atlas has no lunch spot on the mountain yet",
      );
      await expect(plan.getByTestId("stop-apres")).toContainText(apresName);
      await page.screenshot({
        path: path.join(SHOTS, `alive-dashboard-${label}.png`),
        fullPage: true,
      });

      // 9: change it in words — preview, apply; locked things don't move.
      await plan.getByRole("button", { name: "Move lunch earlier" }).click();
      await expect(plan.getByTestId("plan-preview")).toContainText(
        "Lunch moves earlier, to 12:00 pm",
      );
      await plan.getByRole("button", { name: "Apply" }).click();
      await expect(plan.getByTestId("stop-lunch")).toContainText("12:00 pm");
      await plan
        .getByRole("button", { name: "Add somewhere for lunch" })
        .click();
      await expect(plan.getByTestId("plan-said")).toContainText(
        "won't make one up",
      );
      await plan
        .getByRole("button", { name: "Keep us on the mountain" })
        .click();
      await plan.getByRole("button", { name: "Apply" }).click();
      await expect(plan).toContainText("Staying on the mountain");

      // 10: vote on the restaurant and lock it in.
      const apresTopic = (await card(page, "apres")).getByTestId("topic-apres");
      await apresTopic.getByRole("button", { name: "Vote" }).click();
      await expect(apresTopic).toContainText("LEADING");
      await apresTopic.getByRole("button", { name: "Lock it in" }).click();
      await expect(apresTopic).toContainText("LOCKED IN");
      await plan
        .getByRole("button", { name: "Make après more interesting" })
        .click();
      await expect(plan.getByTestId("plan-said")).toContainText(
        `locked in (${apresName})`,
      );
      await expect(plan.getByTestId("stop-apres")).toContainText("Locked in");

      // 11: saved — it all survives a reload.
      await page.reload();
      await expect(page.getByTestId("day-title")).toHaveText(
        "SilverStar opening weekend",
      );
      await expect(page.getByTestId("stop-lunch")).toContainText("12:00 pm");
      await expect(page.getByTestId("stop-apres")).toContainText(apresName);
      await expect(page.getByTestId("card-crew")).toContainText("4 in");

      // 12–14: start, a memory, done, recap.
      await page.getByRole("tab", { name: "On the hill" }).click();
      await page.getByTestId("start-day").click();
      await expect(page.getByTestId("companion")).toBeVisible();
      await page.getByRole("tab", { name: "Memories" }).click();
      await page
        .getByLabel("A moment")
        .fill("Jess beat everyone down Tube Town");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByTestId("moments")).toContainText(
        "Jess beat everyone",
      );
      await page.getByRole("tab", { name: "On the hill" }).click();
      await page.getByTestId("big-leave").click();
      await page.getByTestId("end-day").click();
      await page.getByRole("button", { name: "Open the recap" }).click();
      await expect(page.getByTestId("recap")).toContainText(
        "SilverStar opening weekend",
      );
      await expect(page.getByTestId("recap")).toContainText(
        "with Lorne, Skier 2, Snowboarder 1, Jess",
      );
      await expect(page.getByTestId("moments")).toContainText(
        "Jess beat everyone",
      );
      await page.screenshot({
        path: path.join(SHOTS, `alive-recap-${label}.png`),
        fullPage: true,
      });
    });
  });
}

test("Atlas down: the mountain still plans, and says why there are no places", async ({
  page,
}) => {
  await page.route("**/snow/api/nearby**", (r) =>
    r.fulfill({ status: 502, body: "{}" }),
  );
  await page.clock.setFixedTime(new Date("2026-11-08T10:00:00-08:00"));
  await page.goto("/snow/new");
  await page
    .getByLabel("Tell Passport about the day (optional)")
    .fill("SilverStar opening weekend, 2 skiers");
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Make us an awesome day" }).click();
  await expect(page.getByTestId("nearby-unavailable")).toContainText(
    "Atlas isn't answering",
  );
  await expect(page.getByTestId("day-plan")).toContainText(
    "Atlas isn't answering",
  );
  await expect(page.getByTestId("stop-lifts")).toContainText("Published");
});
