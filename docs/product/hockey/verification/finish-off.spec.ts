import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Deployed before the photos migration, with the NHL unreachable** —
 * production's state until `memories-migration.sql` is applied, on a bad day
 * for the league's API. Needs a stack started with `HOCKEY_MEMORIES=0` and a
 * server whose `NHL_API_BASE` is a dead end (`MODE=down nhl-stub.mjs`); run
 * with FINISH_OFF=1, skipped otherwise.
 *
 * Proves: the night is untouched; Memories is absent (not broken); the photo
 * routes answer in sentences, not 500s; no scoreboard appears and the host
 * can still call the result by hand.
 */
test.skip(
  process.env.FINISH_OFF !== "1",
  "needs FINISH_OFF=1 and the off stack",
);

const stamp = Date.now().toString(36);
const STACK = process.env.STACK ?? "/tmp/hockey-stack";

test("no photos table, no NHL: the night still works", async ({ page }) => {
  const env = Object.fromEntries(
    fs
      .readFileSync(`${STACK}/env`, "utf8")
      .trim()
      .split("\n")
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hockey");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  const email = `finish-off-${stamp}@example.test`;
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByLabel("Opponent").fill("Kraken");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("button", { name: /Skip/ }).click();

  // Move the game to the past so the picks are locked and Call it is open.
  const auth = await (
    await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      },
    )
  ).json();
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/passport_occasions?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        authorization: `Bearer ${auth.access_token}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({
        starts_at: new Date(Date.now() - 4 * 3600e3).toISOString(),
      }),
    },
  );
  expect(res.status).toBe(200);

  await page.goto(`/hockey/${id}#play`);
  await expect(page.getByRole("region", { name: "Call it" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/The NHL has this one on record/)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "The NHL scoreboard" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Memories" })).toHaveCount(0);
  await page.screenshot({
    path: `${process.env.FINISH_SHOTS ?? "/tmp"}/off-play.png`,
    fullPage: true,
  });

  const photos = await (
    await page.request.get(`/hockey/api/occasions/${id}/photos`)
  ).json();
  expect(photos).toEqual({ available: false, photos: [] });
  const add = await page.request.post(`/hockey/api/occasions/${id}/photos`, {
    data: { data: "/9j/" + "A".repeat(200) },
  });
  expect(add.status()).toBe(409);
  expect((await add.json()).error).toMatch(/aren't switched on/);
  expect(
    await (await page.request.get(`/hockey/api/occasions/${id}/game`)).json(),
  ).toEqual({ available: false });
});
