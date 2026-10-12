// Drives /conferences/{id}/arrivals in a real browser against a running
// server and live ADSB.lol, and saves screenshots. Not a test: the sky is
// different every time. See docs/products/go-have-a-conference/ARRIVALS.md.
//
//   node scripts/conference-arrivals/drive.mjs http://127.0.0.1:3141 \
//     "Ana:WS137:YYC" "Ben:F8813:YYC" ...
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const [, , base = "http://127.0.0.1:3141", ...people] = process.argv;
const out = new URL(
  "../../docs/products/go-have-a-conference/arrivals/",
  import.meta.url,
).pathname;
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Edmonton",
});

// ACCOUNTS=1: everybody, organiser included, signs up through Passport's
// own /auth page first (needs a server built against a real GoTrue, e.g.
// the local stack in feature/hockey's docs/product/hockey/verification).
const accounts = process.env.ACCOUNTS === "1";
const stamp = Date.now().toString(36);
async function signUp(p, who) {
  await p.goto(`${base}/auth?next=%2Fconferences`);
  await p.getByRole("tab", { name: "Sign Up" }).click();
  await p.getByLabel("Email address").fill(`${who}-${stamp}@example.test`);
  await p.getByLabel("Password", { exact: true }).fill("wheels-down-yvr");
  await p.getByRole("button", { name: "Create account" }).click();
  await p.waitForURL("**/conferences");
}

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const page = async () => (await browser.newContext(phone)).newPage();
const shot = async (p, name) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${out}${name}.png` });
};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// The organiser makes the conference, switches Arrivals on, opens a code.
const org = await page();
if (accounts) await signUp(org, "organiser");
await org.goto(`${base}/conferences/new`);
await org.getByLabel("What's it called?").fill("Sycle Vancouver 2026");
await org.getByLabel("Free-time ideas start from").selectOption("vancouver");
await org.getByLabel("Starts").fill("2026-10-24");
await org.getByLabel(/Arrivals/).check();
await org.getByRole("button", { name: "Create it" }).click();
await org.getByRole("heading", { name: "Organiser settings" }).waitFor();
const id = org.url().split("/conferences/")[1].split("/")[0];
await org.getByRole("button", { name: "Turn on a code" }).click();
const code = (await org.getByTestId("access-code").textContent()).trim();
log("conference", id, "code", code);

const members = [];
for (const spec of people) {
  const [name, flight, from, share = "share"] = spec.split(":");
  const p = await page();
  if (accounts) await signUp(p, name.toLowerCase());
  await p.goto(`${base}/conferences`);
  await p.getByLabel("Conference code").fill(code);
  await p.getByRole("button", { name: "Let me in" }).click();
  await p.waitForURL(`**/conferences/${id}`);
  await p.goto(`${base}/conferences/${id}/arrivals`);
  await p.getByLabel("Flight", { exact: true }).fill(flight);
  await p.getByLabel("Date it leaves").fill(today);
  if (from) await p.getByLabel(/Flying from/).fill(from);
  if (share === "share") {
    await p.getByLabel(/Share my flight with/).check();
    await p.getByLabel("Name on the map").fill(name);
  }
  if (members.length === 0) await shot(p, "01-enter-flight");
  await p.getByRole("button", { name: "Save my flight" }).click();
  await p.getByRole("button", { name: "Remove my flight" }).waitFor();
  log(name, "saved", flight, from, share);
  members.push({ name, p });
}

// A stranger: same 404 as a conference that doesn't exist, page and API.
const stranger = await page();
const s1 = await stranger.goto(`${base}/conferences/${id}/arrivals`);
const s2 = await stranger.request.get(`${base}/api/conferences/${id}/arrivals`);
const s3 = await stranger.request.put(
  `${base}/api/conferences/${id}/arrivals/me`,
  { data: { flight: "WS137", date: today, shared: true, displayName: "Eve" } },
);
log("stranger page", s1.status(), "api", s2.status(), "save", s3.status());

// Everyone watches. Screenshot the first member's view as things change.
const watcher = members.at(-1).p;
writeFileSync(`${out}conference-id.txt`, `${id}\n`);
const seen = new Set();
const until = Date.now() + Number(process.env.WATCH_MINUTES ?? 3) * 60_000;
let n = 0;
while (Date.now() < until) {
  for (const { name, p } of members) {
    // From inside the page: the guest cookie is Secure, and Playwright's own
    // request client won't send it over plain http.
    const body = await p.evaluate(async (url) => {
      const r = await fetch(url, { cache: "no-store" });
      return { status: r.status, ...(await r.json()) };
    }, `/api/conferences/${id}/arrivals`);
    if (!body.view) {
      log(name, "api", body.status, JSON.stringify(body));
      continue;
    }
    const { view } = body;
    const rows = view.board.rows.map(
      (x) =>
        `${x.isYou ? "you" : x.name}/${x.flight}/${x.phase}${x.position ? `@${x.position.lat.toFixed(3)},${x.position.lon.toFixed(3)} ${x.position.altitudeFt}ft ${x.position.at.slice(11, 19)}` : ""}`,
    );
    log(name, "sees", rows.join(" | "));
  }
  const headline = await watcher.getByTestId("arrivals-headline").textContent();
  const phases = await watcher.getByTestId("arrivals-list").innerText();
  const key = `${headline}|${phases.replace(/\d+ (s|min|h) ago|just now/g, "")}`;
  if (!seen.has(key)) {
    seen.add(key);
    await watcher.waitForTimeout(1500);
    const tag = `${String(2 + n++).padStart(2, "0")}-board`;
    await shot(watcher, tag);
    await watcher.screenshot({ path: `${out}${tag}-full.png`, fullPage: true });
    log("screenshot:", headline);
  }
  await watcher.waitForTimeout(15_000);
}

// Tap a plane and the details sheet opens.
const first = watcher.locator(".arrivals-plane").first();
if (await first.count()) {
  await first.click();
  await watcher.getByTestId("arrival-details").waitFor();
  await watcher.getByText(/How we know it's this plane/).click();
  await watcher.getByTestId("arrival-details").scrollIntoViewIfNeeded();
  await shot(watcher, "10-details");
  await watcher.screenshot({
    path: `${out}11-details-full.png`,
    fullPage: true,
  });
}
await watcher.evaluate(() => window.scrollTo(0, 0));
await shot(watcher, "12-final");
await browser.close();
