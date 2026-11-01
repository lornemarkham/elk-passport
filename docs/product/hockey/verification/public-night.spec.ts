import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import {
  type Person,
  noSidewaysScroll,
  peopleCalled,
  phone,
  setNight,
  signUp,
  snapshot,
} from "./mayhem-helpers";

/**
 * **Hockey Night for anyone — any NHL game, any arena.**
 *
 * Against the stand-in league (`nhl-schedule-stub.mjs`, synthetic schedule,
 * `NHL_API_BASE` pointed at it):
 *
 *   1. signed out, /hockey is the public front door: the words, one button,
 *      no night, no name, no arena — and nothing indexed about any night
 *   2. a new host picks a game from the league's list, filtered to a team
 *      that is not the Canucks, and starts the night
 *   3. the night says both sides, the right arena, the arena's own time;
 *      the pair question is labelled home first; the "near the arena" offer
 *      is honest about an arena Passport has not measured; Arena Mode (a
 *      Rogers Arena thing) is not on the bar
 *   4. the trophy carries the group's own name, in the board and on the shelf
 *   5. a stranger with the id gets a 404 — private stays private
 *   6. by hand still works: the old Canucks form behind one link
 *
 * Run:  NHL_API_BASE=http://127.0.0.1:54352 next start …
 *       E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification public-night
 */

peopleCalled("public");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });

const SHOTS = process.env.PUBLIC_SHOTS;
async function shot(p: { page: Person["page"] }, name: string, full = false) {
  if (!SHOTS) return;
  await p.page.waitForTimeout(600);
  await p.page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
}

let host: Person;

test("signed out, /hockey is a public front door that says nothing about any night", async ({
  browser,
}) => {
  const page = await phone(browser);
  const res = await page.goto("/hockey");
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Hockey is better with your crew." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start a Hockey Night" }),
  ).toHaveAttribute("href", /^\/auth\?next=%2Fhockey$/);
  const body = await page.content();
  expect(body).not.toContain("Sycle");
  expect(body).toContain('content="index, follow"');
  await noSidewaysScroll(page);
  await shot({ page }, "00-landing", true);
  await page.close();
});

test("a new host picks a Leafs game from the league's list", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await phone(browser);
  await page.goto("/hockey");
  await page.getByRole("link", { name: "Start a Hockey Night" }).click();
  await signUp(page, "pat");
  await expect(
    page.getByRole("heading", { name: /Nothing on yet/ }),
  ).toBeVisible();
  await page.getByLabel("Your name").fill("Pat");
  await expect(page.getByRole("radio").first()).toBeVisible();
  await page.getByLabel("Team").selectOption("TOR");
  const leafsHome = page.getByRole("radio", { name: /at Maple Leafs/ }).first();
  await expect(leafsHome).toBeVisible();
  await expect(leafsHome).toContainText("Scotiabank Arena");
  await noSidewaysScroll(page);
  await leafsHome.click();
  await page.getByLabel("Trophy name").fill("The Office Cup");
  await shot({ page }, "01-picker");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(page.url().split("/").pop()!);
  await page.getByRole("button", { name: /Skip/ }).click();
  host = {
    who: "pat",
    name: "Pat",
    page,
    id: (await snapshot(page)).state.meId,
  };
});

test("the night is that game: both sides, that arena, its own time, home first", async () => {
  const { page } = host;
  const snap = await snapshot(page);
  expect(snap.definition.subtitle).toBe("Maple Leafs vs Bruins");
  expect(snap.definition.kicker).toBe("Scotiabank Arena");
  const final = snap.definition.prompts.find((p) => p.id === "final-score") as
    { pairLabels?: string[] } | undefined;
  expect(final?.pairLabels).toEqual(["Maple Leafs", "Bruins"]);
  const first = snap.definition.prompts.find((p) => p.id === "first-team") as
    { options?: { id: string; label: string }[] } | undefined;
  expect(first?.options?.map((o) => o.label)).toEqual([
    "Maple Leafs",
    "Bruins",
  ]);

  await expect(
    page.getByText("Scotiabank Arena", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Hockey Night", { exact: false }).first(),
  ).toBeVisible();
  // Arena Mode is Rogers Arena's; not on this night's bar.
  await expect(page.getByRole("link", { name: /^Arena/ })).toHaveCount(0);
  await noSidewaysScroll(page);
  await shot({ page }, "02-leafs-night", true);

  // The pregame offer is honest: nothing measured from an arena Passport has not measured.
  const nearby = await page.request.get(
    `/hockey/api/occasions/${snap.state.slug}/nearby`,
  );
  expect(nearby.ok()).toBe(true);
  const near = (await nearby.json()) as { places: unknown[]; outage?: string };
  expect(near.places).toEqual([]);
  expect(near.outage).toMatch(/hasn't measured Scotiabank Arena/);
});

test("the trophy is the group's own, on the board and the shelf", async () => {
  const { page } = host;
  await openTab(page, "Play");
  await expect(
    page.getByRole("heading", { name: "The Office Cup" }),
  ).toBeVisible();
  await expect(page.getByText("Sycle")).toHaveCount(0);
  await shot({ page }, "03-office-cup");
  await page.goto("/hockey");
  await expect(
    page.getByText("Maple Leafs vs Bruins · Scotiabank Arena"),
  ).toBeVisible();
  await page.goBack();
});

test("a stranger with the id gets a 404", async ({ browser }) => {
  const page = await phone(browser);
  await page.goto("/hockey");
  await page.getByRole("link", { name: "Start a Hockey Night" }).click();
  await signUp(page, "stranger");
  await expect(
    page.getByRole("heading", { name: /Nothing on yet/ }),
  ).toBeVisible();
  const snap = await snapshot(host.page);
  const res = await page.request.get(
    `/hockey/api/occasions/${snap.state.slug}`,
  );
  expect(res.status()).toBe(404);
  const gone = await page.goto(`/hockey/${snap.state.slug}`);
  expect(gone?.status()).toBe(404);
  await page.close();
});

test("by hand still works: a Canucks home game behind one link", async () => {
  const { page } = host;
  await page.goto("/hockey");
  await page.getByRole("button", { name: "Start another night" }).click();
  await page
    .getByRole("button", { name: /Set a Canucks home game by hand/ })
    .click();
  await page.getByLabel("Opponent").fill("Wild");
  const in9 = new Date(Date.now() + 9 * 86_400_000).toLocaleDateString(
    "en-CA",
    {
      timeZone: "America/Vancouver",
    },
  );
  await page.getByLabel("Game date").fill(in9);
  await page.getByLabel("Puck drop time").fill("19:00");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(page.url().split("/").pop()!);
  const snap = await snapshot(page);
  expect(snap.definition.subtitle).toBe("Canucks vs Wild");
  expect(snap.definition.kicker).toBe("Rogers Arena");
  await page.getByRole("button", { name: /Skip/ }).click();
  await expect(page.getByRole("link", { name: /^Arena/ })).toBeVisible();
});
