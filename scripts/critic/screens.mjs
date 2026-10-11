// Screenshots of the real pages, in a real browser, for every scenario in a
// run: `/go` on desktop and on a phone, and the printed guide as an image and
// as a PDF. It also reads back what the browser rendered and compares it with
// what the critic measured, so a run whose evidence and pictures disagree
// says so instead of quietly shipping both.
//
//   node scripts/critic/screens.mjs <run-dir> <base-url>
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [dir, base] = process.argv.slice(2);
const pages = JSON.parse(readFileSync(join(dir, "pages.json"), "utf8"));
const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const out = join(dir, "screens");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const results = [];
try {
  for (const [i, p] of pages.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const expected = run.scenarios.find((s) => s.id === p.id);
    const record = { id: p.id, files: [], problems: [] };

    for (const [label, viewport] of [
      ["desktop", { width: 1280, height: 900 }],
      ["mobile", { width: 390, height: 844 }],
    ]) {
      const page = await browser.newPage({ viewport });
      const response = await page.goto(base + p.go, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
      if (!response?.ok())
        record.problems.push(`/go answered ${response?.status()} (${label})`);
      await page
        .waitForSelector('[data-testid="go-day"], [data-testid="go-empty"]', {
          timeout: 60_000,
        })
        .catch(() => record.problems.push(`/go rendered no day (${label})`));
      const titles = await page.$$eval('[data-testid="go-stop"]', (els) =>
        els
          .map((e) =>
            (
              e.querySelector("h3") ?? e.querySelector("a")
            )?.textContent?.trim(),
          )
          .filter(Boolean),
      );
      const stops = await page.locator('[data-testid="go-stop"]').count();
      if (expected && stops !== expected.stops.length)
        record.problems.push(
          `browser shows ${stops} stops on /go (${label}); the critic measured ${expected.stops.length}`,
        );
      if (label === "desktop") record.browserTitles = titles;
      const file = `${n}-${p.id}-go-${label}.jpg`;
      await page.screenshot({
        path: join(out, file),
        fullPage: true,
        type: "jpeg",
        quality: 60,
      });
      record.files.push(file);
      await page.close();
    }

    if (p.print) {
      const page = await browser.newPage({
        viewport: { width: 900, height: 1200 },
      });
      const response = await page.goto(base + p.print, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
      if (!response?.ok())
        record.problems.push(`/go/print answered ${response?.status()}`);
      const printed = await page.locator('[data-testid="guide-stop"]').count();
      if (expected && printed !== expected.stops.length)
        record.problems.push(
          `browser prints ${printed} stops; the screen had ${expected.stops.length}`,
        );
      const file = `${n}-${p.id}-print.jpg`;
      await page.screenshot({
        path: join(out, file),
        fullPage: true,
        type: "jpeg",
        quality: 60,
      });
      record.files.push(file);
      await page.emulateMedia({ media: "print" });
      const pdf = `${n}-${p.id}-print.pdf`;
      await page.pdf({
        path: join(out, pdf),
        format: "Letter",
        printBackground: true,
      });
      record.files.push(pdf);
      await page.close();
    }
    results.push(record);
    console.log(
      `${p.id}: ${record.files.length} files${record.problems.length ? `, ${record.problems.length} problems` : ""}`,
    );
  }
} finally {
  await browser.close();
}
writeFileSync(
  join(dir, "screens.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);
const problems = results.flatMap((r) => r.problems.map((x) => `${r.id}: ${x}`));
if (problems.length) {
  console.log(problems.join("\n"));
  process.exitCode = 4;
}
