// Hockey Night on three phones, through the whole night — for before/after
// screenshots of the page, not for assertions.
//
// One host and two guests sign up through the real /auth page, join through
// real invitation links, vote, nominate real Atlas places, make picks and
// talk, all through the night's own API. The host then moves the start time
// (with the host's own session, under RLS, exactly as plan-and-results.spec
// does) so the same night can be photographed before, during and after.
//
// Needs a server built against the local stack (README.md here) and an Atlas
// stand-in serving a real /discovery/candidates body:
//
//   set -a; . $STACK/env; set +a
//   node docs/product/hockey/verification/screenshots.mjs <out-dir> [port]
//
// Nothing here uses the service role.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [out = "hockey-shots", port = "3130"] = process.argv.slice(2);
const BASE = `http://localhost:${port}`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE || !ANON) throw new Error("Source the stack env first.");
mkdirSync(out, { recursive: true });

const stamp = Date.now().toString(36);
const PASSWORD = `shots-${stamp}-pw`;
const emailFor = (who) => `${who}-shots-${stamp}@example.test`;

// Real Atlas ids near Rogers Arena (production /discovery/candidates, 2026-10-20).
const CHAMBAR = "4dbd1e2f-04aa-428f-a39e-8472998b23ca";
const SHARK_CLUB = "f2903da3-8aaa-463f-ae6e-31f490e71b2d";
const BOSTON_PIZZA = "2ac1da68-96f4-414b-9e8f-d0e86347758a";

// WIDTH=390 for an iPhone 14 / Pixel-class phone; 375 is the default.
const WIDTH = Number(process.env.WIDTH ?? 375);
const PHONE = {
  viewport: { width: WIDTH, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const browser = await chromium.launch();

async function person(who) {
  const context = await browser.newContext({ ...PHONE, baseURL: BASE });
  const page = await context.newPage();
  return { who, context, page };
}

async function signUp(page, who) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function token(who) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: PASSWORD }),
  });
  return (await res.json()).access_token;
}

