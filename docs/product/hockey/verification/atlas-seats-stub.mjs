#!/usr/bin/env node
/**
 * **A stand-in Atlas for the Our Seats walk** — local, read-only, and says
 * what it is on every answer.
 *
 * Serves one saved `/discovery/candidates` body (as `scripts/critic/
 * atlas-mock.mjs` does), and `GET /travel/legs` in travel-legs/1's shape so
 * the routed path of "Getting there" can be seen working before Atlas
 * deploys that endpoint. Its walking minutes are **invented by this stub**
 * (straight line × 1.3 at 5 km/h) and its provider is named
 * `local-stub (not a real route)`, so nothing it says can pass for a route.
 *
 *   node docs/product/hockey/verification/atlas-seats-stub.mjs <body.json[.gz]> <port>
 *
 * LEGS=404 answers /travel/legs as production Atlas does today: a path it
 * does not serve.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [file, port = "3135"] = process.argv.slice(2);
const raw = readFileSync(file);
const parsed = JSON.parse(
  (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
);
const body = Array.isArray(parsed) ? parsed : parsed.candidates;
const byId = new Map(body.map((c) => [c.id, c]));

const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const h =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("x-hockey", "atlas-seats-stub");
  res.setHeader("content-type", "application/json");
  if (url.pathname === "/discovery/candidates") {
    res.end(JSON.stringify({ candidates: body }));
    return;
  }
  if (url.pathname === "/travel/legs" && process.env.LEGS !== "404") {
    const stops = (url.searchParams.get("stops") ?? "").split(",");
    const mode = url.searchParams.get("mode");
    const unknown = stops.filter((id) => !byId.has(id));
    if (unknown.length) {
      res.writeHead(404);
      res.end(JSON.stringify({ code: "unknown-stops", unknownStops: unknown }));
      return;
    }
    const legs = stops.slice(1).map((to, i) => {
      const a = byId.get(stops[i]).geography.coordinates;
      const b = byId.get(to).geography.coordinates;
      const straight = km(a, b);
      return {
        from: stops[i],
        to,
        travel: {
          state: "estimated",
          mode,
          minutes: Math.max(1, Math.ceil(((straight * 1.3) / 5) * 60)),
          routeKm: Math.round(straight * 1.3 * 10) / 10,
          straightKm: Math.round(straight * 10) / 10,
          provider: "local-stub (not a real route)",
          calculatedAt: new Date().toISOString(),
          limitations: ["invented by atlas-seats-stub.mjs for a test"],
        },
      };
    });
    console.log(`legs ${mode} ${stops.join(" → ")}`);
    res.end(
      JSON.stringify({
        version: "travel-legs/1",
        mode,
        state: "routed",
        provider: "local-stub (not a real route)",
        legs,
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
}).listen(Number(port), "127.0.0.1", () =>
  console.log(`atlas-seats-stub on ${port}: ${body.length} candidates`),
);
