// Prints what the arrivals API says about each flight, and why: the
// sentence under "Waiting to identify…" and every check behind it.
//
//   node scripts/conference-arrivals/why.mjs http://127.0.0.1:3141 AC1949:YUL WS322:YEG
import { chromium } from "@playwright/test";

const [, , base = "http://127.0.0.1:3141", ...flights] = process.argv;
const date = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Edmonton",
});
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${base}/conferences/new`);
await page.getByLabel("What's it called?").fill("Why");
await page.getByLabel("Free-time ideas start from").selectOption("vancouver");
await page.getByLabel("Starts").fill("2026-10-24");
await page.getByLabel(/Arrivals/).check();
await page.getByRole("button", { name: "Create it" }).click();
await page.getByRole("heading", { name: "Organiser settings" }).waitFor();
const id = page.url().split("/conferences/")[1].split("/")[0];

const call = (method, url, body) =>
  page.evaluate(
    async ([method, url, body]) => {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return r.json();
    },
    [method, url, body],
  );

for (const spec of flights) {
  const [flight, from] = spec.split(":");
  await call("PUT", `/api/conferences/${id}/arrivals/me`, {
    flight,
    from,
    date,
    shared: false,
  });
  // A search, then the board as it stands.
  const { view } = await call("GET", `/api/conferences/${id}/arrivals`);
  const row = view.board.rows[0];
  console.log(`\n${flight} from ${from} (${date}): ${row.phase}`);
  if (row.waiting) console.log(`  "${row.waiting}"`);
  for (const e of row.evidence)
    console.log(`  ${e.result} ${e.check}: ${e.says}`);
}
await browser.close();
