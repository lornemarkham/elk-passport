import { expect, test } from "@playwright/test";

/**
 * **Go Have a Christmas, signed out** — what any visitor reaches. The whole
 * family journey (accounts, invites, announcements, memories) needs a real
 * auth stack and runs from docs/product/christmas/verification.
 *
 * With `E2E_ATLAS=1` (the critic's mock serving Atlas's committed corpus) the
 * pages show real Christmas finds; without it they must say Atlas isn't
 * answering rather than "nothing is on".
 */
const WITH_ATLAS = process.env.E2E_ATLAS === "1";

test("the Christmas page opens on the season and leads somewhere real", async ({
  page,
}) => {
  await page.goto("/christmas");
  await expect(
    page.getByRole("heading", { level: 1, name: /Markets, lights, Santa/ }),
  ).toBeVisible();
  await expect(page.getByTestId("countdown")).toBeVisible();
  if (WITH_ATLAS) {
    await expect(page.getByTestId("atlas-down")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("atlas-down")).toBeVisible();
  }
  await page.getByTestId("theme-markets").click();
  await expect(page).toHaveURL(/\/christmas\/discover\?theme=markets/);
  await expect(page.getByTestId("chip-markets")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (WITH_ATLAS)
    await expect(page.getByTestId("find-card").first()).toBeVisible();
});

test("refining is a plain form, and the URL keeps every answer", async ({
  page,
}) => {
  await page.goto("/christmas/discover");
  await page.getByTestId("refine").locator("summary").click();
  await page.locator('select[name="at"]').selectOption("kelowna");
  await page.locator('input[name="ages"]').fill("5");
  await page.getByTestId("refine-submit").click();
  await expect(page).toHaveURL(/at=kelowna/);
  await expect(page).toHaveURL(/ages=5/);
  if (WITH_ATLAS)
    await expect(page.getByTestId("result-count")).toContainText(
      "checked for a 5-year-old",
    );
});

test("planning and an adventure ask a visitor to sign in, and come back", async ({
  page,
  request,
}) => {
  await page.goto("/christmas/plan?shape=evening");
  const signIn = page.getByTestId("plan-sign-in");
  await expect(signIn).toBeVisible();
  expect(await signIn.getAttribute("href")).toContain(
    encodeURIComponent("/christmas/plan?shape=evening"),
  );
  await page.goto("/christmas/adventure/not-a-real-one");
  await expect(
    page.getByText("Sign in to open this Christmas adventure"),
  ).toBeVisible();
  const start = await request.post("/christmas/api/start", { data: {} });
  expect(start.status()).toBe(401);
});
