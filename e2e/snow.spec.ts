import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * **The Snow journey, end to end, on a phone.**
 *
 * Discover → plan → crew → get ready → challenges → on the hill (offline) →
 * memories → recap → go have another. Everything runs against the local
 * fallbacks: no Atlas, no Supabase, no network beyond this server.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const SHOTS = path.join(
  __dirname,
  "..",
  "docs",
  "product",
  "snow",
  "screenshots",
);
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

// A real 2x2 PNG, so the photo path decodes in a browser.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2P8z8Dwn4EIwDiqkL4KAD7sBP2GkoZ4AAAAAElFTkSuQmCC",
  "base64",
);

const iso = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("a crew plans, plays, remembers and goes again", async ({
  page,
  context,
}) => {
  // ---------------------------------------------------------------- home
  await page.goto("/snow");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "calling",
  );
  await shot(page, "01-home");
  await page
    .getByRole("link", { name: /go have a snow day/i })
    .first()
    .click();

  // ----------------------------------------------------------------- new
  await page.getByLabel("Name the day").fill("Powder Friday");
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Skiing" }).click();
  await page.getByRole("button", { name: "Advanced" }).click();
  await shot(page, "02-start");
  await page.getByRole("button", { name: "Create the day" }).click();
  await expect(page.getByTestId("day-title")).toHaveText("Powder Friday");

  // ---------------------------------------------------------------- plan
  await page
    .getByLabel("Add a mountain from Passport's list")
    .selectOption({ label: "Cypress Mountain" });
  await page
    .getByLabel("Add a mountain from Passport's list")
    .selectOption({ label: "Grouse Mountain" });
  const mountain = page.getByTestId("topic-mountain");
  await expect(
    mountain.locator("li").filter({ hasText: "Cypress Mountain" }),
  ).toBeVisible();
  await mountain.getByRole("button", { name: "Vote" }).first().click();
  await expect(mountain.getByText("LEADING")).toBeVisible();
  await mountain.getByRole("button", { name: "Lock it in" }).first().click();
  await expect(mountain.getByText("LOCKED IN")).toBeVisible();

  const when = iso(3);
  await page.getByLabel("Suggest date").fill(when);
  await page
    .getByTestId("topic-date")
    .getByRole("button", { name: "Suggest" })
    .click();
  await page
    .getByTestId("topic-date")
    .getByRole("button", { name: "Lock it in" })
    .click();
  await page.getByLabel("Suggest meeting points").fill("Base lodge deck");
  await page
    .getByTestId("topic-meeting")
    .getByRole("button", { name: "Suggest" })
    .click();
  await page
    .getByLabel("Suggest meals")
    .fill("Packed lunch at the lodge tables");
  await page
    .getByTestId("topic-meals")
    .getByRole("button", { name: "Suggest" })
    .click();
  await expect(page.getByTestId("open-count")).toContainText("meeting points");
  await shot(page, "03-plan");

  // changing a locked choice tells the crew once
  await mountain.getByRole("button", { name: "Vote" }).last().click();
  await mountain.getByRole("button", { name: "Lock it in" }).click();
  await expect(page.getByTestId("latest-update")).toContainText(
    "Mountain changed to Grouse Mountain",
  );

  // ---------------------------------------------------------------- crew
  await page.getByRole("tab", { name: "Crew" }).click();
  await page.getByLabel("Their name").fill("Ben");
  await page.getByRole("button", { name: "Snowboarding" }).click();
  await page
    .getByRole("group", { name: "Level" })
    .getByRole("button", { name: "Beginner" })
    .click();
  await page.getByLabel("Needs rental gear").check();
  await page.getByLabel("Note").fill("Vegetarian");
  await page.getByRole("button", { name: "Add to the crew" }).click();
  await expect(page.getByTestId("crew-list")).toContainText("Ben");
  await expect(page.getByTestId("group-line")).toContainText("beginner level");
  await page.getByLabel("Post an update").fill("Meet at the deck at 8:40");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByTestId("announcements")).toContainText(
    "Meet at the deck at 8:40",
  );
  await shot(page, "04-crew");

  // ----------------------------------------------------------- get ready
  await page.getByRole("tab", { name: "Get ready" }).click();
  await expect(
    page.getByRole("heading", { name: "Until the mountain" }),
  ).toBeVisible();
  await expect(page.getByTestId("reminders")).toBeVisible();
  const gear = page.getByTestId("gear");
  await gear.getByRole("checkbox").first().check();
  await expect(gear).toContainText("1 of");
  await page.getByLabel("Add a song").fill("Mountain Sound");
  await page
    .getByLabel("Add a song")
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Add" })
    .click();
  await expect(page.getByText("♪ Mountain Sound")).toBeVisible();

  // predictions: call one, refuse an unsafe one, settle it
  const calls = page.getByTestId("predictions");
  await calls
    .getByRole("button", { name: /Someone forgets their gloves/ })
    .click();
  const call = calls.locator("li").first();
  await call.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(call.getByRole("button", { name: "Yes" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await calls.getByLabel("Write a prediction").fill("Who goes fastest");
  await calls.getByRole("button", { name: "Add", exact: true }).click();
  await expect(calls.getByRole("alert")).toBeVisible();
  await call.getByRole("button", { name: "It happened" }).click();
  await expect(call).toContainText("It happened ✅");
  await shot(page, "05-get-ready");

  // ---------------------------------------------------------- challenges
  await page.getByRole("tab", { name: "Challenges" }).click();
  await page.getByTestId("challenge-group-photo").getByRole("button").click();
  await page.getByTestId("challenge-viewpoint").getByRole("button").click();
  await page
    .getByLabel("Marking challenges for")
    .selectOption({ label: "Ben" });
  await page.getByTestId("challenge-first-turns").getByRole("button").click();
  // a beginner is offered the new-trail challenge, never an advanced-only one
  await expect(page.getByTestId("challenge-new-trail")).toBeVisible();
  await page.getByLabel("Your challenge").fill("Fastest run of the day");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("problem")).toContainText(
    "isn't something Snow rewards",
  );
  await page.getByLabel("Your challenge").fill("Best hat at lunch");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page
      .getByTestId("challenge-" + "custom")
      .first()
      .or(page.getByText("Best hat at lunch")),
  ).toBeVisible();
  const table = page.getByTestId("standings");
  await expect(table.getByRole("listitem").first()).toContainText("Ana");
  await expect(page.getByTestId("awards")).toContainText("Trail Boss");
  await shot(page, "06-challenges");

  // --------------------------------------------------------- on the hill
  await page.getByRole("tab", { name: "On the hill" }).click();
  await expect(page.getByTestId("hill-card")).toContainText("Grouse Mountain");
  await expect(page.getByTestId("hill-card")).toContainText(
    "the resort's own report",
  );
  await page.getByRole("button", { name: "Base lodge deck" }).click();
  await expect(page.getByTestId("my-checkin")).toContainText("Base lodge deck");
  await shot(page, "07-on-the-hill");

  // offline: the day still takes changes and keeps them
  await context.setOffline(true);
  await expect(page.getByTestId("connectivity")).toContainText("Offline");
  await page
    .getByRole("button", { name: "Heading to the lodge for a food break" })
    .click();
  await context.setOffline(false);
  await expect(page.getByTestId("connectivity")).toContainText("Online");
  await page.getByRole("tab", { name: "Crew" }).click();
  await expect(page.getByTestId("announcements")).toContainText(
    "Heading to the lodge for a food break",
  );
  await page.reload();
  await page.getByRole("tab", { name: "Crew" }).click();
  await expect(page.getByTestId("announcements")).toContainText(
    "Heading to the lodge for a food break",
  );

  // ------------------------------------------------------------ memories
  await page.getByRole("tab", { name: "Memories" }).click();
  await page
    .getByLabel("Add a photo")
    .setInputFiles({ name: "run.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByTestId("photos").getByRole("img")).toHaveCount(1);
  await page.getByLabel("A moment").fill("Ben met a tree and the tree won");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Next adventure idea").fill("Whistler in January");
  await page.getByRole("button", { name: "Suggest" }).click();
  await page.getByTestId("next").getByRole("button", { name: /☆/ }).click();
  const recap = page.getByTestId("recap");
  await expect(recap).toContainText("Powder Friday");
  await expect(recap).toContainText("Final table");
  await expect(recap).toContainText("Challenges done");
  await expect(recap).toContainText("Called");
  await recap.scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    window.scrollTo(
      0,
      document.querySelector("[data-testid=recap]")!.getBoundingClientRect()
        .top +
        window.scrollY -
        120,
    ),
  );
  await shot(page, "08-recap");

  // ------------------------------------------------------- go have another
  await page.getByRole("link", { name: "Same crew, next snow day" }).click();
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Create the day" }).click();
  await page.getByRole("tab", { name: "Crew" }).click();
  await expect(page.getByTestId("crew-list")).toContainText("Ben");
  // plans and scores start fresh
  await page.getByRole("tab", { name: "Challenges" }).click();
  await expect(page.getByTestId("standings")).toContainText("0 pts");
});

