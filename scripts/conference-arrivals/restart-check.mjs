// Proves flights live in Postgres, not in the app process.
//
//   node scripts/conference-arrivals/restart-check.mjs write http://127.0.0.1:3160 STATE_DIR
//   ...stop the app, start it again (same build, same env)...
//   node scripts/conference-arrivals/restart-check.mjs read  http://127.0.0.1:3160 STATE_DIR
//
// Needs a server built and started against the local stack
// (scripts/conference-stack/stack.mjs) with CONFERENCE_STORE=supabase and
// CONFERENCE_ARRIVALS=on. The flight date is in the future, so ADS-B is not
// asked anything. `write` signs up two people, one shares and one doesn't;
// `read` comes back with their saved browser sessions and checks both views.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [, , mode, base, dir] = process.argv;
fs.mkdirSync(dir, { recursive: true });
const file = (n) => `${dir}/${n}`;
const date = "2026-10-24";
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch();
const as = async (state) => {
  const c = await browser.newContext(state ? { storageState: state } : {});
  return { c, p: await c.newPage() };
};
const view = (p, id) =>
  p.evaluate(async (u) => {
    const r = await fetch(u, { cache: "no-store" });
    return { status: r.status, ...(await r.json()) };
  }, `/api/conferences/${id}/arrivals`);
const flights = (v) =>
  (v.view?.board?.rows ?? []).map((r) => `${r.flight}${r.isYou ? "*" : ""}`);
const landsOf = (v, flight) =>
  (v.view?.board?.rows ?? []).find((r) => r.flight === flight)?.lands;

if (mode === "write") {
  const stamp = Date.now().toString(36);
  const signUp = async (p, who) => {
    await p.goto(`${base}/auth?next=%2Fconferences`);
    await p.getByRole("tab", { name: "Sign Up" }).click();
    await p.getByLabel("Email address").fill(`${who}-${stamp}@example.test`);
    await p.getByLabel("Password", { exact: true }).fill("wheels-down-yvr");
    await p.getByRole("button", { name: "Create account" }).click();
    await p.waitForURL("**/conferences");
  };
  const org = await as();
  await signUp(org.p, "ana");
  await org.p.goto(`${base}/conferences/new`);
  await org.p.getByLabel("What's it called?").fill("Restart Check");
  await org.p
    .getByLabel("Free-time ideas start from")
    .selectOption("vancouver");
  await org.p.getByLabel("Starts").fill(date);
  await org.p.getByLabel(/Arrivals/).check();
  await org.p.getByRole("button", { name: "Create it" }).click();
  await org.p.getByRole("heading", { name: "Organiser settings" }).waitFor();
  const id = org.p.url().split("/conferences/")[1].split("/")[0];
  await org.p.getByRole("button", { name: "Turn on a code" }).click();
  const code = (await org.p.getByTestId("access-code").textContent()).trim();

  const ben = await as();
  await signUp(ben.p, "ben");
  await ben.p.goto(`${base}/conferences`);
  await ben.p.getByLabel("Conference code").fill(code);
  await ben.p.getByRole("button", { name: "Let me in" }).click();
  await ben.p.waitForURL(`**/conferences/${id}`);

  const save = (p, body) =>
    p.evaluate(
      async ([u, b]) =>
        (await fetch(u, { method: "PUT", body: JSON.stringify(b) })).status,
      [`/api/conferences/${id}/arrivals/me`, body],
    );
  // Ana shares; Ben keeps his private. (The organiser sees Ben's name only if he shares.)
  check(
    (await save(org.p, {
      flight: "WS137",
      date,
      lands: `${date}T13:45`,
      shared: true,
      displayName: "Ana",
    })) === 200,
    "Ana saves WS137, shared",
  );
  check(
    (await save(ben.p, { flight: "AC8", date, shared: false })) === 200,
    "Ben saves AC8, private",
  );
  check(
    flights(await view(ben.p, id))
      .sort()
      .join() === "AC8*,WS137",
    "before restart Ben sees AC8 (his) and WS137",
  );
  check(
    landsOf(await view(ben.p, id), "WS137") === `${date}T13:45`,
    "…with Ana's scheduled landing time",
  );
  await org.c.storageState({ path: file("ana.json") });
  await ben.c.storageState({ path: file("ben.json") });
  fs.writeFileSync(file("id"), id);
} else {
  const id = fs.readFileSync(file("id"), "utf8");
  const ana = await as(file("ana.json"));
  const ben = await as(file("ben.json"));
  await ana.p.goto(`${base}/conferences/${id}`);
  await ben.p.goto(`${base}/conferences/${id}`);
  const a = await view(ana.p, id);
  const b = await view(ben.p, id);
  check(
    a.status === 200 && b.status === 200,
    "both still signed in and in the conference after the restart",
  );
  check(
    flights(a).join() === "WS137*",
    "Ana still has WS137 and cannot see Ben's private AC8",
  );
  check(
    flights(b).sort().join() === "AC8*,WS137",
    "Ben still has AC8 and sees Ana's shared WS137",
  );
  check(
    landsOf(b, "WS137") === `${date}T13:45`,
    "…still with Ana's scheduled landing time",
  );
}
await browser.close();
process.exit(failures ? 1 : 0);
