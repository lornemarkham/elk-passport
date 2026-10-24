import { expect, test } from "@playwright/test";
import {
  type Person,
  botLine,
  night,
  ok,
  phone,
  rest,
  signUp,
  snapshot,
  setNight,
  peopleCalled,
} from "./mayhem-helpers";

/**
 * (Helpers shared with mayhem.spec.ts.)
 *
 * **Operation Mayhem — PLAY with three real people.**
 *
 * Lorne (Calgary Flames, host), Alex (Vancouver Canucks) and Sam (Minnesota
 * Wild), three GoTrue accounts on the local stack, three phones. The brief's
 * acceptance test, scenario by scenario:
 *
 *   A — the Flames fan: something personal within 30 s; a challenge crosses
 *       accounts and back.
 *   B — the competition: picks, bets, a jury, a secret mission; one Cup on
 *       three phones; no client-side cheating moves it.
 *   C — the bot: a challenge taken gets a contextual line; Quiet keeps the
 *       moments only; the host silences it.
 *   D — two days out: everybody has something to do.
 *   E — mobile: every major state at 390 px, no sideways scroll, thumb-size
 *       targets; 375 and 320 shots of the opening.
 *
 * Run against `next start` on the stack's env with mayhem-migration.sql
 * applied (README.md here):
 *   set -a; . "$STACK/env"; set +a
 *   MAYHEM_SHOTS=docs/product/hockey/mayhem E2E_PORT=3130 \
 *     npx playwright test -c docs/product/hockey/verification mayhem
 */

peopleCalled("mayhem-ai");
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 30_000 });
test.skip(
  process.env.MAYHEM_AI !== "1",
  "needs a real model behind OPENAI_BASE_URL (restart-ai-local.sh)",
);

/**
 * **Chirp Bot on PLAY's challenges, with a real model.** The unchanged
 * production path — persona, JSON mode, `readLine`, the safety filter, the
 * signature — against Metatron's local Ollama through OPENAI_BASE_URL. No
 * credentials; nothing leaves the machine. Prints every model-written line
 * so a person can judge them, and asserts the challenge ones are stored as
 * the model's (`bot_line = 'ai'`) and render.
 */
test("Chirp Bot voices a challenge thrown and taken, on a real model", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const lornePage = await phone(browser);
  await lornePage.goto("/hockey");
  await signUp(lornePage, "lorne");
  await lornePage.getByLabel("Your name").fill("Lorne");
  await lornePage.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await lornePage.getByLabel("Game date").fill(in2);
  await lornePage.getByLabel("Puck drop time").fill("19:00");
  await lornePage.getByRole("button", { name: "Start it" }).click();
  await expect(lornePage).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(lornePage.url().split("/").pop()!);
  await lornePage.getByRole("button", { name: /Skip/ }).click();
  const lorne: Person = {
    who: "lorne",
    name: "Lorne",
    page: lornePage,
    id: (await snapshot(lornePage)).state.meId,
  };
  const res = await lorne.page.request.post(
    `/hockey/api/occasions/${night}/invites`,
    { data: { label: "Alex" } },
  );
  const { token: invitation } = await res.json();
  const page = await phone(browser);
  await page.goto(`/hockey/join/${invitation}`);
  await page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(page, "alex");
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "I'm in" }).click();
  await expect(page).toHaveURL(new RegExp(`/hockey/${night}$`));
  const alex: Person = {
    who: "alex",
    name: "Alex",
    page,
    id: (await snapshot(page)).state.meId,
  };
  await ok(lorne.page, { type: "setTeam", team: "CGY" });
  await ok(alex.page, { type: "setTeam", team: "VAN" });

  await ok(lorne.page, {
    type: "issueChallenge",
    kind: "bet",
    targetId: alex.id,
    market: "winner",
    side: "away",
    taunt: "Your power play is a rumour.",
  });
  const chal = await botLine(lorne.page, "chal", alex.id, 90_000);
  const id = (await snapshot(alex.page)).play.challenges[0].id;
  await ok(alex.page, {
    type: "answerChallenge",
    challengeId: id,
    answer: "accept",
  });
  const took = await botLine(alex.page, "took", alex.id, 90_000);

  const rows = await rest(
    "lorne",
    "GET",
    `passport_occasion_moments?occasion_id=eq.${night}&kind=eq.chirp&select=bot_key,bot_line,text&order=at`,
  );
  const lines = rows.json as {
    bot_key: string;
    bot_line: string;
    text: string | null;
  }[];
  for (const l of lines)
    console.log(
      `[chirp ${l.bot_line === "ai" ? "MODEL" : "library " + l.bot_line}] ${l.bot_key.split(":")[0]}: ${l.text ?? "(library)"}`,
    );
  console.log(`[render] chal: ${chal.text}`);
  console.log(`[render] took: ${took.text}`);
  // Both moments said; the model voiced at least one of them. A model line
  // that invents a number or a quote is replaced by the library's (inventsFacts).
  expect(lines.some((l) => l.bot_key.startsWith("chal:"))).toBe(true);
  expect(lines.some((l) => l.bot_key.startsWith("took:"))).toBe(true);
  expect(
    lines.some((l) => /^(chal|took):/.test(l.bot_key) && l.bot_line === "ai"),
  ).toBe(true);
});
