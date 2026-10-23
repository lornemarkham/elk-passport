import { expect, test, type Browser, type Page } from "@playwright/test";
import { openDecision, openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **The redesigned night, on two phones, against real Atlas places.**
 *
 * `acceptance.spec.ts` proves the room and `plan-and-results.spec.ts` the
 * plan and the call. This proves what the visual overhaul added on top of
 * them, end to end with real sign-ins:
 *
 *   photographs of real places on the dinner vote, with Passport's picture
 *   rule (own photo plain, a business's own-site photo labelled, a stock
 *   "restaurant" photo never shown as the place) → nominating from "More
 *   near Rogers Arena" → the other phone's plan following the vote → picks by
 *   thumb, sealed one at a time → the reveal, face down then turned over,
 *   judged by the engine → the final on the hero → "Now go have another."
 *
 * Needs a server whose Atlas is the real candidates body (not the synthetic
 * stub acceptance uses), from production on 2026-10-20:
 *
 *   node scripts/critic/atlas-mock.mjs <atlas-real.json> 54340
 *   set -a; . $STACK/env; set +a
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification redesign
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-redesign-${stamp}@example.test`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

async function moveStart(nightId: string, startsAt: string) {
  const auth = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor("lorne"), password: TEST_PASSWORD }),
  });
  const { access_token } = await auth.json();
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${access_token}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({ starts_at: startsAt }),
    },
  );
  expect((await res.json()) as unknown[]).toHaveLength(1);
}

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();

test.describe.configure({ mode: "serial" });
test.skip(
  !!process.env.CONFIRM_EMAIL,
  "this run signs up instantly; it needs an auto-confirming stack",
);

test("real places to vote on, picks by thumb, a reveal, and the next one", async ({
  browser,
}) => {
  test.setTimeout(240_000);

  // ------------------------------------------------------- two phones
  const lorne = await phone(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await lorne.page.getByLabel("Opponent").fill("Wild");
  await lorne.page.getByLabel("Game date").fill(inDays(4));
  await lorne.page.getByLabel("Puck drop time").fill("19:00");
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = lorne.page.url().split("/").pop()!;
  await lorne.page.getByRole("button", { name: /Skip/ }).click();

  // The game first: both sides, the clock, who's in.
  // (`.last()`: the slim bar that follows a scroll repeats the codes.)
  await expect(
    lorne.page.getByText("VAN", { exact: true }).last(),
  ).toBeInViewport();
  await expect(
    lorne.page.getByText("MIN", { exact: true }).last(),
  ).toBeInViewport();
  await expect(lorne.page.getByRole("timer")).toHaveAccessibleName(
    /^Puck drop in \d+ days? \d+ hrs? \d+ min$/,
  );
  await expect(lorne.page.getByText("1 in")).toBeVisible();

  await lorne.page.getByRole("button", { name: "Invite" }).click();
  await lorne.page.getByLabel("Who the invitation is for").fill("Maya");
  await lorne.page.getByRole("button", { name: "Make a link" }).click();
  const invitePath = new URL(
    (await lorne.page.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;

  const maya = await phone(browser);
  await maya.page.goto(invitePath);
  await maya.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(maya.page, "maya");
  await maya.page.getByLabel("Your name").fill("Maya");
  await maya.page.getByRole("button", { name: "I'm in" }).click();
  await expect(maya.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
  await expect(maya.page.getByText("2 in")).toBeVisible();

  // Votes waiting for her are counted on the tab.
  await expect(
    maya.page.getByRole("tab", { name: /^Plan, \d+ waiting$/ }),
  ).toBeVisible();

  // ---------------------------------------------- real places, real photos
  await openTab(lorne.page, "Plan");
  const near = (p: Page) =>
    p.getByRole("region", { name: "Places near Rogers Arena" });
  const card = (p: Page, name: string) =>
    near(p).getByRole("article", { name, exact: true });
  // Plan's first decision; three places first, every place one tap further.
  for (const p of [maya.page, lorne.page]) {
    await openDecision(p, "Before the game");
    await near(p)
      .getByRole("button", { name: /^See all \d+ places$/ })
      .click({ timeout: 30_000 });
  }

  // The place's own photograph, shown plainly.
  await expect(card(maya.page, "Chambar").locator("img")).toHaveAttribute(
    "src",
    /chambar\.com/,
  );
  // A photograph from the business's own site, said to be that.
  await expect(card(maya.page, "Moxies West Georgia")).toContainText(
    /From moxies\.ca/i,
  );
  // Atlas only has a stock "restaurant" picture: no picture, said plainly.
  await expect(card(maya.page, "Tokyo In April").locator("img")).toHaveCount(0);
  await expect(card(maya.page, "Tokyo In April")).toContainText(
    /No photo Passport can vouch for yet/i,
  );
  // Atlas's stated hours for game day, quoted.
  await expect(card(maya.page, "Shark Club")).toContainText(
    /Game day:\s*\w+day: \d/,
  );
  // The walk is an estimate from a straight line, and says so.
  await expect(card(maya.page, "Chambar")).toContainText(
    /\d+\+ min walk · \d+ m straight line \(estimate\)/,
  );

  // Maya puts Chambar on the vote from the shelf; it arrives on Lorne's
  // phone as a photograph, and his vote moves Maya's plan, with no reload.
  await near(maya.page)
    .getByRole("button", { name: "Add Chambar and vote" })
    .click();
  await expect(
    near(maya.page).getByRole("button", { name: "Chambar is your vote" }),
  ).toBeVisible();
  const dinner = (p: Page) =>
    p.getByRole("region", { name: "Where are we going before?" });
  const ballotChambar = dinner(lorne.page).locator('[data-option="Chambar"]');
  await expect(ballotChambar).toBeVisible({ timeout: 15_000 });
  await expect(ballotChambar.locator("img")).toHaveAttribute(
    "src",
    /chambar\.com/,
  );
  await ballotChambar.getByRole("button", { name: "Vote for Chambar" }).click();
  await expect(
    ballotChambar.getByRole("button", { name: "Vote for Chambar" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    maya.page
      .getByRole("region", { name: "The plan" })
      .getByRole("button", { name: /^Before the game/ }),
  ).toHaveAccessibleName(/Chambar\s*1 vote/, { timeout: 15_000 });

  // ------------------------------------------------- picks, by thumb
  await openTab(maya.page, "Play");
  const deck = maya.page.getByRole("region", { name: "Your picks" });
  await expect(deck).toContainText("0 of 7 sealed");
  await deck.getByRole("button", { name: "Canucks one more" }).click();
  await expect(deck).toContainText("1 of 7 sealed");
  await expect(deck.getByText("Sealed", { exact: true })).toBeVisible();
  await deck.getByRole("button", { name: "Next" }).click();
  // A team is a tile in its colours; one tap seals it and the deck moves on.
  await deck.getByRole("button", { name: /VAN\s*Canucks/ }).click();
  await expect(deck).toContainText("2 of 7 sealed");
  await expect(
    deck.getByRole("heading", { name: "Does it go to overtime?" }),
  ).toBeVisible({ timeout: 5_000 });
  await deck.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(deck).toContainText("3 of 7 sealed");

  const mine = async () =>
    (
      (
        await (
          await maya.page.request.get(`/hockey/api/occasions/${nightId}`)
        ).json()
      ).state.responses as { promptId: string; value: unknown }[]
    ).filter((r) =>
      ["final-score", "first-team", "overtime"].includes(r.promptId),
    );
  await expect
    .poll(async () =>
      Object.fromEntries((await mine()).map((r) => [r.promptId, r.value])),
    )
    .toEqual({
      "final-score": [3, 2],
      "first-team": "canucks",
      overtime: true,
    });

  // Lorne's pick, the ordinary way.
  const lornePick = await lorne.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: { type: "respond", promptId: "final-score", value: [1, 1] } },
  );
  expect(lornePick.ok()).toBe(true);

  // A reload lands in the room it was left in.
  await maya.page.reload();
  await expect(maya.page.getByRole("tab", { name: /^Play/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // ------------------------------------------- after the horn: the reveal
  await moveStart(nightId, minutes(-170));
  const call = await lorne.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: { type: "callIt", promptId: "final-score", value: [3, 2] } },
  );
  expect(call.ok()).toBe(true);
  await maya.page.goto(`/hockey/${nightId}`);
  await expect(maya.page.getByLabel("Final: VAN 3, MIN 2")).toBeVisible();
  await openTab(maya.page, "Play");
  const reveal = maya.page.getByRole("region", { name: "The picks are out" });
  await expect(
    reveal.getByRole("button", { name: "Turn over Lorne's pick" }).first(),
  ).toBeVisible();
  await reveal.getByRole("button", { name: "Flip them all" }).click();
  await expect(
    reveal.getByRole("button", { name: "Lorne: 1–1" }),
  ).toBeVisible();
  // Maya called the score exactly; the engine says so, with the points.
  await expect(reveal.getByRole("button", { name: "Maya: 3–2" })).toContainText(
    /Called it \+5/,
  );

  // ------------------------------------------ the morning after: again
  await moveStart(nightId, minutes(-16 * 60));
  await maya.page.goto(`/hockey/${nightId}`);
  await maya.page.getByRole("button", { name: "Now go have another." }).click();
  await expect(maya.page.getByRole("tab", { name: /^Plan/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    maya.page.getByRole("region", { name: "Run it back" }),
  ).toBeInViewport({ timeout: 5_000 });

  await lorne.context.close();
  await maya.context.close();
});
