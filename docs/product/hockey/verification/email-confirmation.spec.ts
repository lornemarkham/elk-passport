import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "./test-credentials";
import fs from "node:fs";

/**
 * **The invitation path when Supabase requires email confirmation.**
 *
 * Acceptance (`acceptance.spec.ts`) runs against a GoTrue that auto-confirms,
 * which skips the step production may require: a coworker signs up from an
 * invitation, is told to check their email, and has to come back to the
 * invitation from the link in it. This run turns confirmation on
 * (`CONFIRM_EMAIL=1 node stack.mjs start`), mails to `smtp-sink.mjs`, and
 * reads the confirmation email the way a person would.
 *
 *   CONFIRM_EMAIL=1 E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification \
 *     email-confirmation.spec.ts
 */

const MAIL_DIR = process.env.MAIL_DIR ?? "/tmp/hockey-mail";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-${stamp}@example.test`;

/** The verify link in the newest message to `to`. */
async function confirmationLink(to: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const files = fs.existsSync(MAIL_DIR) ? fs.readdirSync(MAIL_DIR) : [];
    for (const f of files.sort().reverse()) {
      const raw = fs.readFileSync(`${MAIL_DIR}/${f}`, "utf8");
      if (!raw.toLowerCase().includes(`to: ${to}`.toLowerCase())) continue;
      const text = raw
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-F]{2})/g, (_, h) =>
          String.fromCharCode(parseInt(h, 16)),
        );
      const m = text.match(/https?:\/\/[^"'\s<>]*\/verify\?[^"'\s<>]+/);
      // GoTrue advertises `/verify`; Supabase's gateway (and stack.mjs's proxy)
      // serves it under `/auth/v1`.
      if (m)
        return m[0]
          .replace(/&amp;/g, "&")
          .replace(/(:\d+)?\/verify\?/, "$1/auth/v1/verify?");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no confirmation email for ${to}`);
}

async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function person(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

/** A confirmed host with a night and one single-use invitation path. */
async function hostWithInvite(browser: Browser, hostName: string) {
  const host = await person(browser);
  await host.page.goto("/hockey");
  await signUp(host.page, hostName);
  await expect(host.page.getByText(/Check your email/)).toBeVisible();
  // Unconfirmed: the account exists but there is no session to start a night with.
  await host.page.goto(await confirmationLink(emailFor(hostName)));
  await expect(host.page.getByText(/Nothing on yet/)).toBeVisible();
  await host.page.getByLabel("Your name").fill("Lorne");
  await host.page.getByRole("button", { name: "Start it" }).click();
  await expect(host.page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  const nightId = host.page.url().split("/").pop()!;
  await host.page.getByRole("button", { name: /Skip/ }).click();
  await host.page.getByLabel("Who the invitation is for").fill("Maya");
  await host.page.getByRole("button", { name: "Make a link" }).click();
  const invitePath = new URL(
    (await host.page.getByTestId("invite-url").textContent())!.trim(),
  ).pathname;
  return { host, nightId, invitePath };
}

test.describe.configure({ mode: "serial" });
test.skip(
  !process.env.CONFIRM_EMAIL,
  "needs a stack started with CONFIRM_EMAIL=1 (and CONFIRM_EMAIL=1 here)",
);

test("signs up from an invitation, confirms by email in the same browser, and joins", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { host, nightId, invitePath } = await hostWithInvite(browser, "host1");

  const maya = await person(browser);
  await maya.page.goto(invitePath);
  await maya.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(maya.page, "maya");
  await expect(maya.page.getByText(/Check your email/)).toBeVisible();
  // Not a member, and not signed in, until the link is followed.
  const before = await maya.page.request.get(
    `/hockey/api/occasions/${nightId}`,
  );
  expect(before.status()).toBe(401);

  await maya.page.goto(await confirmationLink(emailFor("maya")));
  await expect(maya.page).toHaveURL(new RegExp(`${invitePath}$`));
  await maya.page.getByLabel("Your name").fill("Maya");
  await maya.page.getByRole("button", { name: "I'm in" }).click();
  await expect(maya.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
  await expect(
    host.page.getByText("Maya", { exact: true }).first(),
  ).toBeVisible({
    timeout: 15_000,
  });
});

test("opens the confirmation email on another device, and is still brought back to the invitation", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { nightId, invitePath } = await hostWithInvite(browser, "host2");

  // Signs up on a laptop…
  const laptop = await person(browser);
  await laptop.page.goto(invitePath);
  await laptop.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(laptop.page, "noor");
  await expect(laptop.page.getByText(/Check your email/)).toBeVisible();

  // …and opens the email on a phone, which holds none of the sign-up's state.
  const phone = await person(browser);
  await phone.page.goto(await confirmationLink(emailFor("noor")));
  await expect(phone.page).toHaveURL(/\/auth\?/);
  await expect(phone.page).toHaveURL(
    new RegExp(`next=${encodeURIComponent(invitePath)}`, "i"),
  );
  // The account is confirmed even though this browser could not finish the
  // exchange, so signing in carries straight on to the invitation.
  await phone.page.getByLabel("Email address").fill(emailFor("noor"));
  await phone.page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await phone.page.getByRole("button", { name: "Log in" }).click();
  await expect(phone.page).toHaveURL(new RegExp(`${invitePath}$`));
  await phone.page.getByLabel("Your name").fill("Noor");
  await phone.page.getByRole("button", { name: "I'm in" }).click();
  await expect(phone.page).toHaveURL(new RegExp(`/hockey/${nightId}$`));
});
