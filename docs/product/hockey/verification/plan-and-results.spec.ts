import { expect, test, type Browser, type Page } from "@playwright/test";
import { openDecision, openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **The Plan panel, the vote, and the result — with two real people.**
 *
 * `acceptance.spec.ts` proves the room: who can get in, who can see what.
 * This proves the evening's other half, which that run could not reach
 * because picks only lock at puck drop:
 *
 *   both vote → "The plan" says what the group settled (and says "tied" when
 *   it is) → the host moves the start → picks lock → only the host can call
 *   the result → both screens agree on the standings.
 *
 * Moving the start is done the way a host really can: with the host's own
 * session, over PostgREST, under RLS. The guest's attempt to do the same is
 * part of the test. Nothing here uses the service role or touches the schema.
 *
 * Run (the env is the stack's, see README.md):
 *   set -a; . /tmp/hockey-stack/env; set +a
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification plan-and-results
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-plan-${stamp}@example.test`;

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function person(browser: Browser, mobile = false) {
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : {},
  );
  return { context, page: await context.newPage() };
}

/** A real password sign-in against GoTrue: an access token for PostgREST. */
async function token(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: TEST_PASSWORD }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).access_token as string;
}

/** `PATCH starts_at` as `who`. Returns the rows RLS let the update touch. */
async function moveStart(who: string, nightId: string, startsAt: string) {
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${await token(who)}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({ starts_at: startsAt }),
    },
  );
  return { status: res.status, rows: (await res.json()) as unknown[] };
}

test.describe.configure({ mode: "serial" });
test.skip(
  !!process.env.CONFIRM_EMAIL,
  "this run signs up instantly; it needs an auto-confirming stack",
);

test("the plan follows the vote, ties are honest, and only the host calls the result", async ({
  browser,
}) => {
  test.setTimeout(240_000);

  // ---------------------------------------------------- host and guest join
  const lorne = await person(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = lorne.page.url().split("/").pop()!;
  await lorne.page.getByRole("button", { name: /Skip/ }).click();
  await lorne.page.getByRole("button", { name: "Invite" }).click();
  await lorne.page.getByLabel("Who the invitation is for").fill("Maya");
  await lorne.page.getByRole("button", { name: "Make a link" }).click();
  const invitePath = new URL(
    (await lorne.page.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;

  const maya = await person(browser, true);
  await maya.page.goto(invitePath);
  await maya.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(maya.page, "maya");
  await maya.page.getByLabel("Your name").fill("Maya");
  await maya.page.getByRole("button", { name: "I'm in" }).click();
  await expect(maya.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
  await openTab(maya.page, "Group");
  await expect(maya.page.getByText(/^Lorne\s*host$/)).toBeVisible({
    timeout: 15_000,
  });
  await Promise.all([openTab(lorne.page, "Plan"), openTab(maya.page, "Plan")]);

  // The game plan leads Plan from the start, and says what it does not know
  // yet. Its first stop is where we eat.
  const eating = (p: Page) =>
    p.getByRole("region", { name: "Pregame", exact: true });
  const dinner = (p: Page) =>
    p.getByRole("region", { name: "Where are we going before?" });

  // ------------------------------------------- nobody has voted: nobody
  for (const p of [lorne.page, maya.page]) {
    await expect(eating(p)).toContainText(/No votes yet/);
    // Plan's first decision opens to its vote.
    await openDecision(p, "Before the game");
  }

  // -------------------------------------------------------- one vote: a plan
  await dinner(lorne.page)
    .getByRole("button", { name: "Vote for Just eat in the concourse" })
    .click();
  for (const p of [lorne.page, maya.page]) {
    await expect(eating(p)).toContainText(
      /Just eat in the concourse\s*1 vote/,
      { timeout: 15_000 },
    );
  }

  // ------------------------------------------ a second voter, a different way
  await dinner(maya.page)
    .getByLabel("Somewhere else? Type a name")
    .fill("Tap & Barrel Bridges");
  await dinner(maya.page)
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await dinner(maya.page)
    .getByRole("button", { name: "Vote for Tap & Barrel Bridges" })
    .click();
  // A tie is said as a tie, not broken.
  await expect(eating(lorne.page)).toContainText(
    /Tied: .*(Tap & Barrel Bridges|Just eat in the concourse).*2 votes/,
    { timeout: 15_000 },
  );

  // ---------------------------------------- they agree: both screens say so
  await dinner(maya.page)
    .getByRole("button", { name: "Vote for Just eat in the concourse" })
    .click();
  for (const p of [lorne.page, maya.page]) {
    await expect(eating(p)).toContainText(
      /Just eat in the concourse\s*2 votes/,
      { timeout: 15_000 },
    );
  }

  // -------- a sealed pick stays sealed until lock (or until you commit yours)
  const act = (p: Page, data: object) =>
    p.request.post(`/hockey/api/occasions/${nightId}/actions`, { data });
  const answers = async (p: Page, promptId: string) =>
    (
      (await (await p.request.get(`/hockey/api/occasions/${nightId}`)).json())
        .state.responses as { promptId: string; participantId: string }[]
    ).filter((r) => r.promptId === promptId);
  expect(
    (
      await act(lorne.page, {
        type: "respond",
        promptId: "final-score",
        value: [3, 2],
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await act(lorne.page, {
        type: "respond",
        promptId: "first-team",
        value: "canucks",
      })
    ).ok(),
  ).toBe(true);
  expect(await answers(lorne.page, "final-score")).toHaveLength(1); // your own
  expect(await answers(maya.page, "final-score")).toHaveLength(0); // sealed from Maya
  expect(
    (
      await act(maya.page, {
        type: "respond",
        promptId: "first-team",
        value: "opponent",
      })
    ).ok(),
  ).toBe(true);
  // Sealed until puck drop for everybody (2026-10-23): committing your own
  // answer opens nobody else's — not even on the same question.
  expect(await answers(maya.page, "first-team")).toHaveLength(1);
  expect(await answers(maya.page, "final-score")).toHaveLength(0);
  expect(await answers(lorne.page, "first-team")).toHaveLength(1);
  expect(
    (
      await act(maya.page, {
        type: "respond",
        promptId: "final-score",
        value: [1, 4],
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await act(maya.page, {
        type: "respond",
        promptId: "total-goals",
        value: 5,
      })
    ).ok(),
  ).toBe(true);
  // The Plan carries only what is public: no pick leaks into the panel.
  const plan = lorne.page.getByRole("region", { name: "Our game plan" });
  await expect(plan).toBeVisible();
  await expect(plan).not.toContainText(/3–2|Canucks|Wild/);

  // ------------------------------------------------ who may move the start
  const past = new Date(Date.now() - 3 * 3600_000).toISOString();
  const guestTry = await moveStart("maya", nightId, past);
  expect(guestTry.rows).toHaveLength(0); // RLS: a guest updates nothing
  const hostMove = await moveStart("lorne", nightId, past);
  expect(hostMove.rows).toHaveLength(1);

  // ------------------------------------------------- after the lock
  await lorne.page.reload();
  await maya.page.reload();

  // The plan outlives the vote: it is still on the page at the final horn.
  for (const p of [lorne.page, maya.page]) {
    await openTab(p, "Plan");
    // Nothing left to vote on, so the line is a statement, not a button.
    const line = p.getByRole("region", { name: "Pregame", exact: true });
    await expect(line).toContainText(
      /Just eat in the concourse\s*2 votes · locked in/,
    );
    await expect(line.getByRole("button")).toHaveCount(0);
  }

  // Locked picks are now everyone's to see.
  expect(await answers(maya.page, "final-score")).toHaveLength(2);

  // Only the referee has a whistle: no "Call it" for Maya, and the API agrees.
  await Promise.all([openTab(lorne.page, "Play"), openTab(maya.page, "Play")]);
  await expect(lorne.page.getByText("Call it", { exact: true })).toBeVisible();
  await expect(maya.page.getByText("Call it", { exact: true })).toHaveCount(0);
  const mayaCall = await act(maya.page, {
    type: "callIt",
    promptId: "first-team",
    value: "opponent",
  });
  expect(mayaCall.ok()).toBe(false);
  expect(await answers(lorne.page, "first-team")).toHaveLength(2);

  // Lorne calls it: Canucks score first, 3-2, five goals.
  const callBox = lorne.page.locator("section", { hasText: "Call it" }).last();
  await callBox
    .getByRole("button", { name: /Canucks/ })
    .first()
    .click();
  await callBox.getByLabel("Canucks", { exact: true }).fill("3");
  await callBox.getByLabel("Wild", { exact: true }).fill("2");
  await callBox.getByRole("button", { name: "Final" }).click();
  await callBox.getByLabel("Total goals, both teams").fill("5");
  await callBox.getByRole("button", { name: "That's it" }).click();

  // Standings follow from the calls, on both screens, with no reload:
  // Lorne: exact score 5 + first goal 3 = 8. Maya: total goals 3.
  for (const p of [lorne.page, maya.page]) {
    const cup = p.getByRole("region", { name: "The Sycle Cup" });
    await expect(cup.getByText("8", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(cup.getByText("3", { exact: true })).toBeVisible();
  }

  // A guest cannot undo the host's call.
  const mayaRecall = await act(maya.page, {
    type: "callIt",
    promptId: "first-team",
    value: "opponent",
  });
  expect(mayaRecall.ok()).toBe(false);

  await lorne.context.close();
  await maya.context.close();
});
