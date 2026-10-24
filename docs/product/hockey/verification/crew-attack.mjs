#!/usr/bin/env node
/**
 * **Attack the Crew the way a hostile member, a stranger or a removed guest
 * would** — straight at PostgREST with real GoTrue sessions, skipping the
 * Passport UI and its server entirely. Whatever this script cannot do,
 * nobody can do. Covers the privacy rules in `crew-migration.sql`: GPS hints
 * (members only, own row only, no coordinates, no trail, revocable, expiring),
 * squad summons and replies, and snack runs and requests.
 *
 * Needs the local stack with the arena and crew migrations (stack.mjs start;
 * the default). Re-applies the crew migration once at the start to prove it is
 * idempotent. Exits non-zero on any failure.
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STACK = process.env.STACK ?? "/tmp/hockey-stack";
const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs
    .readFileSync(`${STACK}/env`, "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
let checks = 0;
const check = (ok, label) => {
  checks++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

const { default: pg } = await import(
  path.join(STACK, "node_modules/pg/lib/index.js")
);
async function superuser(text, params) {
  const client = new pg.Client({ connectionString: env.HOCKEY_STACK_PG });
  await client.connect();
  try {
    return await client.query(text, params);
  } finally {
    await client.end();
  }
}

async function signUp(name) {
  const email = `${name}-${Date.now()}-${randomBytes(3).toString("hex")}@example.test`;
  const res = await fetch(`${URL_}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery-9" }),
  });
  const body = await res.json();
  if (!body.access_token)
    throw new Error(`signup failed: ${JSON.stringify(body)}`);
  return { name, id: body.user.id, token: body.access_token };
}

async function rest(who, method, p, body, prefer = "return=representation") {
  const res = await fetch(`${URL_}/rest/v1${p}`, {
    method,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${who ? who.token : ANON}`,
      "content-type": "application/json",
      prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}
const rows = (r) => (Array.isArray(r.body) ? r.body : []);
const refused = (r) => r.status >= 400 || rows(r).length === 0;
const rpc = (who, fn, args) => rest(who, "POST", `/rpc/${fn}`, args);

async function night(host, startsAt) {
  const r = await rpc(host, "passport_create_occasion", {
    p_template: "sycle-hockey-night",
    p_title: "Sycle Hockey Night",
    p_starts_at: startsAt.toISOString(),
    p_details: { opponent: "Wild" },
    p_display_name: host.name,
    p_emoji: "🧭",
    p_hue: 155,
    p_prompts: [],
  });
  return r.body;
}

async function bringIn(host, occ, guest) {
  const token = randomBytes(32).toString("base64url");
  await rest(host, "POST", "/passport_occasion_invites", {
    occasion_id: occ,
    token_hash: createHash("sha256").update(token).digest("hex"),
    max_uses: 1,
    created_by: host.id,
  });
  const r = await rpc(guest, "passport_redeem_occasion_invite", {
    p_token: token,
    p_display_name: guest.name,
    p_emoji: "🙂",
    p_hue: 200,
  });
  return r.status < 300;
}

const GPS = "/passport_occasion_gps_hints";
const SUMMONS = "/passport_occasion_summons";
const REPLIES = "/passport_occasion_summon_replies";
const RUNS = "/passport_occasion_snack_runs";
const ITEMS = "/passport_occasion_snack_items";
const TABLES = [GPS, SUMMONS, REPLIES, RUNS, ITEMS].map((t) => t.slice(1));

console.log("Migration");
await superuser(
  fs.readFileSync(path.join(here, "..", "crew-migration.sql"), "utf8"),
);
// Re-running Arena Mode's migration afterwards must not break the Crew (it
// once replaced a shared stamp function and every Crew write failed).
await superuser(
  fs.readFileSync(path.join(here, "..", "arena-migration.sql"), "utf8"),
);
const policies = await superuser(
  "select count(*)::int as n from pg_policies where tablename = any($1)",
  [TABLES],
);
check(
  policies.rows[0].n === 19,
  `applied twice: 19 policies (${policies.rows[0].n})`,
);
const rls = await superuser(
  "select count(*)::int as n from pg_class where relname = any($1) and relrowsecurity",
  [TABLES],
);
check(rls.rows[0].n === 5, "RLS on for all five tables");
const cols = await superuser(
  "select column_name from information_schema.columns where table_name = 'passport_occasion_gps_hints'",
);
check(
  !cols.rows.some((c) => /lat|lng|lon|coord|geo|point/i.test(c.column_name)),
  `GPS table has no coordinate column (${cols.rows.map((c) => c.column_name).join(", ")})`,
);
const itemCols = await superuser(
  "select column_name from information_schema.columns where table_name in ('passport_occasion_snack_items','passport_occasion_snack_runs')",
);
check(
  !itemCols.rows.some((c) =>
    /price|pay|cents|card|amount/i.test(c.column_name),
  ),
  "snack tables hold no money",
);

const [host, ana, bo, stranger, cy] = await Promise.all(
  ["Host", "Ana", "Bo", "Stranger", "Cy"].map(signUp),
);
const soon = new Date(Date.now() + 60 * 60_000);
const nextWeek = new Date(Date.now() + 7 * 864e5);
const occ = await night(host, soon);
const later = await night(host, nextWeek);
check(
  typeof occ === "string" && typeof later === "string",
  "host starts two nights",
);
check(await bringIn(host, occ, ana), "Ana joins tonight");
check(await bringIn(host, occ, bo), "Bo joins tonight");
check(await bringIn(host, occ, cy), "Cy joins tonight");
check(await bringIn(host, later, ana), "Ana joins next week's too");

const hint = (who, extra = {}) => ({
  occasion_id: occ,
  user_id: who.id,
  zone: "around",
  distance_m: 100,
  accuracy_m: 30,
  ...extra,
});

console.log("\nSigned out");
for (const t of [GPS, SUMMONS, REPLIES, RUNS, ITEMS]) {
  check(
    refused(await rest(null, "GET", `${t}?select=*`)),
    `anon reads nothing from ${t.slice(1)}`,
  );
}
check(
  refused(await rest(null, "POST", GPS, hint(ana))),
  "anon writes no GPS hint",
);

console.log("\nGPS hint: opt-in, coarse, one row, mine only");
check(
  rows(await rest(bo, "GET", `${GPS}?select=*`)).length === 0,
  "nobody has a hint until they share",
);
const shared = await rest(ana, "POST", GPS, hint(ana));
check(shared.status === 201, `Ana shares a hint (${shared.status})`);
check(
  rows(await rest(bo, "GET", `${GPS}?select=*`)).length === 1,
  "Bo (member) reads it",
);
const seen = rows(await rest(bo, "GET", `${GPS}?select=*`))[0];
check(
  Object.keys(seen).sort().join() ===
    "accuracy_m,distance_m,occasion_id,updated_at,user_id,zone",
  `a hint is only zone, distance, accuracy and when (${Object.keys(seen).join(",")})`,
);
check(
  rows(await rest(stranger, "GET", `${GPS}?select=*`)).length === 0,
  "a stranger reads nothing",
);
check(
  refused(await rest(ana, "POST", GPS, hint(bo))),
  "Ana can't share a hint as Bo",
);
check(
  refused(await rest(stranger, "POST", GPS, hint(stranger))),
  "a stranger can't share into the night",
);
check(
  (await rest(ana, "POST", GPS, hint(ana))).status >= 400,
  "a second row for Ana is refused: one row, so no trail",
);
check(
  (
    await rest(
      ana,
      "POST",
      GPS,
      hint(bo, { user_id: ana.id, lat: 49.27, lng: -123.1 }),
    )
  ).status >= 400,
  "coordinates can't be written (no such column)",
);
for (const [label, extra] of [
  ["a zone that isn't one", { zone: "inside-section-112" }],
  ["a distance not rounded to 50 m", { distance_m: 123 }],
  ["an accuracy not rounded to 10 m", { accuracy_m: 33 }],
  ["an accuracy under 10 m", { accuracy_m: 3 }],
  ["an accuracy over 1500 m", { accuracy_m: 2000 }],
]) {
  const probe = await rest(bo, "POST", GPS, hint(bo, extra));
  check(probe.status >= 400, `refuses ${label}`);
}
const upd = await rest(
  ana,
  "PATCH",
  `${GPS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
  {
    zone: "near",
    distance_m: 400,
    accuracy_m: 50,
  },
);
check(
  rows(upd).length === 1 && rows(upd)[0].zone === "near",
  "Ana refreshes her own hint (overwrites)",
);
check(
  refused(
    await rest(
      bo,
      "PATCH",
      `${GPS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
      { zone: "away" },
    ),
  ),
  "Bo can't change Ana's hint",
);
check(
  refused(
    await rest(
      ana,
      "PATCH",
      `${GPS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
      { user_id: bo.id },
    ),
  ),
  "Ana can't hand her row to Bo",
);
check(
  refused(
    await rest(
      ana,
      "PATCH",
      `${GPS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
      { occasion_id: later },
    ),
  ),
  "Ana can't move her hint to another night",
);
const stolen = await rest(
  bo,
  "DELETE",
  `${GPS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
);
check(rows(stolen).length === 0, "Bo can't delete Ana's hint");
check(
  rows(await rest(ana, "GET", `${GPS}?select=*`)).length === 1,
  "…it is still there",
);

console.log("\nRevoking removes access at once");
const gone = await rest(
  ana,
  "DELETE",
  `${GPS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
);
check(rows(gone).length === 1, "Ana stops sharing");
check(
  rows(await rest(bo, "GET", `${GPS}?select=*`)).length === 0,
  "Bo sees nothing the instant she does",
);
check(
  rows(await rest(host, "GET", `${GPS}?select=*`)).length === 0,
  "nor does the host",
);

console.log("\nA removed member vanishes from everyone's view");
await rest(cy, "POST", GPS, hint(cy));
check(
  rows(await rest(ana, "GET", `${GPS}?select=*`)).length === 1,
  "Ana sees Cy's hint",
);
await superuser(
  "delete from passport_occasion_members where occasion_id = $1 and user_id = $2",
  [occ, cy.id],
);
check(
  rows(await rest(ana, "GET", `${GPS}?select=*`)).length === 0,
  "removed, Cy's hint is invisible to Ana",
);
check(
  rows(await rest(cy, "GET", `${GPS}?select=*`)).length === 0,
  "and Cy reads nothing",
);
check(
  refused(await rest(cy, "POST", GPS, hint(cy, { zone: "near" }))),
  "and can't write again",
);
await superuser("delete from passport_occasion_gps_hints where user_id = $1", [
  cy.id,
]);

console.log("\nThe window: no sharing before the night");
check(
  refused(await rest(ana, "POST", GPS, { ...hint(ana), occasion_id: later })),
  "Ana can't share a hint for a night a week away",
);

console.log("\nSquad summons");
const summon = await rest(ana, "POST", SUMMONS, {
  occasion_id: occ,
  from_user: ana.id,
  place: "sec:112",
  note: "Nachos. Now.",
});
check(summon.status === 201, `Ana summons the squad (${summon.status})`);
const sid = rows(summon)[0]?.id;
check(
  rows(await rest(bo, "GET", `${SUMMONS}?select=*`)).length === 1,
  "Bo reads it",
);
check(
  rows(await rest(stranger, "GET", `${SUMMONS}?select=*`)).length === 0,
  "a stranger doesn't",
);
check(
  refused(
    await rest(bo, "POST", SUMMONS, {
      occasion_id: occ,
      from_user: ana.id,
      place: "sec:112",
    }),
  ),
  "Bo can't summon as Ana",
);
check(
  refused(
    await rest(stranger, "POST", SUMMONS, {
      occasion_id: occ,
      from_user: stranger.id,
      place: "sec:112",
    }),
  ),
  "a stranger can't summon",
);
check(
  (
    await rest(ana, "POST", SUMMONS, {
      occasion_id: occ,
      from_user: ana.id,
      place: "<script>",
    })
  ).status >= 400,
  "a place id with markup is refused",
);
check(
  (
    await rest(ana, "POST", SUMMONS, {
      occasion_id: occ,
      from_user: ana.id,
      place: "sec:112",
      note: "x".repeat(81),
    })
  ).status >= 400,
  "an 81-character note is refused",
);
const reply = await rest(bo, "POST", REPLIES, {
  summon_id: sid,
  occasion_id: occ,
  user_id: bo.id,
  response: "coming",
});
check(reply.status === 201, "Bo answers On my way");
check(
  refused(
    await rest(bo, "POST", REPLIES, {
      summon_id: sid,
      occasion_id: occ,
      user_id: ana.id,
      response: "busy",
    }),
  ),
  "Bo can't answer as Ana",
);
check(
  (
    await rest(host, "POST", REPLIES, {
      summon_id: sid,
      occasion_id: occ,
      user_id: host.id,
      response: "maybe",
    })
  ).status >= 400,
  "an answer that isn't coming/busy/where is refused",
);
check(
  refused(
    await rest(stranger, "POST", REPLIES, {
      summon_id: sid,
      occasion_id: occ,
      user_id: stranger.id,
      response: "coming",
    }),
  ),
  "a stranger can't answer",
);
check(
  refused(
    await rest(host, "POST", REPLIES, {
      summon_id: sid,
      occasion_id: later,
      user_id: host.id,
      response: "coming",
    }),
  ),
  "an answer can't be filed under another night",
);
const changed = await rest(
  bo,
  "PATCH",
  `${REPLIES}?summon_id=eq.${sid}&user_id=eq.${bo.id}`,
  { response: "busy" },
);
check(rows(changed)[0]?.response === "busy", "Bo changes his answer to Busy");
check(
  refused(
    await rest(
      host,
      "PATCH",
      `${REPLIES}?summon_id=eq.${sid}&user_id=eq.${bo.id}`,
      { response: "coming" },
    ),
  ),
  "the host can't change Bo's answer",
);
check(
  rows(await rest(ana, "GET", `${REPLIES}?select=*`)).length === 1,
  "Ana sees who answered",
);
check(
  rows(await rest(bo, "DELETE", `${SUMMONS}?id=eq.${sid}`)).length === 0,
  "Bo can't cancel Ana's summons",
);
check(
  rows(await rest(ana, "DELETE", `${SUMMONS}?id=eq.${sid}`)).length === 1,
  "Ana cancels hers",
);
check(
  rows(await rest(ana, "GET", `${REPLIES}?select=*`)).length === 0,
  "its answers go with it",
);

console.log("\nSnack runs");
const run = await rest(ana, "POST", RUNS, {
  occasion_id: occ,
  runner: ana.id,
  stand: "300:J:304",
  note: "Back in 10",
});
check(run.status === 201, `Ana announces a run (${run.status})`);
const rid = rows(run)[0]?.id;
check(
  rows(await rest(bo, "GET", `${RUNS}?select=*`)).length === 1,
  "Bo sees it",
);
check(
  rows(await rest(stranger, "GET", `${RUNS}?select=*`)).length === 0,
  "a stranger doesn't",
);
check(
  refused(await rest(bo, "POST", RUNS, { occasion_id: occ, runner: ana.id })),
  "Bo can't announce a run as Ana",
);
check(
  (
    await rest(ana, "POST", RUNS, {
      occasion_id: occ,
      runner: ana.id,
      price_cents: 900,
    })
  ).status >= 400,
  "there is no price column to write",
);
const ask = await rest(bo, "POST", ITEMS, {
  run_id: rid,
  occasion_id: occ,
  user_id: bo.id,
  item: "Two hot dogs",
});
check(ask.status === 201, "Bo asks for two hot dogs");
check(
  refused(
    await rest(bo, "POST", ITEMS, {
      run_id: rid,
      occasion_id: occ,
      user_id: ana.id,
      item: "A beer",
    }),
  ),
  "Bo can't ask in Ana's name",
);
check(
  (
    await rest(host, "POST", ITEMS, {
      run_id: rid,
      occasion_id: occ,
      user_id: host.id,
      item: "",
    })
  ).status >= 400,
  "an empty request is refused",
);
check(
  (
    await rest(host, "POST", ITEMS, {
      run_id: rid,
      occasion_id: occ,
      user_id: host.id,
      item: "x".repeat(61),
    })
  ).status >= 400,
  "a 61-character request is refused",
);
check(
  refused(
    await rest(stranger, "POST", ITEMS, {
      run_id: rid,
      occasion_id: occ,
      user_id: stranger.id,
      item: "Free food",
    }),
  ),
  "a stranger can't ask",
);
check(
  refused(
    await rest(bo, "PATCH", `${RUNS}?id=eq.${rid}`, {
      status: "done",
      runner: bo.id,
    }),
  ),
  "Bo can't close or take over Ana's run",
);
check(
  refused(await rest(bo, "PATCH", `${RUNS}?id=eq.${rid}`, { status: "done" })),
  "Bo can't close Ana's run",
);
const edited = await rest(
  bo,
  "PATCH",
  `${ITEMS}?run_id=eq.${rid}&user_id=eq.${bo.id}`,
  { item: "One hot dog" },
);
check(rows(edited)[0]?.item === "One hot dog", "Bo changes his request");
check(
  refused(
    await rest(host, "PATCH", `${ITEMS}?run_id=eq.${rid}&user_id=eq.${bo.id}`, {
      item: "Nothing",
    }),
  ),
  "the host can't edit Bo's request",
);
check(
  rows(await rest(ana, "GET", `${ITEMS}?select=*`)).length === 1,
  "Ana sees what Bo wants",
);
const closed = await rest(ana, "PATCH", `${RUNS}?id=eq.${rid}`, {
  status: "done",
});
check(rows(closed)[0]?.status === "done", "Ana closes her run");
check(
  refused(
    await rest(host, "POST", ITEMS, {
      run_id: rid,
      occasion_id: occ,
      user_id: host.id,
      item: "Late order",
    }),
  ),
  "nobody can order from a finished run",
);
check(
  refused(
    await rest(bo, "PATCH", `${ITEMS}?run_id=eq.${rid}&user_id=eq.${bo.id}`, {
      item: "Changed my mind",
    }),
  ),
  "…or change an order on one",
);
check(
  refused(await rest(ana, "PATCH", `${RUNS}?id=eq.${rid}`, { status: "open" })),
  "a finished run can't be reopened",
);
check(
  rows(
    await rest(bo, "DELETE", `${ITEMS}?run_id=eq.${rid}&user_id=eq.${bo.id}`),
  ).length === 1,
  "Bo can withdraw his request",
);

console.log("\nExpiry: the night ends and everything goes");
await rest(ana, "POST", GPS, hint(ana));
await rest(ana, "POST", SUMMONS, {
  occasion_id: occ,
  from_user: ana.id,
  place: "sec:112",
});
await rest(ana, "POST", RUNS, { occasion_id: occ, runner: ana.id });
check(
  rows(await rest(bo, "GET", `${GPS}?select=*`)).length === 1,
  "(before the end) Bo sees Ana's hint",
);
await superuser(
  "update passport_occasions set starts_at = now() - interval '6 hours' where id = $1",
  [occ],
);
for (const t of [GPS, SUMMONS, RUNS]) {
  check(
    rows(await rest(bo, "GET", `${t}?select=*`)).length === 0,
    `after the window, ${t.slice(1)} reads nothing`,
  );
}
check(
  refused(await rest(ana, "POST", GPS, { ...hint(ana), zone: "away" })),
  "…and no new hint can be written",
);
const kept = await superuser(
  "select count(*)::int as n from passport_occasion_gps_hints where occasion_id = $1",
  [occ],
);
check(
  kept.rows[0].n === 1,
  "(the row is still in the table until the purge runs)",
);
const purge = await rpc(bo, "passport_crew_purge", {});
check(purge.status < 300, `any member can run the purge (${purge.status})`);
const left = await superuser(
  `select (select count(*) from passport_occasion_gps_hints where occasion_id = $1)
        + (select count(*) from passport_occasion_summons where occasion_id = $1)
        + (select count(*) from passport_occasion_snack_runs where occasion_id = $1)
        + (select count(*) from passport_occasion_snack_items where occasion_id = $1) as n`,
  [occ],
);
check(
  Number(left.rows[0].n) === 0,
  "the purge removed every Crew row from the finished night",
);
check(
  refused(await rpc(null, "passport_crew_purge", {})),
  "a signed-out caller still can't purge",
);

console.log("\nA hint written in the night cannot outlive it");
await superuser(
  "update passport_occasions set starts_at = now() + interval '1 hour' where id = $1",
  [occ],
);
await rest(ana, "POST", GPS, hint(ana));
check(
  rows(await rest(bo, "GET", `${GPS}?select=*`)).length === 1,
  "Bo sees Ana's new hint while the night is on",
);
await superuser(
  "update passport_occasions set starts_at = now() - interval '9 hours' where id = $1",
  [occ],
);
check(
  rows(await rest(bo, "GET", `${GPS}?select=*`)).length === 0,
  "once the night is over Bo can't read it, though the row still exists",
);
await rpc(bo, "passport_crew_purge", {});
const after = await superuser(
  "select count(*)::int as n from passport_occasion_gps_hints where user_id = $1",
  [ana.id],
);
check(after.rows[0].n === 0, "and the next purge removes it");

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
