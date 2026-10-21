import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **What's in tonight — the host decides, three phones live with it.**
 *
 * Real accounts on the local stack, under RLS, every person on a phone:
 *
 *   Lorne starts a night with **Sealed picks** left out → Maya and Sam join
 *   from their links → none of them sees a pick, and an answer to one sent
 *   straight at the API is refused → Maya cannot change what's in it, through
 *   Passport or straight at the database → all three vote on when they're
 *   leaving and talk in the night at once, and everyone sees all of it →
 *   Lorne turns the picks back on and leaves out the toy box → the picks
 *   reach the guests' open pages without a reload, the toy box goes.
 *
 * Run (the env is the stack's, see README.md):
 *   set -a; . "$STACK/env"; set +a
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification modules
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-mod-${stamp}@example.test`;

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

async function token(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: TEST_PASSWORD }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).access_token as string;
}

async function invite(page: Page, label: string): Promise<string> {
  const url = page.getByTestId("invite-url");
  const before = (await url.count()) ? await url.textContent() : null;
  await page.getByLabel("Who the invitation is for").fill(label);
  await page.getByRole("button", { name: "Make a link" }).click();
  // Each link is shown in the same place; wait for this one, not the last.
  await expect(url).toContainText(/\/hockey\/join\//);
  await expect(url).not.toHaveText(before ?? "");
  return new URL((await url.textContent())!.trim()).pathname;
}

async function join(page: Page, path: string, who: string) {
  await page.goto(path);
  await page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(page, who);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.getByLabel("Your name").fill(who[0].toUpperCase() + who.slice(1));
  await page.getByRole("button", { name: "I'm in" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
}

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const picks = (p: Page) => p.getByRole("heading", { name: "Your picks" });
const leaving = (p: Page) =>
  p.getByRole("heading", { name: /when are you leaving/i });

test.describe.configure({ mode: "serial" });
test.skip(
  !!process.env.CONFIRM_EMAIL,
  "this run signs up instantly; it needs an auto-confirming stack",
);

test("the host leaves picks out, three phones live with it, and the host changes their mind", async ({
  browser,
}) => {
  test.setTimeout(240_000);

  // ------------------------------------------------------- Lorne starts it
  const lorne = await phone(browser);
  await lorne.page.goto("/hockey");
  await signUp(lorne.page, "lorne");
  await lorne.page.getByLabel("Opponent").fill("Oilers");
  await lorne.page.getByLabel("Game date").fill(inDays(3));
  await lorne.page.getByLabel("Puck drop time").fill("19:00");
  const sealed = lorne.page.getByRole("checkbox", { name: /Sealed picks/ });
  await expect(sealed).toHaveAttribute("aria-checked", "true");
  await sealed.click();
  await expect(sealed).toHaveAttribute("aria-checked", "false");
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = lorne.page.url().split("/").pop()!;
  await lorne.page.getByRole("button", { name: /Skip/ }).click();

  await expect(leaving(lorne.page)).toBeVisible();
  await expect(picks(lorne.page)).toHaveCount(0);
  const settings = lorne.page.getByRole("region", {
    name: "What's in tonight",
  });
  await expect(
    settings.getByRole("checkbox", { name: /Sealed picks/ }),
  ).toHaveAttribute("aria-checked", "false");

  const mayaLink = await invite(lorne.page, "Maya");
  const samLink = await invite(lorne.page, "Sam");

  // ------------------------------------------------- two guests, two phones
  const maya = await phone(browser);
  const sam = await phone(browser);
  await join(maya.page, mayaLink, "maya");
  await join(sam.page, samLink, "sam");
  const everyone = [lorne.page, maya.page, sam.page];

  for (const p of everyone) {
    for (const name of ["Lorne", "Maya", "Sam"])
      await expect(
        p.getByText(new RegExp(`^${name}(host)?$`)).first(),
      ).toBeVisible({
        timeout: 15_000,
      });
    await expect(picks(p)).toHaveCount(0);
  }

  // A pick that is switched off is refused like one that never existed.
  const sneaky = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: { type: "respond", promptId: "final-score", value: [9, 0] } },
  );
  expect(sneaky.status()).toBe(422);

  // Only the host decides what's in it: not through Passport…
  await expect(
    maya.page.getByRole("region", { name: "What's in tonight" }),
  ).toHaveCount(0);
  const guestSets = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: { type: "setModules", modules: ["picks"] } },
  );
  expect(guestSets.status()).toBe(403);
  // …and not straight at the database with her own session.
  const direct = await fetch(
    `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${await token("maya")}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({ details: { modules: [] } }),
    },
  );
  expect(await direct.json()).toEqual([]);

  // ----------------------------------- all three at once: leaving, talking
  const choices = [
    [lorne.page, "One drink after"],
    [maya.page, "One drink after"],
    [sam.page, "Straight home at the horn"],
  ] as const;
  await Promise.all(
    choices.map(([p, label]) =>
      p
        .getByRole("button", { name: new RegExp(label) })
        .first()
        .click(),
    ),
  );
  await Promise.all(
    everyone.map(async (p, i) => {
      const box = p.getByPlaceholder(/Say something to the group/);
      await box.fill(`phone ${i} checking in`);
      await box.press("Enter");
    }),
  );
  for (const p of everyone) {
    for (const i of [0, 1, 2])
      await expect(p.getByText(`phone ${i} checking in`)).toBeVisible({
        timeout: 15_000,
      });
  }
  // The vote is shared: Sam sees two for one drink, one for straight home.
  await expect(async () => {
    await sam.page.reload();
    const snap = await (
      await sam.page.request.get(`/hockey/api/occasions/${nightId}`)
    ).json();
    const answers = snap.state.responses.filter(
      (r: { promptId: string }) => r.promptId === "hard-out",
    );
    expect(answers).toHaveLength(3);
  }).toPass({ timeout: 20_000 });

  // ------------------------------- the host changes their mind, live
  await settings.getByRole("checkbox", { name: /Sealed picks/ }).click();
  await settings.getByRole("checkbox", { name: /Stupid questions/ }).click();
  await expect(picks(lorne.page)).toBeVisible();
  for (const p of [maya.page, sam.page]) {
    // No reload: the open page picks it up on its next look.
    await expect(picks(p)).toBeVisible({ timeout: 15_000 });
    await expect(
      p.getByRole("button", { name: /Ask the group something stupid/ }),
    ).toHaveCount(0);
  }
  const nowAllowed = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: { type: "respond", promptId: "final-score", value: [3, 2] } },
  );
  expect(nowAllowed.status()).toBe(200);
  const toyRefused = await sam.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    {
      data: {
        type: "addToy",
        family: "prediction",
        input: {
          text: "Who cries first?",
          phaseId: "before",
          points: 1,
          edge: 1,
        },
      },
    },
  );
  expect(toyRefused.status()).toBe(422);

  // Every phone, no sideways scroll.
  for (const p of everyone) {
    const [scroll, client] = await p.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(client);
  }

  for (const c of [lorne, maya, sam]) await c.context.close();
});
