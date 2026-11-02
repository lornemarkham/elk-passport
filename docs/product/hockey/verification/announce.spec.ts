import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import {
  type Person,
  moveStart,
  night,
  noSidewaysScroll,
  peopleCalled,
  phone,
  refused,
  setNight,
  signUp,
  snapshot,
} from "./mayhem-helpers";

/**
 * **Host announcements and chat replies — two real accounts, the real
 * database** (`docs/product/hockey/announce-migration.sql` applied).
 *
 *   lorne (host, phone 390)   announces "CHANGE OF PLANS!"
 *   alex  (guest, phone 390)  sees it on every tab, taps Got it!, replies
 *
 * What it proves: the host's announcement is in front of the guest on Plan
 * and Play and in a period's "phones away" screen; View location opens a
 * map search for the place named; Got it! is a ✅ the host can count; a
 * guest cannot announce (UI and API, 403); a reply quotes the line it
 * answers on both phones; the host can take an announcement down; nothing
 * scrolls sideways at 390.
 *
 * Run against `next start` on the stack's env:
 *   set -a; . "$STACK/env"; set +a
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification announce
 */

peopleCalled("announce");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });

const SHOTS = process.env.ANNOUNCE_SHOTS;
async function shot(p: Person, name: string) {
  if (!SHOTS) return;
  await p.page.waitForTimeout(600);
  await p.page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

let lorne: Person;
let alex: Person;

const banner = (p: Person) =>
  p.page.getByRole("status", { name: "Announcement from the host" });

test("the night, two phones", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await phone(browser);
  await page.goto("/hockey/my-nights");
  await signUp(page, "lorne");
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await page.getByLabel("Game date").fill(in2);
  await page.getByLabel("Puck drop time").fill("19:00");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(page.url().split("/").pop()!);
  await page.getByRole("button", { name: /Skip/ }).click();
  lorne = {
    who: "lorne",
    name: "Lorne",
    page,
    id: (await snapshot(page)).state.meId,
  };
  expect(
    (await snapshot(page)).announce,
    "announce-migration.sql applied",
  ).toBe(true);

  const res = await page.request.post(
    `/hockey/api/occasions/${night}/invites`,
    {
      data: { label: "Alex" },
    },
  );
  const { token } = await res.json();
  const guest = await phone(browser);
  await guest.goto(`/hockey/join/${token}`);
  await guest.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(guest, "alex");
  await guest.getByLabel("Your name").fill("Alex");
  await guest.getByRole("button", { name: "I'm in" }).click();
  await expect(guest).toHaveURL(new RegExp(`/hockey/${night}$`));
  alex = {
    who: "alex",
    name: "Alex",
    page: guest,
    id: (await snapshot(guest)).state.meId,
  };
});

test("a guest cannot announce — no button, and the API says 403", async () => {
  await openTab(alex.page, "Chat");
  await expect(
    alex.page.getByRole("button", { name: "Announce a change" }),
  ).toHaveCount(0);
  await refused(
    alex.page,
    { type: "announce", tag: "venue", text: "Everyone to my place." },
    403,
  );
});

test("the host announces a venue change; the guest sees it on every tab", async () => {
  await openTab(lorne.page, "Chat");
  await lorne.page.getByRole("button", { name: "Announce a change" }).click();
  const sheet = lorne.page.getByRole("dialog", { name: "Tell everyone" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /Venue change/ }).click();
  await sheet
    .getByLabel("What's changed")
    .fill("Shark Club is packed. We're going to Boston Pizza instead.");
  await sheet.getByLabel(/Place to show on a map/).fill("Boston Pizza");
  await expect(
    sheet.getByText(/View location opens: https:\/\/www\.google\.com\/maps/),
  ).toBeVisible();
  await shot(lorne, "01-host-announce-sheet");
  await sheet.getByRole("button", { name: "Announce it" }).click();
  await expect(sheet).toHaveCount(0);

  // The host's own announcement is not in front of the host: it is a card
  // in the chat with its receipts.
  await expect(banner(lorne)).toHaveCount(0);
  const hostCard = lorne.page.locator("[data-announcement-card='venue']");
  await expect(hostCard).toContainText("CHANGE OF PLANS!");
  await expect(hostCard).toContainText("0 of 1 got it · waiting on Alex");
  await shot(lorne, "02-host-chat-card");

  // The guest, on Plan (the default room): the banner, within a poll.
  await openTab(alex.page, "Plan");
  await expect(banner(alex)).toBeVisible({ timeout: 15_000 });
  await expect(banner(alex)).toContainText("CHANGE OF PLANS!");
  await expect(banner(alex)).toContainText("Boston Pizza instead");
  await expect(banner(alex)).toContainText("Lorne · Venue change");
  const view = banner(alex).getByRole("link", { name: "View location" });
  await expect(view).toHaveAttribute(
    "href",
    /google\.com\/maps\/search\/\?api=1&query=Boston(%20|\+)Pizza/,
  );
  await noSidewaysScroll(alex.page);
  await shot(alex, "03-guest-banner-plan");

  // Still there on Play, and in the chat as a card too.
  await openTab(alex.page, "Play");
  await expect(banner(alex)).toBeVisible();
  await openTab(alex.page, "Chat");
  await expect(banner(alex)).toBeVisible();
  await expect(
    alex.page.locator("[data-announcement-card='venue']"),
  ).toContainText("Boston Pizza instead");
});

