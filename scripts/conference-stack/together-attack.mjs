#!/usr/bin/env node
/**
 * **Attack the Conference-together migration the way a hostile colleague
 * would**: plans, invitations, RSVPs, votes, chat, shared locations and
 * photos, straight at PostgREST with real JWTs from a real GoTrue. Whatever
 * this cannot do, nobody can do by skipping the Passport UI.
 *
 * Needs the local stack with every migration in supabase/migrations:
 * `STACK=... node scripts/conference-stack/stack.mjs start`. Exits non-zero
 * on any failure.
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
  name: "Together Attack",
  kind: "conference",
  place: { label: "Vancouver" },
  timeZone: "America/Vancouver",
  startsOn: "2026-10-24",
  branding: { accent: "#e11d48" },
  modules: ["plans", "community", "people", "memories"],
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
const see = (who, conf, name) =>
  rest(
    who,
    "PATCH",
    `/passport_conference_members?conference_id=eq.${conf}&user_id=eq.${who.id}`,
    name
      ? { visibility: "members", display_name: name }
      : { visibility: "hidden", display_name: null },
  );
const count = async (who, table, filter) =>
  rows(await rest(who, "GET", `/${table}?${filter}`)).length;
const JPEG = `/9j/${"A".repeat(200)}`;
const soon = (min) => new Date(Date.now() + min * 60_000).toISOString();

const C = await found(alice);
const aliceM = C.member;
const bobM = await join(bob, C);
const carolM = await join(carol, C);
const O = await found(eve);
await see(alice, C.id, "Alice");
await see(bob, C.id, "Bob");
// Carol stays hidden. Mallory is signed in and in nothing.

console.log("plans");
const P = token(12);
let r = await rest(bob, "POST", "/passport_conference_plans", {
  id: P, conference_id: C.id, organiser_id: bobM, kind: "morning-walk",
  title: "Walk", audience: "everyone",
});
check(r.status < 300, "a member makes a plan as themselves");
r = await rest(bob, "POST", "/passport_conference_plans", {
  id: token(12), conference_id: C.id, organiser_id: carolM, kind: "lunch",
  title: "In Carol's name", audience: "everyone",
});
check(r.status >= 400, "…but not in somebody else's name");
r = await rest(mallory, "POST", "/passport_conference_plans", {
  id: token(12), conference_id: C.id, organiser_id: token(9), kind: "lunch",
  title: "Gatecrash", audience: "everyone",
});
check(r.status >= 400, "an outsider cannot make a plan in it");
check((await count(mallory, "passport_conference_plans", `conference_id=eq.${C.id}`)) === 0, "an outsider reads no plans");
check((await count(null, "passport_conference_plans", `conference_id=eq.${C.id}`)) === 0, "signed out reads no plans");
check((await count(eve, "passport_conference_plans", `conference_id=eq.${C.id}`)) === 0, "another conference's organiser reads none");

const S = token(12);
r = await rest(bob, "POST", "/passport_conference_plans", {
  id: S, conference_id: C.id, organiser_id: bobM, kind: "lunch",
  title: "Just Bob and Alice", audience: "selected",
});
r = await rest(bob, "POST", "/passport_conference_plan_invites", {
  plan_id: S, conference_id: C.id, member_id: aliceM,
});
check(r.status < 300, "the organiser of a plan invites a coworker");
check((await count(alice, "passport_conference_plans", `id=eq.${S}`)) === 1, "the invitee sees the private plan");
check((await count(carol, "passport_conference_plans", `id=eq.${S}`)) === 0, "a member not invited does not");
r = await rest(carol, "POST", "/passport_conference_plan_invites", {
  plan_id: S, conference_id: C.id, member_id: carolM,
});
check(r.status >= 400, "…and cannot invite herself");
r = await rest(bob, "POST", "/passport_conference_plan_invites", {
  plan_id: S, conference_id: O.id, member_id: O.member,
});
check(r.status >= 400, "a plan cannot invite someone from another conference");

r = await rest(carol, "PATCH", `/passport_conference_plans?id=eq.${P}`, { title: "Hijacked" });
check(denied(r), "a member cannot edit somebody else's plan");
r = await rest(alice, "PATCH", `/passport_conference_plans?id=eq.${P}`, { title: "Walk (moved)" });
check(rows(r).length === 1, "a conference organiser can");
r = await rest(bob, "PATCH", `/passport_conference_plans?id=eq.${P}`, { organiser_user: carol.id });
check(r.status >= 400, "nobody can hand a plan to someone else by writing its owner");
r = await rest(carol, "DELETE", `/passport_conference_plans?id=eq.${P}`);
check(denied(r), "a member cannot cancel somebody else's plan");

const occP = token(9);
const occS = token(9);
r = await rest(bob, "POST", "/passport_conference_plan_occurrences", { id: occP, plan_id: P, conference_id: C.id, starts_at: soon(600) });
check(r.status < 300, "the organiser adds an occurrence");
await rest(bob, "POST", "/passport_conference_plan_occurrences", { id: occS, plan_id: S, conference_id: C.id, starts_at: soon(700) });
r = await rest(carol, "POST", "/passport_conference_plan_occurrences", { id: token(9), plan_id: P, conference_id: C.id, starts_at: soon(800) });
check(r.status >= 400, "a member cannot add days to somebody else's plan");

console.log("rsvps");
const rsvp = (who, member, occ, plan, answer = "in", conf = C.id) =>
  rest(who, "POST", "/passport_conference_rsvps", {
    occurrence_id: occ, plan_id: plan, conference_id: conf, member_id: member, answer,
  });
r = await rsvp(carol, carolM, occP, P);
check(r.status < 300, "a hidden member answers for herself");
r = await rsvp(carol, bobM, occP, P, "out");
check(r.status >= 400, "…but not for Bob");
r = await rsvp(carol, carolM, occS, S);
check(r.status >= 400, "…nor on a plan she can't see");
r = await rsvp(carol, carolM, occS, P);
check(r.status >= 400, "…nor with another plan's occurrence");
r = await rsvp(mallory, token(9), occP, P);
check(r.status >= 400, "an outsider cannot answer");
r = await rsvp(bob, bobM, occP, P);
r = await rest(carol, "PATCH", `/passport_conference_rsvps?occurrence_id=eq.${occP}&user_id=eq.${bob.id}`, { answer: "out" });
check(denied(r), "nobody changes somebody else's answer");
r = await rest(carol, "PATCH", `/passport_conference_rsvps?occurrence_id=eq.${occP}&user_id=eq.${carol.id}`, { member_id: bobM });
check(r.status >= 400 || rows(r).length === 0, "…or passes their answer off as somebody else's");
r = await rest(carol, "DELETE", `/passport_conference_rsvps?occurrence_id=eq.${occP}&user_id=eq.${bob.id}`);
check(denied(r), "…or deletes it");
check((await count(carol, "passport_conference_rsvps", `occurrence_id=eq.${occS}`)) === 0, "answers on a private plan are private");

console.log("votes");
const optP = token(9);
const optS = token(9);
r = await rest(carol, "POST", "/passport_conference_plan_options", { id: optP, plan_id: P, conference_id: C.id, member_id: carolM, place_id: "curated:vancouver:chambar", name: "Chambar" });
check(r.status < 300, "a member suggests a place");
await rest(bob, "POST", "/passport_conference_plan_options", { id: optS, plan_id: S, conference_id: C.id, member_id: bobM, place_id: "curated:vancouver:miku", name: "Miku" });
r = await rest(carol, "POST", "/passport_conference_plan_options", { id: token(9), plan_id: S, conference_id: C.id, member_id: carolM, place_id: "x", name: "x" });
check(r.status >= 400, "…not on a plan she can't see");
r = await rest(carol, "POST", "/passport_conference_plan_votes", { plan_id: P, option_id: optP, conference_id: C.id, member_id: carolM });
check(r.status < 300, "a member votes");
r = await rest(bob, "POST", "/passport_conference_plan_votes", { plan_id: P, option_id: optS, conference_id: C.id, member_id: bobM });
check(r.status >= 400, "a vote must be for one of the plan's own places");
r = await rest(carol, "POST", "/passport_conference_plan_votes", { plan_id: P, option_id: optP, conference_id: C.id, member_id: carolM });
check(r.status >= 400, "one vote per person per plan");

console.log("chat");
const say = (who, member, body, plan = null, id = token(9)) =>
  rest(who, "POST", "/passport_conference_messages", { id, conference_id: C.id, member_id: member, plan_id: plan, body });
r = await say(carol, carolM, "psst");
check(r.status >= 400, "a hidden member cannot post");
const m1 = token(9);
r = await say(bob, bobM, "Coffee?", null, m1);
check(r.status < 300, "a seen member posts");
r = await say(bob, aliceM, "I'm Alice");
check(r.status >= 400, "…but not as someone else");
const mS = token(9);
r = await say(bob, bobM, "Table for two", S, mS);
check(r.status < 300, "the plan's thread takes its members' messages");
check((await count(carol, "passport_conference_messages", `id=eq.${mS}`)) === 0, "a private plan's thread is unreadable to others");
check((await count(carol, "passport_conference_messages", `id=eq.${m1}`)) === 1, "the room is readable to every member, hidden too");
check((await count(mallory, "passport_conference_messages", `conference_id=eq.${C.id}`)) === 0, "an outsider reads no chat");
r = await rest(carol, "POST", "/passport_conference_message_reactions", { message_id: mS, conference_id: C.id, member_id: carolM, emoji: "🔥" });
check(r.status >= 400, "no reacting to a thread you can't read");
r = await rest(eve, "POST", "/passport_conference_message_reactions", { message_id: m1, conference_id: O.id, member_id: O.member, emoji: "🔥" });
check(r.status >= 400, "no reacting across conferences");
r = await rest(carol, "POST", "/passport_conference_message_reactions", { message_id: m1, conference_id: C.id, member_id: carolM, emoji: "💩" });
check(r.status >= 400, "only the offered reactions");
r = await rest(carol, "DELETE", `/passport_conference_messages?id=eq.${m1}`);
check(denied(r), "a member cannot delete somebody else's message");
// A plan only Bob is in: the conference organiser is not invited.
const S2 = token(12);
await rest(bob, "POST", "/passport_conference_plans", {
  id: S2, conference_id: C.id, organiser_id: bobM, kind: "custom",
  title: "Bob alone", audience: "selected",
});
const mS2 = token(9);
await say(bob, bobM, "note to self", S2, mS2);
r = await rest(alice, "DELETE", `/passport_conference_messages?id=eq.${mS2}`);
check(denied(r), "an organiser can't take down a thread message she can't see");
const m2 = token(9);
await say(bob, bobM, "regrettable", null, m2);
r = await rest(alice, "DELETE", `/passport_conference_messages?id=eq.${m2}`);
check(rows(r).length === 1, "…but moderates the room");

console.log("find my people");
const share = (who, member, expires, extra = {}) =>
  rest(who, "POST", "/passport_conference_locations", { conference_id: C.id, member_id: member, lat: 49.2888, lon: -123.1166, expires_at: expires, ...extra });
r = await share(carol, carolM, soon(30));
check(r.status >= 400, "a hidden member cannot share where she is");
r = await share(bob, bobM, soon(5 * 60));
check(r.status >= 400, "no share longer than four hours");
r = await share(bob, bobM, soon(-1));
check(r.status >= 400, "no share that has already ended");
r = await share(bob, aliceM, soon(30));
check(r.status >= 400, "no sharing as somebody else");
r = await share(bob, bobM, soon(30));
check(r.status < 300, "a seen member shares for 30 minutes");
check((await count(alice, "passport_conference_locations", `conference_id=eq.${C.id}`)) === 1, "coworkers see it");
check((await count(mallory, "passport_conference_locations", `conference_id=eq.${C.id}`)) === 0, "outsiders do not");
check((await count(null, "passport_conference_locations", `conference_id=eq.${C.id}`)) === 0, "signed out does not");
r = await rest(bob, "PATCH", `/passport_conference_locations?user_id=eq.${bob.id}`, { expires_at: soon(10 * 60) });
check(r.status >= 400 || rows(r).length === 0, "a share cannot be stretched past four hours");
r = await rest(carol, "DELETE", `/passport_conference_locations?user_id=eq.${bob.id}`);
check(denied(r), "nobody else can stop (or erase) your share");
await see(bob, C.id, null);
check((await count(alice, "passport_conference_locations", `conference_id=eq.${C.id}`)) === 0, "going hidden takes you off the map at once");
await see(bob, C.id, "Bob");
r = await rest(bob, "DELETE", `/passport_conference_locations?user_id=eq.${bob.id}`);
check(rows(r).length === 1, "stopping deletes the row");
r = await share(bob, bobM, soon(0.03));
await new Promise((res) => setTimeout(res, 2500));
check((await count(alice, "passport_conference_locations", `conference_id=eq.${C.id}`)) === 0, "an expired share is unreadable");
r = await rpc(alice, "passport_conference_locations_purge", {});
check(r.status < 300, "anyone signed in can sweep expired shares");
check((await count(bob, "passport_conference_locations", `user_id=eq.${bob.id}`)) === 0, "…and they are gone, even for their owner");
r = await rpc(null, "passport_conference_locations_purge", {});
check(r.status >= 400, "signed out cannot call it");

console.log("memories");
const photo = (who, member, plan = null, id = token(9)) =>
  rest(who, "POST", "/passport_conference_photos", { id, conference_id: C.id, member_id: member, plan_id: plan, caption: "x", data: JPEG });
r = await photo(carol, carolM);
check(r.status >= 400, "a hidden member cannot add photos");
const ph = token(9);
r = await photo(bob, bobM, null, ph);
check(r.status < 300, "a seen member adds one");
const phS = token(9);
r = await photo(bob, bobM, S, phS);
check(r.status < 300, "…and one from the private lunch");
check((await count(carol, "passport_conference_photos", `id=eq.${ph}`)) === 1, "the album is every member's");
check((await count(carol, "passport_conference_photos", `id=eq.${phS}`)) === 0, "a private plan's photo is only for its people");
check((await count(mallory, "passport_conference_photos", `conference_id=eq.${C.id}`)) === 0, "outsiders see no photos");
r = await rest(carol, "POST", "/passport_conference_photo_reactions", { photo_id: phS, conference_id: C.id, member_id: carolM, emoji: "❤️" });
check(r.status >= 400, "no reacting to a photo you can't see");
r = await rest(carol, "DELETE", `/passport_conference_photos?id=eq.${ph}`);
check(denied(r), "a member cannot delete somebody else's photo");
r = await rest(bob, "PATCH", `/passport_conference_photos?id=eq.${ph}`, { caption: "edited" });
check(r.status >= 400 || rows(r).length === 0, "photos aren't rewritten after the fact");
const phS2 = token(9);
await photo(bob, bobM, S2, phS2);
r = await rest(alice, "DELETE", `/passport_conference_photos?id=eq.${phS2}`);
check(rows(r).length === 0, "an organiser can't take down a photo she can't see");
r = await rest(alice, "DELETE", `/passport_conference_photos?id=eq.${ph}`);
check(rows(r).length === 1, "…but can take down one in the album");

console.log("leaving");
r = await rest(bob, "DELETE", `/passport_conference_members?conference_id=eq.${C.id}&user_id=eq.${bob.id}`);
check(rows(r).length === 1, "Bob leaves");
check((await count(alice, "passport_conference_plans", `conference_id=eq.${C.id}`)) === 0, "his plans go with him");
check((await count(alice, "passport_conference_messages", `conference_id=eq.${C.id}`)) === 0, "…his messages");
check((await count(alice, "passport_conference_photos", `conference_id=eq.${C.id}`)) === 0, "…his photos");
check((await count(carol, "passport_conference_rsvps", `conference_id=eq.${C.id}`)) === 0, "…and every answer to his plans");

console.log(`\n${total - failures}/${total} passed`);
process.exit(failures ? 1 : 0);
