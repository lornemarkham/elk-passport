#!/usr/bin/env node
/**
 * **The room, simulated.** N phones (default 140) poll /api/fairview3/live
 * every ~2 s, say hello once, and when the presenter opens a question they
 * all vote within a few seconds — the burst a real reveal produces. Reports
 * request counts, errors and latency percentiles. Nothing here needs a
 * browser; it is the same HTTP the pages use.
 *
 *   FAIRVIEW3_PRESENTER_KEY=merlin node scripts/fairview3/load.mjs http://localhost:3120 [phones] [seconds]
 */
const base = (process.argv[2] ?? "http://localhost:3120").replace(/\/$/, "");
const phones = Number(process.argv[3] ?? 140);
const seconds = Number(process.argv[4] ?? 30);
const key = process.env.FAIRVIEW3_PRESENTER_KEY ?? "merlin";

const lat = { live: [], vote: [], presence: [] };
let errors = 0;
const errorKinds = new Map();
const uuid = () => crypto.randomUUID();

async function timed(kind, fn) {
  const t = performance.now();
  try {
    const r = await fn();
    lat[kind].push(performance.now() - t);
    if (!r.ok) {
      errors += 1;
      const k = `${kind} ${r.status}`;
      errorKinds.set(k, (errorKinds.get(k) ?? 0) + 1);
    }
    return r;
  } catch (e) {
    errors += 1;
    const k = `${kind} ${e.code ?? e.message}`;
    errorKinds.set(k, (errorKinds.get(k) ?? 0) + 1);
    return null;
  }
}

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

// Presenter: sign in, reset, open q1 after a few seconds, reveal near the end.
const login = await post("/api/fairview3/presenter/session", { key });
if (!login.ok) {
  console.error(
    `presenter sign-in failed: ${login.status} ${await login.text()}`,
  );
  process.exit(1);
}
const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
const presenter = (action) =>
  post("/api/fairview3/presenter", action, { cookie });
await presenter({ type: "reset", what: "all" });
await presenter({ type: "section", section: "vote-1" });

const stopAt = Date.now() + seconds * 1000;
let opened = false;
const phoneRuns = Array.from({ length: phones }, async (_, i) => {
  const id = uuid();
  await new Promise((r) => setTimeout(r, Math.random() * 3000)); // staggered arrival
  await timed("presence", () =>
    post("/api/fairview3/presence", { participant: id }),
  );
  let voted = false;
  while (Date.now() < stopAt) {
    const r = await timed("live", () =>
      fetch(`${base}/api/fairview3/live`, { cache: "no-store" }),
    );
    if (r?.ok && !voted) {
      const snap = await r.json();
      if (snap.state.questions.q1 === "open") {
        await new Promise((res) => setTimeout(res, Math.random() * 4000));
        const v = await timed("vote", () =>
          post("/api/fairview3/vote", {
            participant: id,
            question: "q1",
            option: i % 5,
          }),
        );
        voted = !!v?.ok;
      }
    }
    await new Promise((res) => setTimeout(res, 1800 + Math.random() * 400));
  }
});

setTimeout(async () => {
  opened = true;
  await presenter({ type: "question", question: "q1", status: "open" });
}, 6000);
setTimeout(
  () => presenter({ type: "question", question: "q1", status: "revealed" }),
  Math.max(8000, seconds * 1000 - 4000),
);

await Promise.all(phoneRuns);
const snap = await (await fetch(`${base}/api/fairview3/live`)).json();

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(0);
};
console.log(`phones=${phones} seconds=${seconds} opened=${opened}`);
for (const k of Object.keys(lat))
  console.log(
    `${k.padEnd(9)} n=${String(lat[k].length).padStart(5)}  p50=${pct(lat[k], 50)}ms  p95=${pct(lat[k], 95)}ms  p99=${pct(lat[k], 99)}ms  max=${pct(lat[k], 100)}ms`,
  );
console.log(
  `errors=${errors}${errorKinds.size ? " " + JSON.stringify([...errorKinds]) : ""}`,
);
console.log(
  `participants=${snap.participants} votes=${snap.tallies.q1.reduce((a, b) => a + b, 0)} tallies=${JSON.stringify(snap.tallies.q1)}`,
);
const expectedVotes = phones;
if (
  errors > 0 ||
  snap.participants < phones ||
  snap.tallies.q1.reduce((a, b) => a + b, 0) < expectedVotes
) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
