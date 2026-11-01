#!/usr/bin/env node
// A stand-in for api-web.nhle.com with a SYNTHETIC schedule, for the public
// Hockey Night spec (`public-night.spec.ts`): three weeks of made-up games
// across real arenas, from "now", in the league's own JSON shape (checked
// against the real `/v1/schedule/2026-11-01` on 2026-11-01). Every number
// in it is invented for the test; nothing here is a claim about any game.
//
//   node nhl-schedule-stub.mjs <port>          games are FUT
//   MODE=final node nhl-schedule-stub.mjs …    every game's landing is a
//                                              2–4 final (home 2, away 4)
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 54352);
const TEAMS = [
  ["TOR", "Maple Leafs", "Toronto", "Scotiabank Arena", "America/Toronto"],
  ["BOS", "Bruins", "Boston", "TD Garden", "US/Eastern"],
  ["VAN", "Canucks", "Vancouver", "Rogers Arena", "America/Vancouver"],
  ["MIN", "Wild", "Minnesota", "Grand Casino Arena", "America/Chicago"],
  ["EDM", "Oilers", "Edmonton", "Rogers Place", "America/Edmonton"],
  ["CGY", "Flames", "Calgary", "Scotiabank Saddledome", "America/Edmonton"],
];
const team = ([abbrev, name, place]) => ({
  abbrev,
  commonName: { default: name },
  placeName: { default: place },
  score: 0,
});

const now = Date.now();
const day = (n) => new Date(now + n * 86_400_000);
const iso = (d) => d.toISOString().slice(0, 10);
const games = [];
let id = 2026029000;
// One game a day for 21 days, home side rotating, 7pm-ish local (00:00Z–03:00Z).
for (let n = 1; n <= 21; n += 1) {
  const home = TEAMS[n % TEAMS.length];
  const away = TEAMS[(n + 1) % TEAMS.length];
  const start = new Date(
    Date.UTC(
      day(n).getUTCFullYear(),
      day(n).getUTCMonth(),
      day(n).getUTCDate(),
      2,
      0,
    ),
  );
  games.push({
    id: id++,
    season: 20262027,
    gameType: 2,
    venue: { default: home[3] },
    neutralSite: false,
    startTimeUTC: start.toISOString(),
    venueTimezone: home[4],
    gameState: "FUT",
    gameScheduleState: "OK",
    awayTeam: team(away),
    homeTeam: team(home),
  });
}
// Something that must never be offered: a preseason game and one already played.
games.push({ ...games[0], id: 2026010001, gameType: 1 });
games.push({ ...games[1], id: 2026020001, gameState: "OFF" });

function week(from) {
  const start = new Date(`${from}T00:00:00Z`);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = iso(new Date(start.getTime() + i * 86_400_000));
    days.push({
      date: d,
      games: games.filter((g) => g.startTimeUTC.startsWith(d)),
    });
  }
  const next = iso(new Date(start.getTime() + 7 * 86_400_000));
  const prev = iso(new Date(start.getTime() - 7 * 86_400_000));
  return { nextStartDate: next, previousStartDate: prev, gameWeek: days };
}

function landing(g) {
  const final = process.env.MODE === "final";
  return {
    ...g,
    gameState: final ? "OFF" : g.gameState,
    periodDescriptor: final ? { number: 3, periodType: "REG" } : undefined,
    homeTeam: { ...g.homeTeam, score: final ? 2 : 0 },
    awayTeam: { ...g.awayTeam, score: final ? 4 : 0 },
    summary: final
      ? {
          scoring: [
            {
              periodDescriptor: { number: 1, periodType: "REG" },
              goals: [
                {
                  isHome: false,
                  teamAbbrev: { default: g.awayTeam.abbrev },
                  name: { default: "A. Visitor" },
                  timeInPeriod: "04:10",
                },
              ],
            },
            {
              periodDescriptor: { number: 2, periodType: "REG" },
              goals: [
                {
                  isHome: false,
                  teamAbbrev: { default: g.awayTeam.abbrev },
                  name: { default: "B. Visitor" },
                  timeInPeriod: "07:00",
                },
                {
                  isHome: true,
                  teamAbbrev: { default: g.homeTeam.abbrev },
                  name: { default: "C. Home" },
                  timeInPeriod: "12:00",
                },
              ],
            },
            {
              periodDescriptor: { number: 3, periodType: "REG" },
              goals: [
                {
                  isHome: false,
                  teamAbbrev: { default: g.awayTeam.abbrev },
                  name: { default: "D. Visitor" },
                  timeInPeriod: "01:00",
                },
                {
                  isHome: false,
                  teamAbbrev: { default: g.awayTeam.abbrev },
                  name: { default: "E. Visitor" },
                  timeInPeriod: "09:30",
                },
                {
                  isHome: true,
                  teamAbbrev: { default: g.homeTeam.abbrev },
                  name: { default: "F. Home" },
                  timeInPeriod: "15:00",
                },
              ],
            },
          ],
        }
      : undefined,
  };
}

createServer((req, res) => {
  const url = req.url ?? "";
  const send = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (process.env.MODE === "down") return send(503, { error: "down" });
  let m = /^\/v1\/schedule\/(\d{4}-\d{2}-\d{2})/.exec(url);
  if (m) return send(200, week(m[1]));
  m = /^\/v1\/gamecenter\/(\d+)\/landing/.exec(url);
  if (m) {
    const g = games.find((x) => String(x.id) === m[1]);
    return g ? send(200, landing(g)) : send(404, {});
  }
  send(404, {});
}).listen(port, "127.0.0.1", () =>
  console.log(`nhl-schedule-stub on ${port} (${process.env.MODE ?? "future"})`),
);
