import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * **M216's first acceptance milestone, with two real people.**
 *
 *   Host creates event → invites coworker → coworker authenticates →
 *   coworker joins → both see the same event → both vote and comment →
 *   refresh preserves everything
 *
 * Two independent browser contexts — separate cookie jars, separate sessions —
 * each signing up through Passport's own `/auth` page against a real GoTrue,
 * then a third (a stranger) and a fourth (Lorne again, on "another device").
 * No mocked auth anywhere: every request the app makes goes to the local
 * stack (stack.mjs), and every permission is the database's.
 *
 * Run against a server you started yourself:
 *   E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification
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

async function logIn(page: Page, who: string) {
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
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

test.describe.configure({ mode: "serial" });
test.skip(
  !!process.env.CONFIRM_EMAIL,
  "this run signs up instantly; it needs an auto-confirming stack",
);

test("Lorne starts Hockey Night, invites Maya, and they share one private night", async ({
  browser,
}) => {
  test.setTimeout(180_000);

  // ---------------------------------------------------------- the host
  const lorne = await person(browser);
  await lorne.page.goto("/hockey");
  await expect(lorne.page).toHaveURL(/\/auth\?next=%2Fhockey/);
  await signUp(lorne.page, "lorne");
  await expect(lorne.page.getByText(/Nothing on yet/)).toBeVisible();
  await lorne.page.getByLabel("Your name").fill("Lorne");
  await lorne.page.getByRole("button", { name: "Start it" }).click();
  await expect(lorne.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightUrl = lorne.page.url();
  const nightId = nightUrl.split("/").pop()!;

  // The curator's four taps, as in the lab — skipped, as most hosts will.
  await lorne.page.getByRole("button", { name: /Skip/ }).click();
  await expect(lorne.page.getByText("Canucks vs Wild")).toBeVisible();
  await expect(lorne.page.getByText(/Make Sunday worse/)).toBeVisible();
  await expect(
    lorne.page.getByText(/A hockey night for one is a Tuesday/),
  ).toBeVisible();

  await lorne.page.getByLabel("Who the invitation is for").fill("Maya");
  await lorne.page.getByRole("button", { name: "Make a link" }).click();
  const inviteUrl = (await lorne.page
    .getByTestId("invite-url")
    .textContent())!.trim();
  expect(inviteUrl).toMatch(/\/hockey\/join\/[A-Za-z0-9_-]{32}$/);
  const invitePath = new URL(inviteUrl).pathname;

  // ------------------------------------------- signed out, link in hand
  const anon = await person(browser);
  await anon.page.goto(invitePath);
  await expect(anon.page.getByText("Somebody wants you there.")).toBeVisible();
  // A signed-out visitor learns nothing about the night: not its name, not who is going.
  await expect(anon.page.getByText(/Sycle|Lorne|Canucks|Wild/)).toHaveCount(0);
  await anon.page.goto(new URL(nightUrl).pathname);
  await expect(anon.page).toHaveURL(/\/auth\?next=/);
  const anonApi = await anon.page.request.get(
    `/hockey/api/occasions/${nightId}`,
  );
  expect(anonApi.status()).toBe(401);
  await anon.context.close();

  // ------------------------------------------------ the coworker, on a phone
  const maya = await person(browser, true);
  await maya.page.goto(invitePath);
  await maya.page.getByRole("link", { name: "Sign in to see it" }).click();
  await expect(maya.page).toHaveURL(/\/auth\?next=%2Fhockey%2Fjoin%2F/);
  await signUp(maya.page, "maya");
  await expect(maya.page).toHaveURL(new RegExp(`${invitePath}$`));
  await maya.page.getByLabel("Your name").fill("Maya");
  await maya.page.getByRole("button", { name: "I'm in" }).click();
  await expect(maya.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));

  // ------------------------------------------------ both see the same night
  for (const p of [maya.page, lorne.page]) {
    await expect(p.getByText(/^Lorne\s*host$/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(p.getByText("Maya", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  }
  // Maya is not the host and has no guest list.
  await expect(
    maya.page.getByRole("region", { name: "Guest list" }),
  ).toHaveCount(0);
  const mayaInvites = await maya.page.request.get(
    `/hockey/api/occasions/${nightId}/invites`,
  );
  expect(mayaInvites.status()).toBe(404);

  // ------------------------------------------------ voting, at the same time
  const concourse = (p: Page) =>
    p.getByRole("button", { name: /Just eat in the concourse/ });
  await Promise.all([
    concourse(lorne.page).click(),
    concourse(maya.page).click(),
  ]);

  // Maya nominates somewhere; Lorne sees it arrive without reloading.
  await maya.page
    .getByRole("button", { name: "Suggest somewhere else" })
    .click();
  await maya.page
    .getByPlaceholder(/Nominate a real place/)
    .fill("Tap & Barrel Bridges");
  await maya.page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(lorne.page.getByText("Tap & Barrel Bridges")).toBeVisible({
    timeout: 15_000,
  });

  // ------------------------------------------------ a real place, from Discovery
  // Against atlas-stub.mjs: the wiring is real, the places are labelled fake.
  await lorne.page
    .getByRole("button", { name: "What's near the arena?" })
    .click();
  await expect(
    lorne.page.getByText(/straight line · \d+\+ min walk \(estimate\)/).first(),
  ).toBeVisible();
  await expect(lorne.page.getByText("Stub Museum (synthetic)")).toHaveCount(0);
  await expect(
    lorne.page.getByText("Stub Faraway Cafe (synthetic)"),
  ).toHaveCount(0);
  await lorne.page
    .getByRole("button", { name: "Nominate Stub Pub (synthetic)" })
    .click();
  await expect(
    lorne.page.getByRole("button", {
      name: "Stub Pub (synthetic) is on the ballot",
    }),
  ).toBeVisible();
  const stubPub = maya.page.getByRole("button", {
    name: /Stub Pub \(synthetic\).*straight line/,
  });
  await expect(stubPub).toBeVisible({ timeout: 15_000 });
  await stubPub.click();
  // A nomination is looked up by the server: a made-up place cannot be nominated.
  const fake = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    {
      data: {
        type: "nominate",
        promptId: "pregame-spot",
        atlasId: "rogers-arena-steakhouse",
      },
    },
  );
  expect(fake.status()).toBe(422);

  // ------------------------------------------------ banter
  await lorne.page
    .getByPlaceholder("Say something to the group")
    .fill("Puck drops at 7. The concourse beer is $19. Plan accordingly.");
  await lorne.page.getByRole("button", { name: "Send" }).click();
  await maya.page
    .getByPlaceholder("Say something to the group")
    .fill("I will be predicting a shutout and I will be right.");
  await maya.page.getByRole("button", { name: "Send" }).click();
  for (const p of [lorne.page, maya.page]) {
    await expect(
      p.getByText(
        "Puck drops at 7. The concourse beer is $19. Plan accordingly.",
      ),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      p.getByText("I will be predicting a shutout and I will be right."),
    ).toBeVisible({ timeout: 15_000 });
  }

  // ------------------------------------------------ the server agrees
  const snap = async (p: Page) =>
    await (await p.request.get(`/hockey/api/occasions/${nightId}`)).json();
  const [fromLorne, fromMaya] = await Promise.all([
    snap(lorne.page),
    snap(maya.page),
  ]);
  for (const s of [fromLorne, fromMaya]) {
    const votes = s.state.responses.filter(
      (r: { promptId: string }) => r.promptId === "pregame-spot",
    );
    expect(votes).toHaveLength(2);
    expect(
      s.state.moments.filter((m: { kind: string }) => m.kind === "note"),
    ).toHaveLength(2);
    const options = s.state.addedOptions.map(
      (o: { option: { id: string; label: string; detail?: string } }) =>
        o.option,
    );
    expect(options.map((o: { label: string }) => o.label)).toEqual([
      "Tap & Barrel Bridges",
      "Stub Pub (synthetic)",
    ]);
    // The distance the server measured travels with the nomination, labelled.
    const pub = options.find(
      (o: { label: string }) => o.label === "Stub Pub (synthetic)",
    );
    expect(pub.detail).toMatch(
      /^\d+ m straight line · \d+\+ min walk \(estimate\)$/,
    );
    // Maya moved her vote to the pub; Lorne's stayed on the concourse.
    const byPerson = Object.fromEntries(
      votes.map((v: { participantId: string; value: string }) => [
        v.participantId,
        v.value,
      ]),
    );
    expect(Object.values(byPerson).sort()).toEqual(
      ["concourse", pub.id].sort(),
    );
  }
  // Attribution survives: each note is by the person who wrote it.
  const people = Object.fromEntries(
    fromLorne.definition.participants.map((p: { id: string; name: string }) => [
      p.name,
      p.id,
    ]),
  );
  const byText = Object.fromEntries(
    fromLorne.state.moments
      .filter((m: { kind: string }) => m.kind === "note")
      .map((m: { text: string; by: string }) => [m.text, m.by]),
  );
  expect(byText["I will be predicting a shutout and I will be right."]).toBe(
    people.Maya,
  );
  expect(
    byText["Puck drops at 7. The concourse beer is $19. Plan accordingly."],
  ).toBe(people.Lorne);

  // ------------------------------------------------ a sealed pick stays sealed
  const pick = await lorne.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    {
      data: { type: "respond", promptId: "final-score", value: [4, 2] },
    },
  );
  expect(pick.status()).toBe(200);
  const mayaView = await snap(maya.page);
  expect(
    mayaView.state.responses.some(
      (r: { promptId: string }) => r.promptId === "final-score",
    ),
  ).toBe(false);

  // ------------------------------------------------ no impersonation through the app
  const forged = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    {
      data: {
        type: "say",
        text: "I, Lorne, concede.",
        actorId: people.Lorne,
        by: people.Lorne,
      },
    },
  );
  expect(forged.status()).toBe(200);
  const afterForge = await snap(lorne.page);
  const forgedNote = afterForge.state.moments.find(
    (m: { text?: string }) => m.text === "I, Lorne, concede.",
  );
  expect(forgedNote.by).toBe(people.Maya);
  const hijackBrief = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    {
      data: {
        type: "setBrief",
        brief: { audience: "x", vibe: "x", edge: 3, appetite: "lots" },
      },
    },
  );
  expect(hijackBrief.status()).toBe(403);
  const callIt = await maya.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    {
      data: { type: "callIt", promptId: "final-score", value: [0, 9] },
    },
  );
  expect(callIt.status()).toBe(403);

  // ------------------------------------------------ refresh preserves everything
  await Promise.all([lorne.page.reload(), maya.page.reload()]);
  for (const p of [lorne.page, maya.page]) {
    await expect(p.getByText("Tap & Barrel Bridges")).toBeVisible();
    await expect(
      p.getByText("I will be predicting a shutout and I will be right."),
    ).toBeVisible();
  }

  // ------------------------------------------------ and a brand-new session
  const lorneAgain = await person(browser);
  await lorneAgain.page.goto(new URL(nightUrl).pathname);
  await expect(lorneAgain.page).toHaveURL(/\/auth\?next=/);
  await logIn(lorneAgain.page, "lorne");
  await expect(lorneAgain.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
  await expect(lorneAgain.page.getByText("Tap & Barrel Bridges")).toBeVisible();
  await expect(
    lorneAgain.page.getByText(
      "I will be predicting a shutout and I will be right.",
    ),
  ).toBeVisible();
  await lorneAgain.context.close();

  // ------------------------------------------------ the uninvited
  const stranger = await person(browser);
  await stranger.page.goto("/auth?next=/hockey");
  await signUp(stranger.page, "stranger");
  await expect(stranger.page.getByText(/Nothing on yet/)).toBeVisible();
  const strangerNight = await stranger.page.goto(new URL(nightUrl).pathname);
  expect(strangerNight?.status()).toBe(404);
  expect(
    (
      await stranger.page.request.get(`/hockey/api/occasions/${nightId}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await stranger.page.request.post(
        `/hockey/api/occasions/${nightId}/actions`,
        { data: { type: "say", text: "hi" } },
      )
    ).status(),
  ).toBe(404);
  // Maya's link was single-use. Forwarded, it does nothing.
  await stranger.page.goto(invitePath);
  await expect(
    stranger.page.getByText("This link has done its job."),
  ).toBeVisible();
  const replay = await stranger.page.request.post("/hockey/api/join", {
    data: { token: invitePath.split("/").pop() },
  });
  expect(replay.status()).toBe(410);

  // ------------------------------------------------ removal
  await lorne.page.getByRole("button", { name: "Remove Maya" }).click();
  await lorne.page.getByRole("button", { name: "Remove", exact: true }).click();
  // Maya's open page notices on its next poll and leaves.
  await expect(maya.page).toHaveURL(/\/hockey\?gone=1$/, { timeout: 15_000 });
  await expect(
    maya.page.getByText("That night isn't yours to see any more."),
  ).toBeVisible();
  expect(
    (await maya.page.request.get(`/hockey/api/occasions/${nightId}`)).status(),
  ).toBe(404);
  const mayaBack = await maya.page.goto(new URL(nightUrl).pathname);
  expect(mayaBack?.status()).toBe(404);
  // And her contributions leave with her.
  await lorne.page.reload();
  await expect(
    lorne.page.getByText("I will be predicting a shutout and I will be right."),
  ).toHaveCount(0);

  await Promise.all([
    lorne.context.close(),
    maya.context.close(),
    stranger.context.close(),
  ]);
});
