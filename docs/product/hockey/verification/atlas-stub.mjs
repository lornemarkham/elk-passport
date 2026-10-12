#!/usr/bin/env node
/**
 * **A stand-in Atlas that answers one question, with obviously fake places.**
 *
 * This lane has no Atlas (port 3000 on Metatron is Lodge, not Atlas — and
 * Passport's `ATLAS_API_URL` default is `http://localhost:3000`, so a server
 * started without it set would ask the wrong program). This stub serves
 * `GET /discovery/candidates` in Atlas's real response shape so the
 * nominate-a-place path can be driven end to end.
 *
 * It proves the wiring, not the data. Every name starts "Stub" so nothing here
 * can be mistaken for a real Vancouver venue, and whether real Atlas holds
 * enough food near Rogers Arena is recorded in the README as unverified.
 *
 *   node docs/product/hockey/verification/atlas-stub.mjs   # listens on 54340
 */
import http from "node:http";

const at = (lng, lat) => ({
  state: "observed",
  locality: "Vancouver",
  coordinates: [lng, lat],
  coordinatesBasis: "observed",
});

const candidates = [
  {
    id: "stub-pub",
    kind: "Place",
    name: "Stub Pub (synthetic)",
    subtype: "pub",
    description: "A test fixture, not a pub.",
    geography: at(-123.1065, 49.2785),
    coordinates: [-123.1065, 49.2785],
  },
  {
    id: "stub-bistro",
    kind: "Place",
    name: "Stub Bistro (synthetic)",
    subtype: "bistro",
    description: "Also not real.",
    geography: at(-123.115, 49.28),
    coordinates: [-123.115, 49.28],
  },
  {
    id: "stub-museum",
    kind: "Place",
    name: "Stub Museum (synthetic)",
    subtype: "museum",
    geography: at(-123.108, 49.278),
    coordinates: [-123.108, 49.278],
  },
  {
    id: "stub-far",
    kind: "Place",
    name: "Stub Faraway Cafe (synthetic)",
    subtype: "cafe",
    geography: at(-123.03, 49.26),
    coordinates: [-123.03, 49.26],
  },
];

http
  .createServer((req, res) => {
    if (req.url?.startsWith("/discovery/candidates")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ candidates }));
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(Number(process.env.PORT ?? 54340), "127.0.0.1");