test("a shared plan opens as a copy on another phone", async ({
  page,
  browser,
}) => {
  await page.goto("/snow/new");
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Create the day" }).click();
  await page.getByRole("tab", { name: "Crew" }).click();
  await page.evaluate(() => {
    (navigator as unknown as { share?: unknown }).share = undefined;
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share the plan" }).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("/snow/join#");

  const other = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const friend = await other.newPage();
  await friend.goto(link);
  await expect(friend.getByRole("heading", { level: 1 })).toContainText(
    "snow day",
  );
  await friend.getByLabel("Your name").fill("Cam");
  await friend.getByRole("button", { name: "I'm in" }).click();
  await friend.getByRole("tab", { name: "Crew" }).click();
  await expect(friend.getByTestId("crew-list")).toContainText("Ana");
  await expect(friend.getByTestId("crew-list")).toContainText("Cam");
  await other.close();
});

test("mountains: static and live facts are told apart, and nothing is invented", async ({
  page,
}) => {
  await page.goto("/snow/mountains");
  await expect(
    page.getByTestId("mountain-list").getByRole("listitem").first(),
  ).toBeVisible();
  const card = page.getByTestId("mountain-cypress");
  await expect(card).toContainText("Snow conditions");
  await expect(card).toContainText("NOT CONNECTED");
  await expect(card).not.toContainText(/\$\d/);
  await page.getByLabel("Leaving from").selectOption("Vancouver");
  await expect(
    page.getByTestId("mountain-list").getByRole("listitem").first(),
  ).toContainText("Grouse");
  await page.getByRole("button", { name: "First time" }).click();
  await expect(page.getByTestId("level-guide")).toContainText("learning area");
  await shot(page, "09-mountains");
  // the forecast button either answers live, or says it could not
  await card.getByRole("button", { name: /forecast/i }).click();
  await expect(card.getByText(/LIVE|No forecast|Couldn't reach/)).toBeVisible({
    timeout: 15_000,
  });
});
