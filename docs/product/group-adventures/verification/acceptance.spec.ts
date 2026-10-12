import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **The core workflow, in real browsers, through the real app.**
 *
 *   Alice signs in → starts a Hockey Night → Passport makes a link →
 *   Bob opens it → signs up → joins → both see it → Bob proposes, Alice
 *   confirms → Charlie, separately, cannot see it, cannot use the spent
 *   link, and has his own → a visitor gets nothing.
 *
 * Three browser contexts (separate cookie jars), each signing up through
 * Passport's own `/auth` page against a real GoTrue. No mocked auth: the
 * app talks to the local stack (stack.mjs) and every permission is
 * Postgres's.
 *
 * Run against a production build you started yourself with the stack's env:
 *   E2E_PORT=3126 npx playwright test -c docs/product/group-adventures/verification
 */

const PASSWORD = "puck-drops-at-seven";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-${stamp}@example.test`;

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

/** On /adventures itself — not on /auth?next=/adventures, which also ends so. */
const ON_ADVENTURES = /^https?:\/\/[^/]+\/adventures$/;

async function person(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe.configure({ mode: "serial" });

test("Alice starts a Hockey Night, Bob joins by link, Charlie stays out", async ({
  browser,
}) => {
  test.setTimeout(180_000);

  // ------------------------------------------------------------- Alice
  const alice = await person(browser);
  await alice.page.goto("/auth?next=/adventures");
  await signUp(alice.page, "alice");
  await expect(alice.page).toHaveURL(ON_ADVENTURES);
  await expect(alice.page.getByText(/Nothing yet/)).toBeVisible();

  await alice.page.getByRole("button", { name: "Hockey Night" }).click();
  await alice.page.getByLabel("Name it").fill("Hockey Night A");
  await alice.page.getByLabel("Arena (optional)").fill("Rogers Arena");
  await alice.page.getByLabel("Against (optional)").fill("Wild");
  await alice.page.getByRole("button", { name: "Start it" }).click();
  await expect(alice.page).toHaveURL(/\/adventures\/[0-9a-f]{32}$/);
  const nightUrl = new URL(alice.page.url()).pathname;
  const nightId = nightUrl.split("/").pop()!;
  await expect(
    alice.page.getByRole("heading", { name: "Hockey Night A" }),
  ).toBeVisible();
  await expect(alice.page.getByTestId("hockey-facts")).toContainText("vs Wild");
  await expect(alice.page.getByTestId("hockey-facts")).toContainText(
    "Rogers Arena",
  );

  await alice.page.getByRole("button", { name: "Link for one person" }).click();
  const inviteUrl = (await alice.page
    .getByTestId("invite-url")
    .textContent())!.trim();
  expect(inviteUrl).toMatch(/\/adventures\/join\/[A-Za-z0-9_-]{43}$/);
  const invitePath = new URL(inviteUrl).pathname;

  // --------------------------------------------------------------- Bob
  const bob = await person(browser);
  await bob.page.goto(invitePath);
  await expect(
    bob.page.getByRole("heading", { name: "You're invited to a Hockey Night" }),
  ).toBeVisible();
  // The link does not reveal the name of the night, signed out.
  await expect(bob.page.getByText("Hockey Night A")).toHaveCount(0);
  await bob.page.getByRole("link", { name: "Sign in to join" }).click();
  await signUp(bob.page, "bob");
  await expect(bob.page).toHaveURL(new RegExp(`${invitePath}$`));
  await bob.page.getByRole("button", { name: /join/ }).click();
  await expect(bob.page).toHaveURL(new RegExp(`${nightUrl}$`));
  await expect(
    bob.page.getByRole("heading", { name: "Hockey Night A" }),
  ).toBeVisible();

  const bobMembers = bob.page.getByRole("list", { name: "Members" });
  await expect(bobMembers).toContainText("alice");
  await expect(bobMembers).toContainText("bob");

  // Bob proposes; he cannot invite or remove.
  await bob.page
    .getByLabel("What or where")
    .fill("Pregame at the pub on Abbott");
  await bob.page.getByRole("button", { name: "Propose it" }).click();
  await expect(bob.page.getByTestId("plan-item")).toContainText("Proposed");
  await expect(
    bob.page.getByRole("button", { name: "Link for one person" }),
  ).toHaveCount(0);
  await expect(
    bob.page.getByRole("button", { name: /^Remove alice/ }),
  ).toHaveCount(0);
  expect(
    (await bob.page.request.get(`/api/adventures/${nightId}/invites`)).status(),
  ).toBe(404);

  // Alice sees Bob and his proposal, confirms it, and says she's in.
  await alice.page.reload();
  await expect(alice.page.getByRole("list", { name: "Members" })).toContainText(
    "bob",
  );
  await alice.page.getByRole("button", { name: "Confirm" }).click();
  await expect(alice.page.getByTestId("plan-item")).toContainText("On");
  await alice.page.getByRole("button", { name: "I'm in" }).click();
  await expect(alice.page.getByTestId("plan-item")).toContainText("1 in");

  await bob.page.reload();
  await expect(bob.page.getByTestId("plan-item")).toContainText("On");
  await expect(bob.page.getByTestId("plan-item")).toContainText("1 in");

  // ----------------------------------------------------------- Charlie
  const charlie = await person(browser);
  await charlie.page.goto("/auth?next=/adventures");
  await signUp(charlie.page, "charlie");
  await expect(charlie.page).toHaveURL(ON_ADVENTURES);
  await expect(charlie.page.getByText(/Nothing yet/)).toBeVisible();

  await charlie.page.goto(nightUrl);
  await expect(charlie.page.getByText("Not found")).toBeVisible();
  await expect(charlie.page.getByText("Hockey Night A")).toHaveCount(0);
  expect(
    (await charlie.page.request.get(`/api/adventures/${nightId}`)).status(),
  ).toBe(404);
  expect(
    (
      await charlie.page.request.post(`/api/adventures/${nightId}/items`, {
        data: { label: "gatecrash" },
      })
    ).status(),
  ).toBe(404);

  // Bob's link was for one person; it is spent.
  await charlie.page.goto(invitePath);
  await expect(charlie.page.getByText("That link's done")).toBeVisible();
  expect(
    (
      await charlie.page.request.post("/api/adventures/join", {
        data: { token: invitePath.split("/").pop() },
      })
    ).status(),
  ).toBe(410);

  // Charlie's own night, which Alice cannot see.
  await charlie.page.goto("/adventures");
  await charlie.page.getByRole("button", { name: "Hockey Night" }).click();
  await charlie.page.getByLabel("Name it").fill("Hockey Night B");
  await charlie.page.getByLabel("Arena (optional)").fill("Rogers Arena");
  await charlie.page.getByRole("button", { name: "Start it" }).click();
  await expect(charlie.page).toHaveURL(/\/adventures\/[0-9a-f]{32}$/);
  const nightB = new URL(charlie.page.url()).pathname;
  await alice.page.goto(nightB);
  await expect(alice.page.getByText("Not found")).toBeVisible();

  // Each person's list holds only what they are in.
  await alice.page.goto("/adventures");
  const alicesList = alice.page.getByRole("list", { name: "Your adventures" });
  await expect(alicesList).toContainText("Hockey Night A");
  await expect(alicesList).not.toContainText("Hockey Night B");
  await bob.page.goto("/adventures");
  await expect(
    bob.page.getByRole("list", { name: "Your adventures" }),
  ).toContainText("Joined");

  // ----------------------------------------------------------- visitor
  const visitor = await person(browser);
  expect((await visitor.page.request.get("/api/adventures")).status()).toBe(
    401,
  );
  expect(
    (await visitor.page.request.get(`/api/adventures/${nightId}`)).status(),
  ).toBe(401);
  await visitor.page.goto(nightUrl);
  await expect(visitor.page.getByText("Sign in to open this")).toBeVisible();

  // --------------------------------------------- Alice removes Bob
  await alice.page.goto(nightUrl);
  await alice.page.getByRole("button", { name: "Remove bob" }).click();
  await expect(
    alice.page.getByRole("list", { name: "Members" }),
  ).not.toContainText("bob");
  await bob.page.goto(nightUrl);
  await expect(bob.page.getByText("Not found")).toBeVisible();

  for (const p of [alice, bob, charlie, visitor]) await p.context.close();
});
