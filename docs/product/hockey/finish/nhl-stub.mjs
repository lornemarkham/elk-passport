#!/usr/bin/env node
// A stand-in for api-web.nhle.com serving RECORDED league answers (real JSON,
// captured 2026-10-22) so the journey runs without the network:
//   /v1/schedule/2026-09-26            — the day Canucks v Kraken was played
//   /v1/gamecenter/2026010056/landing  — that game, final, 4–3 in regulation
// MODE=live serves the same game as if mid-2nd-period (2–1, 12:34 left).
//   node nhl-stub.mjs <port>
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (f) =>
  JSON.parse(gunzipSync(readFileSync(path.join(here, "fixtures", f))));
const schedule = load("nhl-schedule-2026-09-26.json.gz");
const landing = load("nhl-landing-2026010056.json.gz");
const port = Number(process.argv[2] ?? 54350);

const asLive = (l) => ({
  ...l,
  gameState: "LIVE",
  periodDescriptor: { number: 2, periodType: "REG", maxRegulationPeriods: 3 },
  clock: {
    timeRemaining: "12:34",
    secondsRemaining: 754,
    running: true,
    inIntermission: false,
  },
  homeTeam: { ...l.homeTeam, score: 2 },
  awayTeam: { ...l.awayTeam, score: 1 },
});

createServer((req, res) => {
  const url = req.url ?? "";
  const send = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (process.env.MODE === "down") return send(503, { error: "down" });
  if (url.startsWith("/v1/schedule/2026-09-26")) return send(200, schedule);
  if (url.startsWith("/v1/schedule/")) return send(200, { gameWeek: [] });
  if (url === "/v1/gamecenter/2026010056/landing")
    return send(200, process.env.MODE === "live" ? asLive(landing) : landing);
  send(404, {});
}).listen(port, "127.0.0.1", () =>
  console.log(`nhl-stub on ${port} (${process.env.MODE ?? "final"})`),
);
