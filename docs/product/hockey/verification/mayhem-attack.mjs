#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(`${process.env.STACK ?? "/tmp/hockey-stack"}/env`, "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const check = (ok, label) => {
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
  if (!body.access_token)
    throw new Error(`signup failed: ${JSON.stringify(body)}`);
  return { name, id: body.user.id, token: body.access_token };
}

/** PostgREST as somebody (or as nobody, with `who` null). */
async function rest(who, method, path, body, extra = {}) {
  const res = await fetch(`${URL_}/rest/v1${path}`, {
    method,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${who ? who.token : ANON}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...extra,
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


/**
 * **Attack Operation Mayhem's tables the way a hostile member would.**
 *
 * Straight at PostgREST and the RPCs with real GoTrue JWTs: challenges,
 * the jury, team reactions, the mission ledger and Chirp Bot's new keys.
 * Needs the local stack with mayhem-migration.sql (stack.mjs start).
 * Exits non-zero on any failure.
 */
const PROMPTS = [
  { id: "final-score", reveal: "onLock", lockOffsetMinutes: 0 },
  { id: "first-team", reveal: "onLock", lockOffsetMinutes: 0 },
  { id: "overtime", reveal: "onLock", lockOffsetMinutes: 0 },
];

async function createOccasion(host, startsAt, details = { opponent: "Wild" }) {
  const r = await rpc(host, "passport_create_occasion", {
    p_template: "sycle-hockey-night", p_title: "Sycle Hockey Night", p_starts_at: startsAt,
    p_details: details, p_display_name: host.name, p_emoji: "🧭", p_hue: 155, p_prompts: PROMPTS,
  });
  if (typeof r.body !== "string") throw new Error(`create failed: ${JSON.stringify(r.body)}`);
  return r.body;
}

async function join(host, occasionId, guest) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await rest(host, "POST", "/passport_occasion_invites", {
    occasion_id: occasionId, token_hash: hash, label: guest.name, max_uses: 1, created_by: host.id,
  });
  const r = await rpc(guest, "passport_redeem_occasion_invite", {
    p_token: token, p_display_name: guest.name, p_emoji: "🧭", p_hue: 10,
  });
  if (r.body !== occasionId) throw new Error(`join failed: ${JSON.stringify(r.body)}`);
}

const issue = (who, occ, kind, target, extra = {}) =>
  rpc(who, "passport_issue_challenge", {
    p_occasion: occ, p_kind: kind, p_target: target.id,
    p_market: extra.market ?? null, p_side: extra.side ?? null,
    p_taunt: extra.taunt ?? null, p_entry: extra.entry ?? null,
  });
const okId = (r) => r.status === 200 && typeof r.body === "string";
const refused = (r) => r.status >= 400;

const lorne = await signUp("Lorne");
const alex = await signUp("Alex");
const sam = await signUp("Sam");
const eve = await signUp("Eve"); // not on the night
const future = new Date(Date.now() + 2 * 86_400_000).toISOString();
const night = await createOccasion(lorne, future);
await join(lorne, night, alex);
await join(lorne, night, sam);

console.log("\n— issuing");
const bet = await issue(lorne, night, "bet", alex, { market: "winner", side: "away", taunt: "rumour" });
check(okId(bet), "a member bets another member");
const betId = bet.body;
const betRow = rows(await rest(alex, "GET", `/passport_occasion_challenges?id=eq.${betId}`))[0];
check(betRow?.challenger_id === lorne.id && betRow?.status === "open", "the challenger is the caller, and it starts open");
check(refused(await issue(lorne, night, "bet", alex, { market: "winner", side: "home" })), "the same bet twice is refused");
check(refused(await issue(lorne, night, "bet", lorne, { market: "winner", side: "home" })), "a bet against yourself is refused");
check(refused(await issue(lorne, night, "bet", alex, { market: "winner", side: "over" })), "a side that isn't the market's is refused");
check(refused(await issue(lorne, night, "bet", alex, { market: "goals", side: "over" })), "a bet on a question the night doesn't have is refused");
check(refused(await issue(eve, night, "bet", alex, { market: "winner", side: "home" })), "a non-member cannot issue");
check(refused(await issue(lorne, night, "defend", eve)), "a challenge to a non-member is refused");
check(refused(await issue(lorne, night, "prophecy", alex, { entry: "x" })), "a prophecy for somebody else is refused");
check(refused(await issue(lorne, night, "defend", lorne)), "volunteering without an entry is refused");
const vol = await issue(lorne, night, "defend", lorne, { entry: "1989 and 2004." });
const volRow = rows(await rest(sam, "GET", `/passport_occasion_challenges?id=eq.${vol.body}`))[0];
check(okId(vol) && volRow?.status === "accepted" && volRow?.entry === "1989 and 2004.", "volunteering starts accepted with your entry");
const sneaky = await issue(lorne, night, "defend", alex, { entry: "Alex says the Canucks are bad" });
const sneakyRow = rows(await rest(lorne, "GET", `/passport_occasion_challenges?id=eq.${sneaky.body}`))[0];
check(okId(sneaky) && sneakyRow?.entry === null, "a challenger cannot write the target's entry for them");

console.log("\n— nobody writes challenge rows by hand");
check(refused(await rest(sam, "POST", "/passport_occasion_challenges", { occasion_id: night, kind: "bet", challenger_id: sam.id, target_id: lorne.id, market: "winner", side: "away", status: "accepted" })), "INSERT refused");
const upd = await rest(alex, "PATCH", `/passport_occasion_challenges?id=eq.${betId}`, { status: "declined" });
check(refused(upd) || rows(upd).length === 0, "UPDATE refused (even the target's)");
const del = await rest(lorne, "DELETE", `/passport_occasion_challenges?id=eq.${betId}`);
check(refused(del) || rows(del).length === 0, "DELETE refused (even the challenger's)");
check(rows(await rest(eve, "GET", `/passport_occasion_challenges?occasion_id=eq.${night}`)).length === 0, "a non-member reads no challenges");

console.log("\n— answering");
check(refused(await rpc(sam, "passport_answer_challenge", { p_challenge: betId, p_answer: "accept" })), "a third member cannot accept for the target");
check(refused(await rpc(lorne, "passport_answer_challenge", { p_challenge: betId, p_answer: "accept" })), "the challenger cannot accept their own");
check(refused(await rpc(alex, "passport_answer_challenge", { p_challenge: betId, p_answer: "withdraw" })), "only the challenger withdraws");
check((await rpc(alex, "passport_answer_challenge", { p_challenge: betId, p_answer: "accept" })).body === "accepted", "the target accepts");
check(refused(await rpc(alex, "passport_answer_challenge", { p_challenge: betId, p_answer: "decline" })), "answered once, answered for good");
const dare = await issue(alex, night, "commentary", sam);
check((await rpc(sam, "passport_answer_challenge", { p_challenge: dare.body, p_answer: "decline" })).body === "declined", "the target passes");
check(rows(await rest(lorne, "GET", `/passport_occasion_challenges?id=eq.${dare.body}`)).length === 0, "a pass is invisible to everybody else");
check(rows(await rest(alex, "GET", `/passport_occasion_challenges?id=eq.${dare.body}`)).length === 1, "…but the challenger sees it");
check(refused(await issue(alex, night, "commentary", sam)), "a declined challenge cannot be re-thrown");

console.log("\n— performing");
check(refused(await rpc(sam, "passport_perform_challenge", { p_challenge: sneaky.body, p_entry: "not mine" })), "only the target performs");
check(refused(await rpc(alex, "passport_perform_challenge", { p_challenge: sneaky.body, p_entry: "before accepting" })), "not before accepting");
await rpc(alex, "passport_answer_challenge", { p_challenge: sneaky.body, p_answer: "accept" });
check((await rpc(alex, "passport_perform_challenge", { p_challenge: sneaky.body, p_entry: "The Canucks are fine." })).status === 204, "the target performs once accepted");
check(refused(await rpc(alex, "passport_perform_challenge", { p_challenge: sneaky.body, p_entry: "again" })), "once on the record, it stays");

console.log("\n— the jury");
check(refused(await rpc(alex, "passport_vote_challenge", { p_challenge: sneaky.body, p_verdict: true })), "the performer cannot judge themself");
check(refused(await rpc(lorne, "passport_vote_challenge", { p_challenge: betId, p_verdict: true })), "nobody votes on a bet");
check(refused(await rpc(eve, "passport_vote_challenge", { p_challenge: sneaky.body, p_verdict: true })), "a non-member cannot vote");
check(refused(await rest(sam, "POST", "/passport_occasion_challenge_votes", { challenge_id: sneaky.body, occasion_id: night, voter_id: lorne.id, verdict: false })), "no vote written by hand (as somebody else)");
check(refused(await rest(sam, "POST", "/passport_occasion_challenge_votes", { challenge_id: sneaky.body, occasion_id: night, voter_id: sam.id, verdict: true })), "no vote written by hand (as yourself)");
check((await rpc(lorne, "passport_vote_challenge", { p_challenge: sneaky.body, p_verdict: false })).status === 204, "a juror rules");
check((await rpc(lorne, "passport_vote_challenge", { p_challenge: sneaky.body, p_verdict: true })).status === 204, "…and may change their mind while it's open");
check((await rpc(sam, "passport_vote_challenge", { p_challenge: sneaky.body, p_verdict: true })).status === 204, "the last juror rules");
check(refused(await rpc(sam, "passport_vote_challenge", { p_challenge: sneaky.body, p_verdict: false })), "once everybody has ruled, it's closed");
const votes = rows(await rest(alex, "GET", `/passport_occasion_challenge_votes?challenge_id=eq.${sneaky.body}`));
check(votes.length === 2 && votes.every((v) => v.verdict === true), "every member reads the same two votes");
const oracle = await issue(sam, night, "prophecy", sam, { entry: "An own goal before the second intermission." });
check(okId(oracle), "a prophecy before puck drop");
check(refused(await rpc(lorne, "passport_vote_challenge", { p_challenge: oracle.body, p_verdict: true })), "a prophecy is not judged before the game");

console.log("\n— limits and puck drop");
const others = [];
for (const k of ["hottake", "defend"]) others.push(await issue(sam, night, k, lorne));
for (const k of ["hottake", "commentary"]) others.push(await issue(sam, night, k, alex));
for (const m of [["winner", "home"], ["first-goal", "home"], ["overtime", "yes"]]) others.push(await issue(sam, night, "bet", lorne, { market: m[0], side: m[1] }));
check(others.every(okId), "seven more from Sam go through (eight in all)");
check(refused(await issue(sam, night, "bet", alex, { market: "winner", side: "home" })), "the ninth is refused");
await rest(lorne, "PATCH", `/passport_occasions?id=eq.${night}`, { starts_at: new Date(Date.now() - 10 * 60_000).toISOString() });
check(refused(await issue(alex, night, "bet", lorne, { market: "overtime", side: "no" })), "no bets after puck drop");
check(refused(await rpc(lorne, "passport_answer_challenge", { p_challenge: others[4].body, p_answer: "accept" })), "no accepting a bet after puck drop");
check(refused(await issue(alex, night, "prophecy", alex, { entry: "late" })), "no prophecies after puck drop");
check((await rpc(lorne, "passport_vote_challenge", { p_challenge: oracle.body, p_verdict: true })).status === 204, "the prophecy jury opens at puck drop");
check(okId(await issue(alex, night, "hottake", alex, { entry: "Overtime should be a shootout." })), "performances still go during the game");
await rest(lorne, "PATCH", `/passport_occasions?id=eq.${night}`, { starts_at: new Date(Date.now() - 170 * 60_000).toISOString() });
check(refused(await issue(alex, night, "commentary", lorne)), "nothing new after the final horn");

console.log("\n— team reactions");
const tr = (who, to, emoji) => rest(who, "POST", "/passport_occasion_team_reactions", { occasion_id: night, from_id: who.id, to_id: to.id, emoji });
check((await tr(alex, lorne, "🤡")).status === 201, "a member reacts to another's team");
check(refused(await rest(sam, "POST", "/passport_occasion_team_reactions", { occasion_id: night, from_id: alex.id, to_id: lorne.id, emoji: "🫡" })), "not in somebody else's name");
check(refused(await tr(alex, alex, "🔥")), "not to yourself");
check(refused(await tr(alex, eve, "🔥")), "not to a non-member");
check(refused(await tr(sam, lorne, "💩")), "only the five reactions");
check(refused(await tr(eve, lorne, "🔥")), "not from a non-member");
const undo = await rest(sam, "DELETE", `/passport_occasion_team_reactions?from_id=eq.${alex.id}`);
check(rows(undo).length === 0 && rows(await rest(lorne, "GET", `/passport_occasion_team_reactions?occasion_id=eq.${night}`)).length === 1, "nobody deletes somebody else's");
check(rows(await rest(eve, "GET", `/passport_occasion_team_reactions?occasion_id=eq.${night}`)).length === 0, "a non-member reads none");

console.log("\n— the mission ledger");
const night2 = await createOccasion(lorne, future);
await join(lorne, night2, alex);
await join(lorne, night2, sam);
const mission = (asker, target, id, points = 20) =>
  rest(asker, "POST", "/passport_occasion_prompts", {
    occasion_id: night2, prompt_id: id, reveal: "onCue", audience_only: target.id, asked_by: asker.id,
    content: { question: "Did you pull it off?", kind: "boolean", phaseId: "before", reveal: "onCue", family: "mission", requiresConsent: true, scoring: { points } },
  });
const ledger = async (who) => rows(await rpc(who, "passport_occasion_mission_ledger", { p_occasion: night2 }));
check((await mission(alex, sam, "toy-mission-a")).status === 201, "Alex slips Sam a mission");
check((await mission(sam, sam, "toy-mission-self")).status === 201, "Sam slips themself one (allowed to write…)");
await rest(sam, "POST", "/passport_occasion_responses", { occasion_id: night2, prompt_id: "toy-mission-a", user_id: sam.id, value: true });
check((await ledger(lorne)).length === 0, "a claim alone is not in the ledger");
await rest(alex, "PATCH", `/passport_occasion_prompts?occasion_id=eq.${night2}&prompt_id=eq.toy-mission-a`, { resolution: true });
check((await ledger(lorne)).length === 0, "claim + confirmation without opting in is not in the ledger");
await rest(sam, "POST", "/passport_occasion_consents", { occasion_id: night2, prompt_id: "toy-mission-a", user_id: sam.id, agreed: true });
const l1 = await ledger(lorne);
check(l1.length === 1 && l1[0].earner === sam.id && l1[0].asked_by === alex.id, "opted in, claimed, confirmed by the mastermind: in the ledger");
check(JSON.stringify(l1).indexOf("Did you pull it off") < 0 && !("brief" in l1[0]), "the ledger says it happened, never what it was");
const forgedConfirm = await rest(sam, "PATCH", `/passport_occasion_prompts?occasion_id=eq.${night2}&prompt_id=eq.toy-mission-a`, { resolution: false });
check(refused(forgedConfirm) || rows(forgedConfirm).length === 0, "the target cannot change the mastermind's call");
await rest(sam, "POST", "/passport_occasion_consents", { occasion_id: night2, prompt_id: "toy-mission-self", user_id: sam.id, agreed: true });
await rest(sam, "POST", "/passport_occasion_responses", { occasion_id: night2, prompt_id: "toy-mission-self", user_id: sam.id, value: true });
await rest(sam, "PATCH", `/passport_occasion_prompts?occasion_id=eq.${night2}&prompt_id=eq.toy-mission-self`, { resolution: true });
check((await ledger(alex)).every((r) => r.prompt_id !== "toy-mission-self"), "a mission you set yourself never counts");
check((await ledger(eve)).length === 0, "a non-member reads an empty ledger");
const same = JSON.stringify(await ledger(lorne)) === JSON.stringify(await ledger(alex)) && JSON.stringify(await ledger(alex)) === JSON.stringify(await ledger(sam));
check(same, "every member reads the same ledger");

console.log("\n— Chirp Bot's new keys");
const fakeKey = (who, key) => rest(who, "POST", "/passport_occasion_moments", { occasion_id: night, actor_id: who.id, kind: "chirp", bot_key: key, bot_line: "tk.1" });
check(refused(await fakeKey(sam, `took:${alex.id}:${betId}`)), "nobody writes a 'took' line about somebody else");
check(refused(await fakeKey(sam, `chal:${lorne.id}:${betId}`)), "nobody writes a 'chal' line about somebody else");
check(refused(await fakeKey(sam, `oracle:${alex.id}:${oracle.body}`)), "nobody writes an 'oracle' line about somebody else");

console.log("\n— the host's games module");
const night3 = await createOccasion(lorne, future, { opponent: "Wild", modules: ["picks"] });
await join(lorne, night3, alex);
check(refused(await issue(lorne, night3, "defend", alex)), "no challenges when the host left the games out");

console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
