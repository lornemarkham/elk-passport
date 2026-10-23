#!/usr/bin/env node
/**
 * **A real, local, throwaway Supabase — no Docker, no cloud project.**
 *
 * Hockey Night is Passport's first multiplayer experience, and the claim
 * "two people can sign in and see the same private night" cannot be verified
 * with mocked auth or a single browser. This lane also has no Supabase
 * credentials, on purpose. So this script stands up the same three servers a
 * Supabase project runs, from their own release binaries:
 *
 *   - PostgreSQL        (embedded-postgres binaries)
 *   - GoTrue / auth     (github.com/supabase/auth release) — real sign-up,
 *                       real password sign-in, real HS256 JWTs
 *   - PostgREST         (github.com/PostgREST/postgrest release) — the same
 *                       role switch and RLS enforcement `@supabase/ssr` talks to
 *
 * behind a tiny proxy that gives them Supabase's URL layout (`/auth/v1`,
 * `/rest/v1`), so the unmodified app, pointed at it with
 * `NEXT_PUBLIC_SUPABASE_URL`, behaves exactly as it does against a project.
 *
 * Roles mirror Supabase's. Default privileges mirror the production project,
 * which does NOT grant new public tables to `anon` or `authenticated`: the
 * migration must GRANT what it needs, and RLS decides rows. (This stack used
 * to grant ALL by default; that hid the same 42501 that crashed Conference in
 * production on 2026-10-16.)
 *
 * Usage (binaries and node deps live in $STACK, default /tmp/hockey-stack):
 *
 *   node docs/product/hockey/verification/stack.mjs start
 *   node docs/product/hockey/verification/stack.mjs stop
 *
 * `start` applies the Passport baseline and the proposed occasions migration,
 * then writes $STACK/env with the URL and keys. Nothing here talks to any real
 * Supabase project, and nothing here is deployable.
 */
