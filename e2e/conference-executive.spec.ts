import { execFileSync } from "node:child_process";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * **Conference, as a participant meets it:** a realistic conference (an
 * organiser, three named colleagues and one who stays unlisted, flights, a
 * published agenda, a dinner chosen by vote) and the empty state of a
 * conference called "test" with nobody else in it.
 *
 * Every screen is opened as somebody who belongs there, and every link on
 * it is followed: nothing on a conference screen may lead nowhere. The data
 * is entered through the public API as the people it belongs to, by
 * `scripts/conference-demo/seed.mjs` — the same script the screenshots use.
 *
 * Needs a server with conferences open on the memory store and guests
 * allowed to organise (see conference.spec.ts), with
 * `CONFERENCE_ARRIVALS`/`CONFERENCE_TOGETHER` open (they are, in
 * development). Against any other server it skips and says why.
 */

type Seed = {
  id: string;
  places?: string[];
  people: Record<string, string>;
};

const seed = (baseURL: string, mode: "full" | "solo"): Seed =>
  JSON.parse(
    execFileSync("node", ["scripts/conference-demo/seed.mjs", baseURL, mode], {
      encoding: "utf8",
    }),
  );

async function as(
  browser: Browser,
  baseURL: string,
  cookie: string,
  phone = false,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(
    phone
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1360, height: 900 } },
  );
  const [name, value] = cookie.split(/=([\s\S]*)/);
  await ctx.addCookies([{ name: name!, value: value!, url: baseURL }]);
  return { ctx, page: await ctx.newPage() };
}

/** Every internal link on the page answers 200 — no decorative dead ends. */
async function linksAllWork(page: Page, where: string) {
  // The conference frame only: the Go Have a Day bar above it is the platform's.
  const hrefs = await page.$$eval(".cf-root a[href]", (as) =>
    as.map((a) => a.getAttribute("href")!),
  );
  expect(
    hrefs.filter((h) => h === "" || h === "#"),
    `${where}: empty links`,
  ).toEqual([]);
  const internal = [
    ...new Set(
      hrefs
        .filter((h) => h.startsWith("/"))
        .map((h) => h.split("#")[0]!)
        .filter(Boolean),
    ),
  ];
  for (const h of internal) {
    const r = await page.request.get(h, { maxRedirects: 0 });
    expect(r.status(), `${where} → ${h}`).toBeLessThan(400);
  }
  return internal;
}

test.describe.configure({ mode: "serial" });

