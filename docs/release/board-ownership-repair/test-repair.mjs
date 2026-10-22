#!/usr/bin/env node
/**
 * **Proves the board ownership repair on a scratch Postgres, never production.**
 *
 * Builds a throwaway database that looks like production should today:
 * Supabase's roles, `auth.uid()` read from the request JWT claims, no default
 * grants, and every Passport migration applied EXCEPT the board fix. Seeds
 * real-shaped boards (an owner with members and invites, a never-shared board,
 * and rows a past attacker could have written). Then:
 *
 *   1. runs the readiness diagnostic and 01-preflight (expects the holes);
 *   2. runs every probe below as `authenticated`/`anon` with RLS on;
 *   3. applies the repair (boards-owner-claim-fix.sql) three times;
 *   4. re-runs every probe: each must give its "after" outcome;
 *   5. checks no row changed, 03-verify and the diagnostic show 0 FAIL;
 *   6. proves the repair aborts cleanly behind a lock and on a failed
 *      self-check; proves rollback.sql restores the baseline exactly and the
 *      repair can be re-applied; proves the optional invite containment.
 *
 *   node docs/release/board-ownership-repair/test-repair.mjs
 *
 * Needs embedded-postgres binaries (PG_BIN; default: the adventures stack's
 * copy) and the `postgres` client already in node_modules and uses SCRATCH (default ~/passport/scratch/board-repair) and port
 * PG_PORT (default 55729). Wipes and recreates only SCRATCH/pgdata. Stops its
 * Postgres when done (KEEP=1 leaves it running).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const HOME = os.homedir();
const PG_BIN =
  process.env.PG_BIN ??
  path.join(
    HOME,
    "passport/scratch/adventures-stack/node_modules/@embedded-postgres/linux-x64/native/bin",
  );
const SCRATCH =
  process.env.SCRATCH ?? path.join(HOME, "passport/scratch/board-repair");
const PORT = Number(process.env.PG_PORT ?? 55729);
const DATA = path.join(SCRATCH, "pgdata");

const FILES = {
  fix: "docs/product/group-adventures/boards-owner-claim-fix.sql",
  audit: "docs/product/group-adventures/boards-ownership-audit.sql",
  preflight: "docs/release/board-ownership-repair/01-preflight.sql",
  verify: "docs/release/board-ownership-repair/03-verify.sql",
  rollback: "docs/release/board-ownership-repair/rollback.sql",
  contain:
    "docs/release/board-ownership-repair/optional-revoke-forged-invites.sql",
  readiness: "docs/release/PRODUCTION-DATABASE-READINESS.md",
};
// Everything production is said to have (readiness report: Hockey,
// Conference, Arrivals and Adventures PASS), in the documented order.
const MIGRATIONS = [
  "supabase/migrations/20260927000000_passport_baseline.sql",
  "supabase/migrations/20261012000000_passport_conferences.sql",
  "supabase/migrations/20261014000000_passport_conference_arrivals.sql",
  "supabase/migrations/20261016000000_passport_conference_grants.sql",
  "supabase/migrations/20261021000000_passport_adventures.sql",
  "docs/product/hockey/migration.sql",
];

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8");

/** Supabase's roles and auth.uid(), with production's no-default-grants posture. */
const BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const U = {
  olive: "00000000-0000-4000-8000-00000000000a", // owns b-olive (shared)
  ed: "00000000-0000-4000-8000-00000000000b", // editor on b-olive
  vi: "00000000-0000-4000-8000-00000000000c", // viewer on b-olive
  pat: "00000000-0000-4000-8000-00000000000d", // owns b-pat (never shared)
  mallory: "00000000-0000-4000-8000-00000000000e", // attacker
  acc: "00000000-0000-4000-8000-00000000000f", // attacker's accomplice
  nia: "00000000-0000-4000-8000-000000000010", // invited newcomer
  zed: "00000000-0000-4000-8000-000000000011", // victim of a past takeover
  sam: "00000000-0000-4000-8000-000000000012", // follows the forged link
};

