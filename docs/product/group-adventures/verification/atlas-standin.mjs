// A stand-in Atlas for the Saved → Adventure journey: one saved
// `/discovery/candidates` body (real Atlas rows, answered exactly as the
// critic's mock answers them), boards kept in memory the way Atlas's
// owner-scoped board REST behaves, an empty `/places`, and `/travel/legs`
// answered 404 — "not served", the state production was last measured in —
// so the journey shows Passport's labelled straight line.
//
// Local and throwaway. Every response says what it is.
//
//   node docs/product/group-adventures/verification/atlas-standin.mjs <body.json[.gz]> <port>
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [file, port = "3123"] = process.argv.slice(2);
const raw = readFileSync(file);
const parsed = JSON.parse(
  (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
);
const body = Array.isArray(parsed) ? parsed : parsed.candidates;
const answersOn = body.find((c) => c.schedule?.onDate)?.schedule.onDate.date;
const answersAge = body.find((c) => c.suitability?.forAge)?.suitability.forAge
  .age;

/** id → { board, items[] } */
const boards = new Map();

const send = (res, status, value) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(value === undefined ? "" : JSON.stringify(value));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("x-ghad-verification", "atlas-standin");
  const owner = url.searchParams.get("ownerId");
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/discovery/candidates") {
    // **Asked how far, from a point** (ADR 094): straight-line km from the
    // coordinates each row states, as Atlas measures; rows it cannot place
    // are left out of the reading. Added for the Vancouver run (2026-10-24),
    // where every answer near the Parq depends on it.
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (url.searchParams.has("lat") && Number.isFinite(lat + lng)) {
      const within = Number(url.searchParams.get("withinKm") ?? 50);
      const rad = (d) => (d * Math.PI) / 180;
      const km = ([lng2, lat2]) => {
        const h =
          Math.sin(rad(lat2 - lat) / 2) ** 2 +
          Math.cos(rad(lat)) *
            Math.cos(rad(lat2)) *
            Math.sin(rad(lng2 - lng) / 2) ** 2;
        return 2 * 6371 * Math.asin(Math.sqrt(h));
      };
      const measured = body.flatMap((c) => {
        const point = c.geography?.coordinates;
        if (!point) return [];
        const d = Math.round(km(point) * 10) / 10;
        return [
          {
            id: c.id,
            distance: {
              state: "measured",
              km: d,
              basis: "coordinates",
              within: d <= within,
            },
          },
        ];
      });
      send(res, 200, { candidates: measured });
      return;
    }
    const on = url.searchParams.get("on");
    const age = url.searchParams.get("childAge");
    const candidates = body.map((c) => {
      let out = c;
      if (on !== answersOn && out.schedule?.onDate) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { onDate: _onDate, ...schedule } = out.schedule;
        out = { ...out, schedule };
      }
      if (Number(age) !== answersAge && out.suitability?.forAge) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { forAge: _forAge, ...suitability } = out.suitability;
        out = { ...out, suitability };
      }
      return out;
    });
    return send(res, 200, { candidates });
  }
  if (url.pathname === "/places") return send(res, 200, []);

  if (parts[0] === "boards") {
    const now = new Date().toISOString();
    if (parts.length === 1 && req.method === "GET") {
      return send(
        res,
        200,
        [...boards.values()]
          .map((b) => b.board)
          .filter((b) => b.ownerId === owner),
      );
    }
    if (parts.length === 1 && req.method === "POST") {
      const { name, ownerId } = await readBody(req);
      const board = {
        id: randomUUID(),
        ownerId,
        name,
        createdAt: now,
        updatedAt: now,
      };
      boards.set(board.id, { board, items: [] });
      return send(res, 201, board);
    }
    const entry = boards.get(parts[1]);
    if (!entry || entry.board.ownerId !== owner) return send(res, 404, {});
    if (parts[2] === "items" && parts.length === 3) {
      if (req.method === "GET") return send(res, 200, entry.items);
      if (req.method === "POST") {
        const { experienceId } = await readBody(req);
        let item = entry.items.find((i) => i.experienceId === experienceId);
        if (!item) {
          item = {
            id: randomUUID(),
            boardId: entry.board.id,
            experienceId,
            addedAt: now,
          };
          entry.items.push(item);
        }
        return send(res, 201, item);
      }
    }
    if (parts[2] === "items" && parts.length === 4 && req.method === "DELETE") {
      entry.items = entry.items.filter(
        (i) => i.experienceId !== decodeURIComponent(parts[3]),
      );
      return send(res, 204);
    }
    if (parts.length === 2 && req.method === "PATCH") {
      const { name } = await readBody(req);
      entry.board.name = name;
      return send(res, 200, entry.board);
    }
  }

  return send(res, 404, {
    error: "the verification stand-in does not serve this",
  });
}).listen(Number(port), "127.0.0.1", () =>
  console.log(`atlas-standin on ${port}: ${body.length} candidates`),
);
