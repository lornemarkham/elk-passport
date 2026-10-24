import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **Arena Mode deployed before its migration** — production's state until
 * `arena-migration.sql` is applied. Needs a stack started with
 * `HOCKEY_ARENA=0 stack.mjs start` (the seats table present, the arena tables
 * not), and is skipped otherwise.
 *
 * Proves: the night is untouched; Arena Mode opens, says it isn't switched
 * on, and its map, food guide and arena facts still work; a write answers
 * 503 with that sentence rather than breaking.
 */

test.skip(
  process.env.HOCKEY_ARENA !== "0",
  "needs a stack started with HOCKEY_ARENA=0",
);

const stamp = Date.now().toString(36);
const STACK = process.env.STACK ?? "/tmp/hockey-stack";

test("before the migration: the map works, check-ins say they're off", async ({
  page,
}) => {
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
  const email = `arena-off-${stamp}@example.test`;
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("button", { name: /Skip/ }).click();

  // The game an hour from now, so the window is open and only the table is missing.
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
  const moved = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        authorization: `Bearer ${auth.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
      }),
    },
  );
  expect(moved.ok).toBe(true);

  await page.reload();
  await expect(
    page.getByRole("region", { name: "Game time", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hockey Night sections" })
    .getByRole("link", { name: "Arena" })
    .click();
  await expect(
    page.getByText(/isn't switched on for this night yet/),
  ).toBeVisible();
  await expect(page.locator("svg[data-level]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "📍 I'm here", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("tablist", { name: "Arena Mode" })
    .getByRole("tab", { name: /^Eat & drink/ })
    .click();
  await expect(page.getByTestId("stand").first()).toBeVisible();

  const write = await page.request.post(
    `/hockey/api/occasions/${nightId}/arena`,
    { data: { type: "checkin", place: "sec:309" } },
  );
  expect(write.status()).toBe(503);
  expect((await write.json()).error).toMatch(/isn't switched on/);
});
