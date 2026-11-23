// A local stand-in for Atlas, for the shared place page specs (M1041).
// Read-only, offline, and it says what it is on every response.
//
// Serves the critic's saved `GET /discovery/candidates` body (so "Close by"
// has real places to show) and the composed Organization reads committed in
// `e2e/fixtures/place-details/` as `GET /organizations/:id/detail`, and the
// Place reads in `places/` (built from the same snapshot's real candidates) as
// `GET /places` and `GET /places/:id/detail`. Every
// other detail read is a 404, as Atlas answers an id of another kind.
//
//   node e2e/support/place-details-standin.mjs [port]
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [port = "3124"] = process.argv.slice(2);
const parsed = JSON.parse(
  gunzipSync(
    readFileSync(
      "docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
    ),
  ).toString("utf8"),
);
const candidates = Array.isArray(parsed) ? parsed : parsed.candidates;
const dir = "e2e/fixtures/place-details";
const details = new Map(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")))
    .map((c) => [c.root.id, c]),
);

const placeDir = `${dir}/places`;
const places = new Map(
  readdirSync(placeDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${placeDir}/${f}`, "utf8")))
    .map((d) => [d.place.id, d]),
);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("x-atlas-standin", "place-details");
  res.setHeader("content-type", "application/json");
  if (url.pathname === "/discovery/candidates") {
    res.writeHead(200);
    res.end(JSON.stringify({ candidates }));
    return;
  }
  if (url.pathname === "/places") {
    res.writeHead(200);
    res.end(JSON.stringify([...places.values()].map((d) => d.place)));
    return;
  }
  const p = url.pathname.match(/^\/places\/([^/]+)\/detail$/);
  if (p && places.has(decodeURIComponent(p[1]))) {
    res.writeHead(200);
    res.end(JSON.stringify(places.get(decodeURIComponent(p[1]))));
    return;
  }
  const m = url.pathname.match(/^\/organizations\/([^/]+)\/detail$/);
  if (m && details.has(decodeURIComponent(m[1]))) {
    res.writeHead(200);
    res.end(JSON.stringify(details.get(decodeURIComponent(m[1]))));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not held by the place-details stand-in" }));
}).listen(Number(port), "127.0.0.1", () =>
  console.log(
    `place-details stand-in on ${port}: ${candidates.length} candidates, ${details.size} details`,
  ),
);
