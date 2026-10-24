import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * **The Crew deployed before its migration** — production's state until
 * `crew-migration.sql` is applied. Needs a stack started with
 * `HOCKEY_CREW=0 stack.mjs start` (Arena Mode's tables present, the Crew's
 * not), and is skipped otherwise.
 *
 * Proves Arena Mode as it was keeps working: the map, manual check-ins and the
 * crew strip; and that the Crew's own parts say they're off instead of
 * breaking: no GPS card, no summon button, writes answer 503.
 */

test.skip(
  process.env.HOCKEY_CREW !== "0",
  "needs a stack started with HOCKEY_CREW=0",
);

const stamp = Date.now().toString(36);
const STACK = process.env.STACK ?? "/tmp/hockey-stack";

test("before the Crew migration: arena works, the Crew says it's off", async ({
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
  const email = `crew-off-${stamp}@example.test`;
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("button", { name: /Skip/ }).click();

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

  await page.goto(`/hockey/${nightId}/arena`);
  await expect(page.locator("svg[data-level]")).toBeVisible();
  await expect(page.getByTestId("sharing")).toContainText("Not sharing");
  // Manual check-in, the existing feature, still works.
  await page.getByRole("button", { name: "📍 I'm here", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Where are you?" })
    .getByPlaceholder("Any section, e.g. 309")
    .fill("112");
  await page
    .getByRole("dialog", { name: "Where are you?" })
    .getByRole("button", { name: "Check in" })
    .click();
  await expect(page.getByTestId("sharing")).toContainText("Section 112");
  await expect(page.getByTestId("crew-me")).toHaveAttribute(
    "data-presence",
    "in",
  );
  // The Crew's own parts are off, and say so.
  await expect(
    page.getByRole("button", { name: "📣 Summon the squad" }),
  ).toHaveCount(0);
  await page
    .getByRole("tablist", { name: "Arena Mode" })
    .getByRole("tab", { name: /^Find friends/ })
    .click();
  await expect(page.getByText("Optional: add a GPS hint")).toHaveCount(0);
  await page
    .getByRole("tablist", { name: "Arena Mode" })
    .getByRole("tab", { name: /^Squad/ })
    .click();
  await expect(page.getByText(/Crew isn't switched on/)).toBeVisible();
  await page
    .getByRole("tablist", { name: "Arena Mode" })
    .getByRole("tab", { name: /^Snack run/ })
    .click();
  await expect(page.getByText(/Crew isn't switched on/)).toBeVisible();

  const api = `/hockey/api/occasions/${nightId}/arena`;
  for (const data of [
    { type: "summon", place: "sec:112", note: "" },
    {
      type: "gpsShare",
      reading: { lat: 49.2778, lng: -123.1088, accuracy: 20 },
    },
    { type: "runStart", note: "" },
  ]) {
    const write = await page.request.post(api, { data });
    expect(write.status(), data.type).toBe(503);
    expect((await write.json()).error).toMatch(/isn't switched on/);
  }
  // Stopping still works: it removes the manual check-in.
  const stop = await page.request.post(api, { data: { type: "stopSharing" } });
  expect(stop.ok()).toBe(true);
  expect((await stop.json()).checkins).toEqual([]);
});
