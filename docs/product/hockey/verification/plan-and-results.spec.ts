import { expect, test, type Browser, type Page } from "@playwright/test";

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

const PASSWORD = "puck-drops-at-seven";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-plan-${stamp}@example.test`;

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
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
    body: JSON.stringify({ email: emailFor(who), password: PASSWORD }),
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
  await expect(maya.page.getByText(/^Lorne\s*host$/)).toBeVisible({
    timeout: 15_000,
  });

  // ------------------------------------------- nobody has voted: no plan yet
  for (const p of [lorne.page, maya.page]) {
    await expect(p.getByText("The plan", { exact: true })).toHaveCount(0);
  }

  // -------------------------------------------------------- one vote: a plan
  await lorne.page
    .getByRole("button", { name: /Just eat in the concourse/ })
    .click();
  for (const p of [lorne.page, maya.page]) {
    await expect(p.getByText("The plan", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      p.getByText(/Just eat in the concourse · 1 vote$/),
    ).toBeVisible();
  }

  // ------------------------------------------ a second voter, a different way
  await maya.page
    .getByRole("button", { name: "Suggest somewhere else" })
    .click();
  await maya.page
    .getByPlaceholder(/Nominate a real place/)
    .fill("Tap & Barrel Bridges");
  await maya.page.getByRole("button", { name: "Add", exact: true }).click();
  await maya.page
    .getByRole("button", { name: /Tap & Barrel Bridges/ })
    .first()
    .click();
  await expect(lorne.page.getByText(/Tied at 1 vote/)).toBeVisible({
    timeout: 15_000,
  });

  // ---------------------------------------- they agree: both screens say so
  await maya.page
    .getByRole("button", { name: /Just eat in the concourse/ })
    .click();
  for (const p of [lorne.page, maya.page]) {
    await expect(
      p.getByText(/Just eat in the concourse · 2 votes$/),
    ).toBeVisible({ timeout: 15_000 });
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
  // Committing your own answer opens that one question to you, and only that one.
  expect(await answers(maya.page, "first-team")).toHaveLength(2);
  expect(await answers(maya.page, "final-score")).toHaveLength(0);
  expect(await answers(lorne.page, "first-team")).toHaveLength(2);
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
  await expect(lorne.page.getByText("The plan", { exact: true })).toBeVisible();

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
    await expect(p.getByText("The plan", { exact: true })).toBeVisible();
    await expect(
      p.getByText(/Just eat in the concourse · 2 votes$/),
    ).toBeVisible();
  }

  // Locked picks are now everyone's to see.
  expect(await answers(maya.page, "final-score")).toHaveLength(2);

  // Only the referee has a whistle: no "Call it" for Maya, and the API agrees.
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
    const cup = p.locator("section", { hasText: "The Sycle Cup" }).last();
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
