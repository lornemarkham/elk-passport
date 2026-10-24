import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Chirp Bot with a real model, end to end** (2026-10-23).
 *
 * Everything before this ran on the library or a mocked client. Here the
 * unchanged server path — `askModel` (the OpenAI SDK), the persona, JSON
 * mode, `readLine`/`readChirps`, `acceptableChirp`, the HMAC signature, the
 * insert under the member's own session, and the verified render — runs
 * against a real language model behind an OpenAI-compatible endpoint. On
 * Metatron that is the local Ollama (no credentials, nothing leaves the
 * machine):
 *
 *   OPENAI_API_KEY=local-not-a-real-key
 *   OPENAI_BASE_URL=http://127.0.0.1:11434/v1
 *   OPENAI_CHIRP_MODEL=qwen3:8b  OPENAI_CHIRP_REASONING_EFFORT=none
 *   OPENAI_CHIRP_TIMEOUT_MS=15000
 *   CHIRP_AI_LIVE=1 E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification chirp-ai-live
 *
 * Skipped unless CHIRP_AI_LIVE=1. Prints the model's lines so a person can
 * read them.
 */

const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-ai-${stamp}@example.test`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.HOCKEY_STACK_SERVICE_KEY!;
const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};
let night = "";

interface BotRowOut {
  bot_key: string;
  bot_line: string;
  bot_sig: string | null;
  text: string | null;
  actor_id: string;
}

async function phone(browser: Browser) {
  return (await browser.newContext(PHONE)).newPage();
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function snapshot(page: Page) {
  const res = await page.request.get(`/hockey/api/occasions/${night}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    state: { meId: string };
    chirp: {
      model: boolean;
      lines: { kind: string; text: string; about?: string }[];
    };
  };
}

async function act(page: Page, action: unknown) {
  const res = await page.request.post(
    `/hockey/api/occasions/${night}/actions`,
    { data: action as never },
  );
  expect(res.status(), await res.text()).toBeLessThan(300);
}

/** What the database holds — read with the stack's service key, test only. */
async function stored(): Promise<BotRowOut[]> {
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasion_moments?occasion_id=eq.${night}&kind=eq.chirp&select=bot_key,bot_line,bot_sig,text,actor_id`,
    { headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` } },
  );
  expect(res.status).toBe(200);
  return (await res.json()) as BotRowOut[];
}

async function aiLine(prefix: string): Promise<BotRowOut> {
  let found: BotRowOut | undefined;
  await expect
    .poll(
      async () => {
        found = (await stored()).find(
          (r) => r.bot_key.startsWith(prefix) && r.bot_line === "ai",
        );
        return Boolean(found);
      },
      { timeout: 60_000, message: `a model-written ${prefix} line` },
    )
    .toBe(true);
  return found!;
}

async function declareTeam(page: Page, name: string, team: string) {
  await page.getByRole("button", { name: "Pick my team" }).click();
  const picker = page.getByRole("dialog", { name: /WHO DO YOU BLEED FOR/i });
  await picker.getByLabel("Find your team").fill(team.split(" ").pop()!);
  await picker.getByRole("radio", { name: team, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: `${name} bleeds for the ${team}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Let's go" }).click();
}

test.skip(
  !process.env.CHIRP_AI_LIVE,
  "needs a model endpoint (CHIRP_AI_LIVE=1)",
);
test.use({ actionTimeout: 20_000 });

test("Chirp Bot writes, signs, stores and shows a real model's lines", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  const lorne = await phone(browser);
  await lorne.goto("/hockey");
  await signUp(lorne, "lorne");
  await lorne.getByLabel("Your name").fill("Lorne");
  await lorne.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await lorne.getByLabel("Game date").fill(in2);
  await lorne.getByLabel("Puck drop time").fill("19:00");
  await lorne.getByRole("button", { name: "Start it" }).click();
  await expect(lorne).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  night = lorne.url().split("/").pop()!;
  await lorne.getByRole("button", { name: /Skip/ }).click();
  const lorneId = (await snapshot(lorne)).state.meId;
  expect((await snapshot(lorne)).chirp.model).toBe(true);

  // 1. A team declared: the welcome line is asked of the model.
  await declareTeam(lorne, "Lorne", "Calgary Flames");
  const welcome = await aiLine(`team:${lorneId}:`);
  expect(welcome.actor_id).toBe(lorneId);
  expect(welcome.bot_sig).toBeTruthy();
  expect(welcome.text!.length).toBeGreaterThanOrEqual(8);
  expect(welcome.text!.length).toBeLessThanOrEqual(240);
  // The page shows exactly the stored, signed text (the signature checked).
  await expect
    .poll(async () =>
      (await snapshot(lorne)).chirp.lines.some(
        (l) => l.kind === "welcome" && l.text === welcome.text,
      ),
    )
    .toBe(true);
  await lorne.goto(`/hockey/${night}#chat`);
  await expect(lorne.getByText(welcome.text!, { exact: true })).toBeVisible();
  if (process.env.ALIVE_SHOTS) {
    await lorne
      .getByText(welcome.text!, { exact: true })
      .scrollIntoViewIfNeeded();
    await lorne.waitForTimeout(400);
    await lorne.screenshot({
      path: `${process.env.ALIVE_SHOTS}/60-chirp-bot-model-line.png`,
    });
  }
  console.log(`MODEL welcome (Flames): ${welcome.text}`);

  // 2. A guest joins and declares; then "Chirp Someone" asks for three.
  const res = await lorne.request.post(
    `/hockey/api/occasions/${night}/invites`,
    { data: { label: "Alex" } },
  );
  const { token: invitation } = await res.json();
  const alex = await phone(browser);
  await alex.goto(`/hockey/join/${invitation}`);
  await alex.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(alex, "alex");
  await alex.getByLabel("Your name").fill("Alex");
  await alex.getByRole("button", { name: "I'm in" }).click();
  await expect(alex).toHaveURL(new RegExp(`/hockey/${night}$`));
  const alexId = (await snapshot(alex)).state.meId;
  await declareTeam(alex, "Alex", "Toronto Maple Leafs");
  const leafs = await aiLine(`team:${alexId}:`);
  console.log(`MODEL welcome (Leafs): ${leafs.text}`);

  const chirps = await alex.request.post(
    `/hockey/api/occasions/${night}/chirps`,
    { data: { targetId: lorneId } },
  );
  expect(chirps.status()).toBe(200);
  const offered = (await chirps.json()) as { chirps: string[]; by: string };
  console.log(
    `MODEL chirps (${offered.by}): ${JSON.stringify(offered.chirps)}`,
  );
  expect(offered.by).toBe("model");
  expect(offered.chirps.length).toBeGreaterThanOrEqual(1);

  // 3. A bet in the chat: an organic line, also from the model.
  await act(lorne, {
    type: "say",
    text: "Bet you a coffee the Leafs miss the playoffs again, Alex",
  });
  const bet = await aiLine("challenge:");
  console.log(`MODEL challenge: ${bet.text}`);

  // Nothing a model wrote is stored unsigned.
  for (const r of await stored())
    if (r.bot_line === "ai") expect(r.bot_sig).toBeTruthy();
});
