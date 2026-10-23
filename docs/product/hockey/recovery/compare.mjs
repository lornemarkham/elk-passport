// The same Hockey Night photographed on any build — for comparing versions,
// not for assertions (that is `verification/recovery.spec.ts`).
//
// One host and two guests sign up through the real /auth page and join through
// real invitation links. Then, through the night's own API only: three real
// Atlas places nominated, votes on dinner, meeting point and leaving, the
// group's seats, the host's time and gate, a few lines of chat. The page is
// photographed twice: fresh (the host alone, nothing decided) and busy.
//
//   set -a; . $STACK/env; set +a
//   node docs/product/hockey/recovery/compare.mjs <out-dir> <port>
//
// Version-agnostic on purpose: it never clicks anything inside Plan except,
// on builds where Plan is an accordion (Release 1 / 2), the row toggles — so
// those builds are photographed with the dinner and meeting rows open too.
// Nothing here uses the service role.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [out = "compare-shots", port = "3130"] = process.argv.slice(2);
const BASE = `http://localhost:${port}`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE || !ANON) throw new Error("Source the stack env first.");
mkdirSync(out, { recursive: true });

const stamp = `${port}-${Date.now().toString(36)}`;
const PASSWORD = `compare-${stamp}-pw`;
const emailFor = (who) => `${who}-cmp-${stamp}@example.test`;

// Real Atlas ids near Rogers Arena (production /discovery/candidates, 2026-10-20).
const CHAMBAR = "4dbd1e2f-04aa-428f-a39e-8472998b23ca";
const SHARK_CLUB = "f2903da3-8aaa-463f-ae6e-31f490e71b2d";
const BOSTON_PIZZA = "2ac1da68-96f4-414b-9e8f-d0e86347758a";

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const DESK = { viewport: { width: 1280, height: 900 } };

const browser = await chromium.launch();

async function signUp(page, who) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

let nightId;
async function act(page, action) {
  const res = await page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: action },
  );
  if (!res.ok()) console.warn(action.type, res.status(), await res.text());
  return res.ok() ? res.json() : null;
}

/** Wait until the places near the arena have arrived (or said they can't). */
async function settle(page) {
  await page.waitForLoadState("load");
  await page
    .getByText(/Asking Atlas what/)
    .first()
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
}

/** On an accordion build, open one of Plan's rows; elsewhere, nothing. */
async function openRow(page, label) {
  const button = page
    .getByRole("region", { name: "The plan" })
    .getByRole("button", { name: new RegExp(`^${label}`) })
    .and(page.locator("[aria-expanded]"));
  if ((await button.count()) === 0) return false;
  if ((await button.first().getAttribute("aria-expanded")) !== "true")
    await button.first().click();
  await settle(page);
  return true;
}

async function shoot(context, name) {
  const page = await context.newPage();
  await page.goto(`/hockey/${nightId}#plan`);
  await page.waitForLoadState("load");
  // The host's "You're making…" setup comes back on a fresh page; skip it.
  const skip = page.getByRole("button", { name: /^Skip/ });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const planTab = page.getByRole("tab", { name: /^Plan/ });
  if (await planTab.isVisible().catch(() => false)) await planTab.click();
  await settle(page);
  await page.screenshot({ path: path.join(out, `${name}-top.png`) });
  await page.screenshot({
    path: path.join(out, `${name}-full.png`),
    fullPage: true,
  });
  console.log("shot", name);
  for (const [row, tag] of [
    ["Before the game", "dinner-open"],
    ["Meeting point", "meeting-open"],
  ]) {
    if (await openRow(page, row)) {
      await page.screenshot({
        path: path.join(out, `${name}-${tag}-full.png`),
        fullPage: true,
      });
      console.log("shot", `${name}-${tag}`);
    }
  }
  await page.close();
}

// ------------------------------------------------------------- the host
const host = await browser.newContext({ ...PHONE, baseURL: BASE });
const hp = await host.newPage();
await hp.goto("/hockey");
await signUp(hp, "lorne");
await hp.getByLabel("Your name").fill("Lorne");
await hp.getByRole("button", { name: "Start it" }).click();
await hp.waitForURL(/\/hockey\/[0-9a-f-]{36}$/);
nightId = hp.url().split("/").pop();
console.log("night", nightId);
await hp.getByRole("button", { name: /Skip/ }).click();
await hp.close();

const hostDesk = await browser.newContext({
  ...DESK,
  baseURL: BASE,
  storageState: await host.storageState(),
});

await shoot(host, "fresh-390");
await shoot(hostDesk, "fresh-1280");

// ------------------------------------------------------------ the guests
async function join(who, name) {
  const res = await host.request.post(
    `${BASE}/hockey/api/occasions/${nightId}/invites`,
    { data: { label: name } },
  );
  const { token } = await res.json();
  const context = await browser.newContext({ ...PHONE, baseURL: BASE });
  const page = await context.newPage();
  await page.goto(`/hockey/join/${token}`);
  await page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(page, who);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "I'm in" }).click();
  await page.waitForURL(new RegExp(`/hockey/${nightId}$`));
  return { context, page };
}
const maya = await join("maya", "Maya");
const sam = await join("sam", "Sam");
const lorne = await host.newPage();
await lorne.goto(`/hockey/${nightId}`);

// ------------------------------------------- the night fills up, by API
for (const atlasId of [CHAMBAR, SHARK_CLUB, BOSTON_PIZZA])
  await act(lorne, { type: "nominate", promptId: "pregame-spot", atlasId });
const snap = await (
  await lorne.request.get(`/hockey/api/occasions/${nightId}`)
).json();
const option = (label) =>
  snap.state.addedOptions.find(
    (o) => o.promptId === "pregame-spot" && o.option.label === label,
  )?.option.id;
const meet = snap.definition.prompts.find((p) => p.id === "meet-spot");

const vote = (page, promptId, value) =>
  act(page, { type: "respond", promptId, value });
await vote(lorne, "pregame-spot", option("Chambar"));
await vote(maya.page, "pregame-spot", option("Shark Club"));
await vote(sam.page, "pregame-spot", option("Chambar"));
if (meet) {
  await vote(lorne, "meet-spot", meet.options[0].id);
  await vote(maya.page, "meet-spot", meet.options[0].id);
}
await vote(lorne, "hard-out", "one");
await vote(maya.page, "hard-out", "close");
await vote(sam.page, "hard-out", "horn");
await vote(lorne, "final-score", [4, 2]);
await vote(maya.page, "final-score", [2, 3]);
await act(lorne, { type: "say", text: "Booked nothing. Vote." });
await act(maya.page, {
  type: "say",
  text: "Shark Club has the big screens, just saying",
});

// Seats and the host's time and gate, where the build has them.
const seatsUrl = `/hockey/api/occasions/${nightId}/seats`;
const view = await lorne.request.get(seatsUrl);
if (view.ok()) {
  const { me } = await view.json();
  await lorne.request.put(seatsUrl, {
    data: { for: "group", section: "309", row: "12", seats: "1-8" },
  });
  await lorne.request.put(seatsUrl, {
    data: { for: me, section: "309", row: "12", seats: "1", gate: "10" },
  });
  await lorne.request.put(`/hockey/api/occasions/${nightId}/meetup`, {
    data: { gate: "10", spot: "Outside, by the doors", time: "18:15" },
  });
}
await lorne.close();

await shoot(host, "busy-host-390");
await shoot(hostDesk, "busy-host-1280");
await shoot(maya.context, "busy-guest-390");

await browser.close();
console.log("done", nightId);
