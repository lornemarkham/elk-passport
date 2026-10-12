// A stand-in Atlas for screenshots: serves one saved `/discovery/candidates`
// body, answering only what each request asks — no `on=`, no `onDate`; no
// `childAge=`, no `forAge` — exactly as the critic's in-process mock does.
// Read-only, local, and it says what it is on every response.
//
//   node scripts/critic/atlas-mock.mjs <body.json[.gz]> <port>
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [file, port = "3122"] = process.argv.slice(2);
const raw = readFileSync(file);
const parsed = JSON.parse(
  (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
);
const body = Array.isArray(parsed) ? parsed : parsed.candidates;
const answersOn = body.find((c) => c.schedule?.onDate)?.schedule.onDate.date;
const answersAge = body.find((c) => c.suitability?.forAge)?.suitability.forAge
  .age;

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("x-ghad-critic", "atlas-mock");
  if (url.pathname !== "/discovery/candidates") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: "the critic's mock serves candidates only" }),
    );
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
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ candidates }));
}).listen(Number(port), "127.0.0.1", () =>
  console.log(`atlas-mock on ${port}: ${body.length} candidates`),
);