test("Got it! takes it out of the guest's way and counts for the host", async () => {
  await banner(alex).getByRole("button", { name: "Got it!" }).click();
  await expect(banner(alex)).toHaveCount(0);
  const card = alex.page.locator("[data-announcement-card='venue']");
  await expect(card.getByRole("button", { name: /You got it/ })).toBeVisible();
  // A reload does not bring it back: the ✅ is in the database.
  await alex.page.reload();
  await expect(alex.page.getByRole("tab", { name: /^Plan/ })).toBeVisible();
  await expect(banner(alex)).toHaveCount(0);

  await expect(
    lorne.page.locator("[data-announcement-card='venue']"),
  ).toContainText("Everyone got it.", { timeout: 15_000 });
  await shot(lorne, "04-host-everyone-got-it");
});

test("a reply quotes the line it answers, on both phones", async () => {
  await openTab(alex.page, "Chat");
  await alex.page
    .getByLabel("Say something to the group")
    .fill("Who's bringing the flag?");
  await alex.page.getByRole("button", { name: "Send" }).click();
  await expect(alex.page.getByText("Who's bringing the flag?")).toBeVisible();

  await openTab(lorne.page, "Chat");
  const theirs = lorne.page
    .locator("li")
    .filter({ hasText: "Who's bringing the flag?" })
    .first();
  await expect(theirs).toBeVisible({ timeout: 15_000 });
  await theirs.getByRole("button", { name: "Reply" }).click();
  const bar = lorne.page.locator("[data-replying]");
  await expect(bar).toContainText("Replying to Alex");
  await expect(bar).toContainText("Who's bringing the flag?");
  const input = lorne.page.getByLabel("Say something to the group");
  await expect(input).toHaveAttribute("placeholder", "Reply to Alex");
  await input.fill("Me. It's enormous.");
  await lorne.page.getByRole("button", { name: "Send" }).click();
  await expect(bar).toHaveCount(0);

  const reply = lorne.page
    .locator("li")
    .filter({ hasText: "Me. It's enormous." })
    .first();
  await expect(reply.locator("[data-quote]")).toContainText("Alex");
  await expect(reply.locator("[data-quote]")).toContainText(
    "Who's bringing the flag?",
  );
  await shot(lorne, "05-host-reply");

  const seen = alex.page
    .locator("li")
    .filter({ hasText: "Me. It's enormous." })
    .first();
  await expect(seen).toBeVisible({ timeout: 15_000 });
  await expect(seen.locator("[data-quote]")).toContainText(
    "Who's bringing the flag?",
  );
  await noSidewaysScroll(alex.page);
  await shot(alex, "06-guest-sees-reply");

  // A reply to somebody else's line is stored as a reply, not reinterpreted.
  const snap = await snapshot(alex.page);
  const stored = snap.state.moments?.find(
    (m: { text?: string }) => m.text === "Me. It's enormous.",
  );
  expect(stored?.replyTo).toBeTruthy();
});

test("in a period, an announcement is above 'phones away'; the host can take one down", async () => {
  // Puck drop ten minutes ago: the first period, phones away for the arena crowd.
  await moveStart(new Date(Date.now() - 10 * 60_000), "lorne");
  await alex.page.reload();
  await expect(alex.page.getByText(/Put your phone away/i)).toBeVisible({
    timeout: 20_000,
  });

  await lorne.page.reload();
  // The host peeks at the chat to announce from it.
  await lorne.page.getByRole("button", { name: /Open the chat/ }).click();
  await lorne.page.getByRole("button", { name: "Announce a change" }).click();
  const sheet = lorne.page.getByRole("dialog", { name: "Tell everyone" });
  await sheet.getByRole("button", { name: /Meeting spot/ }).click();
  await sheet
    .getByLabel("What's changed")
    .fill("Section 112 for the second. Bring the flag.");
  await sheet.getByRole("button", { name: "Announce it" }).click();
  await expect(sheet).toHaveCount(0);

  await expect(banner(alex)).toBeVisible({ timeout: 15_000 });
  await expect(banner(alex)).toContainText("NEW MEETING SPOT");
  await expect(alex.page.getByText(/Put your phone away/i)).toBeVisible();
  await noSidewaysScroll(alex.page);
  await shot(alex, "07-guest-period-banner");

  // Taken down by the host: gone from the guest within a poll.
  const card = lorne.page.locator("[data-announcement-card='meeting']");
  await card.getByRole("button", { name: "Take it down" }).click();
  await card.getByRole("button", { name: "Yes, take it down" }).click();
  await expect(card).toHaveCount(0);
  await expect(banner(alex)).toHaveCount(0, { timeout: 15_000 });
});
