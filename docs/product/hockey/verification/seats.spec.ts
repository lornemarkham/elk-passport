import { expect, test, type Browser, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Our seats, with two real people on two phones.**
 *
 * Needs the local stack WITH the seats migration (stack.mjs start, the
 * default) and `atlas-seats-stub.mjs` serving the real candidates body as
 * ATLAS_API_URL (its /travel/legs is a labelled stub). Proves:
 *
 *   the host adds the group block and their own seat, edits it, and it
 *   survives a reload → sets a meeting point → a guest joins on a 320 px
 *   phone, adds their own seat with no gate and is told the entrance is
 *   unknown → the guest cannot change the host's seat, the block or the
 *   meeting point (straight at the API) → the host can change the guest's
 *   → who's sitting together → a private seat → posting a seat to the chat →
 *   directions open in a map app, from a restaurant, to the arena, saying
 *   why not to the gate → nothing on the section scrolls sideways or is too
 *   small to tap.
 */

const stamp = Date.now().toString(36);
const SHOTS = process.env.SEATS_SHOTS;

async function phone(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  // The map apps are somebody else's website: answer for them, and record.
  await context.route(
    /^https:\/\/(www\.google\.com\/maps|maps\.apple\.com)/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>map app</p>",
      }),
  );
  return { context, page: await context.newPage() };
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`${who}-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

const seats = (page: Page) => page.getByRole("region", { name: "Our seats" });
const row = (page: Page, name: string) =>
  seats(page).getByRole("listitem", { name: new RegExp(`^${name}`) });

async function fillSeat(
  page: Page,
  form: string,
  seat: { section?: string; row?: string; seats?: string; gate?: string },
) {
  const f = page.getByRole("form", { name: form });
  if (seat.section !== undefined)
    await f.getByLabel("Section").fill(seat.section);
  if (seat.row !== undefined) await f.getByLabel("Row").fill(seat.row);
  if (seat.seats !== undefined) await f.getByLabel("Seat(s)").fill(seat.seats);
  if (seat.gate !== undefined)
    await f.getByLabel("Entrance").selectOption(seat.gate);
  await f.getByRole("button", { name: "Save" }).click();
  await expect(f).toHaveCount(0);
}

/** No sideways scroll; every control in Our seats is a thumb's size; no tiny text. */
async function fitsThePhone(page: Page, width: number) {
  const report = await page.evaluate(() => {
    const region = document.getElementById("our-seats")!;
    const small = [
      ...region.querySelectorAll<HTMLElement>(
        "a, button, select, input, summary",
      ),
    ]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ el, box }) =>
        el instanceof HTMLInputElement && el.type === "checkbox"
          ? false
          : box.height < 40,
      )
      .map(
        ({ el, box }) =>
          `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(box.height)}px`,
      );
    const tiny = [
      ...region.querySelectorAll<HTMLElement>("p, span, li, a, button, label"),
    ]
      .filter((el) => el.offsetParent !== null && el.textContent?.trim())
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
      .map((el) => el.textContent!.trim().slice(0, 30));
    return {
      scroll: document.documentElement.scrollWidth,
      small,
      tiny,
    };
  });
  expect(report.scroll, "no sideways scroll").toBeLessThanOrEqual(width);
  expect(report.small, "taps under 40px").toEqual([]);
  expect(report.tiny, "text under 12px").toEqual([]);
}

test.describe.configure({ mode: "serial" });

test("Our seats: host and guest, persistence, authorization, directions, phones", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  // ------------------------------------------------------------ the host
  const host = await phone(browser, 390);
  await host.page.goto("/hockey");
  await signUp(host.page, "seats-host");
  await host.page.getByLabel("Your name").fill("Lorne");
  await host.page.getByRole("button", { name: "Start it" }).click();
  await expect(host.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightPath = new URL(host.page.url()).pathname;
  const nightId = nightPath.split("/").pop()!;
  await host.page.getByRole("button", { name: /Skip/ }).click();

  // Near the top of Plan: right under the plan, above the dinner vote.
  await expect(seats(host.page)).toBeVisible();
  const [seatsBox, dinnerBox] = await Promise.all([
    seats(host.page).boundingBox(),
    host.page.locator("#vote-pregame-spot").boundingBox(),
  ]);
  expect(seatsBox!.y).toBeLessThan(dinnerBox!.y);

  // The group block.
  await seats(host.page)
    .getByRole("button", { name: "Add the group's seats" })
    .click();
  await fillSeat(host.page, "The group's seats", {
    section: "309",
    row: "12",
    seats: "1-8",
  });
  await expect(
    seats(host.page).getByText("Section 309 · Row 12 · Seats 1–8"),
  ).toBeVisible();
  await expect(
    seats(host.page).getByText("Entrance not known").first(),
  ).toBeVisible();

  // My seat, with a gate from the arena's map. The section starts as the block's.
  await seats(host.page)
    .getByRole("button", { name: "Add my seat" })
    .first()
    .click();
  const mine = host.page.getByRole("form", { name: "My seat" });
  await expect(mine.getByLabel("Section")).toHaveValue("309");
  await expect(
    mine.getByText(/draws Gate 1, Gate 2 and Gate 8 on the Level 300 plan/),
  ).toBeVisible();
  await expect(mine.getByLabel("Entrance")).toHaveValue(""); // nothing preselected
  await fillSeat(host.page, "My seat", { row: "12", seats: "1", gate: "10" });
  await expect(
    row(host.page, "Lorne").getByText("Section 309 · Row 12 · Seat 1"),
  ).toBeVisible();
  await expect(row(host.page, "Lorne").getByText("Gate 10")).toBeVisible();
  await expect(row(host.page, "Lorne").getByText("Level 300")).toBeVisible();

  // Edit.
  await row(host.page, "Lorne")
    .getByRole("button", { name: "Edit my seat" })
    .click();
  await fillSeat(host.page, "My seat", { seats: "1-2" });
  await expect(
    row(host.page, "Lorne").getByText("Section 309 · Row 12 · Seats 1–2"),
  ).toBeVisible();

  // The meeting point.
  await seats(host.page)
    .getByRole("button", { name: "Set a meeting point" })
    .click();
  const meet = host.page.getByRole("form", { name: "Meeting point" });
  await meet.getByLabel("Gate").selectOption("10");
  await meet.getByLabel("Where exactly").fill("Outside, by the doors");
  await meet.getByLabel("Time").fill("18:15");
  await meet.getByRole("button", { name: "Save" }).click();
  await expect(
    seats(host.page).getByText("Gate 10 · Outside, by the doors · 6:15pm"),
  ).toBeVisible();

  // It survives a reload.
  await host.page.reload();
  await expect(
    row(host.page, "Lorne").getByText("Section 309 · Row 12 · Seats 1–2"),
  ).toBeVisible();
  await expect(
    seats(host.page).getByText("Section 309 · Row 12 · Seats 1–8"),
  ).toBeVisible();
  await expect(
    seats(host.page).getByText("Gate 10 · Outside, by the doors · 6:15pm"),
  ).toBeVisible();

  // -------------------------------------------------- invite the guest
  await host.page.getByRole("button", { name: "Invite" }).click();
  await host.page.getByLabel("Who the invitation is for").fill("Maya");
  await host.page.getByRole("button", { name: "Make a link" }).click();
  const invitePath = new URL(
    (await host.page.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;

  const guest = await phone(browser, 320);
  await guest.page.goto(invitePath);
  await guest.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(guest.page, "seats-guest");
  await expect(guest.page).toHaveURL(new RegExp(`${invitePath}$`));
  await guest.page.getByLabel("Your name").fill("Maya");
  await guest.page.getByRole("button", { name: "I'm in" }).click();
  await expect(guest.page).toHaveURL(new RegExp(`${nightPath}$`));

  // The guest sees what the host entered, and cannot edit it.
  await expect(
    seats(guest.page).getByText("Section 309 · Row 12 · Seats 1–8"),
  ).toBeVisible();
  await expect(
    row(guest.page, "Lorne").getByText("Section 309 · Row 12 · Seats 1–2"),
  ).toBeVisible();
  await expect(
    seats(guest.page).getByText("Gate 10 · Outside, by the doors · 6:15pm"),
  ).toBeVisible();
  await expect(
    seats(guest.page).getByRole("button", { name: /Lorne's seat/ }),
  ).toHaveCount(0);
  await expect(
    seats(guest.page).getByRole("button", { name: "Edit the block" }),
  ).toHaveCount(0);
  await expect(
    seats(guest.page).getByRole("button", { name: "Change it" }),
  ).toHaveCount(0);

  // Her own seat, entrance not known.
  await seats(guest.page)
    .getByRole("button", { name: "Add my seat" })
    .first()
    .click();
  await fillSeat(guest.page, "My seat", {
    section: "309",
    row: "12",
    seats: "3",
  });
  await expect(
    row(guest.page, "Maya").getByText("Entrance not known"),
  ).toBeVisible();
  await expect(
    seats(guest.page).getByText(
      /Entrance not chosen — directions end at Rogers Arena/,
    ),
  ).toBeVisible();

  // Who's sitting together: 1–2 and 3 in one row is side by side.
  await expect(
    seats(guest.page).getByText(/Section 309 · Row 12, side by side/),
  ).toBeVisible();

  // ------------------------------------- the guest, around the UI
  const api = `/hockey/api/occasions/${nightId}`;
  const hostId = await host.page.evaluate(async (url) => {
    const v = await (await fetch(url)).json();
    return v.me as string;
  }, `${api}/seats`);
  const tries = [
    ["PUT", `${api}/seats`, { for: hostId, section: "101" }],
    ["PUT", `${api}/seats`, { for: "group", section: "101" }],
    ["DELETE", `${api}/seats?for=${hostId}`, undefined],
    ["DELETE", `${api}/seats?for=group`, undefined],
    ["PUT", `${api}/meetup`, { gate: "3" }],
    ["DELETE", `${api}/meetup`, undefined],
  ] as const;
  for (const [method, url, data] of tries) {
    const res = await guest.page.request.fetch(url, { method, data });
    expect(res.status(), `${method} ${url}`).toBe(403);
  }
  const after = await (await host.page.request.get(`${api}/seats`)).json();
  expect(
    after.seats.find((s: { userId: string }) => s.userId === hostId).seats,
  ).toBe("1-2");
  expect(
    after.seats.find((s: { userId: null }) => s.userId === null).section,
  ).toBe("309");
  expect(after.meetup.gate).toBe("10");

  // A stranger gets nothing at all.
  const stranger = await phone(browser, 390);
  await stranger.page.goto("/auth?next=/hockey");
  await signUp(stranger.page, "seats-stranger");
  await expect(stranger.page.getByText(/Nothing on yet/)).toBeVisible();
  expect((await stranger.page.request.get(`${api}/seats`)).status()).toBe(404);
  expect(
    (
      await stranger.page.request.put(`${api}/seats`, {
        data: { for: hostId, section: "1" },
      })
    ).status(),
  ).toBe(404);
  await stranger.context.close();

  // ----------------------------------------- the host may change hers
  await host.page.reload();
  // The invite left the host's page on Group, and the tab is remembered.
  await openTab(host.page, "Plan");
  await row(host.page, "Maya")
    .getByRole("button", { name: "Edit Maya's seat" })
    .click();
  await fillSeat(host.page, "Maya's seat", { seats: "4" });
  await guest.page.reload();
  await expect(
    row(guest.page, "Maya").getByText("Section 309 · Row 12 · Seat 4"),
  ).toBeVisible();
  await expect(
    row(guest.page, "Maya").getByText("Entered by Lorne"),
  ).toBeVisible();

  // A private seat: the host still sees it, and says so.
  await row(guest.page, "Maya")
    .getByRole("button", { name: "Edit my seat" })
    .click();
  await guest.page
    .getByRole("form", { name: "My seat" })
    .getByLabel(/Share with everyone/)
    .uncheck();
  await fillSeat(guest.page, "My seat", {});
  await host.page.reload();
  await expect(
    row(host.page, "Maya").getByText("Only Maya and the host can see this."),
  ).toBeVisible();

  // Sharing to the night's chat.
  await row(guest.page, "Maya")
    .getByRole("button", { name: "Chat it" })
    .click();
  await openTab(host.page, "Chat");
  await expect(
    host.page.getByText(/I'm in Section 309 · Row 12 · Seat 4/),
  ).toBeVisible({
    timeout: 15_000,
  });
  await openTab(host.page, "Plan");

  // ------------------------------------------------------- directions
  const there = seats(host.page).locator("#getting-there");
  const google = there.getByRole("link", { name: "Google Maps" });
  const apple = there.getByRole("link", { name: "Apple Maps" });
  // From here, to the gate on my seat — which ends at the arena, and says why.
  let href = new URL((await google.getAttribute("href"))!);
  expect(href.searchParams.get("travelmode")).toBe("walking");
  expect(href.searchParams.get("destination")).toBe("49.277800,-123.108800");
  expect(href.searchParams.has("origin")).toBe(false);
  await expect(
    there.getByText(
      /no verified location for Gate 10, so directions end at Rogers Arena/,
    ),
  ).toBeVisible();
  await expect(
    there.getByText(/Passport has no indoor directions/),
  ).toBeVisible();

  // From a restaurant near the arena: Atlas routes it (the stub, labelled).
  // Labels wrap their selects, so option text ("across from…") joins the name.
  const from = there.locator("select").nth(0);
  await expect(from.locator("option")).not.toHaveCount(1, { timeout: 30_000 });
  await from.selectOption({ index: 1 });
  const fromName = (await from.locator("option:checked").textContent())!.trim();
  href = new URL((await google.getAttribute("href"))!);
  expect(href.searchParams.get("origin")).toMatch(/^49\.\d+,-123\.\d+$/);
  const appleHref = new URL((await apple.getAttribute("href"))!);
  expect(appleHref.host).toBe("maps.apple.com");
  expect(appleHref.searchParams.get("dirflg")).toBe("w");
  expect(appleHref.searchParams.get("saddr")).toBe(
    href.searchParams.get("origin"),
  );
  await expect(there.getByText(/min walk/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    there.getByText(/routed by Atlas|straight line/).first(),
  ).toBeVisible();

  // A link opens the map app in a new tab, with the walk in it.
  const [popup] = await Promise.all([
    host.page.waitForEvent("popup"),
    google.click(),
  ]);
  expect(popup.url()).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
  expect(new URL(popup.url()).searchParams.get("travelmode")).toBe("walking");
  await popup.close();

  // To another gate: still the arena, still said.
  await there.locator("select").nth(1).selectOption("16");
  await expect(
    there.getByText(/no verified location for Gate 16/),
  ).toBeVisible();
  console.log(
    `walk from ${fromName}: ${await there.locator("p").nth(1).textContent()}`,
  );

  // The arena guide, from the arena's own pages.
  await seats(host.page).getByText("Gates, getting in, accessibility").click();
  await expect(
    seats(host.page).getByText(
      "Every entrance is accessible except Gates 3 and 7.",
    ),
  ).toBeVisible();
  await expect(
    seats(host.page).getByText(/never picks one for you/),
  ).toBeVisible();

  // ------------------------------------------------------------ phones
  await fitsThePhone(host.page, 390);
  await guest.page.reload();
  await expect(row(guest.page, "Maya")).toBeVisible();
  await fitsThePhone(guest.page, 320);
  if (SHOTS) {
    await seats(host.page).screenshot({ path: `${SHOTS}/seats-390-host.png` });
    await seats(guest.page).screenshot({
      path: `${SHOTS}/seats-320-guest.png`,
    });
  }

  // ------------------------------------- the rest of the night is intact
  await openTab(guest.page, "Play");
  await openTab(guest.page, "Group");
  await openTab(guest.page, "Plan");
  await expect(guest.page.locator("#vote-pregame-spot")).toBeVisible();

  // Clearing my seat.
  await row(guest.page, "Maya")
    .getByRole("button", { name: "Edit my seat" })
    .click();
  await guest.page
    .getByRole("form", { name: "My seat" })
    .getByRole("button", { name: "Clear" })
    .click();
  await expect(row(guest.page, "Maya").getByText("No seat yet")).toBeVisible();

  await host.context.close();
  await guest.context.close();
});
