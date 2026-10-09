import { test, expect } from "@playwright/test";

// The one test that matters most: the founder's actual path tonight.
// Dream -> Plan -> Reveal -> Adventure -> Capture -> Summary.
//
// **It starts at `/plan` rather than at the homepage**, and that is a finding
// rather than a tidy-up: this test had been failing on `main` because the
// homepage it drove no longer exists. `/` is now "Discover the Okanagan." with
// two links, `/places` and `/discovery`, and the copy this used to click
// ("this is going to be dope") is nowhere in the codebase. Every route of the
// loop — `/plan`, `/reveal`, `/adventure`, `/summary` — still works, so the
// loop is intact and simply unreachable from the front door.
//
// Repointing it here is the smallest thing that makes the safety net work
// again. Whether Passport's homepage should link to its own core loop is a
// product decision, recorded for Lorne rather than answered here.
//
// ## The second failure was latency, not a break
//
// After repointing, this failed once at the Reveal step and passed on the next
// run. Reveal waits on a remote read, and production Atlas answers
// `/discovery/candidates` in about six seconds cold — so a 15-second budget
// was a coin toss rather than a verdict. The wait below is sized for the
// measured latency, and the flake is why it is stated here: a test that fails
// a third of the time teaches people to ignore the suite.
test("plans, reveals, experiences, captures, and recaps an adventure", async ({
  page,
}) => {
  // Step 1: intent
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: /what kind of day is this/i }),
  ).toBeVisible();
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
    timeout: 45_000,
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
