/**
 * A stand-in for Upstash's REST API, for rehearsing the show with no account:
 *   node --experimental-strip-types scripts/fairview3/fake-upstash.ts 6399
 * then start the app with UPSTASH_REDIS_REST_URL=http://localhost:6399
 * UPSTASH_REDIS_REST_TOKEN=x. Two app processes pointed at it share state the
 * way two Vercel instances share a real Redis.
 */
import { createServer } from "node:http";
// @ts-expect-error -- run with node --experimental-strip-types, which wants the extension
import { fakeRedis } from "../../src/lib/fairview3/fakeRedis.ts";

const r = fakeRedis();
const port = Number(process.argv[2] ?? 6399);
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const cmds = JSON.parse(body || "[]");
    const out = req.url?.startsWith("/pipeline")
      ? r.pipeline(cmds)
      : r.pipeline([cmds])[0];
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out));
  });
}).listen(port, () => console.log(`fake upstash on ${port}`));