test("a realistic conference: every screen, every link, the day's journeys", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(480_000);
  const probe = await browser.newPage();
  await probe.goto("/conferences");
  test.skip(
    (await probe.getByRole("link", { name: "Start a conference" }).count()) ===
      0,
    "Conferences are closed or guests can't organise here; see the header comment.",
  );
  await probe.close();

  const s = seed(baseURL!, "full");
  const base = `/conferences/${s.id}`;
  const screens = [
    "",
    "/schedule",
    "/arrivals",
    "/discover",
    "/people",
    "/plans",
    "/chat",
    "/memories",
    "/you",
  ];

  // ── Daniel, a participant, on a laptop ──
  const daniel = await as(browser, baseURL!, s.people.daniel!);
  const p = daniel.page;
  await p.goto(base);
  await expect(p.getByTestId("conference-name")).toHaveText(
    "Sycle Vancouver 2026",
  );
  await expect(p.getByTestId("fact-venue")).toContainText(
    "Vancouver Convention Centre West",
  );
  await expect(p.getByTestId("fact-participants")).toContainText("5");
  await expect(p.getByTestId("now-card")).toBeVisible();
  // No form on the overview: the name/privacy controls moved to the profile.
  await expect(p.getByLabel("Your name here")).toHaveCount(0);
  await expect(p.locator("main form")).toHaveCount(0);
  // Who's here: named people, and the unlisted one counted, not named.
  await expect(p.getByTestId("people-panel")).toContainText(
    "One person is here without being listed",
  );
  await expect(p.getByTestId("arrivals-summary")).toContainText("Priya Raman");

  // Every tab is there and goes somewhere real.
  const tabs = p.getByRole("navigation", { name: "Conference" });
  for (const t of ["Overview", "Arrivals", "Agenda", "Explore", "People"])
    await expect(tabs.getByRole("link", { name: t })).toBeVisible();

  for (const screen of screens) {
    const r = await p.goto(`${base}${screen}`);
    expect(r?.status(), screen || "overview").toBe(200);
    await linksAllWork(p, screen || "overview");
  }

  // The agenda: published lines and the colleagues' dinner, told apart.
  await p.goto(`${base}/schedule`);
  const day1 = p.getByTestId("agenda");
  await expect(day1).toContainText("Opening keynote");
  await expect(day1).toContainText("Team dinner after the customer panel");
  await expect(day1.locator('[data-entry="plan"]')).toHaveCount(1);
  await p.getByRole("link", { name: /Day 2/ }).click();
  await expect(p.getByTestId("agenda")).toContainText("Staff hockey game");
  await expect(p.getByTestId("agenda")).toContainText("Featured");

  // The dinner: chosen by vote, and the choice is where we meet.
  await p.goto(`${base}/plans`);
  const dinner = p.locator('[id^="plan-"]', {
    hasText: "Team dinner after the customer panel",
  });
  if (s.places?.length) {
    await expect(dinner).toContainText(`Meet at: ${s.places[0]}`);
    await expect(dinner).not.toContainText("Going to:");
  }

  // Answering from the overview works and sticks.
  await p.goto(base);
  const walk = p
    .getByTestId("up-next")
    .locator('[data-plan="Seawall walk before the sessions"]');
  await walk.getByRole("button", { name: "I'm in" }).click();
  await expect(walk.getByRole("button", { name: "I'm in" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await p.reload();
  await expect(
    p
      .getByTestId("up-next")
      .locator('[data-plan="Seawall walk before the sessions"]')
      .getByRole("button", { name: "I'm in" }),
  ).toHaveAttribute("aria-pressed", "true");

  // The profile menu: profile, plans, memories — no organiser settings for him.
  await p.getByRole("button", { name: "Your profile and settings" }).click();
  const menu = p.getByRole("menu");
  await expect(
    menu.getByRole("menuitem", { name: "Organiser settings" }),
  ).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Your profile & privacy" }).click();
  await p.waitForURL(`**${base}/you`);
  await expect(p.getByLabel("Your name here")).toHaveValue("Daniel Okafor");
  // Members still can't reach organiser settings by URL.
  await p.goto(`${base}/admin`);
  await p.waitForURL(`**${base}`);

  // People: the directory says what each person chose to share.
  await p.goto(`${base}/people`);
  const dir = p.getByTestId("people-directory");
  await expect(dir.getByRole("listitem")).toHaveCount(4);
  await expect(dir).toContainText("AC116 from Toronto");
  await expect(
    p.getByText("One more person is in this conference without being listed"),
  ).toBeVisible();

  // Arrivals: the timeline places everyone at the time the board gives.
  await p.goto(`${base}/arrivals`);
  await expect(p.getByTestId("arrival-timeline")).toContainText("(scheduled)");
  await expect(
    p.getByTestId("arrivals-list").getByRole("listitem"),
  ).toHaveCount(4);
  await daniel.ctx.close();

  // ── Maya, the organiser: settings are behind her profile, and work ──
  const maya = await as(browser, baseURL!, s.people.organiser!);
  await maya.page.goto(base);
  await expect(maya.page.getByTestId("organiser-setup")).toHaveCount(0); // all set up
  await maya.page
    .getByRole("button", { name: "Your profile and settings" })
    .click();
  await maya.page.getByRole("menuitem", { name: "Organiser settings" }).click();
  await maya.page.waitForURL(`**${base}/admin`);
  await linksAllWork(maya.page, "admin");
  const editor = maya.page.getByTestId("agenda-editor");
  await expect(editor.locator("[data-agenda-line]")).toHaveCount(16);
  await editor.getByLabel("What").fill("Lightning talks");
  await editor.getByLabel(/^Starts/).fill("16:50");
  await editor.getByLabel(/^Ends/).fill("17:30");
  await editor.getByLabel(/^Where/).fill("Room 211");
  await editor.getByRole("button", { name: "Add to the agenda" }).click();
  await expect(editor.getByText("Published.")).toBeVisible();
  await expect(
    editor.locator('[data-agenda-line="Lightning talks"]'),
  ).toBeVisible();
  await maya.page.goto(`${base}/schedule`);
  await expect(maya.page.getByTestId("agenda")).toContainText(
    "Lightning talks",
  );
  // The details form leaves the agenda alone.
  await maya.page.goto(`${base}/admin`);
  await maya.page
    .getByLabel(/^One line about it/)
    .fill("Three days on the waterfront.");
  await maya.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(maya.page.getByText("Saved.")).toBeVisible();
  await maya.page.reload();
  await expect(
    maya.page
      .getByTestId("agenda-editor")
      .locator('[data-agenda-line="Lightning talks"]'),
  ).toBeVisible();
  await maya.ctx.close();

  // ── Priya on her phone: the tab bar is where her thumb is ──
  const priya = await as(browser, baseURL!, s.people.priya!, true);
  // `next dev` puts its "N" badge over the bottom-left corner, where the
  // Overview tab is. It doesn't exist in a build; hide it here.
  await priya.page.goto(base);
  await priya.page.addStyleTag({
    content: "nextjs-portal{display:none!important}",
  });
  const bar = priya.page.getByRole("navigation", {
    name: "Conference sections",
  });
  await expect(bar).toBeVisible();
  for (const [label, path] of [
    ["Agenda", "/schedule"],
    ["Arrivals", "/arrivals"],
    ["Explore", "/discover"],
    ["People", "/people"],
    ["Overview", ""],
  ] as const) {
    await bar.getByRole("link", { name: label }).click();
    await priya.page.waitForURL(new RegExp(`${base}${path}$`));
    const wide = await priya.page.evaluate(
      () => document.scrollingElement!.scrollWidth - window.innerWidth,
    );
    expect(wide, `${label} scrolls sideways on a phone`).toBeLessThanOrEqual(1);
  }
  await priya.ctx.close();

  // ── A stranger can't tell any of it exists ──
  const stranger = await browser.newContext();
  const sp = await stranger.newPage();
  for (const screen of [...screens, "/admin"])
    expect(
      (await sp.goto(`${base}${screen}`))?.status(),
      screen || "overview",
    ).toBe(404);
  await stranger.close();
});

test("empty: one organiser, a conference called “test”", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const probe = await browser.newPage();
  await probe.goto("/conferences");
  test.skip(
    (await probe.getByRole("link", { name: "Start a conference" }).count()) ===
      0,
    "Conferences are closed or guests can't organise here.",
  );
  await probe.close();

  const s = seed(baseURL!, "solo");
  const base = `/conferences/${s.id}`;
  const { ctx, page } = await as(browser, baseURL!, s.people.organiser!);
  await page.goto(base);
  // Not renamed, not padded out.
  await expect(page.getByTestId("conference-name")).toHaveText("test");
  await expect(page.getByTestId("fact-venue")).toContainText("Add the venue");
  await expect(page.getByTestId("fact-participants")).toContainText("1");
  await expect(page.getByTestId("now-card")).toContainText(
    "The agenda hasn't been published yet",
  );
  await expect(page.getByText("It's just you in here so far.")).toBeVisible();
  const setup = page.getByTestId("organiser-setup");
  await expect(setup).toContainText("4 things left to set up");
  await linksAllWork(page, "empty overview");

  // Each next step goes to the place that finishes it.
  await setup.getByRole("link", { name: /Publish the agenda/ }).click();
  await page.waitForURL(`**${base}/admin#agenda`);
  const editor = page.getByTestId("agenda-editor");
  await editor.getByLabel("What").fill("Opening keynote");
  await editor.getByLabel(/^Starts/).fill("09:00");
  await editor.getByRole("button", { name: "Add to the agenda" }).click();
  await expect(editor.getByText("Published.")).toBeVisible();
  await page.getByRole("button", { name: "New link" }).click();
  await expect(page.getByTestId("invite-link")).toHaveCount(1);
  await page.goto(base);
  await expect(page.getByTestId("organiser-setup")).toContainText(
    "3 things left to set up",
  );
  await expect(page.getByTestId("now-card")).toContainText("Opening keynote");
  await ctx.close();
});
