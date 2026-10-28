import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Fairview 3, end to end on the memory store: a phone joins, the presenter
 * runs the show from the console, votes land on the stage, feedback is
 * moderated before it shows. Run against a server started with
 * `FAIRVIEW3_STORE=memory FAIRVIEW3_PRESENTER_KEY=merlin`.
 */
const KEY = process.env.FAIRVIEW3_PRESENTER_KEY ?? "merlin";

async function presenter(
  api: APIRequestContext,
  action: Record<string, unknown>,
) {
  const r = await api.post("/api/fairview3/presenter", { data: action });
  expect(r.ok(), `presenter ${JSON.stringify(action)}: ${r.status()}`).toBe(
    true,
  );
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const login = await request.post("/api/fairview3/presenter/session", {
    data: { key: KEY },
  });
  expect(login.ok()).toBe(true);
  await presenter(request, { type: "reset", what: "all" });
});

test("a phone joins, votes, and sees the reveal; the stage counts it", async ({
  browser,
  request,
}) => {
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await phone.newPage();
  await p.goto("/fairview3");
  await expect(p.getByText("You're in.")).toBeVisible();
  await expect(p.getByTestId("link-status")).toHaveAttribute(
    "data-link",
    "live",
    { timeout: 10_000 },
  );
  await expect(p.getByTestId("wizard-count")).toContainText("1 wizard", {
    timeout: 10_000,
  });

  const stage = await (
    await browser.newContext({ viewport: { width: 1600, height: 900 } })
  ).newPage();
  await stage.goto("/fairview3/stage");

  await presenter(request, { type: "section", section: "vote-1" });
  await expect(p.getByTestId("ballot")).toBeVisible({ timeout: 10_000 });
  await expect(p.getByTestId("ballot-note")).toContainText("isn't open yet");
  await expect(
    p.getByRole("button", { name: "Data and evidence" }),
  ).toBeDisabled();

  await presenter(request, {
    type: "question",
    question: "q1",
    status: "open",
  });
  await expect(
    p.getByRole("button", { name: "Data and evidence" }),
  ).toBeEnabled({ timeout: 10_000 });
  await p.getByRole("button", { name: "AI and velocity" }).click();
  await expect(p.getByTestId("ballot-note")).toContainText("Locked in");
  await expect(stage.getByTestId("stage-total")).toHaveText("1", {
    timeout: 10_000,
  });

  // Change of mind while open: still one vote.
  await p.getByRole("button", { name: "Unification" }).click();
  await expect(p.getByTestId("ballot-note")).toContainText("Locked in");
  await p.reload();
  await expect(p.getByRole("button", { name: "Unification" })).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 10_000 },
  );

  await presenter(request, {
    type: "question",
    question: "q1",
    status: "revealed",
  });
  await expect(p.getByTestId("results")).toBeVisible({ timeout: 10_000 });
  await expect(p.getByTestId("tally-2")).toContainText("100%");
  await expect(stage.getByTestId("tally-2")).toContainText("100%", {
    timeout: 10_000,
  });
  await expect(p.getByRole("button", { name: "Unification" })).toHaveCount(0);

  // Closed again: a vote is refused server-side.
  const late = await request.post("/api/fairview3/vote", {
    data: {
      participant: "33333333-3333-4333-8333-333333333333",
      question: "q1",
      option: 0,
    },
  });
  expect(late.status()).toBe(409);
  await phone.close();
});

