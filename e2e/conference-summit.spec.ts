import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Browser } from "@playwright/test";

/**
 * **A company summit, from the organiser's import to an attendee's phone.**
 *
 * The agenda is a made-up four-day summit (`e2e/fixtures/summit.agenda.json`,
 * the same shape as a real one: an evening mixer, breakfasts with ends,
 * sessions with topics and no ends, breaks, a celebration dinner). A real
 * company's programme is never committed to this public repository; it is
 * checked against a pinned clock outside it.
 *
 * Needs conferences open on the memory store with guest organisers (see
 * scripts/conference-demo/README.md), like conference-executive.spec.ts.
 */

const FILE = "e2e/fixtures/summit.agenda.json";

type Seed = { id: string; people: Record<string, string> };
const seed = (baseURL: string): Seed =>
  JSON.parse(
    execFileSync(
      "node",
      ["scripts/conference-demo/seed.mjs", baseURL, "solo"],
      {
        encoding: "utf8",
      },
    ),
  );

const as = async (
  browser: Browser,
  baseURL: string,
  cookie: string,
  width = 1280,
) => {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    ...(width < 600 ? { isMobile: true, hasTouch: true } : {}),
  });
  const [name, value] = cookie.split("=");
  await ctx.addCookies([{ name: name!, value: value!, url: baseURL }]);
  return ctx.newPage();
};

test.describe.configure({ mode: "serial" });