// Production-shaped rows. b-zed and b-mallory hold what an attacker could have
// written through the holes before the repair: the audit must flag them and
// the repair must leave them exactly as they are.
const SEED = `
insert into auth.users (id, email) values
  ${Object.entries(U)
    .map(([n, id]) => `('${id}', '${n}@example.test')`)
    .join(",\n  ")};
insert into public.passport_board_members (board_id, board_owner_id, user_id, role, added_at) values
  ('b-olive', '${U.olive}', '${U.olive}', 'owner',  '2026-10-01T10:00:00Z'),
  ('b-olive', '${U.olive}', '${U.ed}',    'editor', '2026-10-01T11:00:00Z'),
  ('b-olive', '${U.olive}', '${U.vi}',    'viewer', '2026-10-01T12:00:00Z'),
  ('b-zed',   '${U.zed}',   '${U.zed}',   'owner',  '2026-10-02T10:00:00Z'),
  ('b-zed',   '${U.zed}',   '${U.mallory}', 'owner', '2026-10-05T10:00:00Z'),
  ('b-mallory', '${U.mallory}', '${U.mallory}', 'owner', '2026-10-05T11:00:00Z'),
  ('b-mallory', '${U.zed}',     '${U.acc}',     'editor', '2026-10-05T12:00:00Z');
insert into public.passport_board_invites (token, board_id, board_owner_id, role, created_by, created_at, expires_at, revoked_at) values
  ('tok-live',    'b-olive', '${U.olive}', 'editor', '${U.olive}', '2026-10-03T10:00:00Z', null, null),
  ('tok-revoked', 'b-olive', '${U.olive}', 'viewer', '${U.olive}', '2026-10-03T11:00:00Z', null, '2026-10-04T10:00:00Z'),
  ('tok-expired', 'b-olive', '${U.olive}', 'viewer', '${U.olive}', '2026-10-03T12:00:00Z', '2026-10-04T00:00:00Z', null),
  ('tok-forged',  'b-mallory', '${U.zed}', 'editor', '${U.mallory}', '2026-10-05T13:00:00Z', null, null);
`;
const AUDIT_EXPECTED = {
  "audit: owner rows naming someone else": "1",
  "audit: member rows whose board_owner_id is not that board's owner": "1",
  "audit: invites naming someone else": "1",
  "audit: LIVE invites naming someone else": "1",
  "audit: boards with more than one owner row": "1",
};

const insertOwner = (board, user, owner = user) =>
  `insert into passport_board_members (board_id, board_owner_id, user_id, role) values ('${board}', '${owner}', '${user}', 'owner')`;
const insertMember = (board, user, owner, role = "editor") =>
  `insert into passport_board_members (board_id, board_owner_id, user_id, role) values ('${board}', '${owner}', '${user}', '${role}')`;
const insertInvite = (board, owner, by, token = "tok-new") =>
  `insert into passport_board_invites (token, board_id, board_owner_id, role, created_by) values ('${token}', '${board}', '${owner}', 'editor', '${by}')`;

/**
 * Each probe runs in its own transaction as one person, then rolls back, so
 * probes never see each other. `ok` decides "allowed" from the last result.
 * `before` / `after` are the required outcomes on the unrepaired and repaired
 * database.
 */
