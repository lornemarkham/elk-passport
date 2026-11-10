import { expect, test, type Page } from "@playwright/test";

/**
 * **Mission 660 — scenarios A to D**, against a production build, the real
 * 2026-11-08 production corpus (Atlas stand-in) and a real local Supabase.
 *
 *   A  Discover four activities near Vernon, save them, build a day from
 *      them, and every one of them is in it.
 *   B  A weekend from places saved in different regions: nothing dropped,
 *      no day that crosses the province.
 *   D  Change the plan after it is built; the picks stay.
 *
 * (C, the SilverStar ski day, is `../../snow/verification/silverstar.spec.ts`.)
 *
 *   E2E_ATLAS_URL=http://127.0.0.1:3127 E2E_PORT=3126 \
 *     npx playwright test -c docs/product/go-have-a-day/verification scenarios
 */
const password = "a-pretty-good-day-9";
const SHOTS = process.env.E2E_SHOTS ?? `${process.env.HOME}/scratch/m660/shots`;
const ATLAS = process.env.E2E_ATLAS_URL ?? "http://127.0.0.1:3127";

const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) *
      Math.cos(b[1] * r) *
      Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const VERNON: [number, number] = [-119.27, 50.267];

interface AtlasRow {
  id: string;
  name: string;
  kind: string;
  coordinates?: [number, number];
  geography?: { coordinates?: [number, number] };
}
type Atlas = Record<
  string,
  { name: string; at?: [number, number]; kind: string }
>;
let corpus: Atlas = {};
test.beforeAll(async () => {
  const body = await (await fetch(`${ATLAS}/discovery/candidates`)).json();
  corpus = Object.fromEntries(
    body.candidates.map((c: AtlasRow) => [
      c.id,
      {
        name: c.name,
        kind: c.kind,
        at: c.geography?.coordinates ?? c.coordinates,
      },
    ]),
  );
});

async function signUp(page: Page, who: string, next = "/discovery") {
  await page.goto(`/auth?next=${next}`);
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(who);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace("/", "\\/")));
}

async function ideasHeld(page: Page): Promise<string[]> {
  const boards = await (await page.request.get("/api/boards")).json();
  if (!Array.isArray(boards)) return [];
  const ids = new Set<string>();
  for (const b of boards.filter((x) => (x.role ?? "owner") === "owner")) {
    const items = await (
      await page.request.get(`/api/boards/${b.id}/items`)
    ).json();
    for (const i of Array.isArray(items) ? items : []) ids.add(i.experienceId);
  }
  return [...ids];
}

/** Ask Discovery, then save a card by its title. */
async function saveByName(page: Page, said: string, title: string | RegExp) {
  await page.getByTestId("ask-input").fill(said);
  await page.getByTestId("ask-submit").click();
  const card = page
    .getByTestId("ask-answer")
    .getByTestId("possibility")
    .filter({ hasText: title })
    .first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  const before = (await ideasHeld(page)).length;
  await expect(async () => {
    if ((await ideasHeld(page)).length === before)
      await card
        .getByRole("button", { name: "Save", exact: true })
        .click({ timeout: 2_000 });
    expect((await ideasHeld(page)).length).toBe(before + 1);
  }).toPass({ timeout: 45_000 });
  return ((await card.locator("h3").first().textContent()) ?? "").trim();
}

const titles = async (page: Page) =>
  (await page.locator('[data-testid="go-stop"] h3').allTextContents()).map(
    (s) => s.trim(),
  );

test.describe.configure({ mode: "serial" });

test("A · four things near Vernon, saved, become a day with all four", async ({
  page,
}, info) => {
  const shot = (n: string) =>
    page.screenshot({ path: `${SHOTS}/${info.project.name}-A-${n}.png` });
  await signUp(
    page,
    `a-${info.project.name}-${Date.now().toString(36)}@example.test`,
  );
  await expect(page.getByTestId("ask-input")).toBeVisible({ timeout: 60_000 });

  // ---- Discover: "near Vernon" answers with things that are near Vernon.
  await page.getByTestId("ask-input").fill("something fun to do near Vernon");
  await page.getByTestId("ask-submit").click();
  const answer = page.getByTestId("ask-answer");
  await expect(answer.getByTestId("possibility").first()).toBeVisible({
    timeout: 30_000,
  });
  const names = (
    await answer.getByTestId("possibility").locator("h3").allTextContents()
  ).map((s) => s.trim());
  expect(names.length).toBeGreaterThanOrEqual(4);
  const far = Object.values(corpus).filter(
    (c) => names.includes(c.name) && c.at && km(VERNON, c.at) > 80,
  );
  expect(
    far.map((c) => c.name),
    "Discovery near Vernon showed places more than 80 km away",
  ).toEqual([]);
  await shot("01-near-vernon");

  // ---- Save four of them.
  const cards = answer.getByTestId("possibility");
  const picked: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const card = cards.nth(i);
    const title = (
      (await card.locator("h3").first().textContent()) ?? ""
    ).trim();
    const before = (await ideasHeld(page)).length;
    await expect(async () => {
      if ((await ideasHeld(page)).length === before)
        await card
          .getByRole("button", { name: "Save", exact: true })
          .click({ timeout: 2_000 });
      expect((await ideasHeld(page)).length).toBe(before + 1);
    }).toPass({ timeout: 45_000 });
    picked.push(title);
  }
  expect(await ideasHeld(page)).toHaveLength(4);
  await expect(page.getByTestId("pocket-count")).toHaveText("4 ideas saved");
  await shot("02-four-saved");

  // ---- Pocket → Make a day.
  await page.getByRole("button", { name: /4 ideas saved/ }).click();
  await expect(page.getByTestId("pocket-item")).toHaveCount(4);
  await expect(page.getByTestId("pocket-spread")).toHaveCount(0);
  await page.getByTestId("pocket-make-day").click();
  await expect(page).toHaveURL(/\/go\?with=/);

  // ---- No "where are you?" questionnaire: the picks say where.
  await expect(page.getByTestId("go-day")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("go-where")).toHaveCount(0);
  await expect(page.getByTestId("go-apart")).toHaveCount(0);

  // ---- All four are in the day.
  const stops = await titles(page);
  for (const p of picked)
    expect(stops, `"${p}" missing from the day`).toContain(p);
  await shot("03-day");

  // ---- Print and offline are there, and secondary.
  const keep = page.getByTestId("go-keep-day");
  await expect(keep).toBeVisible();
  await expect(page.getByTestId("go-take")).toContainText(
    "Taking it with you?",
  );
  await expect(page.getByTestId("go-print")).toBeVisible();
  const printBox = await page.getByTestId("go-print").boundingBox();
  const keepBox = await keep.boundingBox();
  expect(printBox!.height).toBeLessThan(keepBox!.height + 1);

  // ---- D · change it after it is built; the picks stay.
  for (const said of ["Add somewhere for lunch", "Keep us within 30 minutes"]) {
    await page.getByTestId("go-change").fill(said);
    await page.getByTestId("go-change-submit").click();
    await expect(page.getByTestId("go-reply")).toBeVisible();
  }
  const after = await titles(page);
  for (const p of picked) expect(after, `"${p}" lost by a change`).toContain(p);
  await shot("04-changed");

  // ---- And the day, once created, can be kept and found again.
  await keep.click();
  await expect(keep).toContainText("Kept");
  await page.goto("/go");
  await expect(
    page.getByTestId("go-kept-days").or(page.getByText(/kept/i)).first(),
  ).toBeVisible();
});

