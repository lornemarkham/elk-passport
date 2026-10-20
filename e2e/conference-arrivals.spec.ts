import { expect, test, type Browser } from "@playwright/test";

/**
 * **Arrivals, end to end, without the sky:** two coworkers enter flights,
 * one shares and one doesn't, the other sees exactly the shared one, and a
 * stranger sees nothing. Flights are dated next year, so no ADS-B call is
 * made and the test doesn't depend on what is flying. The live behaviour is
 * driven by `scripts/conference-arrivals/drive.mjs` (see ARRIVALS.md).
 *
 * Needs the same server as `conference.spec.ts` (conferences open, guests
 * may organise). Against a server without them, it skips and says why.
 */

const fresh = async (browser: Browser) =>
  (await browser.newContext()).newPage();

const NEXT_YEAR = `${new Date().getUTCFullYear() + 1}-10-22`;

test("share a flight, see a coworker's, and nothing for strangers", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const org = await fresh(browser);
  await org.goto("/conferences");
  test.skip(
    (await org.getByText("Conferences aren't open here yet.").count()) > 0 ||
      (await org.getByRole("link", { name: "Start a conference" }).count()) ===
        0,
    "Conferences are closed or guests can't organise on this server; see conference.spec.ts.",
  );

  await org.getByRole("link", { name: "Start a conference" }).click();
  await org.getByLabel("What's it called?").fill("Sycle Vancouver 2026");
  await org.getByLabel("Free-time ideas start from").selectOption("vancouver");
  await org.getByLabel("Starts").fill("2026-10-24");
  await org.getByLabel(/Arrivals/).check();
  await org.getByRole("button", { name: "Create it" }).click();
  await expect(
    org.getByRole("heading", { name: "Organiser settings" }),
  ).toBeVisible();
  const id = org.url().split("/conferences/")[1]!.split("/")[0]!;
  await org.getByRole("button", { name: "Turn on a code" }).click();
  const code = (await org.getByTestId("access-code").textContent())!.trim();

  const join = async () => {
    const p = await fresh(browser);
    await p.goto("/conferences");
    await p.getByLabel("Conference code").fill(code);
    await p.getByRole("button", { name: "Let me in" }).click();
    await p.waitForURL(`**/conferences/${id}`);
    await p.goto(`/conferences/${id}/arrivals`);
    // Arrivals is closed on the in-memory store outside `next dev` by design
    // (arrivalsEnabled): say so instead of failing.
    test.skip(
      (await p.getByText("Arrivals isn't open yet.").count()) > 0,
      "Arrivals is closed on this server (in-memory store outside next dev); run against next dev.",
    );
    await expect(p.getByTestId("arrivals-headline")).toBeVisible();
    return p;
  };

  // ── Ana enters her flight and shares it ──
  const ana = await join();
  await ana.getByLabel("Flight", { exact: true }).fill("ac 855");
  await ana.getByLabel("Date it leaves").fill(NEXT_YEAR);
  await ana.getByLabel(/Flying from/).fill("lhr");
  await ana.getByLabel(/Lands in/).fill(`${NEXT_YEAR}T14:20`);
  await ana.getByLabel(/Share my flight with/).check();
  await ana.getByLabel("Name on the map").fill("Ana");
  await ana.getByRole("button", { name: "Save my flight" }).click();
  await expect(
    ana.getByText("Shared with Sycle Vancouver 2026 as Ana."),
  ).toBeVisible();
  await expect(ana.getByTestId("arrivals-list")).toContainText("AC855");

  // ── Ben enters his and keeps it to himself ──
  const ben = await join();
  await ben.getByLabel("Flight", { exact: true }).fill("WS133");
  await ben.getByLabel("Date it leaves").fill(NEXT_YEAR);
  await ben.getByRole("button", { name: "Save my flight" }).click();
  await expect(ben.getByText("Only you can see it.")).toBeVisible();

  // ── Each sees Ana's; nobody but Ben sees Ben's ──
  await expect(ben.getByTestId("arrivals-list")).toContainText("Ana");
  await expect(ben.getByTestId("arrivals-list")).toContainText("AC855");
  await expect(ben.getByTestId("arrivals-list")).toContainText("London");
  // Her booking's time is on the board as scheduled, never as live.
  await expect(ben.getByTestId("arrivals-list")).toContainText("14:20");
  await expect(
    ben.getByRole("button", { name: /Ana AC855/ }).getByTestId("time-kind"),
  ).toHaveText("Scheduled");
  await expect(ben.getByTestId("arrivals-list")).not.toContainText(/live/i);
  // The destination is named on the map.
  await expect(ben.getByTestId("arrivals-airport")).toContainText("YVR");
  await ana.reload();
  await expect(ana.getByTestId("arrivals-list")).toContainText("AC855");
  await expect(ana.getByTestId("arrivals-list")).not.toContainText("WS133");

  // ── Tapping a row explains what's known, and claims no position ──
  await ben.getByRole("button", { name: /Ana AC855/ }).click();
  await expect(ben.getByTestId("arrival-details")).toContainText("London");
  await expect(ben.getByTestId("details-time")).toContainText("Scheduled");
  await expect(ben.getByTestId("details-time")).toContainText(
    "from their booking",
  );
  await expect(ben.getByTestId("arrival-details")).not.toContainText(
    "Telemetry",
  );

  // ── Strangers get the same 404 as a conference that doesn't exist ──
  const stranger = await fresh(browser);
  expect((await stranger.goto(`/conferences/${id}/arrivals`))?.status()).toBe(
    404,
  );
  await expect(stranger.getByText("AC855")).toHaveCount(0);

  // ── Bad input is explained, field by field ──
  await ben.getByRole("button", { name: "Change" }).click();
  await ben.getByLabel("Flight", { exact: true }).fill("not a flight");
  await ben.getByRole("button", { name: "Save my flight" }).click();
  await expect(
    ben.getByText(/doesn't look like a flight number/),
  ).toBeVisible();

  // ── Changing it changes it for everyone ──
  await ana.getByRole("button", { name: "Change" }).click();
  await ana.getByLabel(/Lands in/).fill(`${NEXT_YEAR}T15:05`);
  await ana.getByRole("button", { name: "Save my flight" }).click();
  await expect(ana.getByText(/Lands .* at 15:05, scheduled\./)).toBeVisible();
  await ben.reload();
  await expect(ben.getByTestId("arrivals-list")).toContainText("15:05");
  await expect(ben.getByTestId("arrivals-list")).not.toContainText("14:20");

  // ── A landing time from another trip is refused, and said why ──
  await ana.getByRole("button", { name: "Change" }).click();
  await ana.getByLabel(/Lands in/).fill(`${NEXT_YEAR.slice(0, 4)}-11-30T09:00`);
  await ana.getByRole("button", { name: "Save my flight" }).click();
  await expect(ana.getByText(/not the same trip/)).toBeVisible();
  await ana.getByRole("button", { name: "Cancel" }).click();

  // ── Removing it is removing it ──
  await ana.getByRole("button", { name: "Remove my flight" }).click();
  await expect(ana.getByLabel("Flight", { exact: true })).toBeVisible();
  await ben.reload();
  await expect(ben.getByTestId("arrivals-list")).not.toContainText("AC855");
});
