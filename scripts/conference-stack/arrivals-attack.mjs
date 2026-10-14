#!/usr/bin/env node
/**
 * **Attack the Arrivals migration the way a hostile colleague would.**
 *
 * Not through the app: straight at PostgREST with real JWTs from a real
 * GoTrue, because that is the authority a member has in production (the anon
 * key is public; their own session token is in their browser). Whatever this
 * cannot do, nobody can do by skipping the Passport UI.
 *
 * Needs the local stack with both migrations: `node scripts/conference-stack/stack.mjs start`.
 * Exits non-zero on any failure.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const STACK = process.env.STACK ?? "/tmp/conference-stack";
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
let total = 0;
const check = (ok, label) => {
  total++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

async function signUp(name) {
  const email = `${name}-${Date.now()}-${randomBytes(3).toString("hex")}@example.test`;
  const res = await fetch(`${URL_}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "correct-horse-battery-9",
      data: { display_name: name },
    }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`signup: ${JSON.stringify(body)}`);
  return { name, id: body.user.id, token: body.access_token };
}

async function rest(who, method, path, body) {
  const res = await fetch(`${URL_}/rest/v1${path}`, {
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
const rpc = (who, fn, args) => rest(who, "POST", `/rpc/${fn}`, args);
const rows = (r) => (Array.isArray(r.body) ? r.body : []);
const denied = (r) => r.status >= 400 || rows(r).length === 0;
const token = (n) => randomBytes(n).toString("base64url");

const future = new Date(Date.now() + 30 * 86400_000).toISOString();
const details = {
  name: "Attack Summit",
  kind: "conference",
  place: { label: "Vancouver" },
  timeZone: "America/Vancouver",
  startsOn: "2026-10-24",
  branding: { accent: "#e11d48" },
  modules: ["discover", "arrivals"],
};
const [alice, bob, carol, mallory, eve] = await Promise.all(
  ["alice", "bob", "carol", "mallory", "eve"].map(signUp),
);

async function found(who) {
  const id = token(12);
  await rest(who, "POST", "/passport_conferences", {
    id,
    details,
    retain_until: future,
  });
  const m = token(9);
  await rest(who, "POST", "/passport_conference_members", {
    conference_id: id,
    user_id: who.id,
    member_id: m,
    role: "organiser",
    via: "created",
  });
  const link = token(32);
  await rest(who, "POST", "/passport_conference_invites", {
    token: link,
    conference_id: id,
  });
  return { id, member: m, link };
}
async function join(who, conf) {
  const m = token(9);
  await rpc(who, "passport_conference_redeem_invite", {
    p_token: conf.link,
    p_member_id: m,
  });
  return m;
}
const recordFor = (conf, member, shared, extra = {}) => ({
  conferenceId: conf,
  memberId: member,
  flight: {
    ident: { display: "FI665" },
    date: "2026-10-24",
    departure: null,
  },
  shared,
  createdAt: "2026-10-14T00:00:00.000Z",
  updatedAt: "2026-10-14T00:00:00.000Z",
  tracking: { phase: "scheduled", trail: [] },
  ...extra,
});
const save = (who, conf, rec) =>
  rpc(who, "passport_conference_arrivals_save", {
    p_conference: conf,
    p_record: rec,
  });
const list = (who, conf) =>
  rest(who, "GET", `/passport_conference_arrivals?conference_id=eq.${conf}`);
const seenBy = async (who, conf) =>
  rows(await list(who, conf)).map((x) => x.member_id);
const see = (who, conf, visibility) =>
  rest(
    who,
    "PATCH",
    `/passport_conference_members?conference_id=eq.${conf}&user_id=eq.${who.id}`,
    { visibility, display_name: visibility === "members" ? who.name : null },
  );

const C = await found(alice);
const bobM = await join(bob, C);
const carolM = await join(carol, C);
const other = await found(eve);

console.log("writing");
let r = await save(bob, C.id, recordFor(C.id, bobM, true));
check(r.status < 300, "a member saves their own flight");
r = await save(carol, C.id, recordFor(C.id, carolM, false));
check(r.status < 300, "…hidden, unshared too");
r = await save(mallory, C.id, recordFor(C.id, token(9), true));
check(r.status >= 400, "an outsider cannot save into a conference");
r = await save(mallory, C.id, recordFor(C.id, bobM, true));
check(r.status >= 400, "…not even as Bob");
r = await save(null, C.id, recordFor(C.id, bobM, true));
check(r.status >= 400, "a signed-out caller cannot call the save function");
r = await rest(bob, "POST", "/passport_conference_arrivals", {
  conference_id: C.id,
  user_id: bob.id,
  member_id: bobM,
  record: recordFor(C.id, bobM, true),
});
check(r.status >= 400, "no direct insert: writes go through the function");
r = await rest(
  bob,
  "PATCH",
  `/passport_conference_arrivals?conference_id=eq.${C.id}`,
  { shared: true, record: {} },
);
check(r.status >= 400, "…and no direct update");
r = await save(eve, other.id, recordFor(C.id, bobM, true));
check(r.status >= 400, "a record cannot name a conference it isn't in");

console.log("\nreading");
check((await seenBy(bob, C.id)).join() === bobM, "Bob sees his own, only");
check(
  (await seenBy(carol, C.id)).join() === carolM,
  "Carol sees her own unshared flight, only (Bob is hidden)",
);
check(
  (await seenBy(alice, C.id)).length === 0,
  "an organiser sees neither: Bob is hidden, Carol's is unshared",
);
await see(bob, C.id, "members");
check(
  (await seenBy(alice, C.id)).join() === bobM,
  "once Bob is seen and shared, a colleague reads his flight",
);
check(
  (await seenBy(carol, C.id)).sort().join() === [bobM, carolM].sort().join(),
  "…and Carol sees his and hers, never anybody's unshared",
);
check((await seenBy(mallory, C.id)).length === 0, "a stranger reads nothing");
check((await seenBy(eve, C.id)).length === 0, "…nor an organiser elsewhere");
r = await list(null, C.id);
check(denied(r), "a signed-out caller reads nothing");
await see(carol, C.id, "members");
check(
  !(await seenBy(alice, C.id)).includes(carolM),
  "Carol seen but unshared: still only hers",
);
await see(bob, C.id, "hidden");
check(
  (await seenBy(alice, C.id)).length === 0,
  "Bob hides again: his flight leaves everyone else's view at once",
);
await see(bob, C.id, "members");

console.log("\nrefreshing somebody else's tracking");
const live = {
  phase: "airborne",
  trail: [],
  last: { lat: 49.9, lon: -120 },
  match: null,
};
r = await save(alice, C.id, recordFor(C.id, bobM, true, { tracking: live }));
const bobRow = async () =>
  rows(await list(alice, C.id)).find((x) => x.member_id === bobM);
check(
  (await bobRow()).record.tracking.phase === "airborne",
  "a colleague's lookup is stored on Bob's shared flight",
);
r = await save(
  alice,
  C.id,
  recordFor(C.id, bobM, true, {
    tracking: { ...live, phase: "landed" },
    updatedAt: "2026-10-14T09:00:00.000Z",
  }),
);
check(
  (await bobRow()).record.tracking.phase === "airborne",
  "…a lookup against a stale version is ignored",
);
r = await save(
  alice,
  C.id,
  recordFor(C.id, bobM, false, {
    flight: { ident: { display: "XX1" }, date: "2026-10-24", departure: null },
    tracking: { ...live, phase: "lost" },
  }),
);
const after = await bobRow();
check(
  after.shared === true &&
    after.record.flight.ident.display === "FI665" &&
    after.record.shared === true &&
    after.record.tracking.phase === "lost",
  "…it changes the tracking only: not the flight, not the sharing choice",
);
r = await save(alice, C.id, recordFor(C.id, carolM, false, { tracking: live }));
check(
  (await seenBy(carol, C.id)).length === 2 &&
    rows(await list(carol, C.id)).find((x) => x.member_id === carolM).record
      .tracking.phase === "scheduled",
  "…and Carol's unshared flight cannot be touched by anybody else",
);
r = await save(mallory, C.id, recordFor(C.id, bobM, true, { tracking: live }));
check(r.status >= 400, "an outsider cannot refresh anything");
r = await save(alice, C.id, recordFor(C.id, bobM, true, { tracking: "junk" }));
check(
  (await bobRow()).record.tracking.phase === "lost",
  "malformed tracking is refused",
);

for (const [label, tracking] of [
  ["an unknown phase", { ...live, phase: "owned" }],
  ["a trail of non-positions", { ...live, trail: ["x", 1] }],
  [
    "an oversized trail",
    { ...live, trail: Array(241).fill({ lat: 1, lon: 1 }) },
  ],
  ["a bloated body", { ...live, junk: "x".repeat(17000) }],
]) {
  await save(alice, C.id, recordFor(C.id, bobM, true, { tracking }));
  check(
    (await bobRow()).record.tracking.phase === "lost",
    `a colleague cannot write ${label} onto Bob's flight`,
  );
}

console.log("\nerasure");
r = await rest(
  mallory,
  "DELETE",
  `/passport_conference_arrivals?conference_id=eq.${C.id}`,
);
check(
  (await seenBy(carol, C.id)).includes(carolM),
  "a stranger deletes nothing",
);
r = await rest(
  alice,
  "DELETE",
  `/passport_conference_arrivals?conference_id=eq.${C.id}&member_id=eq.${bobM}`,
);
r = await rest(
  bob,
  "DELETE",
  `/passport_conference_members?conference_id=eq.${C.id}&user_id=eq.${bob.id}`,
);
check(
  rows(
    await rest(
      alice,
      "GET",
      `/passport_conference_arrivals?member_id=eq.${bobM}`,
    ),
  ).length === 0,
  "when somebody leaves, their flight goes with them",
);
await save(bob, C.id, recordFor(C.id, bobM, true));
check(
  (await seenBy(bob, C.id)).length === 0,
  "…and a person who has left cannot save another",
);
r = await rest(
  alice,
  "DELETE",
  `/passport_conference_members?conference_id=eq.${C.id}&user_id=eq.${carol.id}`,
);
check(
  (await seenBy(carol, C.id)).length === 0,
  "an organiser removing Carol takes her flight with her",
);
await save(alice, C.id, recordFor(C.id, C.member, true));
r = await rpc(alice, "passport_conference_remove", { p_conference: C.id });
r = await rest(alice, "GET", "/passport_conference_arrivals");
check(rows(r).length === 0, "deleting the conference deletes every flight");

console.log(`\n${total - failures}/${total} as expected`);
process.exit(failures ? 1 : 0);