test("B · a weekend from places saved in different regions", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const shot = (n: string) =>
    page.screenshot({ path: `${SHOTS}/${info.project.name}-B-${n}.png` });
  await signUp(
    page,
    `b-${info.project.name}-${Date.now().toString(36)}@example.test`,
  );
  await expect(page.getByTestId("ask-input")).toBeVisible({ timeout: 60_000 });

  // The titles are whatever the cards that were saved are called.
  const vernon: string[] = [];
  const vancouver: string[] = [];
  for (const name of ["Kal Beach", "BNA Brewing", "Knox Mountain Park"])
    vernon.push(await saveByName(page, name, name));
  for (const name of ["Stanley Park", "Capilano Suspension Bridge"])
    vancouver.push(await saveByName(page, name, name));
  expect(await ideasHeld(page)).toHaveLength(5);
  await expect(page.getByTestId("pocket-count")).toHaveText("5 ideas saved");

  // ---- the Pocket says they are in two places, before anything is pressed.
  await page.getByRole("button", { name: /5 ideas saved/ }).click();
  await expect(page.getByTestId("pocket-item")).toHaveCount(5);
  await expect(page.getByTestId("pocket-spread")).toContainText(
    "2 different places",
  );
  await shot("01-pocket-spread");

  // ---- Make a day: it says they are not one day and drops nothing.
  await page.getByTestId("pocket-make-day").click();
  await expect(page.getByTestId("go-apart")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("go-day")).toHaveCount(0);
  await expect(page.getByTestId("go-where")).toHaveCount(0);
  const groups = page.getByTestId("go-apart-group");
  await expect(groups).toHaveCount(2);
  const oneGroup = (await groups.allTextContents()).join(" | ");
  for (const n of [...vernon, ...vancouver]) expect(oneGroup).toContain(n);
  await shot("02-apart");

  // ---- A day for the first group works, with its three places in it.
  await groups.first().getByTestId("go-apart-day").click();
  await expect(page.getByTestId("go-day")).toBeVisible({ timeout: 60_000 });
  const dayStops = await titles(page);
  for (const n of vernon) expect(dayStops).toContain(n);
  for (const n of vancouver) expect(dayStops).not.toContain(n);

  // ---- Back to the pocket, and make the weekend instead.
  await page.goBack();
  const weekend = page.getByTestId("go-apart-weekend");
  await weekend.scrollIntoViewIfNeeded();
  await expect(async () => {
    await weekend.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/adventures\/new\?with=/, {
      timeout: 5_000,
    });
  }).toPass({ timeout: 40_000 });
  // The town is already there: the places said where it starts.
  await expect(page.getByTestId("create-town")).not.toHaveValue("");
  await page.getByRole("button", { name: "This weekend", exact: true }).click();
  await page.getByTestId("create-title").fill("Vernon then Vancouver");
  await shot("03-new-adventure");
  await page.getByTestId("create-submit").click();
  await expect(page).toHaveURL(/\/adventures\/[0-9a-f]{32}/, {
    timeout: 120_000,
  });

  const sections = page.getByTestId("plan-day-section");
  await expect(sections).toHaveCount(2);
  const day = async (i: number) =>
    (
      await sections
        .nth(i)
        .getByTestId("plan-item")
        .locator("h4")
        .allTextContents()
    ).map((t) => t.trim());
  const [one, two] = [await day(0), await day(1)];
  const all = [...one, ...two];
  for (const n of [...vernon, ...vancouver])
    expect(all, `"${n}" missing from the weekend`).toContain(n);
  // Never one day holding both a Vernon place and a Vancouver place.
  for (const d of [one, two]) {
    const here = vernon.some((n) => d.includes(n));
    const there = vancouver.some((n) => d.includes(n));
    expect(here && there, `a day spans the province: ${d.join(", ")}`).toBe(
      false,
    );
  }
  await shot("04-weekend");
});