import { spawn, execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STACK = process.env.STACK ?? "/tmp/hockey-stack";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");

const PG_PORT = 54329;
const AUTH_PORT = 54331;
const REST_PORT = 54332;
const PROXY_PORT = 54321;
const JWT_SECRET = "hockey-night-local-only-secret-not-for-anything-real";
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3130";

const pgBin = path.join(
  STACK,
  "node_modules/@embedded-postgres/linux-x64/native/bin",
);
const DATA = path.join(STACK, "pgdata");
const LOGS = path.join(STACK, "logs");
const PIDS = path.join(STACK, "pids.json");

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

/** HS256, the way Supabase mints its anon and service keys. */
function jwt(payload) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${sig}`;
}

const ANON_KEY = jwt({
  role: "anon",
  iss: "supabase",
  iat: 1760000000,
  exp: 2000000000,
});
const SERVICE_KEY = jwt({
  role: "service_role",
  iss: "supabase",
  iat: 1760000000,
  exp: 2000000000,
});

/** SQL as the superuser, through `pg` (embedded-postgres ships no psql). */
async function sql(text) {
  const { default: pg } = await import(
    path.join(STACK, "node_modules/pg/lib/index.js")
  );
  const client = new pg.Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    database: "postgres",
  });
  await client.connect();
  try {
    return await client.query(text);
  } finally {
    await client.end();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, label) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error(`${label} did not come up at ${url}`);
}

function launch(name, cmd, args, env) {
  fs.mkdirSync(LOGS, { recursive: true });
  const out = fs.openSync(path.join(LOGS, `${name}.log`), "a");
  const child = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", out, out],
    detached: true,
  });
  child.unref();
  return child.pid;
}

/** Supabase's bootstrap, reduced to what GoTrue and PostgREST need. */
const BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole superuser;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

/**
 * The proxy. Supabase's gateway does three things the client depends on:
 * routes by prefix, answers CORS preflight, and accepts the anon key as
 * `apikey`. PostgREST only reads `Authorization`, so a request carrying just
 * the apikey is promoted to `Bearer <apikey>` — exactly Kong's behaviour.
 */
function proxyServer() {
  return http.createServer((req, res) => {
    const cors = {
      "access-control-allow-origin": req.headers.origin ?? "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers":
        req.headers["access-control-request-headers"] ?? "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    let port;
    let rest;
    if (req.url.startsWith("/auth/v1")) {
      port = AUTH_PORT;
      rest = req.url.slice("/auth/v1".length) || "/";
    } else if (req.url.startsWith("/rest/v1")) {
      port = REST_PORT;
      rest = req.url.slice("/rest/v1".length) || "/";
    } else {
      res.writeHead(404, cors);
      res.end("not found");
      return;
    }
    const headers = { ...req.headers, host: `127.0.0.1:${port}` };
    if (!headers.authorization && headers.apikey) {
      headers.authorization = `Bearer ${headers.apikey}`;
    }
    const upstream = http.request(
      { host: "127.0.0.1", port, path: rest, method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", (err) => {
      res.writeHead(502, cors);
      res.end(String(err));
    });
    req.pipe(upstream);
  });
}

async function start() {
  if (fs.existsSync(PIDS)) {
    console.error(`Already running (${PIDS}). Run stop first.`);
    process.exit(1);
  }
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.rmSync(LOGS, { recursive: true, force: true });
  execFileSync(
    path.join(pgBin, "initdb"),
    ["-D", DATA, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"],
    { stdio: "ignore" },
  );

  // Recorded as each one starts, so a failure part-way can still be stopped.
  const pids = {};
  const record = () => fs.writeFileSync(PIDS, JSON.stringify(pids));
  pids.postgres = launch(
    "postgres",
    path.join(pgBin, "postgres"),
    ["-D", DATA, "-p", String(PG_PORT), "-h", "127.0.0.1", "-k", STACK],
    {},
  );
  record();
  for (let i = 0; i < 100; i++) {
    try {
      await sql("select 1");
      break;
    } catch {
      await sleep(200);
    }
  }
  await sql(BOOTSTRAP);

  const authBin = path.join(STACK, "bin/auth");
  pids.auth = launch("auth", authBin, [], {
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: `postgres://supabase_auth_admin@127.0.0.1:${PG_PORT}/postgres?search_path=auth&sslmode=disable`,
    GOTRUE_DB_MIGRATIONS_PATH: path.join(STACK, "bin/migrations"),
    GOTRUE_DB_NAMESPACE: "auth",
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(AUTH_PORT),
    API_EXTERNAL_URL: `http://127.0.0.1:${PROXY_PORT}/auth/v1`,
    GOTRUE_SITE_URL: SITE_URL,
    GOTRUE_URI_ALLOW_LIST: `${SITE_URL}/**`,
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    // Production may require email confirmation; set CONFIRM_EMAIL=1 to make
    // this stack do the same, mailing to smtp-sink.mjs on SMTP_PORT.
    GOTRUE_MAILER_AUTOCONFIRM: process.env.CONFIRM_EMAIL ? "false" : "true",
    ...(process.env.CONFIRM_EMAIL
      ? {
          GOTRUE_SMTP_HOST: "127.0.0.1",
          GOTRUE_SMTP_PORT: process.env.SMTP_PORT ?? "2525",
          GOTRUE_SMTP_USER: "x",
          GOTRUE_SMTP_PASS: "x",
          GOTRUE_SMTP_ADMIN_EMAIL: "noreply@hockey.local",
        }
      : {}),
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_LOG_LEVEL: "warn",
  });
  record();
  await waitFor(`http://127.0.0.1:${AUTH_PORT}/health`, "auth");

  // Passport's own baseline first — the occasions migration must coexist with
  // it — then the proposal under test.
  await sql(
    fs.readFileSync(
      path.join(
        repo,
        "supabase/migrations/20260927000000_passport_baseline.sql",
      ),
      "utf8",
    ),
  );
  await sql(fs.readFileSync(path.join(here, "..", "migration.sql"), "utf8"));
  // Our seats (2026-10-22). HOCKEY_SEATS=0 starts without it, to see the
  // night as production has it before that migration is applied.
  // Memories (2026-10-23). HOCKEY_MEMORIES=0 starts without it, to see the
  // night as production has it before that migration is applied.
  if (process.env.HOCKEY_MEMORIES !== "0") {
    await sql(
      fs.readFileSync(path.join(here, "..", "memories-migration.sql"), "utf8"),
    );
  }
  if (process.env.HOCKEY_SEATS !== "0") {
    await sql(
      fs.readFileSync(path.join(here, "..", "seats-migration.sql"), "utf8"),
    );
  }
  // Arena Mode (2026-10-22). HOCKEY_ARENA=0 starts without it, to see Arena
  // Mode as production would before that migration is applied.
  if (process.env.HOCKEY_ARENA !== "0") {
    await sql(
      fs.readFileSync(path.join(here, "..", "arena-migration.sql"), "utf8"),
    );
  }

  pids.rest = launch("rest", path.join(STACK, "bin/postgrest"), [], {
    PGRST_DB_URI: `postgres://authenticator@127.0.0.1:${PG_PORT}/postgres`,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_PORT: String(REST_PORT),
    PGRST_SERVER_HOST: "127.0.0.1",
    PGRST_LOG_LEVEL: "warn",
  });
  record();
  await waitFor(`http://127.0.0.1:${REST_PORT}/`, "rest");

  // The proxy runs as its own detached node process so `start` can exit.
  pids.proxy = launch(
    "proxy",
    process.execPath,
    [fileURLToPath(import.meta.url), "proxy"],
    { STACK },
  );
  await waitFor(`http://127.0.0.1:${PROXY_PORT}/auth/v1/health`, "proxy");

  fs.writeFileSync(PIDS, JSON.stringify(pids));
  const env = [
    `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${PROXY_PORT}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`,
    `HOCKEY_STACK_SERVICE_KEY=${SERVICE_KEY}`,
    `HOCKEY_STACK_PG=postgres://postgres@127.0.0.1:${PG_PORT}/postgres`,
  ].join("\n");
  fs.writeFileSync(path.join(STACK, "env"), env + "\n");
  console.log(`Stack up. Env written to ${path.join(STACK, "env")}`);
  console.log(JSON.stringify(pids));
}

function stop() {
  if (!fs.existsSync(PIDS)) {
    console.log("Nothing running.");
    return;
  }
  const pids = JSON.parse(fs.readFileSync(PIDS, "utf8"));
  for (const [name, pid] of Object.entries(pids)) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`stopped ${name} (${pid})`);
    } catch {
      console.log(`${name} (${pid}) already gone`);
    }
  }
  fs.rmSync(PIDS, { force: true });
}

const command = process.argv[2];
if (command === "start") await start();
else if (command === "stop") stop();
else if (command === "proxy") proxyServer().listen(PROXY_PORT, "127.0.0.1");
else {
  console.error("usage: stack.mjs start|stop");
  process.exit(2);
}