test("feedback is screened, then moderated before the stage shows it", async ({
  browser,
  request,
}) => {
  await presenter(request, { type: "section", section: "challenge" });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await phone.newPage();
  await p.goto("/fairview3");
  await expect(p.getByTestId("feedback-body")).toBeVisible({ timeout: 10_000 });

  await p.getByTestId("feedback-body").fill("Ring me on 604 555 0199");
  await p.getByTestId("feedback-send").click();
  await expect(p.getByTestId("feedback-note")).toContainText("phone number");

  await p.getByRole("tab", { name: /do better/ }).click();
  await p
    .getByTestId("feedback-body")
    .fill("Show the baseline at every all-hands");
  await p.getByTestId("feedback-send").click();
  await expect(p.getByTestId("feedback-note")).toContainText(
    "A human reads it",
  );

  const stage = await (
    await browser.newContext({ viewport: { width: 1600, height: 900 } })
  ).newPage();
  await stage.goto("/fairview3/stage");
  await expect(stage.getByText("The cauldron is empty")).toBeVisible({
    timeout: 10_000,
  });

  // The console: sign in, approve, and the stage shows it.
  const console_ = await browser.newPage();
  await console_.goto("/fairview3/presenter");
  await console_.getByTestId("presenter-key").fill("not-the-key");
  await console_.getByTestId("presenter-enter").click();
  await expect(console_.getByTestId("presenter-error")).toContainText(
    "doesn't open",
  );
  await console_.getByTestId("presenter-key").fill(KEY);
  await console_.getByTestId("presenter-enter").click();
  await expect(console_.getByTestId("presenter-section")).toHaveText(
    "Challenge us",
    { timeout: 10_000 },
  );
  await expect(console_.getByTestId("inbox-row")).toHaveCount(1, {
    timeout: 10_000,
  });
  await console_.getByTestId("approve").click();
  await expect(stage.getByTestId("stage-feedback")).toContainText(
    "Show the baseline at every all-hands",
    { timeout: 10_000 },
  );

  // Advance from the console and the phone follows.
  await console_.getByTestId("next").click();
  await expect(console_.getByTestId("presenter-section")).toHaveText(
    "Hot Seat",
  );
  await expect(p.getByTestId("qa-body")).toBeVisible({ timeout: 10_000 });
  await phone.close();
});

/** A one-second silent WAV, so a slot has something to load. Test-only. */
const SILENCE = (() => {
  const rate = 8000;
  const n = rate;
  const b = Buffer.alloc(44 + n);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(n, 40);
  b.fill(128, 44);
  return b;
})();

test("Hot Seat: ask, upvote, moderate, and only a selected question reaches the stage", async ({
  browser,
  request,
}) => {
  await presenter(request, { type: "section", section: "vote-1" });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await phone.newPage();
  await p.goto("/fairview3");
  // The box is open all show, not only on its own section.
  await p.getByTestId("hotseat-open").click({ timeout: 10_000 });
  await p.getByTestId("qa-name").fill("Pat");
  await p.getByTestId("qa-body").fill("How will we measure referrals?");
  await p.getByTestId("qa-send").click();
  await expect(p.getByTestId("qa-note")).toContainText("In the box");
  await p.getByTestId("qa-body").fill("Mail me at pat@example.com please");
  await p.getByTestId("qa-send").click();
  await expect(p.getByTestId("qa-note")).toContainText("email");
  await p.getByTestId("qa-body").fill("What is the migration date?");
  await p.getByTestId("qa-send").click();
  await expect(p.getByTestId("qa-item")).toHaveCount(2, { timeout: 10_000 });
  await p
    .getByRole("button", { name: /Upvote: What is the migration date/ })
    .click();
  await expect(p.getByTestId("qa-item").first()).toContainText(
    "migration date",
    { timeout: 10_000 },
  );
  await expect(p.getByTestId("qa-votes").first()).toHaveText("1");

  await presenter(request, { type: "section", section: "hotseat" });
  const stage = await (
    await browser.newContext({ viewport: { width: 1600, height: 900 } })
  ).newPage();
  await stage.goto("/fairview3/stage");
  await expect(stage.getByTestId("hotseat-counts")).toContainText("2 waiting", {
    timeout: 10_000,
  });
  // Nothing selected: no submission is on the projector.
  await expect(stage.getByText("migration date")).toHaveCount(0);
  await expect(stage.getByText("measure referrals")).toHaveCount(0);

  const console_ = await browser.newPage();
  await console_.goto("/fairview3/presenter");
  await console_.getByTestId("presenter-key").fill(KEY);
  await console_.getByTestId("presenter-enter").click();
  await expect(console_.getByTestId("qa-row")).toHaveCount(2, {
    timeout: 10_000,
  });
  const row = console_
    .getByTestId("qa-row")
    .filter({ hasText: "measure referrals" });
  await row.getByTestId("qa-show").click();
  await expect(stage.getByTestId("hotseat-selected")).toContainText(
    "measure referrals",
    { timeout: 10_000 },
  );
  await expect(stage.getByText("migration date")).toHaveCount(0);

  await row.getByTestId("qa-answered").click();
  await expect(stage.getByTestId("hotseat-selected")).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(stage.getByTestId("hotseat-counts")).toContainText(
    "1 answered",
    { timeout: 10_000 },
  );

  const other = console_
    .getByTestId("qa-row")
    .filter({ hasText: "migration date" });
  await other.getByTestId("qa-hide").click();
  await expect(p.getByText("migration date")).toHaveCount(0, {
    timeout: 10_000,
  });
  await phone.close();
});

