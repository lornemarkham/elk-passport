#!/usr/bin/env node
/**
 * **Before / after screenshots of Saved and Adventures, through the real app.**
 *
 * Signs a fresh account up against the local stack (`stack.mjs`, real
 * GoTrue), saves six real Kelowna subjects to its board through the app's own
 * `/api/boards`, starts a weekend adventure from three of them through
 * `/api/adventures`, and photographs each surface at phone and desktop widths.
 * Atlas is `atlas-standin.mjs` serving a saved production feed body.
 *
 *   node docs/product/adventures/verification/shoot.mjs <port> <out-dir> [label]
 *
 * Nothing here talks to a real Supabase project or a real Atlas.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [port = "3126", out = "/tmp/adventure-shots", label = "shot"] =
  process.argv.slice(2);
const base = `http://localhost:${port}`;
fs.mkdirSync(out, { recursive: true });

const SAVED = [
  "27bad519-00b7-42e8-8d96-64b3cf450eb4", // Downtown Marina
  "28d2718b-0cb8-496d-a8fa-0579641f1c73", // Kelowna Flower Farm
  "40a236e3-fae9-4657-83fa-389a9204f91d", // Waterfront Park
  "3b958853-74ef-4cda-b75a-47aa69362d4e", // Gellatly Nut Farm
  "ce6c75f2-bdf5-4798-b2ea-a05e0f6f75bf", // Kangaroo Creek Farm
  "879b9775-8fe2-4f34-83ad-fdca59c9b1a3", // Mission Hill Family Estate Winery
];

/** The coming Saturday and Sunday in Vancouver time. */
function weekend() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Vancouver" }),
  );
  const sat = new Date(now);
  sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const iso = (d) => d.toLocaleDateString("en-CA");
  return [iso(sat), iso(sun)];
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const email = `shots-${Date.now().toString(36)}@example.test`;
await page.goto(`${base}/auth?next=/saved`);
await page.getByRole("tab", { name: "Sign Up" }).click();
await page.getByLabel("Email address").fill(email);
await page.getByLabel("Password", { exact: true }).fill("a-whole-weekend-9");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30_000 });

const [sat, sun] = weekend();
const seeded = await page.evaluate(
  async ({ saved, sat, sun }) => {
    const post = (url, body) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const board = await post("/api/boards", { name: "Saved" });
    for (const experienceId of saved)
      await post(`/api/boards/${board.body.id}/items`, { experienceId });
    const adventure = await post("/api/adventures", {
      kind: "weekend",
      title: "Okanagan weekend",
      startsOn: sat,
      endsOn: sun,
      destinationTownId: "kelowna",
      destinationLabel: "Kelowna",
      atlasRefs: saved.slice(0, 3),
    });
    return { board: board.status, adventure };
  },
  { saved: SAVED, sat, sun },
);
console.log("seeded", JSON.stringify(seeded));
const id = seeded.adventure.body.id;

const pages = [
  ["saved", "/saved"],
  ["adventures", "/adventures"],
  ["adventure", `/adventures/${id}`],
  ["new", "/adventures/new"],
];
for (const [width, device] of [
  [390, "phone"],
  [1280, "desktop"],
]) {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
  for (const [name, url] of pages) {
    await page.goto(`${base}${url}`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const file = path.join(out, `${label}-${name}-${device}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
}
fs.writeFileSync(path.join(out, `${label}-account.json`), JSON.stringify({ email, id, sat, sun }));
await browser.close();
