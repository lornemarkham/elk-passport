#!/usr/bin/env node
/**
 * **Attack Arena Mode the way a hostile member, a stranger or a removed guest
 * would** — straight at PostgREST with real GoTrue sessions, skipping the
 * Passport UI and its server entirely. Whatever this script cannot do,
 * nobody can do. Covers the privacy rules in `arena-migration.sql`: members
 * only, own rows only, the event window, revocation, expiry and the purge.
 *
 * Needs the local stack with the arena migration (stack.mjs start; the
 * default). Re-applies the migration once at the start to prove it is
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

async function rest(who, method, p, body) {
  const res = await fetch(`${URL_}/rest/v1${p}`, {
    method,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${who ? who.token : ANON}`,
      "content-type": "application/json",
      prefer: "return=representation",
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

const CHECKINS = "/passport_occasion_checkins";
const PINGS = "/passport_occasion_pings";
const QUESTS = "/passport_occasion_quests";
const CREW = "/passport_occasion_quest_crew";

console.log("Migration");
await superuser(
  fs.readFileSync(path.join(here, "..", "arena-migration.sql"), "utf8"),
);
const policies = await superuser(
  "select count(*)::int as n from pg_policies where tablename like 'passport_occasion_%' and (tablename in ('passport_occasion_checkins','passport_occasion_pings','passport_occasion_quests','passport_occasion_quest_crew'))",
);
check(
  policies.rows[0].n === 15,
  `applied twice: 15 policies (${policies.rows[0].n})`,
);
const rls = await superuser(
  "select count(*)::int as n from pg_class where relname in ('passport_occasion_checkins','passport_occasion_pings','passport_occasion_quests','passport_occasion_quest_crew') and relrowsecurity",
);
check(rls.rows[0].n === 4, "RLS on for all four tables");

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

const at = (who, place, extra = {}) => ({
  occasion_id: occ,
  user_id: who.id,
  place,
  ...extra,
});

console.log("\nSigned out");
check(
  refused(await rest(null, "GET", `${CHECKINS}?select=*`)),
  "anon reads no check-ins",
);
check(
  refused(await rest(null, "POST", CHECKINS, at(ana, "sec:309"))),
  "anon writes no check-in",
);
check(
  refused(await rpc(null, "passport_arena_purge", {})),
  "anon can't run the purge",
);

console.log("\nChecking in");
const anaIn = await rest(
  ana,
  "POST",
  CHECKINS,
  at(ana, "300:J:304", { status: "In line. Pray for me." }),
);
check(
  anaIn.status === 201,
  `Ana checks in at Hot Dogs by 304 (${anaIn.status})`,
);
const moved = await rest(
  ana,
  "PATCH",
  `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
  { place: "sec:309" },
);
check(rows(moved).length === 1, "Ana moves her check-in to her section");
check(
  refused(
    await rest(
      ana,
      "PATCH",
      `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
      { updated_at: "2020-01-01T00:00:00Z" },
    ),
  ),
  "Ana can't backdate her check-in",
);
const stamped = rows(
  await rest(
    ana,
    "GET",
    `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}&select=updated_at`,
  ),
)[0];
check(
  stamped && Date.now() - new Date(stamped.updated_at).getTime() < 60_000,
  "its time is the database's",
);
check(
  refused(await rest(ana, "POST", CHECKINS, at(bo, "sec:101"))),
  "Ana can't check Bo in",
);
check(
  refused(
    await rest(ana, "POST", CHECKINS, { ...at(ana, "x"), occasion_id: later }),
  ),
  "Ana can't check in next week's night (window shut)",
);
check(
  refused(await rest(ana, "POST", CHECKINS, at(ana, "<script>"))),
  "a place that isn't a place id is refused",
);
check(
  refused(
    await rest(
      ana,
      "POST",
      CHECKINS,
      at(ana, "sec:101", { status: "x".repeat(81) }),
    ),
  ),
  "an 81-character status is refused",
);
const boIn = await rest(bo, "POST", CHECKINS, at(bo, "100:store:114-115"));
check(boIn.status === 201, "Bo checks in at the Team Store");

console.log("\nWho sees whom");
const boSees = rows(
  await rest(
    bo,
    "GET",
    `${CHECKINS}?occasion_id=eq.${occ}&select=user_id,place`,
  ),
);
check(
  boSees.length === 2 && boSees.some((r) => r.user_id === ana.id),
  "Bo sees Ana's check-in and his own",
);
check(
  rows(await rest(host, "GET", `${CHECKINS}?occasion_id=eq.${occ}`)).length ===
    2,
  "the host sees both",
);
check(
  rows(await rest(stranger, "GET", `${CHECKINS}?occasion_id=eq.${occ}`))
    .length === 0,
  "a stranger sees none",
);
check(
  rows(await rest(stranger, "GET", CHECKINS)).length === 0,
  "a stranger sees none anywhere",
);
check(
  refused(await rest(stranger, "POST", CHECKINS, at(stranger, "sec:101"))),
  "a stranger can't check in",
);
const probe = await rpc(stranger, "passport_arena_open", { p_occasion: occ });
check(
  probe.body === false,
  "the window helper tells a stranger nothing (false)",
);
check(
  refused(
    await rest(
      bo,
      "PATCH",
      `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
      { place: "sec:101" },
    ),
  ),
  "Bo can't move Ana",
);
await rest(
  bo,
  "DELETE",
  `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
);
await rest(
  host,
  "DELETE",
  `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
);
check(
  rows(
    await rest(
      ana,
      "GET",
      `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
    ),
  ).length === 1,
  "neither Bo nor the host can vanish Ana",
);

console.log("\nPings");
const where = await rest(ana, "POST", PINGS, {
  occasion_id: occ,
  from_user: ana.id,
  to_user: bo.id,
  kind: "where",
});
check(where.status === 201, "Ana asks Bo where he is");
check(
  rows(await rest(bo, "GET", `${PINGS}?occasion_id=eq.${occ}&kind=eq.where`))
    .length === 1,
  "Bo reads it",
);
check(
  rows(await rest(cy, "GET", `${PINGS}?occasion_id=eq.${occ}&kind=eq.where`))
    .length === 0,
  "Cy can't read a ping between Ana and Bo",
);
check(
  rows(await rest(host, "GET", `${PINGS}?occasion_id=eq.${occ}&kind=eq.where`))
    .length === 0,
  "nor can the host",
);
const herd = await rest(host, "POST", PINGS, {
  occasion_id: occ,
  from_user: host.id,
  kind: "herd",
  place: "gate:10",
});
check(herd.status === 201, "the host rounds up the herd");
check(
  rows(await rest(cy, "GET", `${PINGS}?occasion_id=eq.${occ}&kind=eq.herd`))
    .length === 1,
  "Cy reads the broadcast",
);
check(
  rows(await rest(stranger, "GET", PINGS)).length === 0,
  "a stranger reads no pings",
);
check(
  refused(
    await rest(ana, "POST", PINGS, {
      occasion_id: occ,
      from_user: bo.id,
      kind: "here",
    }),
  ),
  "Ana can't ping as Bo",
);
check(
  refused(
    await rest(ana, "POST", PINGS, {
      occasion_id: occ,
      from_user: ana.id,
      to_user: stranger.id,
      kind: "meet",
    }),
  ),
  "Ana can't ping a stranger",
);
check(
  refused(
    await rest(ana, "POST", PINGS, {
      occasion_id: occ,
      from_user: ana.id,
      kind: "taunt",
    }),
  ),
  "an unknown ping kind is refused",
);
check(
  refused(
    await rest(ana, "PATCH", `${PINGS}?id=eq.${rows(where)[0]?.id}`, {
      note: "edited",
    }),
  ),
  "a ping can't be edited",
);
check(
  refused(
    await rest(stranger, "POST", PINGS, {
      occasion_id: occ,
      from_user: stranger.id,
      kind: "herd",
    }),
  ),
  "a stranger can't ping the night",
);

console.log("\nQuests");
const quest = await rest(bo, "POST", QUESTS, {
  occasion_id: occ,
  kind: "hot-dog-hero",
  started_by: bo.id,
  place: "300:J:304",
});
check(quest.status === 201, "Bo starts Hot Dog Hero");
const qid = rows(quest)[0]?.id;
check(
  refused(
    await rest(ana, "POST", QUESTS, {
      occasion_id: occ,
      kind: "beer-run",
      started_by: bo.id,
    }),
  ),
  "Ana can't start a quest as Bo",
);
check(
  refused(
    await rest(ana, "POST", QUESTS, {
      occasion_id: occ,
      kind: "missing-legend",
      started_by: ana.id,
      subject_user: stranger.id,
    }),
  ),
  "the missing legend must be on the night",
);
check(
  rows(await rest(stranger, "GET", QUESTS)).length === 0,
  "a stranger reads no quests",
);
check(
  (
    await rest(ana, "POST", CREW, {
      quest_id: qid,
      occasion_id: occ,
      user_id: ana.id,
      note: "Two, mustard",
    })
  ).status === 201,
  "Ana joins the crew with her order",
);
check(
  refused(
    await rest(ana, "POST", CREW, {
      quest_id: qid,
      occasion_id: occ,
      user_id: cy.id,
    }),
  ),
  "Ana can't sign Cy up",
);
check(
  refused(
    await rest(ana, "POST", CREW, {
      quest_id: qid,
      occasion_id: later,
      user_id: ana.id,
    }),
  ),
  "Ana can't attach tonight's quest to next week's night",
);
check(
  refused(
    await rest(stranger, "POST", CREW, {
      quest_id: qid,
      occasion_id: occ,
      user_id: stranger.id,
    }),
  ),
  "a stranger can't join",
);
check(
  refused(
    await rest(
      ana,
      "PATCH",
      `${CREW}?quest_id=eq.${qid}&user_id=eq.${ana.id}`,
      { price_cents: 0 },
    ),
  ),
  "a $0.00 price is refused",
);
check(
  refused(
    await rest(
      ana,
      "PATCH",
      `${CREW}?quest_id=eq.${qid}&user_id=eq.${ana.id}`,
      { price_cents: 20000 },
    ),
  ),
  "a $200 price is refused",
);
check(
  rows(
    await rest(
      ana,
      "PATCH",
      `${CREW}?quest_id=eq.${qid}&user_id=eq.${ana.id}`,
      { price_cents: 1000 },
    ),
  ).length === 1,
  "Ana reports a $10.00 price",
);
check(
  refused(
    await rest(cy, "PATCH", `${QUESTS}?id=eq.${qid}`, {
      status: "done",
      closed_by: cy.id,
    }),
  ),
  "Cy (not on it) can't close it",
);
check(
  refused(
    await rest(host, "PATCH", `${QUESTS}?id=eq.${qid}`, {
      status: "dropped",
      closed_by: host.id,
    }),
  ),
  "nor can the host",
);
check(
  refused(
    await rest(ana, "PATCH", `${QUESTS}?id=eq.${qid}`, {
      status: "done",
      closed_by: bo.id,
    }),
  ),
  "Ana can't close it in Bo's name",
);
check(
  refused(
    await rest(ana, "PATCH", `${QUESTS}?id=eq.${qid}`, { kind: "beer-run" }),
  ),
  "a quest's kind can't be changed",
);
check(
  rows(
    await rest(ana, "PATCH", `${QUESTS}?id=eq.${qid}`, {
      status: "done",
      closed_by: ana.id,
      closed_note: "Hero.",
    }),
  ).length === 1,
  "Ana (crew) completes it",
);
check(
  refused(
    await rest(bo, "PATCH", `${QUESTS}?id=eq.${qid}`, {
      status: "open",
      closed_by: bo.id,
    }),
  ),
  "a finished quest can't be reopened",
);
check(
  refused(
    await rest(cy, "POST", CREW, {
      quest_id: qid,
      occasion_id: occ,
      user_id: cy.id,
    }),
  ),
  "nobody joins a finished quest",
);

console.log("\nRemoved from the night");
const boLeft = await rest(
  host,
  "DELETE",
  `/passport_occasion_members?occasion_id=eq.${occ}&user_id=eq.${bo.id}`,
);
check(boLeft.status < 300, "the host removes Bo");
const anaNow = rows(
  await rest(ana, "GET", `${CHECKINS}?occasion_id=eq.${occ}`),
);
check(
  anaNow.length === 1 && anaNow[0].user_id === ana.id,
  "Bo's dot vanishes from Ana's map",
);
check(
  rows(await rest(bo, "GET", `${CHECKINS}?occasion_id=eq.${occ}`)).length === 0,
  "Bo sees nobody",
);
check(rows(await rest(bo, "GET", PINGS)).length === 0, "Bo reads no pings");
check(
  refused(
    await rest(
      bo,
      "PATCH",
      `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${bo.id}`,
      { place: "sec:101" },
    ),
  ),
  "Bo can't move his old check-in",
);
check(
  rows(await rest(cy, "GET", `${CREW}?quest_id=eq.${qid}`)).every(
    (r) => r.user_id !== bo.id,
  ),
  "Bo isn't on any crew Cy can see",
);

console.log("\nVanish");
await rest(cy, "POST", CHECKINS, at(cy, "gate:10"));
const gone = await rest(
  cy,
  "DELETE",
  `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${cy.id}`,
);
check(gone.status < 300 && rows(gone).length === 1, "Cy vanishes");
check(
  rows(
    await rest(
      ana,
      "GET",
      `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${cy.id}`,
    ),
  ).length === 0,
  "and is gone from Ana's map at once",
);

console.log("\nAfter the night");
const before = (
  await superuser(
    "select (select count(*) from passport_occasion_checkins where occasion_id=$1)::int as c, (select count(*) from passport_occasion_pings where occasion_id=$1)::int as p, (select count(*) from passport_occasion_quests where occasion_id=$1)::int as q",
    [occ],
  )
).rows[0];
check(
  before.c > 0 && before.p > 0 && before.q > 0,
  `rows exist before the window shuts (${JSON.stringify(before)})`,
);
const ended = await rest(host, "PATCH", `/passport_occasions?id=eq.${occ}`, {
  starts_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
});
check(
  rows(ended).length === 1,
  "the night moves to six hours ago (window shut)",
);
check(
  rows(await rest(ana, "GET", `${CHECKINS}?occasion_id=eq.${occ}`)).length ===
    0,
  "Ana reads no check-ins",
);
check(
  rows(await rest(ana, "GET", `${PINGS}?occasion_id=eq.${occ}`)).length === 0,
  "Ana reads no pings",
);
check(
  rows(await rest(ana, "GET", `${QUESTS}?occasion_id=eq.${occ}`)).length === 0,
  "Ana reads no quests",
);
check(
  refused(
    await rest(
      ana,
      "PATCH",
      `${CHECKINS}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
      { place: "sec:101" },
    ),
  ),
  "Ana can't check in after the night",
);
check(
  refused(
    await rest(ana, "POST", PINGS, {
      occasion_id: occ,
      from_user: ana.id,
      kind: "herd",
    }),
  ),
  "nor ping",
);
const purged = await rpc(ana, "passport_arena_purge", {});
check(
  purged.status === 200 && purged.body >= 3,
  `any member can run the purge (${purged.body} rows)`,
);
const after = (
  await superuser(
    "select (select count(*) from passport_occasion_checkins where occasion_id=$1)::int as c, (select count(*) from passport_occasion_pings where occasion_id=$1)::int as p, (select count(*) from passport_occasion_quests where occasion_id=$1)::int as q, (select count(*) from passport_occasion_quest_crew where occasion_id=$1)::int as k",
    [occ],
  )
).rows[0];
check(
  after.c === 0 && after.p === 0 && after.q === 0 && after.k === 0,
  `and the rows are actually gone (${JSON.stringify(after)})`,
);
await rest(host, "PATCH", `/passport_occasions?id=eq.${occ}`, {
  starts_at: soon.toISOString(),
});
check(
  rows(await rest(ana, "GET", `${CHECKINS}?occasion_id=eq.${occ}`)).length ===
    0,
  "moving the night back brings nothing back",
);

console.log("\nA moved night");
const anaAgain = await rest(ana, "POST", CHECKINS, at(ana, "sec:309"));
check(anaAgain.status === 201, "Ana checks in again tonight");
await rest(host, "PATCH", `/passport_occasions?id=eq.${occ}`, {
  starts_at: nextWeek.toISOString(),
});
check(
  rows(await rest(ana, "GET", `${CHECKINS}?occasion_id=eq.${occ}`)).length ===
    0,
  "the night moves to next week: tonight's check-in is hidden",
);
await rpc(ana, "passport_arena_purge", {});
const leftover = (
  await superuser(
    "select count(*)::int as n from passport_occasion_checkins where occasion_id=$1",
    [occ],
  )
).rows[0].n;
check(
  leftover === 0,
  "and the purge deletes a check-in written outside the night's current window",
);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
