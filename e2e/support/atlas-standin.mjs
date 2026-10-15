// A local stand-in for Atlas, for the Discovery journeys. Read-only, offline,
// and it says what it is on every response (`x-atlas-standin`).
//
// It serves one SAVED `GET /discovery/candidates` body (the critic's committed
// 2026-10-11 snapshot by default) and measures distance the way Atlas states
// it: straight line from stated coordinates, or "unknown". It is a stand-in,
// not Atlas: nothing it says about routing is a real route.
//
//   node e2e/support/atlas-standin.mjs [body.json[.gz]] [port]
//
// Modes are switched at runtime so one server can play every failure:
//   POST /__mode  {"candidates":"ok|empty|500|slow", "distance":"ok|500",
//                  "legs":"ok|404|500|slow"}
//   GET  /__mode  → the current modes
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [
  file = "docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
  port = "3123",
] = process.argv.slice(2);
const raw = readFileSync(file);
const parsed = JSON.parse(
  (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
);
const body = Array.isArray(parsed) ? parsed : parsed.candidates;
const byId = new Map(body.map((c) => [c.id, c]));

const modes = { candidates: "ok", distance: "ok", legs: "ok" };

const km = (a, b) => {
  const r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r;
  const dLng = (b[0] - a[0]) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const json = (res, status, value) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "x-atlas-standin": "local",
  });
  res.end(JSON.stringify(value));
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/__mode") {
    if (req.method === "POST") {
      let text = "";
      for await (const chunk of req) text += chunk;
      Object.assign(modes, JSON.parse(text || "{}"));
    }
    return json(res, 200, modes);
  }

  if (url.pathname === "/discovery/candidates") {
    const wantsDistance = url.searchParams.has("lat");
    if (
      modes.candidates === "500" ||
      (wantsDistance && modes.distance === "500")
    )
      return json(res, 500, { error: "stand-in: forced failure" });
    if (modes.candidates === "empty") return json(res, 200, { candidates: [] });
    // A cold Atlas: the real corpus read is 8–19 s. Long enough for a test to
    // look at what the page is while it waits, short enough not to stall one.
    if (modes.candidates === "slow")
      await new Promise((r) => setTimeout(r, 4_000));
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const within = Number(url.searchParams.get("withinKm"));
    let out = body;
    if (wantsDistance) {
      out = [];
      for (const c of body) {
        const at = c.coordinates;
        if (!at) continue; // unplaced=drop
        const d = km([lng, lat], at);
        out.push({
          ...c,
          distance: {
            state: "measured",
            km: Math.round(d * 10) / 10,
            basis: "coordinates",
            ...(Number.isFinite(within) && within > 0
              ? { within: d <= within }
              : {}),
          },
        });
      }
    }
    return json(res, 200, { candidates: out });
  }

  if (url.pathname === "/travel/legs") {
    if (modes.legs === "404") return json(res, 404, { error: "no route" });
    if (modes.legs === "500") return json(res, 500, { error: "forced" });
    if (modes.legs === "slow") await new Promise((r) => setTimeout(r, 30_000));
    const ids = (url.searchParams.get("stops") ?? "")
      .split(",")
      .filter(Boolean);
    const mode = url.searchParams.get("mode") ?? "driving";
    const legs = [];
    // A question is either 2–10 stops, or one stop after an origin (`lat&lng`).
    const origin = url.searchParams.has("lat")
      ? [
          Number(url.searchParams.get("lng")),
          Number(url.searchParams.get("lat")),
        ]
      : undefined;
    const points = origin
      ? [origin, ...ids.map((id) => byId.get(id)?.coordinates)]
      : ids.map((id) => byId.get(id)?.coordinates);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (!a || !b) {
        legs.push({
          travel: { state: "unavailable", mode, because: "stand-in: no point" },
        });
        continue;
      }
      const straight = km(a, b);
      const routeKm = Math.round(straight * 1.3 * 10) / 10;
      legs.push({
        travel: {
          state: "estimated",
          mode,
          minutes: Math.max(1, Math.round((routeKm / 55) * 60)),
          routeKm,
          straightKm: Math.round(straight * 10) / 10,
          provider: "standin",
          calculatedAt: new Date().toISOString(),
          limitations: ["stand-in estimate, not a route"],
        },
      });
    }
    return json(res, 200, { legs });
  }

  json(res, 404, { error: "the stand-in serves candidates and legs only" });
}).listen(Number(port), "127.0.0.1", () =>
  console.log(`atlas stand-in on ${port}: ${body.length} candidates`),
);
