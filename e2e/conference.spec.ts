import { expect, test, type Browser } from "@playwright/test";

/**
 * **GO HAVE A CONFERENCE, end to end:** an organiser makes one and opens two
 * ways in, strangers can't see it, people join by link and by code, and
 * nobody is seen until they choose to be.
 *
 * Needs a server with conferences open and guests allowed to organise (no
 * Supabase here), e.g.:
 *
 *   CONFERENCE_SECRET=<32+ chars> CONFERENCE_STORE=memory \
 *   CONFERENCE_GUEST_ORGANISERS=1 npx next start -p 3120
 *
 * Against a server without them, it skips and says why. It does not pass.
 */

const fresh = async (browser: Browser) =>
  (await browser.newContext()).newPage();

test("create, invite, join privately, and choose to be seen", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const org = await fresh(browser);
  await org.goto("/conferences");
  test.skip(
    (await org.getByText("Conferences aren't open here yet.").count()) > 0 ||
      (await org.getByRole("link", { name: "Start a conference" }).count()) ===
        0,
    "Conferences are closed or guests can't organise on this server; see the header comment.",
  );

  // ── The organiser makes one ──
  await org.getByRole("link", { name: "Start a conference" }).click();
  await org.getByLabel("What's it called?").fill("Sycle Vancouver 2026");
  await org.getByLabel("Free-time ideas start from").selectOption("vancouver");
  await org.getByLabel("Starts").fill("2026-10-24");
  await org.getByRole("button", { name: "Create it" }).click();
  await expect(
    org.getByRole("heading", { name: "Organiser settings" }),
  ).toBeVisible();
  const id = org.url().split("/conferences/")[1]!.split("/")[0]!;
  await expect(org.getByText("Codes are off.")).toBeVisible();

  await org.getByRole("button", { name: "Turn on a code" }).click();
  const code = (await org.getByTestId("access-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  await org.getByRole("button", { name: "New link" }).click();
  const token = (await org
    .getByTestId("invite-link")
    .first()
    .getAttribute("data-token"))!;

  // ── A stranger can't tell it exists ──
  const ana = await fresh(browser);
  const stranger = await ana.goto(`/conferences/${id}`);
  expect(stranger?.status()).toBe(404);
  await expect(ana.getByText("Sycle Vancouver 2026")).toHaveCount(0);

  // ── Ana follows the link ──
  await ana.goto(`/conferences/join/${token}`);
  await expect(
    ana.getByRole("heading", { name: "Sycle Vancouver 2026" }),
  ).toBeVisible();
  await ana.getByRole("button", { name: "I'm in" }).click();
  await ana.waitForURL(`**/conferences/${id}`);
  await expect(ana.getByText("Who's here · 2")).toBeVisible();
  await expect(ana.getByTestId("doors").getByRole("link")).toHaveCount(3);
  await expect(
    ana.getByRole("link", { name: /Two hours between sessions/ }),
  ).toHaveAttribute("href", /at=vancouver/);

  // ── Ben types the code, sloppily ──
  const ben = await fresh(browser);
  await ben.goto("/conferences");
  await ben
    .getByLabel("Conference code")
    .fill(code.toLowerCase().replace(/-/g, " "));
  await ben.getByRole("button", { name: "Let me in" }).click();
  await ben.waitForURL(`**/conferences/${id}`);
  await expect(ben.getByText("Who's here · 3")).toBeVisible();
  await expect(ben.getByTestId("visible-people")).toHaveCount(0);

  // ── Ana chooses to be seen; Ben sees her name and nobody else's ──
  await ana.getByLabel("Your name here").fill("Ana");
  await ana.getByLabel("Show my name to other colleagues.").check();
  await ana.getByRole("button", { name: "Save" }).click();
  await expect(ana.getByText("Saved.")).toBeVisible();
  await ben.reload();
  await expect(ben.getByTestId("visible-people")).toHaveText("Ana");

  // ── Members can't reach the organiser's settings ──
  await ben.goto(`/conferences/${id}/admin`);
  await ben.waitForURL(`**/conferences/${id}`);

  // ── The organiser sees everyone, hidden or not ──
  await org.reload();
  await expect(org.getByTestId("members").getByRole("listitem")).toHaveCount(3);

  // ── A turned-off link stops working for new people ──
  await org.getByRole("button", { name: "Turn off" }).first().click();
  await expect(org.getByTestId("invite-link")).toHaveCount(0);
  const late = await fresh(browser);
  await late.goto(`/conferences/join/${token}`);
  await expect(
    late.getByRole("heading", { name: "This invitation has stopped working." }),
  ).toBeVisible();
});