const PROBES = [
  // ---- existing owners and members keep their access
  {
    name: "owner reads her board's members",
    as: "olive",
    sql: [
      "select count(*)::int as n from passport_board_members where board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0].n === 3,
    before: "allow",
    after: "allow",
  },
  {
    name: "editor reads the board's members",
    as: "ed",
    sql: [
      "select count(*)::int as n from passport_board_members where board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0].n === 3,
    before: "allow",
    after: "allow",
  },
  {
    name: "viewer reads the board's invites",
    as: "vi",
    sql: [
      "select count(*)::int as n from passport_board_invites where board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0].n === 3,
    before: "allow",
    after: "allow",
  },
  {
    name: "member's own membership row (what accessToBoard reads)",
    as: "ed",
    sql: [
      "select board_owner_id from passport_board_members where user_id = auth.uid() and board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0]?.board_owner_id === U.olive,
    before: "allow",
    after: "allow",
  },
  // ---- sharing keeps working
  {
    name: "owner creates an invite",
    as: "olive",
    sql: [insertInvite("b-olive", U.olive, U.olive)],
    before: "allow",
    after: "allow",
  },
  {
    name: "owner revokes an invite",
    as: "olive",
    sql: [
      "update passport_board_invites set revoked_at = now() where board_id = 'b-olive' and token = 'tok-live'",
    ],
    before: "allow",
    after: "allow",
  },
  {
    name: "owner changes a member's role",
    as: "olive",
    sql: [
      "update passport_board_members set role = 'viewer' where board_id = 'b-olive' and user_id = '" +
        U.ed +
        "'",
    ],
    before: "allow",
    after: "allow",
  },
  {
    name: "owner removes a member",
    as: "olive",
    sql: [
      "delete from passport_board_members where board_id = 'b-olive' and user_id = '" +
        U.vi +
        "'",
    ],
    before: "allow",
    after: "allow",
  },
  {
    name: "owner adds a member row naming herself as owner",
    as: "olive",
    sql: [insertMember("b-olive", U.nia, U.olive)],
    before: "allow",
    after: "allow",
  },
  {
    name: "owner's existing row re-upserted (pre-5f91b5c ensureOwnerMembership)",
    as: "olive",
    sql: [
      insertOwner("b-olive", U.olive) +
        " on conflict (board_id, user_id) do update set role = excluded.role",
    ],
    before: "allow",
    after: "allow",
  },
  {
    name: "newcomer redeems a live invite and sees the board",
    as: "nia",
    sql: [
      "select passport_redeem_board_invite('tok-live') as b",
      "select count(*)::int as n from passport_board_members where board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0].n === 4,
    before: "allow",
    after: "allow",
  },
  {
    name: "redeeming the same invite twice is harmless",
    as: "nia",
    sql: [
      "select passport_redeem_board_invite('tok-live')",
      "select passport_redeem_board_invite('tok-live') as b",
    ],
    ok: (r) => r.rows[0].b === "b-olive",
    before: "allow",
    after: "allow",
  },
  {
    name: "redeemed membership names the real owner",
    as: "nia",
    sql: [
      "select passport_redeem_board_invite('tok-live')",
      "select board_owner_id from passport_board_members where user_id = auth.uid() and board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0]?.board_owner_id === U.olive,
    before: "allow",
    after: "allow",
  },
  {
    name: "revoked invite does not redeem",
    as: "nia",
    sql: ["select passport_redeem_board_invite('tok-revoked') as b"],
    ok: (r) => r.rows[0].b !== null,
    before: "deny",
    after: "deny",
  },
  {
    name: "expired invite does not redeem",
    as: "nia",
    sql: ["select passport_redeem_board_invite('tok-expired') as b"],
    ok: (r) => r.rows[0].b !== null,
    before: "deny",
    after: "deny",
  },
  {
    name: "signed-out visitor reads what a link offers",
    as: "anon",
    sql: ["select valid from passport_describe_board_invite('tok-live')"],
    ok: (r) => r.rows[0]?.valid === true,
    before: "allow",
    after: "allow",
  },
  {
    name: "first share of a never-shared board (writeOwnerRow, plain insert)",
    as: "pat",
    sql: [insertOwner("b-pat", U.pat)],
    before: "allow",
    after: "allow",
  },
  {
    name: "first share then first invite",
    as: "pat",
    sql: [insertOwner("b-pat", U.pat), insertInvite("b-pat", U.pat, U.pat)],
    before: "allow",
    after: "allow",
  },
  {
    name: "first share via upsert stays refused (known app bug, fixed in 5f91b5c)",
    as: "pat",
    sql: [
      insertOwner("b-pat", U.pat) +
        " on conflict (board_id, user_id) do update set role = excluded.role",
    ],
    before: "deny",
    after: "deny",
  },
  {
    name: "editor records board activity (passport_events)",
    as: "ed",
    sql: [
      "insert into passport_events (resource_type, resource_id, actor_id, kind, payload) values ('board', 'b-olive', auth.uid(), 'note', '{}')",
    ],
    before: "allow",
    after: "allow",
  },
  {
    name: "editor leaving by deleting own row (refused in both: no self-leave policy exists)",
    as: "ed",
    sql: [
      "delete from passport_board_members where board_id = 'b-olive' and user_id = auth.uid() and role <> 'owner'",
    ],
    before: "deny",
    after: "deny",
  },

  // ---- hole 1: claiming a shared board
  {
    name: "HOLE 1: stranger claims a shared board as owner",
    as: "mallory",
    sql: [insertOwner("b-olive", U.mallory)],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 1 then reads its members",
    as: "mallory",
    sql: [
      insertOwner("b-olive", U.mallory),
      "select count(*)::int as n from passport_board_members where board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0].n > 0,
    before: "allow",
    after: "deny",
  },
  {
    name: "stranger upsert-claims a shared board",
    as: "mallory",
    sql: [
      insertOwner("b-olive", U.mallory) +
        " on conflict (board_id, user_id) do update set role = 'owner'",
    ],
    before: "deny",
    after: "deny",
  },
  {
    name: "stranger claims an empty board naming its real owner",
    as: "mallory",
    sql: [insertOwner("b-pat", U.mallory, U.pat)],
    before: "deny",
    after: "deny",
  },
  {
    name: "real owner shares a board a stranger pre-claimed",
    as: "pat",
    setup: { as: "mallory", sql: [insertOwner("b-pat", U.mallory)] },
    sql: [insertOwner("b-pat", U.pat)],
    before: "allow",
    after: "deny",
  },
  {
    name: "RESIDUAL: stranger pre-claims an empty board in their own name",
    as: "mallory",
    sql: [insertOwner("b-pat", U.mallory)],
    before: "allow",
    after: "allow",
  },
  {
    name: "stranger reads a shared board's members",
    as: "mallory",
    sql: [
      "select count(*)::int as n from passport_board_members where board_id = 'b-olive'",
    ],
    ok: (r) => r.rows[0].n > 0,
    before: "deny",
    after: "deny",
  },

  // ---- hole 2: naming somebody else as owner
  {
    name: "HOLE 2: pre-claimer repoints own row at the real owner",
    as: "mallory",
    sql: [
      insertOwner("b-pat", U.mallory),
      `update passport_board_members set board_owner_id = '${U.pat}' where board_id = 'b-pat' and user_id = auth.uid()`,
    ],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: pre-claimer adds an accomplice row naming the real owner",
    as: "mallory",
    sql: [insertOwner("b-pat", U.mallory), insertMember("b-pat", U.acc, U.pat)],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: pre-claimer mints an invite naming the real owner",
    as: "mallory",
    sql: [
      insertOwner("b-pat", U.mallory),
      insertInvite("b-pat", U.pat, U.mallory),
    ],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: pre-claimer mints an invite naming the real owner as creator too",
    as: "mallory",
    sql: [insertOwner("b-pat", U.mallory), insertInvite("b-pat", U.pat, U.pat)],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: owner repoints her own row at someone else",
    as: "olive",
    sql: [
      `update passport_board_members set board_owner_id = '${U.pat}' where board_id = 'b-olive' and user_id = auth.uid()`,
    ],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: owner repoints a member's row at someone else",
    as: "olive",
    sql: [
      `update passport_board_members set board_owner_id = '${U.pat}' where board_id = 'b-olive' and user_id = '${U.ed}'`,
    ],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: owner mints an invite naming someone else",
    as: "olive",
    sql: [insertInvite("b-olive", U.pat, U.olive)],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: owner mints an invite in someone else's name",
    as: "olive",
    sql: [insertInvite("b-olive", U.olive, U.ed)],
    before: "allow",
    after: "deny",
  },
  {
    name: "HOLE 2: owner rewrites an existing invite to name someone else",
    as: "olive",
    sql: [
      `update passport_board_invites set board_owner_id = '${U.pat}' where token = 'tok-live'`,
    ],
    before: "allow",
    after: "deny",
  },
  {
    name: "pre-claimer mints an invite naming only themself (harmless)",
    as: "mallory",
    sql: [
      insertOwner("b-pat", U.mallory),
      insertInvite("b-pat", U.mallory, U.mallory),
    ],
    before: "allow",
    after: "allow",
  },
  {
    name: "pre-claimer moves own row onto a shared board",
    as: "mallory",
    sql: [
      insertOwner("b-pat", U.mallory),
      "update passport_board_members set board_id = 'b-olive' where board_id = 'b-pat' and user_id = auth.uid()",
    ],
    before: "deny",
    after: "deny",
  },

  // ---- members cannot forge ownership through invitations or rows
  {
    name: "editor mints an invite naming the owner",
    as: "ed",
    sql: [insertInvite("b-olive", U.olive, U.olive)],
    before: "deny",
    after: "deny",
  },
  {
    name: "editor mints an invite naming themself",
    as: "ed",
    sql: [insertInvite("b-olive", U.ed, U.ed)],
    before: "deny",
    after: "deny",
  },
  {
    name: "editor revives a revoked invite",
    as: "ed",
    sql: [
      "update passport_board_invites set revoked_at = null where token = 'tok-revoked'",
    ],
    before: "deny",
    after: "deny",
  },
  {
    name: "editor promotes themself to owner",
    as: "ed",
    sql: [
      "update passport_board_members set role = 'owner' where board_id = 'b-olive' and user_id = auth.uid()",
    ],
    before: "deny",
    after: "deny",
  },
  {
    name: "editor adds a member row",
    as: "ed",
    sql: [insertMember("b-olive", U.acc, U.olive)],
    before: "deny",
    after: "deny",
  },
  {
    name: "editor self-claims the board they are on",
    as: "ed",
    sql: [
      insertOwner("b-olive", U.ed) +
        " on conflict (board_id, user_id) do update set role = 'owner', board_owner_id = excluded.board_owner_id",
    ],
    before: "deny",
    after: "deny",
  },
  {
    name: "viewer redeems an editor invite to upgrade (no-op by design)",
    as: "vi",
    sql: [
      "select passport_redeem_board_invite('tok-live')",
      "select role from passport_board_members where board_id = 'b-olive' and user_id = auth.uid()",
    ],
    ok: (r) => r.rows[0]?.role !== "viewer",
    before: "deny",
    after: "deny",
  },

  // ---- anon
  {
    name: "anon reads board members",
    as: "anon",
    sql: ["select count(*) from passport_board_members"],
    before: "deny",
    after: "deny",
  },
  {
    name: "anon inserts an owner row",
    as: "anon",
    sql: [insertOwner("b-pat", U.mallory)],
    before: "deny",
    after: "deny",
  },
  {
    name: "anon reads invites",
    as: "anon",
    sql: ["select count(*) from passport_board_invites"],
    before: "deny",
    after: "deny",
  },
  {
    name: "anon calls passport_board_has_members",
    as: "anon",
    sql: ["select passport_board_has_members('b-olive')"],
    before: "deny",
    after: "deny",
  },
  {
    name: "signed-in user calls passport_board_has_members",
    as: "mallory",
    sql: ["select passport_board_has_members('b-olive') as h"],
    ok: (r) => r.rows[0].h === true,
    before: "deny",
    after: "allow",
  },

  // ---- what the repair does NOT undo (README §E)
  {
    name: "RESIDUAL: an invite forged BEFORE the repair still redeems",
    as: "sam",
    sql: [
      "select passport_redeem_board_invite('tok-forged') as b",
      "select board_owner_id from passport_board_members where user_id = auth.uid() and board_id = 'b-mallory'",
    ],
    ok: (r) => r.rows[0]?.board_owner_id === U.zed,
    before: "allow",
    after: "allow",
  },
];

// ---------------------------------------------------------------- plumbing

let failures = 0;
const log = (...a) => console.log(...a);
function check(cond, label, extra = "") {
  if (cond) log(`  ok    ${label}`);
  else {
    failures++;
    log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ""}`);
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.on("connect", () => (s.destroy(), resolve(false)));
    s.on("error", () => resolve(true));
  });
}

/** One dedicated session (max: 1), so BEGIN / SET LOCAL hold across calls. */
function client(database = "postgres") {
  const sql = postgres({
    host: "127.0.0.1",
    port: PORT,
    user: "postgres",
    database,
    max: 1,
    onnotice: () => {},
  });
  return {
    connect: async () => {},
    end: () => sql.end(),
    async query(text, params) {
      const r = params
        ? await sql.unsafe(text, params)
        : await sql.unsafe(text);
      return { rows: r, rowCount: r.count, command: r.command };
    },
  };
}

async function claimsAs(db, who) {
  if (who === "anon") {
    await db.query("set local role anon");
    await db.query(
      `select set_config('request.jwt.claims', '{"role":"anon"}', true)`,
    );
  } else {
    await db.query("set local role authenticated");
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: U[who], role: "authenticated" }),
    ]);
  }
}

/** allow | deny, plus why. Rolls back whatever the probe did. */
async function runProbe(db, p) {
  await db.query("begin");
  try {
    if (p.setup) {
      await claimsAs(db, p.setup.as);
      for (const s of p.setup.sql) await db.query(s);
      await db.query("reset role");
    }
    await claimsAs(db, p.as);
    let r;
    for (const s of p.sql) r = await db.query(s);
    const allowed = p.ok ? p.ok(r) : r.command === "SELECT" || r.rowCount > 0;
    return {
      outcome: allowed ? "allow" : "deny",
      why: allowed ? r.command : `${r.command} ${r.rowCount} rows`,
    };
  } catch (e) {
    return { outcome: "deny", why: `${e.code} ${e.message}` };
  } finally {
    await db.query("rollback");
  }
}

async function runProbes(db, phase) {
  log(`\n== probes, ${phase} the repair (${PROBES.length})`);
  for (const p of PROBES) {
    const got = await runProbe(db, p);
    const want = p[phase];
    check(
      got.outcome === want,
      `${want.padEnd(5)} ${p.name}`,
      `got ${got.outcome}: ${got.why}`,
    );
  }
}

async function snapshot(db) {
  const { rows } = await db.query(`
    select (select md5(coalesce(string_agg(m::text, '|' order by m.board_id, m.user_id), '')) from passport_board_members m) as members,
           (select md5(coalesce(string_agg(i::text, '|' order by i.token), '')) from passport_board_invites i) as invites,
           (select count(*) from passport_board_members) as nm,
           (select count(*) from passport_board_invites) as ni`);
  return rows[0];
}

async function policyState(db) {
  const { rows } = await db.query(`
    select policyname, cmd, coalesce(qual, '') || ' | ' || coalesce(with_check, '') as def
    from pg_policies where tablename in ('passport_board_members', 'passport_board_invites') order by 1`);
  return JSON.stringify(rows);
}

function diagnosticSql() {
  const doc = read(FILES.readiness);
  const start = doc.indexOf("```sql\n");
  const end = doc.indexOf("\n```", start + 7);
  return doc.slice(start + 7, end);
}

async function runDiagnostic(db, label) {
  const { rows } = await db.query(diagnosticSql());
  const overall = rows.find((r) => r.status === "OVERALL").detail;
  log(`\n== readiness diagnostic, ${label}: ${overall}`);
  for (const r of rows.filter(
    (r) => r.status === "FAIL" || r.status === "REVIEW",
  ))
    log(
      `  ${r.status.padEnd(6)} ${r.group} · ${r.check} — ${String(r.detail).slice(0, 160)}`,
    );
  return rows;
}

async function runReport(db, file, label) {
  const { rows } = await db.query(read(file));
  log(`\n== ${label}`);
  for (const r of rows)
    log(
      `  ${r.status.padEnd(9)} ${r.check} — ${String(r.detail).slice(0, 150)}`,
    );
  return rows;
}

// ---------------------------------------------------------------- main

async function main() {
  if (!fs.existsSync(path.join(PG_BIN, "postgres")))
    throw new Error(`no postgres in ${PG_BIN} (set PG_BIN)`);
  if (!(await portFree(PORT)))
    throw new Error(`port ${PORT} is in use (set PG_PORT)`);
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(SCRATCH, { recursive: true });
  execFileSync(
    path.join(PG_BIN, "initdb"),
    ["-D", DATA, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"],
    { stdio: "ignore" },
  );
  execFileSync(
    path.join(PG_BIN, "pg_ctl"),
    [
      "-D",
      DATA,
      "-l",
      path.join(SCRATCH, "postgres.log"),
      "-w",
      "-o",
      `-p ${PORT} -k ${SCRATCH} -c listen_addresses=127.0.0.1`,
      "start",
    ],
    { stdio: "ignore" },
  );

  const db = client();
  await db.connect();
  try {
    const { rows: v } = await db.query("select version()");
    log(`scratch database: ${v[0].version.split(",")[0]} on 127.0.0.1:${PORT}`);
    await db.query(BOOTSTRAP);
    for (const m of MIGRATIONS) await db.query(read(m));
    log(
      `applied ${MIGRATIONS.length} migrations (no board fix), production grant posture`,
    );
    await db.query(SEED);

    // ---------------------------------------------------------- before
    const diagBefore = await runDiagnostic(
      db,
      "BEFORE the repair (production today)",
    );
    const boardFails = diagBefore.filter((r) => r.status === "FAIL");
    check(
      boardFails.length > 0 &&
        boardFails.every((r) => r.group === "board ownership fix"),
      "every FAIL is in the board ownership group",
    );
    const pre = await runReport(
      db,
      FILES.preflight,
      "01-preflight.sql, before",
    );
    check(!pre.some((r) => r.status === "STOP"), "preflight: no STOP");
    for (const [name, n] of Object.entries(AUDIT_EXPECTED))
      check(
        pre.find((r) => r.check === name)?.detail.startsWith(n),
        `preflight finds the seeded forgery: ${name}`,
      );
    const { rows: auditRows } = await db.query(read(FILES.audit));
    const found = auditRows
      .map((r) => `${r.finding}:${r.board_id ?? ""}`)
      .sort()
      .join(" ");
    check(
      found ===
        "board_with_several_owners:b-zed invite_names_someone_else:b-mallory member_row_names_non_owner:b-mallory owner_row_names_someone_else:b-zed summary:",
      "boards-ownership-audit.sql lists exactly the seeded forgeries",
      found,
    );
    await runProbes(db, "before");

    const snap0 = await snapshot(db);
    const preDigest = pre.find((r) =>
      r.check.startsWith("preserve: content digest"),
    ).detail;
    check(
      preDigest === `${snap0.members} / ${snap0.invites}`,
      "preflight digest matches an independent digest",
    );

    // ---------------------------------------------------------- repair
    log("\n== apply the repair three times");
    for (let i = 1; i <= 3; i++) {
      await db.query(read(FILES.fix));
      log(`  applied ${FILES.fix} (#${i})`);
    }
    const snap1 = await snapshot(db);
    check(
      JSON.stringify(snap1) === JSON.stringify(snap0),
      "no board member or invite row changed",
      `${JSON.stringify(snap0)} -> ${JSON.stringify(snap1)}`,
    );

    await runProbes(db, "after");

    const ver = await runReport(db, FILES.verify, "03-verify.sql, after");
    check(
      ver[0].detail.startsWith("REPAIRED: 0 FAIL"),
      "verify: 0 FAIL",
      ver[0].detail,
    );
    check(
      ver
        .filter((r) => r.status === "REVIEW")
        .every((r) => r.check.startsWith("audit:")),
      "verify: the only REVIEWs are the seeded audit findings",
    );
    check(
      ver
        .find((r) => r.check.startsWith("preserve: content digest"))
        .detail.startsWith(preDigest),
      "verify digest equals preflight digest",
    );
    const pre2 = await runReport(
      db,
      FILES.preflight,
      "01-preflight.sql, after (re-run is safe)",
    );
    check(
      [
        "function passport_board_has_members(text)",
        "policy passport_board_members_self_claim",
        "policy passport_board_members_owner_writes",
        "policy passport_board_invites_owner_writes",
      ].every((c) => pre2.find((r) => r.check === c)?.status === "FIXED"),
      "preflight recognises an already-repaired database (FIXED)",
    );

    const diagAfter = await runDiagnostic(db, "AFTER the repair");
    check(!diagAfter.some((r) => r.status === "FAIL"), "diagnostic: 0 FAIL");
    check(
      !diagAfter.some(
        (r) =>
          r.group === "board ownership fix" &&
          r.status !== "PASS" &&
          !r.check.startsWith("audit:"),
      ),
      "diagnostic: board ownership group all PASS apart from the seeded audit counts",
    );

    // ---------------------------------------------------------- atomicity
    log("\n== the repair aborts cleanly");
    // Back to exactly today's production state: baseline policies, no function.
    await db.query(read(FILES.rollback));
    await db.query("drop function public.passport_board_has_members(text)");
    const vulnerable = await policyState(db);
    const blocker = client();
    await blocker.connect();
    await blocker.query(
      "begin; lock table passport_board_invites in access share mode",
    );
    const t0 = Date.now();
    const err = await db.query(read(FILES.fix)).then(
      () => null,
      (e) => e,
    );
    await db.query("rollback").catch(() => {});
    await blocker.query("rollback");
    await blocker.end();
    check(
      err?.code === "55P03",
      `behind a held lock: lock_timeout after ${((Date.now() - t0) / 1000).toFixed(1)} s`,
      err ? `${err.code} ${err.message}` : "it did not abort",
    );
    check(
      (await policyState(db)) === vulnerable &&
        !(
          await db.query(
            "select to_regprocedure('public.passport_board_has_members(text)') as f",
          )
        ).rows[0].f,
      "  ...and nothing changed (policies as before, function not created)",
    );

    const broken = read(FILES.fix).replace(
      "AND created_by = auth.uid());",
      ");",
    );
    const err2 = await db.query(broken).then(
      () => null,
      (e) => e,
    );
    await db.query("rollback").catch(() => {});
    check(
      /self-check failed: invites_owner_writes/.test(err2?.message ?? ""),
      "a bad edit fails the self-check",
      err2?.message ?? "no error",
    );
    check((await policyState(db)) === vulnerable, "  ...and nothing changed");

    // ---------------------------------------------------------- rollback
    log("\n== rollback restores the baseline exactly");
    const baselineDb = await (async () => {
      // The policy definitions the baseline file itself produces, for comparison.
      const { rows } = await db.query(
        `select string_agg(md5(regexp_replace(coalesce(qual, '') || '|' || coalesce(with_check, '') || '|' || roles::text || '|' || permissive, '\\s+', ' ', 'g')), ',' order by policyname) as fp from pg_policies where tablename in ('passport_board_members', 'passport_board_invites')`,
      );
      return rows[0].fp;
    })();
    const fresh = client();
    await fresh.connect();
    await fresh.query("create database rollback_ref");
    await fresh.end();
    const ref = client("rollback_ref");
    await ref.connect();
    await ref.query(
      BOOTSTRAP.replace(
        /create role[^;]*;\n|grant anon, authenticated, service_role to authenticator;\n/g,
        "",
      ),
    );
    await ref.query(read(MIGRATIONS[0]));
    const { rows: refRows } = await ref.query(
      `select string_agg(md5(regexp_replace(coalesce(qual, '') || '|' || coalesce(with_check, '') || '|' || roles::text || '|' || permissive, '\\s+', ' ', 'g')), ',' order by policyname) as fp from pg_policies where tablename in ('passport_board_members', 'passport_board_invites')`,
    );
    await ref.end();
    check(
      baselineDb === refRows[0].fp,
      "after rollback.sql the five board policies equal a fresh baseline's",
    );
    check(
      JSON.stringify(await snapshot(db)) === JSON.stringify(snap0),
      "rollback changed no row",
    );
    await db.query(read(FILES.rollback));
    log("  rollback applied twice (idempotent)");
    await db.query(read(FILES.fix));
    check(
      (await db.query(read(FILES.verify))).rows[0].detail.startsWith(
        "REPAIRED: 0 FAIL",
      ),
      "re-applying the repair after a rollback: 0 FAIL",
    );

    // ---------------------------------------------------------- containment
    log("\n== optional containment of forged invites");
    const live = async () =>
      (
        await db.query(
          "select token from passport_board_invites where revoked_at is null and (expires_at is null or expires_at >= now()) order by token",
        )
      ).rows
        .map((x) => x.token)
        .join(",");
    const liveBefore = await live();
    await db.query(read(FILES.contain));
    const liveAfter = await live();
    check(
      liveBefore === "tok-forged,tok-live" && liveAfter === "tok-live",
      `revokes exactly the forged live invite (live: ${liveBefore} -> ${liveAfter})`,
    );
    const after = await snapshot(db);
    check(
      after.nm === snap0.nm &&
        after.ni === snap0.ni &&
        after.members === snap0.members,
      "containment deletes nothing and touches no member row",
    );
    const forged = PROBES.find((p) =>
      p.name.startsWith("RESIDUAL: an invite forged"),
    );
    check(
      (await runProbe(db, forged)).outcome === "deny",
      "the forged invite no longer redeems",
    );
    const liveOk = PROBES.find(
      (p) => p.name === "newcomer redeems a live invite and sees the board",
    );
    check(
      (await runProbe(db, liveOk)).outcome === "allow",
      "genuine invites still redeem",
    );
    const ver2 = await db.query(read(FILES.verify));
    check(
      ver2.rows.find(
        (x) => x.check === "audit: LIVE invites naming someone else",
      ).detail === "0",
      "verify: live forged invites now 0",
    );
  } finally {
    await db.end();
    if (!process.env.KEEP)
      execFileSync(
        path.join(PG_BIN, "pg_ctl"),
        ["-D", DATA, "-m", "fast", "-w", "stop"],
        { stdio: "ignore" },
      );
  }

  log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  try {
    execFileSync(
      path.join(PG_BIN, "pg_ctl"),
      ["-D", DATA, "-m", "fast", "-w", "stop"],
      { stdio: "ignore" },
    );
  } catch {}
  process.exit(2);
});