test("an organiser imports the summit's agenda; attendees live it on their phones", async ({
  browser,
  baseURL,
  request,
}) => {
  test.setTimeout(240_000);
  const probe = await browser.newPage();
  await probe.goto("/conferences");
  test.skip(
    (await probe.getByRole("link", { name: "Start a conference" }).count()) ===
      0,
    "Conferences are closed or guests can't organise here.",
  );
  await probe.close();

  const s = seed(baseURL!);
  const base = `/conferences/${s.id}`;
  const org = await as(browser, baseURL!, s.people.organiser!);

  // ── The organiser imports the file ──
  await org.goto(`${base}/admin#agenda`);
  const imp = org.getByTestId("agenda-import");
  await imp.locator("summary").click();
  await imp.getByTestId("agenda-import-text").fill(readFileSync(FILE, "utf8"));
  const preview = imp.getByTestId("agenda-import-preview");
  await expect(preview.getByTestId("import-added")).toHaveText("16 new lines");
  await expect(preview).toContainText("First day: ");
  await expect(preview).toContainText(
    "Venue: not set → Harbour Hotel, 1 Quay Street",
  );
  await imp.getByTestId("agenda-import-apply").click();
  await expect(imp.getByTestId("agenda-import-done")).toContainText("16 added");
  await expect(org.getByTestId("agenda-editor")).toContainText(
    "Celebration Dinner",
  );

  // Again: nothing to do, nothing doubled.
  await imp.getByTestId("agenda-import-text").fill(readFileSync(FILE, "utf8"));
  await expect(imp.getByTestId("agenda-import-preview")).toContainText(
    "Already up to date",
  );
  await expect(imp.getByTestId("agenda-import-apply")).toBeDisabled();
  await org.reload();
  await expect(
    org.locator("[data-agenda-line='Celebration Dinner']"),
  ).toHaveCount(1);

  // ── An attendee joins by link ──
  const invite = await org.request.post(`/api/conferences/${s.id}/invites`, {
    data: {},
  });
  const { token } = (await invite.json()) as { token: string };
  const join = await request.post("/api/conferences/join", { data: { token } });
  expect(join.ok()).toBeTruthy();
  const cookie = (join.headers()["set-cookie"] ?? "").split(";")[0]!;

  for (const width of [320, 375, 390]) {
    const phone = await as(browser, baseURL!, cookie, width);
    await phone.goto(`${base}/schedule?day=2026-10-28`);
    const days = phone.locator('nav[aria-label="Days"] a');
    await expect(days).toHaveCount(4);
    await expect(days.nth(2)).toHaveAttribute("aria-current", "page");
    // The celebration is dressed for it; a break is one quiet line.
    await expect(
      phone.locator('details[data-kind="celebration"].cf-gala'),
    ).toHaveCount(1);
    // Tabs, in the brief's order: Home · Agenda · Arrivals · Explore · People.
    const tabs = await phone
      .locator('nav[aria-label="Conference sections"] a')
      .allInnerTexts();
    const order = ["Home", "Agenda", "Arrivals", "Explore", "People"].filter(
      (t) => tabs.some((x) => x.includes(t)),
    );
    expect(tabs.map((x) => x.trim())).toEqual(order);
    for (const path of [
      "/schedule?day=2026-10-28",
      "/schedule/tue-general",
      "",
    ]) {
      if (path !== "/schedule?day=2026-10-28")
        await phone.goto(`${base}${path}`);
      // Against the phone's own width: an over-wide child makes a mobile
      // browser widen the whole layout, so compare with the device.
      const wide = await phone.evaluate(
        (w) => document.documentElement.scrollWidth - w,
        width,
      );
      expect(wide, `${path || "home"} at ${width}px`).toBeLessThanOrEqual(1);
    }
    await phone.context().close();
  }

  const me = await as(browser, baseURL!, cookie, 390);
  await me.goto(`${base}/schedule?day=2026-10-27`);
  const general = me.locator('li[data-entry-id="tue-general"]');
  await general.locator("summary").click();
  await expect(general.getByTestId("session-topics")).toContainText(
    "Values, with a comma",
  );
  await expect(general).toContainText("the agenda gives no end time");

  // Save it; it appears in My schedule; remove it again.
  await general.getByTestId("save-session").click();
  await expect(general.getByTestId("save-session")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await me.getByTestId("my-schedule-tab").click();
  await expect(me.getByTestId("my-schedule")).toContainText("General Session");
  await expect(me.getByTestId("export-mine")).toHaveAttribute(
    "href",
    /ids=tue-general/,
  );
  await me
    .locator('[data-mine="tue-general"]')
    .getByTestId("save-session")
    .click();
  await expect(me.getByTestId("my-schedule")).toContainText(
    "Nothing saved yet.",
  );

  // Reminders: a default, a per-session override, carried into the calendar.
  await me.getByTestId("reminder-lead").first().selectOption("15");
  await me.goto(`${base}/schedule/wed-gala`);
  await expect(me.getByTestId("session")).toHaveClass(/cf-gala/);
  await expect(me.getByTestId("session-where")).toHaveText("Grand Ballroom");
  await me.getByTestId("session-reminder").selectOption("30");
  const href = await me.getByTestId("session-calendar").getAttribute("href");
  expect(href).toContain("lead=15");
  expect(href).toContain("o=wed-gala%3A30");
  const ics = await (await me.request.get(href!)).text();
  expect(ics).toContain("DTSTART;TZID=America/Vancouver:20261028T183000");
  expect(ics).toContain("TRIGGER:-PT30M");
  expect(ics).toContain("BEGIN:VTIMEZONE");

  const all = await (
    await me.request.get(`/api/conferences/${s.id}/calendar`)
  ).text();
  expect(all.split("BEGIN:VEVENT").length - 1).toBe(16);

  // ── Strangers ──
  const stranger = await browser.newPage();
  for (const path of [
    `${base}/schedule`,
    `${base}/schedule/wed-gala`,
    `${base}/bingo`,
  ]) {
    const r = await stranger.goto(path);
    expect(r?.status()).toBe(404);
  }
  expect(
    (await stranger.request.get(`/api/conferences/${s.id}/calendar`)).status(),
  ).toBe(404);

  // ── Bingo: off until the organiser switches it on ──
  expect((await me.goto(`${base}/bingo`))?.status()).toBe(404);
});
