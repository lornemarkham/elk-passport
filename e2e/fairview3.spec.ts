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
  await expect(console_.getByTestId("presenter-section")).toHaveText("Finale");
  await expect(p.getByTestId("lyrics")).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByTestId("anthem-ready")).toBeVisible({
    timeout: 10_000,
  });
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
