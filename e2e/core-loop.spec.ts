import { test, expect } from "@playwright/test";

// The one test that matters most: the founder's actual path tonight.
// Dream -> Plan -> Reveal -> Adventure -> Capture -> Summary.
test("plans, reveals, experiences, captures, and recaps an adventure", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /make today unforgettable/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /this is going to be dope/i }).click();

  // Step 1: intent
  await page.getByRole("button", { name: "Relax" }).click();

  // Step 2: constraints
  await expect(
    page.getByRole("heading", { name: /how much day do you have/i }),
  ).toBeVisible();
  await page.getByLabel(/where are you exploring/i).fill("Kelowna");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: adventure DNA
  await expect(
    page.getByRole("heading", { name: /sound like you/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Foodie" }).click();
  await page.getByRole("button", { name: /curate my day/i }).click();

  // Reveal
  await expect(page.getByText(/going to love/i)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /show me/i }).click();
  await page.getByRole("button", { name: /let's go/i }).click();

  // Adventure Mode
  await expect(page).toHaveURL(/\/adventure\//);
  await expect(page.getByText(/right now/i)).toBeVisible();

  // Capture a moment (note only, no real photo in CI)
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByPlaceholder(/what just happened/i).fill("Great coffee.");
  await page.getByRole("button", { name: /save moment/i }).click();

  // Walk through every step to the end. Uses a stable test id + data-last
  // attribute rather than the button's own label (which changes text).
  // The final click navigates away (Adventure Mode -> Summary) as soon as
  // it fires, which races Playwright's own post-click actionability
  // re-check against our fast client-side unmount — dispatching that one
  // click as a plain DOM event sidesteps the race entirely.
  const actionButton = page.getByTestId("adventure-action-button");
  const title = page.getByTestId("adventure-current-title");
  let finished = false;
  for (let i = 0; i < 10 && !finished; i++) {
    const isLast = (await actionButton.getAttribute("data-last")) === "true";
    if (isLast) {
      await actionButton.evaluate((el: HTMLElement) => el.click());
      await page.waitForURL(/\/summary\//);
      finished = true;
    } else {
      const previousTitle = await title.textContent();
      await actionButton.click();
      await expect(title).not.toHaveText(previousTitle ?? "");
    }
  }

  // Summary / recap
  await expect(page).toHaveURL(/\/summary\//);
  await expect(page.getByText(/damn good day/i)).toBeVisible();
  await expect(page.getByText("Great coffee.")).toBeVisible();
});
