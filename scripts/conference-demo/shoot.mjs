#!/usr/bin/env node
/**
 * Screenshots of a seeded conference (see seed.mjs), as one of its people,
 * at desktop and phone sizes.
 *
 *   node scripts/conference-demo/shoot.mjs <seed.json> <outDir> <person> <now-iso> <prefix> <path>...
 *
 * `<path>` is relative to the conference ("" is the overview, "schedule",
 * "arrivals"…). The browser's clock is set to `<now-iso>` so that what the
 * page computes in the browser agrees with the server's CONFERENCE_NOW.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

const [seedFile, out, person, nowIso, prefix, ...paths] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedFile, "utf8"));
const base = process.env.BASE ?? "http://localhost:3170";
mkdirSync(out, { recursive: true });

const [name, value] = seed.people[person].split(/=(.*)/s);
const browser = await chromium.launch();
const sizes = (process.env.SIZES ?? "desktop,phone").split(",");
for (const size of sizes) {
  const ctx = await browser.newContext(
    size === "phone"
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  await ctx.addCookies([{ name, value, url: base }]);
  const page = await ctx.newPage();
  // Date is pinned; timers run in real time (maps animate, fetches settle).
  await page.clock.setFixedTime(new Date(nowIso));
  for (const p of paths) {
    const url = `${base}/conferences/${seed.id}${p ? `/${p}` : ""}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    // `next dev`'s badge isn't part of the product.
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}",
    });
    // Let the page's own timers and fetches run against the fake clock.
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(Number(process.env.WAIT ?? 400));
    }
    if (process.env.SCROLL) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        Number(process.env.SCROLL),
      );
      await page.waitForTimeout(1500);
    }
    const file = `${out}/${prefix}-${(p || "overview").replace(/[/?=&#]/g, "_")}-${size}.png`;
    await page.screenshot({ path: file, fullPage: process.env.FULL !== "0" });
    console.log(file);
  }
  await ctx.close();
}
await browser.close();
