#!/usr/bin/env node
/**
 * **Attack the conference migration the way a hostile colleague would.**
 *
 * Not through the app: straight at PostgREST with real JWTs from a real
 * GoTrue, because that is the authority a member has in production (the anon
 * key is public; their own session token is in their browser). Whatever this
 * cannot do, nobody can do by skipping the Passport UI.
 *
 * Needs the local stack: `node scripts/conference-stack/stack.mjs start`.
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

const details = {
  name: "Attack Summit",
  kind: "conference",
  place: { label: "Vancouver" },
  timeZone: "America/Vancouver",
  startsOn: "2026-10-24",
  branding: { accent: "#e11d48" },
  modules: ["discover"],
};
// Codes are globally unique, and the stack keeps its data between runs.
const KEY = Array.from(
  randomBytes(9),
  (b) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 31],
).join("");
const CODE = `${KEY.slice(0, 3)}-${KEY.slice(3, 6)}-${KEY.slice(6)}`;
const future = new Date(Date.now() + 30 * 86400_000).toISOString();

const [alice, bob, carol, dave, mallory] = await Promise.all(
  ["alice", "bob", "carol", "dave", "mallory"].map(signUp),
);

// ── Alice founds a conference, as the app's store does ───────────────────
const CONF = token(12);
let r = await rest(alice, "POST", "/passport_conferences", {
  id: CONF,
  details,
  retain_until: future,
});
check(r.status === 201, "a signed-in person can found a conference");
r = await rest(alice, "POST", "/passport_conference_members", {
  conference_id: CONF,
  user_id: alice.id,
  member_id: token(9),
  role: "organiser",
  via: "created",
});
check(r.status === 201, "…and becomes its first organiser");
const aliceMember = rows(r)[0].member_id;

const LINK = token(32);
const LINK1 = token(32);
const LINK_DEAD = token(32);
for (const [t, extra] of [
  [LINK, {}],
  [LINK1, { max_uses: 1 }],
  [LINK_DEAD, { expires_at: new Date(Date.now() - 1000).toISOString() }],
]) {
  r = await rest(alice, "POST", "/passport_conference_invites", {
    token: t,
    conference_id: CONF,
    ...extra,
  });
  check(r.status === 201, "organiser makes a link");
}
r = await rest(alice, "POST", "/passport_conference_codes", {
  conference_id: CONF,
  code: CODE,
  code_key: KEY,
});
check(r.status === 201, "organiser turns on a code");

// ── Joining ──────────────────────────────────────────────────────────────
console.log("\njoining");
r = await rpc(null, "passport_conference_redeem_invite", {
  p_token: LINK,
  p_member_id: token(9),
});
check(r.status >= 400, "a signed-out visitor cannot redeem a link");
r = await rpc(null, "passport_conference_describe_invite", { p_token: LINK });
check(
  rows(r)[0]?.state === "valid",
  "a signed-out visitor can ask what a good link is to",
);
r = await rpc(null, "passport_conference_describe_invite", {
  p_token: "nonsense",
});
check(rows(r).length === 0, "…and learns nothing from a made-up one");
r = await rpc(null, "passport_conference_describe_invite", {
  p_token: LINK_DEAD,
});
check(
  rows(r).length === 0 || rows(r)[0].details === null,
  "…or from an expired one, beyond that it is dead",
);

const bobMember = token(9);
r = await rpc(bob, "passport_conference_redeem_invite", {
  p_token: LINK,
  p_member_id: bobMember,
});
check(r.body === CONF, "Bob joins with a link");
r = await rpc(bob, "passport_conference_redeem_invite", {
  p_token: LINK,
  p_member_id: token(9),
});
check(r.body === CONF, "…again: idempotent");
r = await rest(alice, "GET", `/passport_conference_invites?token=eq.${LINK}`);
check(rows(r)[0]?.uses === 1, "…and spent one use, not two");
r = await rpc(null, "passport_conference_expired", {});
check(
  r.status === 200 && r.body.length === 0,
  "purge-on-read works for a signed-out visitor and finds nothing of theirs",
);
const gina = await signUp("gina");
r = await rpc(gina, "passport_conference_redeem_invite", {
  p_token: LINK_DEAD,
  p_member_id: token(9),
});
check(r.body === null, "an expired link admits nobody");
r = await rpc(bob, "passport_conference_redeem_invite", {
  p_token: LINK_DEAD,
  p_member_id: token(9),
});
check(
  r.body === CONF,
  "…but takes somebody already in home, rather than lecturing them",
);
r = await rpc(carol, "passport_conference_redeem_code", {
  p_code: CODE.toLowerCase().replace(/-/, " "),
  p_member_id: token(9),
});
check(r.body === CONF, "Carol joins with the code, typed sloppily");
r = await rpc(mallory, "passport_conference_redeem_code", {
  p_code: "AAA-AAA-AAA",
  p_member_id: token(9),
});
check(r.body === null, "a wrong code admits nobody");
const [a1, a2] = await Promise.all([
  rpc(dave, "passport_conference_redeem_invite", {
    p_token: LINK1,
    p_member_id: token(9),
  }),
  rpc(mallory, "passport_conference_redeem_invite", {
    p_token: LINK1,
    p_member_id: token(9),
  }),
]);
const winners = [a1, a2].filter((x) => x.body === CONF).length;
check(
  winners === 1,
  `a one-use link admits exactly one of two simultaneous people (got ${winners})`,
);
const daveIn = a1.body === CONF;
const loser = daveIn ? mallory : dave;
const winner = daveIn ? dave : mallory;
r = await rpc(loser, "passport_conference_redeem_code", {
  p_code: CODE,
  p_member_id: token(9),
});
check(r.body === CONF, "(the other one uses the code, so everyone is in)");
void winner;

// Make Carol visible, Bob and the others stay hidden.
r = await rest(
  carol,
  "PATCH",
  `/passport_conference_members?user_id=eq.${carol.id}`,
  {
    display_name: "Carol",
    visibility: "members",
  },
);
check(
  r.status === 200 && rows(r)[0]?.visibility === "members",
  "a member chooses to be seen",
);
r = await rest(
  bob,
  "PATCH",
  `/passport_conference_members?user_id=eq.${bob.id}`,
  { visibility: "members" },
);
check(r.status >= 400, "…but not without a name to be seen by");

// ── Strangers ────────────────────────────────────────────────────────────
console.log(
  "\nstrangers (Mallory is in only if the race put her there; use a fresh one)",
);
const eve = await signUp("eve");
for (const t of [
  "passport_conferences",
  "passport_conference_members",
  "passport_conference_invites",
  "passport_conference_codes",
]) {
  r = await rest(eve, "GET", `/${t}`);
  check(rows(r).length === 0, `a stranger reads no ${t}`);
  r = await rest(null, "GET", `/${t}`);
  check(denied(r), `a signed-out request reads no ${t}`);
}
r = await rpc(eve, "passport_conference_headcount", { p_conference: CONF });
check(r.body === null, "a stranger gets no headcount");
r = await rpc(eve, "passport_conference_remove", { p_conference: CONF });
check(r.body === false, "a stranger cannot remove a conference");
r = await rest(eve, "PATCH", `/passport_conferences?id=eq.${CONF}`, {
  details: { ...details, name: "pwned" },
});
check(rows(r).length === 0, "a stranger cannot edit one");
r = await rest(eve, "DELETE", `/passport_conferences?id=eq.${CONF}`);
check(
  r.status >= 400 || rows(r).length === 0,
  "a stranger cannot delete one directly",
);
r = await rest(eve, "POST", "/passport_conference_members", {
  conference_id: CONF,
  user_id: eve.id,
  member_id: token(9),
  role: "member",
  via: "link",
});
check(r.status >= 400, "a stranger cannot add themselves as a member");
r = await rest(eve, "POST", "/passport_conference_members", {
  conference_id: CONF,
  user_id: eve.id,
  member_id: token(9),
  role: "organiser",
  via: "created",
});
check(r.status >= 400, "…nor as an organiser, claiming to have founded it");
r = await rest(eve, "POST", "/passport_conferences", {
  id: token(12),
  details,
  retain_until: future,
  created_by: alice.id,
});
check(
  r.status >= 400,
  "a stranger cannot found a conference in somebody else's name",
);
r = await rest(eve, "POST", "/passport_conference_invites", {
  token: token(32),
  conference_id: CONF,
});
check(r.status >= 400, "a stranger cannot make a link");
r = await rest(eve, "POST", "/passport_conference_codes", {
  conference_id: CONF,
  code: "ZZZ-ZZZ-ZZZ",
  code_key: "ZZZZZZZZZ",
});
check(r.status >= 400, "…or a code");
r = await rpc(eve, "passport_conference_code_taken", { p_code: CODE });
check(
  r.body === true,
  "(code_taken tells a signed-in person only that a code exists — accepted)",
);

// A founder cannot add a second founder-style row, and cannot add members.
const EVE_CONF = token(12);
await rest(eve, "POST", "/passport_conferences", {
  id: EVE_CONF,
  details,
  retain_until: future,
});
r = await rest(eve, "POST", "/passport_conference_members", {
  conference_id: EVE_CONF,
  user_id: eve.id,
  member_id: token(9),
  role: "organiser",
  via: "created",
});
check(r.status === 201, "(Eve founds her own conference fine)");
r = await rest(eve, "POST", "/passport_conference_members", {
  conference_id: EVE_CONF,
  user_id: mallory.id,
  member_id: token(9),
  role: "member",
  via: "created",
});
check(
  r.status >= 400,
  "a founder cannot add other people to their own conference by hand",
);

// ── Members ──────────────────────────────────────────────────────────────
console.log("\nmembers");
r = await rest(bob, "GET", "/passport_conferences");
check(
  rows(r).length === 1 && rows(r)[0].id === CONF,
  "Bob sees exactly his conference",
);
r = await rest(bob, "GET", "/passport_conference_members");
const seen = rows(r)
  .map((m) => m.user_id)
  .sort();
check(
  seen.includes(bob.id) &&
    seen.includes(carol.id) &&
    !seen.includes(alice.id) &&
    !seen.includes(dave.id) &&
    seen.length === 2,
  "Bob sees himself and Carol (who chose to be seen), nobody hidden — not even the organiser",
);
r = await rpc(bob, "passport_conference_headcount", { p_conference: CONF });
check(r.body === 5, `…but the headcount counts everyone (got ${r.body})`);
for (const t of ["passport_conference_invites", "passport_conference_codes"]) {
  r = await rest(bob, "GET", `/${t}`);
  check(rows(r).length === 0, `a member cannot read ${t}`);
}
r = await rest(
  bob,
  "PATCH",
  `/passport_conference_members?user_id=eq.${bob.id}`,
  { role: "organiser" },
);
check(r.status >= 400, "a member cannot make themselves an organiser");
r = await rest(
  bob,
  "PATCH",
  `/passport_conference_members?user_id=eq.${bob.id}`,
  { member_id: aliceMember },
);
check(r.status >= 400, "…or take someone else's member id");
r = await rest(
  bob,
  "PATCH",
  `/passport_conference_members?user_id=eq.${carol.id}`,
  { display_name: "Not Carol" },
);
check(rows(r).length === 0, "…or rename Carol");
r = await rest(
  bob,
  "DELETE",
  `/passport_conference_members?user_id=eq.${carol.id}`,
);
check(rows(r).length === 0, "…or remove Carol");
r = await rest(bob, "PATCH", `/passport_conferences?id=eq.${CONF}`, {
  details: { ...details, name: "pwned" },
});
check(rows(r).length === 0, "…or edit the conference");
r = await rest(bob, "PATCH", `/passport_conferences?id=eq.${CONF}`, {
  created_by: bob.id,
});
check(r.status >= 400, "…or take it over");
r = await rest(bob, "POST", "/passport_conference_invites", {
  token: token(32),
  conference_id: CONF,
});
check(r.status >= 400, "…or make a link");
r = await rpc(bob, "passport_conference_remove", { p_conference: CONF });
check(r.body === false, "…or delete the conference");
r = await rest(bob, "PATCH", `/passport_conference_invites?token=eq.${LINK}`, {
  uses: 0,
});
check(rows(r).length === 0, "…or reset a link's uses");

// ── Organiser ────────────────────────────────────────────────────────────
console.log("\norganiser");
r = await rest(alice, "GET", "/passport_conference_members");
check(
  rows(r).length === 5,
  `Alice sees all five, hidden included (got ${rows(r).length})`,
);
r = await rest(
  alice,
  "PATCH",
  `/passport_conference_invites?token=eq.${LINK1}`,
  { uses: 0 },
);
check(r.status >= 400, "an organiser cannot hand-edit uses");
r = await rest(
  alice,
  "PATCH",
  `/passport_conference_members?user_id=eq.${bob.id}`,
  { role: "organiser" },
);
check(r.status >= 400, "…nor promote someone by hand");
r = await rest(
  alice,
  "PATCH",
  `/passport_conference_invites?token=eq.${LINK}`,
  { revoked_at: new Date().toISOString() },
);
check(r.status === 200, "an organiser revokes a link");
const frank = await signUp("frank");
r = await rpc(frank, "passport_conference_redeem_invite", {
  p_token: LINK,
  p_member_id: token(9),
});
check(r.body === null, "a revoked link admits nobody");
r = await rest(
  alice,
  "DELETE",
  `/passport_conference_members?user_id=eq.${dave.id}`,
);
check(
  rows(r).length === 1 || r.status === 204,
  "an organiser removes a member",
);
r = await rest(dave, "GET", "/passport_conferences");
check(
  rows(r).length === 0 || rows(r).every((c) => c.id !== CONF),
  "…who then sees nothing (unless the race made them the other person)",
);
r = await rest(alice, "PATCH", `/passport_conferences?id=eq.${CONF}`, {
  details: { ...details, name: "Renamed" },
});
check(rows(r)[0]?.details.name === "Renamed", "an organiser edits details");

// ── Expiry ───────────────────────────────────────────────────────────────
console.log("\nexpiry");
r = await rpc(eve, "passport_conference_remove", { p_conference: EVE_CONF });
check(r.body === true, "(its organiser deletes her own conference)");
const OLD = token(12);
await rest(eve, "POST", "/passport_conferences", {
  id: OLD,
  details,
  retain_until: new Date(Date.now() - 1000).toISOString(),
});
await rest(eve, "POST", "/passport_conference_members", {
  conference_id: OLD,
  user_id: eve.id,
  member_id: token(9),
  role: "organiser",
  via: "created",
});
r = await rpc(eve, "passport_conference_expired", {});
check(r.body.includes(OLD), "an expired conference is found by its member");
r = await rpc(mallory, "passport_conference_remove", { p_conference: OLD });
check(
  r.body === true,
  "…and anybody signed in can finish the job once it is past retention",
);
r = await rest(eve, "GET", "/passport_conferences");
check(rows(r).length === 0, "…everything about it is gone");

console.log(`\n${total - failures}/${total} as expected`);
process.exit(failures ? 1 : 0);
