#!/usr/bin/env node
/**
 * **A real, local, throwaway Supabase for Powder Day (Snow).** Copied from
 * Date Night's stack with its own ports (569xx) and directory
 * (~/passport/scratch/snow-stack, populated by copying bin/ and node_modules/
 * from another stack), applying the baseline, the adventures core, item
 * origin and supabase/migrations/20261103000000_passport_snow.sql twice. Original header
 * follows.
 *
 * **A real, local, throwaway Supabase for Date Night** — Christmas's copy of
 * the group-adventures stack (docs/product/group-adventures/verification/
 * stack.mjs) with its own ports (559xx) and directory, applying the baseline,
 * the adventures core, item origin, and Date Night's migration
 * (supabase/migrations/20261102000000_passport_date_nights.sql) twice.
 *
 * Original header follows.
 *
 * **A real, local, throwaway Supabase for the group-adventures foundation.**
 *
 * Adapted from Hockey Night's verification stack (feature/hockey,
 * docs/product/hockey/verification/stack.mjs, M216): the same three servers
 * a Supabase project runs, from their own release binaries, behind a proxy
 * that gives them Supabase's URL layout.
 *
 *   - PostgreSQL   (embedded-postgres binaries)
 *   - GoTrue       real sign-up, real password sign-in, real HS256 JWTs
 *   - PostgREST    the same role switch and RLS `@supabase/ssr` talks to
 *
 * Roles and default privileges mirror Supabase's (`anon`, `authenticated`
 * and `service_role` get ALL on new public tables), so RLS and the
 * migration's own REVOKEs — not a missing GRANT — keep people out.
 *
 * Own directory and ports, so it can run beside the hockey stack:
 *
 *   STACK=/tmp/adventures-stack   (bin/, node_modules/ copied from a hockey
 *                                  stack; see README "Verification")
 *   proxy 55521 · postgres 55529 · auth 55531 · rest 55532 (the hockey
 *   stack uses 543xx and the conference stack 544xx)
 *
 * Usage:
 *
 *   node docs/product/group-adventures/verification/stack.mjs start
 *   node docs/product/group-adventures/verification/stack.mjs restart
 *   node docs/product/group-adventures/verification/stack.mjs stop
 *
 * `start` wipes the database, applies the Passport baseline and the proposed
 * adventures migration (twice, to prove it is idempotent), and writes
 * $STACK/env. `restart` stops and starts Postgres, GoTrue and PostgREST on the
 * SAME data directory — the "state survives a restart" check. Nothing here
 * talks to any real Supabase project.
 */
