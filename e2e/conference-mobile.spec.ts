import { expect, test, type Page } from "@playwright/test";

/**
 * **Conference on a phone (375 px), and the way in from Passport.**
 *
 * Coworkers will open an invite on a phone. Nothing here may scroll the page
 * sideways, and the flight form must be usable. Like `conference-arrivals`,
 * it needs conferences open with guest organisers, and Arrivals open (`next
 * dev` on the memory store); otherwise it skips and says why.
 */
test.use({ viewport: { width: 375, height: 740 }, hasTouch: true });

const noSidewaysScroll = async (page: Page, where: string) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(
    overflow,
    `${where} scrolls sideways by ${overflow}px`,
  ).toBeLessThanOrEqual(0);
};

test("the Labs door leads to Conference", async ({ page }) => {
  await page.goto("/labs");
  await page.getByRole("link", { name: /Go have a conference/i }).click();
  await page.waitForURL("**/conferences");
  await noSidewaysScroll(page, "/conferences");
});

test("create, join and enter a flight on a phone", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.goto("/conferences");
  test.skip(
    (await page.getByText("Conferences aren't open here yet.").count()) > 0 ||
      (await page.getByRole("link", { name: "Start a conference" }).count()) ===
        0,
    "Conferences are closed or guests can't organise on this server.",
  );
  await page.getByRole("link", { name: "Start a conference" }).click();
  await noSidewaysScroll(page, "the create form");
  await page.getByLabel("What's it called?").fill("Phone Test");
  await page.getByLabel("Free-time ideas start from").selectOption("vancouver");
  await page.getByLabel("Starts").fill("2026-10-24");
  await page.getByLabel(/Arrivals/).check();
  await page.getByRole("button", { name: "Create it" }).click();
  await expect(
    page.getByRole("heading", { name: "Organiser settings" }),
  ).toBeVisible();
  await noSidewaysScroll(page, "organiser settings");
  const id = page.url().split("/conferences/")[1]!.split("/")[0]!;
  await page.getByRole("button", { name: "Turn on a code" }).click();
  const code = (await page.getByTestId("access-code").textContent())!.trim();

  const ctx = await browser.newContext({
    viewport: { width: 375, height: 740 },
    hasTouch: true,
  });
  const guest = await ctx.newPage();
  await guest.goto("/conferences");
  await noSidewaysScroll(guest, "the join screen");
  await guest.getByLabel("Conference code").fill(code);
  await guest.getByRole("button", { name: "Let me in" }).click();
  await guest.waitForURL(`**/conferences/${id}`);
  await noSidewaysScroll(guest, "the conference home");

  await guest.goto(`/conferences/${id}/arrivals`);
  test.skip(
    (await guest.getByText("Arrivals isn't open yet.").count()) > 0,
    "Arrivals is closed on this server; run against next dev.",
  );
  await expect(guest.getByTestId("arrivals-headline")).toBeVisible();
  await expect(guest.getByTestId("arrivals-map")).toBeVisible();
  await noSidewaysScroll(guest, "arrivals");

  const year = new Date().getUTCFullYear() + 1;
  await guest.getByLabel("Flight", { exact: true }).fill("AC855");
  await guest.getByLabel("Date it leaves").fill(`${year}-10-22`);
  await guest.getByLabel(/Share my flight with/).check();
  await guest.getByLabel("Name on the map").fill("Mo");
  await guest.getByRole("button", { name: "Save my flight" }).click();
  await expect(guest.getByTestId("arrivals-list")).toContainText("AC855");
  // A future flight is a plan, not an aircraft: it must not claim to be live.
  await expect(guest.getByTestId("arrivals-list")).not.toContainText(/live/i);
  await noSidewaysScroll(guest, "arrivals with a flight");
});