async function moveStart(nightId, startsAt) {
  const res = await fetch(
    `${SUPABASE}/rest/v1/passport_occasions?id=eq.${nightId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${await token("lorne")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ starts_at: startsAt }),
    },
  );
  if (!res.ok) throw new Error(`move start: ${res.status}`);
}

let nightId;
async function act(p, action) {
  const res = await p.page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: action },
  );
  if (!res.ok())
    console.warn(p.who, action.type, res.status(), await res.text());
  return res.ok() ? res.json() : null;
}

async function snapshot(p) {
  const res = await p.page.request.get(`/hockey/api/occasions/${nightId}`);
  return res.json();
}

const minutes = (n) => new Date(Date.now() + n * 60_000).toISOString();

async function shoot(p, name, { full = true } = {}) {
  // The bare URL: a `#tab` left by an earlier shot would open that tab.
  await p.page.goto(`/hockey/${nightId}`);
  await p.page.waitForLoadState("load");
  await p.page.waitForTimeout(1200);
  await p.page.screenshot({ path: path.join(out, `${name}-top.png`) });
  if (full) {
    await p.page.screenshot({
      path: path.join(out, `${name}-full.png`),
      fullPage: true,
    });
  }
  console.log("shot", name);
}

/** Every tab of the night, if the page has tabs; the page as it is if not. */
async function shootTabs(p, name) {
  await shoot(p, name);
  const tabs = p.page.getByRole("tablist", { name: "Hockey Night" });
  if ((await tabs.count()) === 0) return;
  for (const label of ["Plan", "Play", "Chat", "Group"]) {
    const tab = tabs.getByRole("tab", { name: new RegExp(`^${label}`) });
    if ((await tab.count()) === 0) continue;
    await tab.click();
    await p.page.waitForTimeout(500);
    await p.page.screenshot({
      path: path.join(out, `${name}-${label.toLowerCase()}.png`),
      fullPage: true,
    });
    console.log("shot", `${name}-${label.toLowerCase()}`);
  }
}

// ------------------------------------------------------------- the people
const lorne = await person("lorne");
await lorne.page.goto("/hockey");
await signUp(lorne.page, "lorne");
await lorne.page.getByLabel("Your name").fill("Lorne");
await lorne.page.getByRole("button", { name: "Start it" }).click();
await lorne.page.waitForURL(/\/hockey\/[0-9a-f-]{36}$/);
nightId = lorne.page.url().split("/").pop();
console.log("night", nightId);
await shoot(lorne, "00-host-first-open");
await lorne.page.getByRole("button", { name: /Skip/ }).click();

async function invite(label) {
  const res = await lorne.page.request.post(
    `/hockey/api/occasions/${nightId}/invites`,
    { data: { label } },
  );
  const { token: invitation } = await res.json();
  return `/hockey/join/${invitation}`;
}

async function join(who, name) {
  const p = await person(who);
  await p.page.goto(await invite(name));
  await p.page.getByRole("link", { name: "Sign in to see it" }).click();
  await signUp(p.page, who);
  await p.page.getByLabel("Your name").fill(name);
  await p.page.getByRole("button", { name: "I'm in" }).click();
  await p.page.waitForURL(new RegExp(`/hockey/${nightId}$`));
  return p;
}

const maya = await join("maya", "Maya");
const sam = await join("sam", "Sam");
await shoot(maya, "01-guest-just-joined");

// ------------------------------------------------ before: plans and picks
for (const id of [CHAMBAR, SHARK_CLUB, BOSTON_PIZZA]) {
  await act(lorne, { type: "nominate", promptId: "pregame-spot", atlasId: id });
}
const snap = await snapshot(lorne);
const added = snap.state.addedOptions.filter(
  (o) => o.promptId === "pregame-spot",
);
const optionFor = (label) =>
  added.find((o) => o.option.label === label)?.option.id;
const meet = snap.definition.prompts.find((p) => p.id === "meet-spot");

await act(lorne, {
  type: "respond",
  promptId: "pregame-spot",
  value: optionFor("Chambar"),
});
await act(maya, {
  type: "respond",
  promptId: "pregame-spot",
  value: optionFor("Shark Club"),
});
await act(sam, {
  type: "respond",
  promptId: "pregame-spot",
  value: optionFor("Chambar"),
});
if (meet) {
  await act(lorne, {
    type: "respond",
    promptId: "meet-spot",
    value: meet.options[0].id,
  });
  await act(maya, {
    type: "respond",
    promptId: "meet-spot",
    value: meet.options[0].id,
  });
}
await act(lorne, { type: "respond", promptId: "hard-out", value: "one" });
await act(maya, { type: "respond", promptId: "hard-out", value: "close" });
await act(sam, { type: "respond", promptId: "hard-out", value: "horn" });

await act(lorne, { type: "respond", promptId: "final-score", value: [4, 2] });
await act(lorne, { type: "respond", promptId: "first-team", value: "canucks" });
await act(lorne, { type: "respond", promptId: "overtime", value: false });
await act(lorne, { type: "respond", promptId: "total-goals", value: 6 });
await act(maya, { type: "respond", promptId: "final-score", value: [2, 3] });
await act(maya, { type: "respond", promptId: "host-beer", value: true });
await act(sam, { type: "respond", promptId: "final-score", value: [5, 1] });

await act(lorne, { type: "say", text: "Booked nothing. Vote." });
await act(maya, {
  type: "say",
  text: "Shark Club has the big screens, just saying",
});
await act(sam, {
  type: "say",
  text: "I'm bringing the cowbell. This is not a question.",
});
await act(maya, {
  type: "setMe",
  name: "Maya",
  emoji: "🦆",
  vibe: "Here for the nachos",
});

await shootTabs(maya, "10-before-guest");
await shootTabs(lorne, "11-before-host");

// --------------------------------------------- warm-up: last call on picks
await moveStart(nightId, minutes(60));
await shootTabs(maya, "20-warmup-guest");

// ------------------------------------------------------- the game is on
await moveStart(nightId, minutes(-10));
await shoot(maya, "30-live-guest", { full: false });

await moveStart(nightId, minutes(-45));
await shootTabs(maya, "31-intermission-guest");

// ------------------------------------------------------------- after
await moveStart(nightId, minutes(-170));
await act(lorne, { type: "callIt", promptId: "final-score", value: [4, 2] });
await act(lorne, { type: "callIt", promptId: "first-team", value: "canucks" });
await act(lorne, { type: "callIt", promptId: "overtime", value: false });
await act(lorne, { type: "callIt", promptId: "total-goals", value: 6 });
await act(lorne, { type: "callIt", promptId: "host-beer", value: true });
await shootTabs(maya, "40-after-guest");

await moveStart(nightId, minutes(-16 * 60));
await shootTabs(maya, "50-morning-guest");

await browser.close();
console.log("done", nightId);