import { spawn, execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STACK =
  process.env.STACK ??
  path.join(process.env.HOME ?? "/tmp", "passport/scratch/snow-stack");
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");

const PG_PORT = 56939;
const AUTH_PORT = 56941;
const REST_PORT = 56942;
const PROXY_PORT = 56931;
/**
 * This stack's JWT secret: generated on first use and kept in the stack
 * directory (0600), so every command run against one stack agrees, and no
 * fixed secret is committed (the release runner refuses credential-shaped
 * strings).
 */
const JWT_SECRET = (() => {
  const file = path.join(STACK, "jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {}
  fs.mkdirSync(STACK, { recursive: true });
  const secret = randomBytes(32).toString("hex");
  fs.writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
})();
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3132";

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
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
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
    if (req.url.startsWith("/storage/v1/")) {
      storage(req, res, cors).catch((err) => {
        res.writeHead(500, cors);
        res.end(String(err));
      });
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

/**
 * **A stand-in for Supabase Storage, for Sesh Wars' clips only.** Real
 * Supabase runs storage-api; this stack has no such binary, so the proxy
 * answers the three calls Sesh Wars makes, with the same rules the
 * migration's storage policies state:
 *
 *   POST /storage/v1/object/<bucket>/<path>       upload (multipart or raw);
 *        only an authenticated JWT whose sub is the path's first folder, and
 *        only once that person has a rider profile (asked of PostgREST as them)
 *   POST /storage/v1/object/sign/<bucket>/<path>  a signed link, only if the
 *        caller owns the folder or can see a clip pointing at the file
 *        (asked of PostgREST as the caller, so the clips policy decides)
 *   GET  /storage/v1/object/sign/<bucket>/<path>?token=…  the file, with Range
 *
 * It is an emulation, labelled as one in SESH-WARS.md: it proves Passport's
 * calls and the visibility rule, not storage-api itself.
 */
const BUCKET = "sesh-wars-clips";
const MAX_BYTES = 52428800;
const MIMES = ["video/mp4", "video/quicktime", "video/webm", "image/jpeg"];

function verifyJwt(token) {
  const [h, b, sig] = String(token ?? "").split(".");
  if (!sig) return null;
  const want = createHmac("sha256", JWT_SECRET)
    .update(`${h}.${b}`)
    .digest("base64url");
  if (want !== sig) return null;
  try {
    const claims = JSON.parse(Buffer.from(b, "base64url").toString());
    return claims.exp && claims.exp * 1000 < Date.now() ? null : claims;
  } catch {
    return null;
  }
}

async function restAs(auth, query) {
  const r = await fetch(`http://127.0.0.1:${REST_PORT}${query}`, {
    headers: { authorization: auth },
  });
  return r.ok ? r.json() : [];
}

async function readBody(req) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > MAX_BYTES + 1_000_000) throw new Error("too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function storage(req, res, cors) {
  const url = new URL(req.url, "http://x");
  const auth =
    req.headers.authorization ??
    (req.headers.apikey ? `Bearer ${req.headers.apikey}` : "");
  const claims = verifyJwt(auth.replace(/^Bearer /, ""));
  const json = (status, body) => {
    res.writeHead(status, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const signed = url.pathname.startsWith("/storage/v1/object/sign/");
  const rel = decodeURIComponent(
    url.pathname.replace(
      signed ? "/storage/v1/object/sign/" : "/storage/v1/object/",
      "",
    ),
  );
  const [bucket, ...parts] = rel.split("/");
  const name = parts.join("/");
  if (
    bucket !== BUCKET ||
    !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm|jpg)$/.test(name)
  )
    return json(400, { error: "invalid path" });
  const file = path.join(STACK, "storage", BUCKET, name);

  if (signed && req.method === "GET") {
    const want = createHmac("sha256", JWT_SECRET)
      .update(`sign:${name}`)
      .digest("base64url");
    const token = url.searchParams.get("token") ?? "";
    const [exp, mac] = token.split(".");
    const ok =
      mac ===
        createHmac("sha256", JWT_SECRET)
          .update(`${want}:${exp}`)
          .digest("base64url") && Number(exp) > Date.now();
    if (!ok || !fs.existsSync(file))
      return json(400, { error: "invalid signature" });
    const meta = JSON.parse(fs.readFileSync(`${file}.json`, "utf8"));
    const size = fs.statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.writeHead(206, {
        ...cors,
        "content-type": meta.type,
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
        "content-length": String(end - start + 1),
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      ...cors,
      "content-type": meta.type,
      "content-length": String(size),
      "accept-ranges": "bytes",
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  if (signed && req.method === "POST") {
    const owner = claims?.sub && name.split("/")[0] === claims.sub;
    const quoted = encodeURIComponent(name);
    const seen =
      owner ||
      (
        await restAs(
          auth,
          `/passport_sesh_clips?select=id&or=(video_path.eq.${quoted},poster_path.eq.${quoted})`,
        )
      ).length > 0;
    if (!seen || !fs.existsSync(file))
      return json(404, { error: "Object not found" });
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const exp =
      Date.now() + Math.min(Number(body.expiresIn) || 60, 86400) * 1000;
    const want = createHmac("sha256", JWT_SECRET)
      .update(`sign:${name}`)
      .digest("base64url");
    const mac = createHmac("sha256", JWT_SECRET)
      .update(`${want}:${exp}`)
      .digest("base64url");
    return json(200, {
      signedURL: `/object/sign/${BUCKET}/${name}?token=${exp}.${mac}`,
    });
  }

  if (!signed && req.method === "POST") {
    if (claims?.role !== "authenticated" || name.split("/")[0] !== claims.sub)
      return json(403, { error: "new row violates row-level security policy" });
    const me = await restAs(
      auth,
      `/passport_sesh_riders?select=user_id&user_id=eq.${claims.sub}`,
    );
    if (me.length === 0)
      return json(403, { error: "new row violates row-level security policy" });
    const raw = await readBody(req);
    let bytes = raw;
    let type = req.headers["content-type"] ?? "";
    if (type.startsWith("multipart/form-data")) {
      const form = await new Response(raw, {
        headers: { "content-type": type },
      }).formData();
      const part = [...form.values()].find((v) => typeof v === "object");
      if (!part) return json(400, { error: "no file" });
      bytes = Buffer.from(await part.arrayBuffer());
      type = part.type;
    }
    if (!MIMES.includes(type))
      return json(415, { error: "mime type not supported" });
    if (bytes.length > MAX_BYTES)
      return json(413, { error: "Payload too large" });
    if (fs.existsSync(file))
      return json(409, { error: "The resource already exists" });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    fs.writeFileSync(`${file}.json`, JSON.stringify({ type }));
    return json(200, {
      Key: `${BUCKET}/${name}`,
      Id: randomBytes(16).toString("hex"),
    });
  }
  return json(405, { error: "not supported by this stand-in" });
}

async function start() {
  if (fs.existsSync(PIDS)) {
    console.error(`Already running (${PIDS}). Run stop first.`);
    process.exit(1);
  }
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.rmSync(LOGS, { recursive: true, force: true });
  fs.rmSync(path.join(STACK, "storage"), { recursive: true, force: true });
  execFileSync(
    path.join(pgBin, "initdb"),
    ["-D", DATA, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"],
    { stdio: "ignore" },
  );
  await services({ fresh: true });
}

/** Whether something already answers on a port. */
function portBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** Postgres, GoTrue, PostgREST and the proxy. `fresh` bootstraps and migrates. */
async function services({ fresh }) {
  // Another lane's stack on these ports would otherwise be bootstrapped and
  // migrated by mistake (it happened: the conference stack once held 544xx).
  for (const port of [PG_PORT, AUTH_PORT, REST_PORT, PROXY_PORT]) {
    if (await portBusy(port)) {
      throw new Error(`port ${port} is already in use; refusing to start`);
    }
  }
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
  if (fresh) await sql(BOOTSTRAP);

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
          GOTRUE_SMTP_ADMIN_EMAIL: "noreply@adventures.local",
        }
      : {}),
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_LOG_LEVEL: "warn",
  });
  record();
  await waitFor(`http://127.0.0.1:${AUTH_PORT}/health`, "auth");

  if (fresh) {
    // Passport's own baseline first — the proposal must coexist with it —
    // then the proposal under test, twice: the second run must change nothing.
    await sql(
      fs.readFileSync(
        path.join(
          repo,
          "supabase/migrations/20260927000000_passport_baseline.sql",
        ),
        "utf8",
      ),
    );
    const proposal = fs.readFileSync(
      path.join(
        repo,
        "supabase/migrations/20261021000000_passport_adventures.sql",
      ),
      "utf8",
    );
    await sql(proposal);
    await sql(proposal);
    // ADR 012's item origin, twice as well. ADVENTURES_WITHOUT_ORIGIN=1 leaves
    // it out, for proving the app still works before it is applied.
    if (process.env.ADVENTURES_WITHOUT_ORIGIN !== "1") {
      const origin = fs.readFileSync(
        path.join(
          repo,
          "supabase/migrations/20261023100000_passport_adventure_item_origin.sql",
        ),
        "utf8",
      );
      await sql(origin);
      await sql(origin);
    }
    // Everything else on the core that production gets before Snow (ADR 014
    // together, Date Night, packing), so Snow is proven beside it, not alone.
    for (const later of [
      "20261101000000_passport_adventure_together.sql",
      "20261102000000_passport_date_nights.sql",
      "20261102100000_passport_adventure_packing.sql",
    ])
      await sql(
        fs.readFileSync(path.join(repo, "supabase/migrations", later), "utf8"),
      );
    // Powder Day's shared tables, twice: the second run must change nothing.
    const snow = fs.readFileSync(
      path.join(repo, "supabase/migrations/20261103000000_passport_snow.sql"),
      "utf8",
    );
    await sql(snow);
    await sql(snow);
    // Activities as a voted topic (one CHECK), twice. Skipped with
    // SNOW_NO_ACTIVITY=1 to rehearse a database that only has Powder Day,
    // then `apply` it over existing rows.
    if (!process.env.SNOW_NO_ACTIVITY) {
      const activity = fs.readFileSync(
        path.join(
          repo,
          "supabase/migrations/20261108000000_passport_snow_activity.sql",
        ),
        "utf8",
      );
      await sql(activity);
      await sql(activity);
    }
    // Find your crew (opt-in, time-limited locations): a PROPOSED migration,
    // so it lives in docs until the contracts lane moves it into
    // supabase/migrations. Also applied twice. Skipped with
    // SNOW_NO_LOCATION=1 to rehearse the world before it is applied.
    if (!process.env.SNOW_NO_LOCATION) {
      const loc = fs.readFileSync(
        path.join(repo, "docs/product/snow/location-migration.sql"),
        "utf8",
      );
      await sql(loc);
      await sql(loc);
    }
    // Sesh Wars (PROPOSED, docs/product/snow/sesh-wars-migration.sql), twice.
    // SESH_NO_MIGRATION=1 rehearses a database without it ("not open yet").
    if (!process.env.SESH_NO_MIGRATION) {
      const sesh = fs.readFileSync(
        path.join(repo, "docs/product/snow/sesh-wars-migration.sql"),
        "utf8",
      );
      await sql(sesh);
      await sql(sesh);
    }
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
    `ADVENTURES_STACK_SERVICE_KEY=${SERVICE_KEY}`,
    `ADVENTURES_STACK_PG=postgres://postgres@127.0.0.1:${PG_PORT}/postgres`,
  ].join("\n");
  fs.writeFileSync(path.join(STACK, "env"), env + "\n");
  console.log(`Stack up. Env written to ${path.join(STACK, "env")}`);
  console.log(JSON.stringify(pids));
}

async function stop() {
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
  // Wait for every process to be gone, so a restart reuses the data
  // directory and ports cleanly.
  for (let i = 0; i < 150; i++) {
    const alive = Object.values(pids).filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
    if (alive.length === 0) return;
    await sleep(200);
  }
  throw new Error("stack processes did not exit");
}

/** Same data directory, fresh processes. Nothing is re-applied. */
async function restart() {
  await stop();
  await services({ fresh: false });
}

/** Apply one more SQL file as the superuser (e.g. the boards claim fix). */
async function apply(file) {
  await sql(fs.readFileSync(path.resolve(file), "utf8"));
  console.log(`applied ${file}`);
}

const command = process.argv[2];
if (command === "start") await start();
else if (command === "stop") await stop();
else if (command === "restart") await restart();
else if (command === "apply") await apply(process.argv[3]);
else if (command === "proxy") proxyServer().listen(PROXY_PORT, "127.0.0.1");
else {
  console.error("usage: stack.mjs start|restart|stop|apply <file.sql>");
  process.exit(2);
}
