import { expect, test } from "@playwright/test";

/**
 * **Before the owner applies together-migration.sql** — the state production
 * is in. Christmas must still plan, vote and invite on the core, say plainly
 * that announcements and shared memories aren't switched on, and refuse
 * writes with a sentence rather than an error page.
 *
 *   node docs/product/christmas/verification/stack.mjs start  # with
 *   CHRISTMAS_WITHOUT_TOGETHER=1, then restart the server, then:
 *   CHRISTMAS_OFF=1 E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification christmas-off
 */
test.skip(
  process.env.CHRISTMAS_OFF !== "1",
  "needs a stack without the migration",
);

test("without the sharing step, the plan works and the page says what's off", async ({
  page,
}) => {
  await page.goto("/auth?next=/christmas/plan");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page
    .getByLabel("Email address")
    .fill(`off-${Date.now().toString(36)}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("jingle-all-the-way-9");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/christmas\/plan/);
  await page.getByTestId("plan-shape-evening").click();
  await page.getByTestId("plan-town").selectOption("vancouver");
  await page.getByTestId("plan-date").fill("2026-12-12");
  await page.getByTestId("plan-start").click();
  await page.waitForURL(/\/christmas\/adventure\//, { timeout: 90_000 });
  const id = new URL(page.url()).pathname.split("/").at(-1)!;

  await expect(page.getByTestId("sharing-off")).toBeVisible();
  await expect(page.getByTestId("announce")).toHaveCount(0);
  await expect(page.locator("#memories")).toContainText("switches on");
  await expect(page.getByTestId("plan-day-section")).toHaveCount(1);
  await page.getByRole("button", { name: "Link for one person" }).click();
  await expect(page.getByTestId("invite-url").first()).toContainText(
    "/adventures/join/",
  );

  const refused = await page.request.post(`/christmas/api/${id}/moments`, {
    data: { kind: "moment", text: "hello" },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).off).toBe(true);
});
