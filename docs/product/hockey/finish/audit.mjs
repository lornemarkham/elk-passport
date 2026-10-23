// Audit driver: host + two guests through the real UI/API; photographs every tab
// before the game, during, and after. node audit.mjs <outdir> <port>
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [out = "audit-shots", port = "3130"] = process.argv.slice(2);
const BASE = `http://localhost:${port}`;
mkdirSync(out, { recursive: true });
const stamp = Date.now().toString(36);
const PASSWORD = `audit-${stamp}-pw`;
const emailFor = (w) => `${w}-aud-${stamp}@example.test`;
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const CHAMBAR = "4dbd1e2f-04aa-428f-a39e-8472998b23ca";
const SHARK_CLUB = "f2903da3-8aaa-463f-ae6e-31f490e71b2d";
const BOSTON_PIZZA = "2ac1da68-96f4-414b-9e8f-d0e86347758a";
const browser = await chromium.launch();
let nightId;

async function signUp(page, who) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}
const act = async (page, a) => {
  const r = await page.request.post(
    `/hockey/api/occasions/${nightId}/actions`,
    { data: a },
  );
  if (!r.ok()) console.warn(a.type, r.status(), await r.text());
  return r.ok() ? r.json() : null;
};
const host = await browser.newContext({ ...PHONE, baseURL: BASE });
const hp = await host.newPage();
await hp.goto("/hockey");
await signUp(hp, "lorne");
await hp.getByLabel("Your name").fill("Lorne");
await hp.screenshot({ path: path.join(out, "00-start.png"), fullPage: true });
await hp.getByRole("button", { name: "Start it" }).click();
await hp.waitForURL(/\/hockey\/[0-9a-f-]{36}$/);
nightId = hp.url().split("/").pop();
console.log("night", nightId);
await hp.screenshot({ path: path.join(out, "01-setup.png"), fullPage: true });
const skip = hp.getByRole("button", { name: /Skip/ });
if (await skip.isVisible().catch(() => false)) await skip.click();

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

for (const atlasId of [CHAMBAR, SHARK_CLUB, BOSTON_PIZZA])
  await act(hp, { type: "nominate", promptId: "pregame-spot", atlasId });
const vote = (p, promptId, value) =>
  act(p, { type: "respond", promptId, value });
await vote(hp, "final-score", [4, 2]);
await vote(maya.page, "final-score", [2, 3]);
await vote(sam.page, "first-team", "home").catch(() => {});

async function tour(page, tag) {
  await page.goto(`/hockey/${nightId}`);
  await page.waitForLoadState("load");
  const s = page.getByRole("button", { name: /^Skip/ });
  if (await s.isVisible().catch(() => false)) await s.click();
  await page.waitForTimeout(2500);
  for (const t of ["Plan", "Play", "Chat", "Group"]) {
    const tab = page.getByRole("tab", { name: new RegExp(`^${t}`) });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1200);
    }
    await page.screenshot({
      path: path.join(out, `${tag}-${t.toLowerCase()}.png`),
      fullPage: true,
    });
  }
  console.log("toured", tag);
}
await tour(host.pages()[0] ?? hp, "pre-host");
await tour(maya.page, "pre-guest");

// move the game: started 1h ago (live) then 9h ago (over)
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL,
  SK = process.env.HOCKEY_STACK_SERVICE_KEY;
const setStart = (h) =>
  fetch(`${SB}/rest/v1/passport_occasions?id=eq.${nightId}`, {
    method: "PATCH",
    headers: {
      apikey: SK,
      authorization: `Bearer ${SK}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      starts_at: new Date(Date.now() - h * 3600e3).toISOString(),
    }),
  }).then((r) => console.log("moved", h, r.status));
await setStart(1);
await tour(hp, "live-host");
await tour(maya.page, "live-guest");
await setStart(9);
await tour(hp, "after-host");
await tour(maya.page, "after-guest");
await browser.close();
console.log("done", nightId);