test("showdown: one vote per phone, live totals, announce, then the presenter starts the song", async ({
  browser,
  request,
}) => {
  await presenter(request, { type: "section", section: "showdown" });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await phone.newPage();
  await p.goto("/fairview3");
  const stagePage = await browser.newContext({
    viewport: { width: 1600, height: 900 },
  });
  await stagePage.route("**/fairview3/audio/fairview3-country.mp3", (r) =>
    r.fulfill({ status: 200, contentType: "audio/wav", body: SILENCE }),
  );
  const stage = await stagePage.newPage();
  await stage.goto("/fairview3/stage");

  await expect(p.getByTestId("vote-metal")).toBeDisabled({ timeout: 10_000 });
  await presenter(request, {
    type: "question",
    question: "q4",
    status: "open",
  });
  await expect(p.getByTestId("vote-metal")).toBeEnabled({ timeout: 10_000 });
  await p.getByTestId("vote-metal").click();
  await p.getByTestId("vote-country").click();
  await expect(p.getByTestId("ballot-note")).toContainText("Locked in");
  await expect(stage.getByTestId("showdown-pct-country")).toContainText(
    "100%",
    {
      timeout: 10_000,
    },
  );
  await expect(stage.getByTestId("stage-total")).toHaveText("1");

  // The same phone id voting again moves its one ballot; it never adds one.
  const id = await p.evaluate(() => localStorage.getItem("fv3:participant"));
  const again = await request.post("/api/fairview3/vote", {
    data: { participant: id, question: "q4", option: 2 },
  });
  expect(again.ok()).toBe(true);
  expect(
    (await (await request.get("/api/fairview3/live")).json()).tallies.q4,
  ).toEqual([0, 0, 1]);

  await presenter(request, {
    type: "question",
    question: "q4",
    status: "closed",
  });
  // The re-vote above moved this phone's single ballot to electro swing.
  await expect(p.getByTestId("showdown-electroswing")).toHaveAttribute(
    "data-winner",
    "true",
    { timeout: 10_000 },
  );
  await presenter(request, {
    type: "showdown",
    announced: true,
    winner: "electroswing",
  });
  await expect(stage.getByTestId("showdown-announced")).toContainText(
    "ELECTRO SWING",
    { timeout: 10_000 },
  );
  await presenter(request, { type: "showdown", winner: "country" });

  await presenter(request, { type: "section", section: "finale" });
  const player = stage.getByTestId("finale-player");
  await expect(player).toHaveAttribute("data-track", "country", {
    timeout: 10_000,
  });
  await expect(player).toHaveAttribute("data-state", "ready");
  // Nothing plays until the presenter starts it.
  await expect(stage.getByTestId("finale-play")).toHaveAttribute(
    "aria-label",
    "Play",
  );
  await presenter(request, { type: "finale", started: true });
  await expect(player).toHaveAttribute("data-state", "playing", {
    timeout: 10_000,
  });
  await expect(stage.getByTestId("finale-time")).toContainText("0:01", {
    timeout: 10_000,
  });
  await expect(stage.getByTestId("finale-fullscreen")).toBeVisible();
  await expect(stage.getByTestId("finale-volume")).toBeVisible();
  await expect(p.getByTestId("lyrics")).toBeVisible({ timeout: 10_000 });

  // A slot with no file is a calm message, not a crash.
  await presenter(request, { type: "finale", started: false, track: "metal" });
  await expect(stage.getByTestId("finale-missing")).toContainText(
    "HEAVY METAL",
    { timeout: 10_000 },
  );
  await expect(stage.getByTestId("lyrics")).toBeVisible();
  await phone.close();
});

test("presenter actions are refused without the key", async ({
  request,
  browser,
}) => {
  const anon = await (
    await browser.newContext()
  ).request.post("/api/fairview3/presenter", {
    data: { type: "section", section: "finale" },
  });
  expect(anon.status()).toBe(403);
  const inbox = await (
    await browser.newContext()
  ).request.get("/api/fairview3/presenter");
  expect(inbox.status()).toBe(403);
  const live = await request.get("/api/fairview3/live");
  expect((await live.json()).state.section).toBe("curtain");
});
