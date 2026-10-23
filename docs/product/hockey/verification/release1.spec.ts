import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Small release 1: Plan as five decisions, with a host and a guest.**
 *
 * Needs the local stack (stack.mjs start, with seats and arena) and
 * `atlas-seats-stub.mjs` serving the real candidates body as ATLAS_API_URL.
 * Proves what `RELEASE-1-UX.md` changed:
 *
 *   Plan opens on five rows (before, getting there, meeting point, seats,
 *   after), each with its state and one tap to open → the dinner vote shows
 *   three places, not the whole neighbourhood, with all of them one tap away
 *   → nominating and voting still work and the row follows → the concourse
 *   is one compact row → seats and the meeting point are edited from their
 *   rows and survive a reload → a guest on a 320 px phone votes, ties, and
 *   their votes survive a reload → the guest cannot set the host's meeting
 *   point → Arena sits in the middle of the bar, goes to Arena Mode, and its
 *   bar comes back → nothing scrolls sideways, at 320 px or on a desktop.
 */

const stamp = Date.now().toString(36);
const SHOTS = process.env.RELEASE1_SHOTS;

async function phone(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(`${who}-${stamp}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function shot(page: Page, name: string, full = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
}

const plan = (p: Page) => p.getByRole("region", { name: "The plan" });
const decision = (p: Page, label: string) =>
  plan(p).getByRole("region", { name: label, exact: true });
const toggle = (p: Page, label: string) =>
  decision(p, label).getByRole("button", { name: new RegExp(`^${label}`) });

async function open(p: Page, label: string) {
  const button = toggle(p, label);
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

/** No sideways scroll, and nothing to tap in the plan is under 40 px. */
async function fitsThePhone(page: Page, width: number) {
  const report = await page.evaluate(() => {
    const plan = document.querySelector('[aria-labelledby="plan-title"]')!;
    const small = [
      ...plan.querySelectorAll<HTMLElement>("a, button, select, input"),
    ]
      .filter((el) => el.offsetParent !== null)
      .filter(
        (el) => !(el instanceof HTMLInputElement && el.type === "checkbox"),
      )
      .filter((el) => el.getBoundingClientRect().height < 40)
      .map((el) => `${el.tagName} "${el.textContent?.trim().slice(0, 30)}"`);
    const tiny = [
      ...plan.querySelectorAll<HTMLElement>("p, span, li, a, button, label"),
    ]
      .filter((el) => el.offsetParent !== null && el.textContent?.trim())
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
      .map((el) => el.textContent!.trim().slice(0, 30));
    return { scroll: document.documentElement.scrollWidth, small, tiny };
  });
  expect(report.scroll, "no sideways scroll").toBeLessThanOrEqual(width);
  expect(report.small, "taps under 40px").toEqual([]);
  expect(report.tiny, "text under 12px").toEqual([]);
}

test("five decisions, three places, Arena in the bar — host and guest", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  // ------------------------------------------------------------ the host
  const host = await phone(browser, 390);
  await host.page.goto("/hockey");
  await signUp(host.page, "r1-host");
  await host.page.getByLabel("Your name").fill("Lorne");
  await host.page.getByRole("button", { name: "Start it" }).click();
  await expect(host.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightPath = new URL(host.page.url()).pathname;
  await host.page.getByRole("button", { name: /Skip/ }).click();

  // Five rows, in order, each with somewhere to tap.
  await expect(plan(host.page)).toBeVisible();
  const labels = [
    "Before the game",
    "Getting there",
    "Meeting point",
    "Our seats",
    "After the game",
  ];
  for (const label of labels)
    await expect(toggle(host.page, label)).toBeVisible();
  const ys = await Promise.all(
    labels.map(async (l) => (await toggle(host.page, l).boundingBox())!.y),
  );
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  // Nothing is open, so nothing below the plan but Run it back's absence:
  // the whole of Plan is about a phone screen and a half.
  await expect(plan(host.page).locator("[aria-expanded=true]")).toHaveCount(0);
  const tall = await host.page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  expect(tall, "Plan, closed, is short").toBeLessThan(844 * 2);
  await expect(toggle(host.page, "Before the game")).toContainText("Vote");
  await expect(toggle(host.page, "Our seats")).toContainText("Add yours");
  await expect(toggle(host.page, "Getting there")).toContainText("Set");
  await shot(host.page, "01-plan-host-390");
  await fitsThePhone(host.page, 390);

  // ------------------------------------------------- the dinner vote
  await open(host.page, "Before the game");
  const near = host.page.getByRole("region", {
    name: "Places near Rogers Arena",
  });
  // Nothing real on the vote yet, so the places are already open: three.
  await expect(near.getByRole("article").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(near.getByRole("article")).toHaveCount(3);
  // The concourse is one compact row, not a poster.
  const concourse = decision(host.page, "Before the game").locator(
    '[data-option="Just eat in the concourse"]',
  );
  expect((await concourse.boundingBox())!.height).toBeLessThan(110);
  await shot(host.page, "02-before-the-game-390", true);
  await fitsThePhone(host.page, 390);

  // Everything else is one tap away.
  const all = near.getByRole("button", { name: /^See all \d+ places$/ });
  const count = Number((await all.textContent())!.match(/\d+/)![0]);
  expect(count).toBeGreaterThan(3);
  await all.click();
  await expect(near.getByRole("article")).toHaveCount(count);
  await near.getByRole("button", { name: "Bars & pubs" }).click();
  await near.getByRole("button", { name: "All" }).click();

  // Nominate the first place and vote for it; the row follows.
  const first = near.getByRole("article").first();
  const place = (await first.getAttribute("aria-label"))!;
  await first.getByRole("button", { name: `Nominate ${place}` }).click();
  const vote = decision(host.page, "Before the game").getByRole("button", {
    name: `Vote for ${place}`,
  });
  await expect(vote).toBeVisible();
  await vote.click();
  await expect(vote).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(host.page, "Before the game")).toContainText(place);
  await expect(toggle(host.page, "Before the game")).toContainText("1 vote");

  // A typed nomination still goes on the vote.
  await decision(host.page, "Before the game")
    .getByLabel("Somewhere else? Type a name")
    .fill("Dave's basement");
  await decision(host.page, "Before the game")
    .getByRole("button", { name: "Add" })
    .click();
  await expect(
    decision(host.page, "Before the game").getByRole("button", {
      name: "Vote for Dave's basement",
    }),
  ).toBeVisible();

  // One open at a time.
  await open(host.page, "Meeting point");
  await expect(toggle(host.page, "Before the game")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await decision(host.page, "Meeting point")
    .getByRole("button", { name: /Just meet at our seats/ })
    .click();
  await expect(toggle(host.page, "Meeting point")).toContainText(
    "Just meet at our seats",
  );

  // ------------------------------------------------------- seats, walk
  await open(host.page, "Our seats");
  await decision(host.page, "Our seats")
    .getByRole("button", { name: "Add my seat" })
    .first()
    .click();
  const form = host.page.getByRole("form", { name: "My seat" });
  await form.getByLabel("Section").fill("309");
  await form.getByLabel("Row").fill("12");
  await form.getByLabel("Seat(s)").fill("1-2");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toHaveCount(0);
  await expect(toggle(host.page, "Our seats")).toContainText(
    "Section 309 · Row 12 · Seats 1–2",
  );
  await expect(toggle(host.page, "Our seats")).toContainText("Edit");

  await open(host.page, "Getting there");
  await decision(host.page, "Getting there")
    .getByRole("button", { name: "Set a meeting point" })
    .click();
  const meet = host.page.getByRole("form", { name: "Meeting point" });
  await meet.getByLabel("Gate").selectOption("10");
  await meet.getByLabel("Time").fill("18:15");
  await meet.getByRole("button", { name: "Save" }).click();
  await expect(toggle(host.page, "Getting there")).toContainText(
    "6:15pm at the arena · Gate 10",
  );
  await expect(
    decision(host.page, "Getting there")
      .getByRole("group", {
        name: /^Walking directions/,
      })
      .first(),
  ).toBeVisible();
  await shot(host.page, "03-getting-there-390", true);
  await fitsThePhone(host.page, 390);

  // All of it survives a reload.
  await host.page.reload();
  await expect(toggle(host.page, "Before the game")).toContainText(place);
  await expect(toggle(host.page, "Meeting point")).toContainText(
    "Just meet at our seats",
  );
  await expect(toggle(host.page, "Our seats")).toContainText(
    "Section 309 · Row 12 · Seats 1–2",
  );
  await expect(toggle(host.page, "Getting there")).toContainText(
    "6:15pm at the arena · Gate 10",
  );

  // ------------------------------------------------------ Arena, in the bar
  const bar = host.page.getByRole("navigation", {
    name: "Hockey Night sections",
  });
  const order = await Promise.all(
    ["Plan", "Play", "Arena", "Chat", "Group"].map(async (name) => {
      const item =
        name === "Arena"
          ? bar.getByRole("link", { name: "Arena" })
          : bar.getByRole("tab", { name: new RegExp(`^${name}`) });
      await expect(item).toBeVisible();
      return (await item.boundingBox())!.x;
    }),
  );
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await bar.getByRole("link", { name: "Arena" }).click();
  await expect(host.page).toHaveURL(new RegExp(`${nightPath}/arena$`));
  await expect(host.page.locator("svg[data-level]")).toBeVisible();
  const arenaBar = host.page.getByRole("navigation", {
    name: "Hockey Night sections",
  });
  await expect(arenaBar.getByRole("link", { name: "Arena" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await shot(host.page, "04-arena-with-bar-390");
  await arenaBar.getByRole("link", { name: "Group" }).click();
  await expect(host.page).toHaveURL(new RegExp(`${nightPath}#group$`));
  await expect(host.page.getByRole("tab", { name: /^Group/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await host.page
    .getByRole("navigation", { name: "Hockey Night sections" })
    .getByRole("tab", { name: /^Plan/ })
    .click();

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
  await signUp(guest.page, "r1-guest");
  await expect(guest.page).toHaveURL(new RegExp(`${invitePath}$`));
  await guest.page.getByLabel("Your name").fill("Maya");
  await guest.page.getByRole("button", { name: "I'm in" }).click();
  await expect(guest.page).toHaveURL(new RegExp(`${nightPath}$`));

  // The guest sees the host's plan, and what is waiting on her.
  await expect(toggle(guest.page, "Before the game")).toContainText(place);
  await expect(toggle(guest.page, "Before the game")).toContainText("Vote");
  await expect(toggle(guest.page, "Getting there")).toContainText(
    "6:15pm at the arena · Gate 10",
  );
  await expect(toggle(guest.page, "Our seats")).toContainText("Add yours");
  await shot(guest.page, "05-plan-guest-320");
  await fitsThePhone(guest.page, 320);

  // She votes the other way: a tie, said as a tie, on both phones.
  await open(guest.page, "Before the game");
  // Something real is on the vote, so the places wait behind Explore.
  await expect(
    guest.page.getByRole("region", { name: "Places near Rogers Arena" }),
  ).toHaveCount(0);
  await expect(
    guest.page.getByRole("button", { name: /Explore places & vote/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await decision(guest.page, "Before the game")
    .getByRole("button", { name: "Vote for Just eat in the concourse" })
    .click();
  await expect(toggle(guest.page, "Before the game")).toContainText("Tied:");
  // Inviting left the host on Group.
  await host.page.getByRole("tab", { name: /^Plan/ }).click();
  await expect(toggle(host.page, "Before the game")).toContainText("Tied:", {
    timeout: 20_000,
  });
  await guest.page
    .getByRole("button", { name: /Explore places & vote/ })
    .click();
  await expect(
    guest.page
      .getByRole("region", { name: "Places near Rogers Arena" })
      .getByRole("article"),
  ).toHaveCount(3, { timeout: 30_000 });
  await shot(guest.page, "06-guest-explore-320", true);
  await fitsThePhone(guest.page, 320);

  // After the game: how she's leaving.
  await open(guest.page, "After the game");
  await decision(guest.page, "After the game")
    .getByRole("button", { name: /One drink after/ })
    .click();
  await expect(toggle(guest.page, "After the game")).toContainText(
    "One drink after",
  );

  // Her seat, from her own row.
  await open(guest.page, "Our seats");
  await expect(
    decision(guest.page, "Our seats").getByRole("button", {
      name: /Lorne's seat/,
    }),
  ).toHaveCount(0);
  await decision(guest.page, "Our seats")
    .getByRole("button", { name: "Add my seat" })
    .first()
    .click();
  const hers = guest.page.getByRole("form", { name: "My seat" });
  await hers.getByLabel("Section").fill("309");
  await hers.getByLabel("Row").fill("12");
  await hers.getByLabel("Seat(s)").fill("3");
  await hers.getByRole("button", { name: "Save" }).click();
  await expect(toggle(guest.page, "Our seats")).toContainText(
    "Section 309 · Row 12 · Seat 3",
  );

  // The meeting point is the host's to set.
  await open(guest.page, "Getting there");
  await expect(
    decision(guest.page, "Getting there").getByRole("button", {
      name: "Change it",
    }),
  ).toHaveCount(0);
  await fitsThePhone(guest.page, 320);

  // Her votes and seat survive a reload.
  await guest.page.reload();
  await expect(toggle(guest.page, "Before the game")).toContainText(
    "you: Just eat in the concourse",
  );
  await expect(toggle(guest.page, "After the game")).toContainText(
    "you: One drink after",
  );
  await expect(toggle(guest.page, "Our seats")).toContainText(
    "Section 309 · Row 12 · Seat 3",
  );

  // ------------------------------------------------------------ desktop
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: await host.context.storageState(),
  });
  const deskPage = await desk.newPage();
  await deskPage.goto(`${nightPath}#plan`);
  await expect(toggle(deskPage, "Before the game")).toContainText("Tied:");
  await open(deskPage, "Before the game");
  await expect(
    deskPage
      .getByRole("navigation", { name: "Hockey Night sections" })
      .getByRole("link", { name: "Arena" }),
  ).toBeVisible();
  await shot(deskPage, "07-desktop-before-the-game", true);
  expect(
    await deskPage.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1280);

  for (const c of [host.context, guest.context, desk]) await c.close();
});
