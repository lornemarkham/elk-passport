#!/usr/bin/env node
/**
 * **Attack the occasions migration the way a hostile member would.**
 *
 * Not through the app — straight at PostgREST, with real JWTs minted by a
 * real GoTrue for real sign-ups, because that is the authority a member has
 * in production: the anon key is public, and their own session token is in
 * their browser. Whatever this script cannot do, nobody can do by skipping
 * the Passport UI.
 *
 * Needs the local stack (stack.mjs start). Exits non-zero on any failure.
 */
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

const PROMPTS = [
  {
    id: "pregame-spot",
    reveal: "immediate",
    lockOffsetMinutes: -90,
    openToSuggestions: true,
  },
  { id: "final-score", reveal: "onLock", lockOffsetMinutes: 0 },
  { id: "story", reveal: "never", lockOffsetMinutes: null },
  { id: "vault", reveal: "onCue", lockOffsetMinutes: 100 },
];

async function createOccasion(host, startsAt) {
  const r = await rpc(host, "passport_create_occasion", {
    p_template: "sycle-hockey-night",
    p_title: "Sycle Hockey Night",
    p_starts_at: startsAt,
    p_details: { opponent: "Wild" },
    p_display_name: host.name,
    p_emoji: "🧭",
    p_hue: 155,
    p_prompts: PROMPTS,
  });
  return r.body;
}

async function invite(host, occasionId, maxUses = 1) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const r = await rest(host, "POST", "/passport_occasion_invites", {
    occasion_id: occasionId,
    token_hash: hash,
    label: "for a coworker",
    max_uses: maxUses,
    created_by: host.id,
  });
  return { token, status: r.status };
}

const join = (who, token) =>
  rpc(who, "passport_redeem_occasion_invite", {
    p_token: token,
    p_display_name: who?.name ?? "Anon",
    p_emoji: "🧭",
    p_hue: 250,
  });

const [lorne, nathan, stranger] = await Promise.all(
  ["Lorne", "Nathan", "Stranger"].map(signUp),
);
console.log("Three real GoTrue accounts signed up.\n");

const future = new Date(Date.now() + 14 * 864e5).toISOString();
const occ = await createOccasion(lorne, future);
check(
  typeof occ === "string" && occ.length === 36,
  "host creates an occasion through the RPC",
);

console.log("\nSigned-out visitors");
for (const table of [
  "passport_occasions",
  "passport_occasion_members",
  "passport_occasion_responses",
  "passport_occasion_moments",
  "passport_occasion_invites",
]) {
  const r = await rest(null, "GET", `/${table}?select=*`);
  check(
    rows(r).length === 0,
    `anon reads nothing from ${table} (status ${r.status})`,
  );
}
const anonCreate = await rpc(null, "passport_create_occasion", {
  p_template: "x",
  p_title: "x",
  p_starts_at: future,
  p_details: {},
  p_display_name: "x",
  p_emoji: "x",
  p_hue: 1,
  p_prompts: [],
});
check(
  anonCreate.status >= 400,
  `anon cannot create an occasion (status ${anonCreate.status})`,
);

const inv = await invite(lorne, occ);
check(inv.status === 201, "host creates an invite (stores only the hash)");
const described = await rpc(null, "passport_describe_occasion_invite", {
  p_token: inv.token,
});
check(
  described.body === true,
  "a signed-out visitor can learn the link is valid — and nothing else",
);
const anonJoin = await join(null, inv.token);
check(
  anonJoin.status >= 400,
  `invitation link cannot be redeemed without signing in (status ${anonJoin.status})`,
);

console.log("\nUninvited, signed-in");
for (const table of [
  "passport_occasions",
  "passport_occasion_members",
  "passport_occasion_prompts",
  "passport_occasion_invites",
]) {
  const r = await rest(
    stranger,
    "GET",
    `/${table}?occasion_id=eq.${occ}&select=*`.replace(
      "passport_occasions?occasion_id",
      "passport_occasions?id",
    ),
  );
  check(rows(r).length === 0, `stranger reads nothing from ${table}`);
}
const strangerSelfAdd = await rest(
  stranger,
  "POST",
  "/passport_occasion_members",
  {
    occasion_id: occ,
    user_id: stranger.id,
    role: "guest",
    display_name: "Totally Nathan",
  },
);
check(
  strangerSelfAdd.status >= 400,
  `stranger cannot insert themselves as a member (status ${strangerSelfAdd.status})`,
);
const strangerAnswer = await rest(
  stranger,
  "POST",
  "/passport_occasion_responses",
  {
    occasion_id: occ,
    prompt_id: "pregame-spot",
    user_id: stranger.id,
    value: "lions",
  },
);
check(strangerAnswer.status >= 400, "stranger cannot answer");
const strangerInvite = await invite(stranger, occ);
check(
  strangerInvite.status >= 400,
  "stranger cannot mint an invite to somebody else's occasion",
);
const forgedJoin = await join(stranger, randomBytes(32).toString("base64url"));
check(forgedJoin.body === null, "a guessed token joins nothing");

console.log("\nInvited guest");
const joined = await join(nathan, inv.token);
check(joined.body === occ, "Nathan signs in and redeems the invite");
const again = await join(stranger, inv.token);
check(
  again.body === null,
  "a single-use link that was forwarded does not admit a second person",
);
const rejoin = await join(nathan, inv.token);
check(rejoin.body === occ, "following your own link again is harmless");
const members = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_members?occasion_id=eq.${occ}&select=user_id,role`,
  ),
);
check(members.length === 2, "guest sees both members");
const guestInvites = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_invites?occasion_id=eq.${occ}&select=*`,
  ),
);
check(
  guestInvites.length === 0,
  "guest cannot see invitation tokens (even hashed)",
);
const promote = await rest(
  nathan,
  "PATCH",
  `/passport_occasion_members?occasion_id=eq.${occ}&user_id=eq.${nathan.id}`,
  { role: "host" },
);
check(
  promote.status >= 400,
  `guest cannot promote themselves to host (status ${promote.status})`,
);
const rename = await rest(
  nathan,
  "PATCH",
  `/passport_occasion_members?occasion_id=eq.${occ}&user_id=eq.${lorne.id}`,
  { display_name: "Loser" },
);
check(rows(rename).length === 0, "guest cannot rename the host");
const kickHost = await rest(
  nathan,
  "DELETE",
  `/passport_occasion_members?occasion_id=eq.${occ}&user_id=eq.${lorne.id}`,
);
check(rows(kickHost).length === 0, "guest cannot remove the host");

const looks = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_members?occasion_id=eq.${occ}&select=emoji`,
  ),
);
check(
  new Set(looks.map((m) => m.emoji)).size === looks.length,
  "nobody joins wearing somebody else's emoji",
);

console.log("\nImpersonation");
const asLorne = await rest(nathan, "POST", "/passport_occasion_responses", {
  occasion_id: occ,
  prompt_id: "pregame-spot",
  user_id: lorne.id,
  value: "concourse",
});
check(asLorne.status >= 400, "Nathan cannot vote as Lorne");
const sayAsLorne = await rest(nathan, "POST", "/passport_occasion_moments", {
  occasion_id: occ,
  actor_id: lorne.id,
  kind: "note",
  text: "I love the Flames",
});
check(sayAsLorne.status >= 400, "Nathan cannot post in Lorne's name");
const sayAsPassport = await rest(nathan, "POST", "/passport_occasion_moments", {
  occasion_id: occ,
  actor_id: nathan.id,
  kind: "voice",
  text: "Passport has ruled Nathan the winner.",
});
check(sayAsPassport.status >= 400, "Nathan cannot speak as Passport");
const fakeJoin = await rest(nathan, "POST", "/passport_occasion_moments", {
  occasion_id: occ,
  actor_id: nathan.id,
  kind: "join",
});
check(fakeJoin.status >= 400, "Nathan cannot forge a join");

console.log("\nSealed answers are sealed in the database");
await rest(lorne, "POST", "/passport_occasion_responses", {
  occasion_id: occ,
  prompt_id: "final-score",
  user_id: lorne.id,
  value: [4, 2],
});
await rest(lorne, "POST", "/passport_occasion_responses", {
  occasion_id: occ,
  prompt_id: "story",
  user_id: lorne.id,
  value: "I once ate a whole cake on a dare.",
});
await rest(lorne, "POST", "/passport_occasion_responses", {
  occasion_id: occ,
  prompt_id: "vault",
  user_id: lorne.id,
  value: "Dave, holding four beers",
});
const peek = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_responses?occasion_id=eq.${occ}&select=prompt_id,user_id,value`,
  ),
);
check(
  !peek.some((r) => r.prompt_id === "final-score"),
  "Nathan cannot see Lorne's sealed score pick before making his own",
);
check(
  !peek.some((r) => r.prompt_id === "story"),
  "a never-revealed answer is invisible to others",
);
check(
  !peek.some((r) => r.prompt_id === "vault"),
  "the vault is shut until somebody opens it",
);
await rest(nathan, "POST", "/passport_occasion_responses", {
  occasion_id: occ,
  prompt_id: "final-score",
  user_id: nathan.id,
  value: [3, 0],
});
const after = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_responses?occasion_id=eq.${occ}&prompt_id=eq.final-score&select=user_id`,
  ),
);
// night-migration.sql (2026-10-23): sealing your own opens nobody else's.
check(
  after.length === 1 && after[0].user_id === nathan.id,
  "Nathan seals his own pick and still cannot see Lorne's (sealed until puck drop)",
);
// Puck drop: the host moves the game into the past, and the picks lock.
const moved = await rest(lorne, "PATCH", `/passport_occasions?id=eq.${occ}`, {
  starts_at: new Date(Date.now() - 60_000).toISOString(),
});
const atLock = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_responses?occasion_id=eq.${occ}&prompt_id=eq.final-score&select=user_id`,
  ),
);
check(
  moved.status < 300 && atLock.length === 2,
  "once the picks lock, everybody sees every pick",
);
await rest(lorne, "PATCH", `/passport_occasions?id=eq.${occ}`, {
  starts_at: future,
});
await rest(nathan, "POST", "/passport_occasion_cues", {
  occasion_id: occ,
  prompt_id: "vault",
  cued_by: nathan.id,
});
const vault = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_responses?occasion_id=eq.${occ}&prompt_id=eq.vault&select=user_id`,
  ),
);
check(
  vault.length === 1,
  "once somebody opens the vault, everybody sees inside",
);
const lornesStory = rows(
  await rest(
    lorne,
    "GET",
    `/passport_occasion_responses?occasion_id=eq.${occ}&prompt_id=eq.story&select=value`,
  ),
);
check(lornesStory.length === 1, "your own private answer is still yours");

console.log("\nConcurrent votes");
const [maya] = await Promise.all([signUp("Maya")]);
const inv2 = await invite(lorne, occ, 1);
await join(maya, inv2.token);
const spots = ["lions", "tap", "chambar", "concourse"];
await Promise.all(
  Array.from({ length: 30 }, (_, i) => {
    const who = [lorne, nathan, maya][i % 3];
    return rest(
      who,
      "POST",
      "/passport_occasion_responses",
      {
        occasion_id: occ,
        prompt_id: "pregame-spot",
        user_id: who.id,
        value: spots[i % 4],
      },
      { prefer: "resolution=merge-duplicates,return=minimal" },
    );
  }),
);
const votes = rows(
  await rest(
    maya,
    "GET",
    `/passport_occasion_responses?occasion_id=eq.${occ}&prompt_id=eq.pregame-spot&select=user_id,value`,
  ),
);
check(
  votes.length === 3 && new Set(votes.map((v) => v.user_id)).size === 3,
  "30 concurrent votes from three people leave exactly one vote each, nobody overwritten",
);
await Promise.all(
  [lorne, nathan, maya].flatMap((who) =>
    Array.from({ length: 5 }, (_, i) =>
      rest(who, "POST", "/passport_occasion_moments", {
        occasion_id: occ,
        actor_id: who.id,
        kind: "note",
        text: `${who.name} #${i}`,
      }),
    ),
  ),
);
const notes = rows(
  await rest(
    nathan,
    "GET",
    `/passport_occasion_moments?occasion_id=eq.${occ}&kind=eq.note&select=text`,
  ),
);
check(
  notes.length === 15,
  "15 concurrent comments from three people all persist",
);

console.log("\nLocks");
const past = new Date(Date.now() - 3600e3).toISOString();
const started = await createOccasion(lorne, past);
const late = await rest(lorne, "POST", "/passport_occasion_responses", {
  occasion_id: started,
  prompt_id: "final-score",
  user_id: lorne.id,
  value: [9, 0],
});
check(
  late.status >= 400,
  "nobody — not even the host — can make a pick after puck drop",
);
const lateSuggest = await rest(lorne, "POST", "/passport_occasion_options", {
  occasion_id: started,
  prompt_id: "pregame-spot",
  label: "Too late",
  added_by: lorne.id,
});
check(lateSuggest.status >= 400, "suggestions close when the question locks");
const unknownPrompt = await rest(
  nathan,
  "POST",
  "/passport_occasion_responses",
  {
    occasion_id: occ,
    prompt_id: "made-up",
    user_id: nathan.id,
    value: 1,
  },
);
check(
  unknownPrompt.status >= 400,
  "cannot answer a question that does not exist",
);
const loosenRule = await rest(
  lorne,
  "PATCH",
  `/passport_occasion_prompts?occasion_id=eq.${started}&prompt_id=eq.final-score`,
  { lock_offset_minutes: null },
);
check(
  loosenRule.status >= 400,
  "a prompt's rules cannot be rewritten to unlock it",
);

console.log("\nRemoval");
const removed = await rest(
  lorne,
  "DELETE",
  `/passport_occasion_members?occasion_id=eq.${occ}&user_id=eq.${nathan.id}`,
);
check(rows(removed).length === 1, "host removes Nathan");
const lost = await Promise.all(
  [
    "passport_occasions?id",
    "passport_occasion_members?occasion_id",
    "passport_occasion_responses?occasion_id",
    "passport_occasion_moments?occasion_id",
  ].map((q) => rest(nathan, "GET", `/${q}=eq.${occ}&select=*`)),
);
check(
  lost.every((r) => rows(r).length === 0),
  "Nathan, removed, can read nothing — not even his own answers",
);
const ghost = await rest(nathan, "POST", "/passport_occasion_moments", {
  occasion_id: occ,
  actor_id: nathan.id,
  kind: "note",
  text: "still here",
});
check(ghost.status >= 400, "Nathan, removed, cannot post");
const reuse = await join(nathan, inv.token);
check(reuse.body === null, "Nathan's spent invite does not let him back in");
const revokeTest = await invite(lorne, occ, 5);
const invRow = rows(
  await rest(
    lorne,
    "GET",
    `/passport_occasion_invites?occasion_id=eq.${occ}&uses=eq.0&select=id`,
  ),
);
await rest(
  lorne,
  "PATCH",
  `/passport_occasion_invites?id=in.(${invRow.map((r) => r.id).join(",")})`,
  { revoked_at: new Date().toISOString() },
);
const revoked = await join(stranger, revokeTest.token);
check(revoked.body === null, "a revoked link admits nobody");
const forgeUses = await rest(
  lorne,
  "PATCH",
  `/passport_occasion_invites?occasion_id=eq.${occ}`,
  { uses: 0 },
);
check(forgeUses.status >= 400, "a spent link cannot be un-spent");

console.log("\nRedeeming at the same instant");
const racers = await Promise.all(
  ["Racer1", "Racer2", "Racer3", "Racer4"].map(signUp),
);
const raceOcc = await createOccasion(
  lorne,
  new Date(Date.now() + 86400000 * 3).toISOString(),
);
const raceInvite = await invite(lorne, raceOcc, 1);
const raced = await Promise.all(racers.map((r) => join(r, raceInvite.token)));
check(
  raced.filter((r) => r.body === raceOcc).length === 1,
  "one single-use link redeemed by four people at once admits exactly one",
);
const raceMembers = rows(
  await rest(
    lorne,
    "GET",
    `/passport_occasion_members?occasion_id=eq.${raceOcc}&role=eq.guest&select=user_id`,
  ),
);
check(raceMembers.length === 1, "and exactly one guest row exists");
const raceUses = rows(
  await rest(
    lorne,
    "GET",
    `/passport_occasion_invites?occasion_id=eq.${raceOcc}&select=uses`,
  ),
);
check(raceUses[0]?.uses === 1, "and the link records exactly one use");
const sameTwice = await Promise.all([
  join(racers[0], raceInvite.token),
  join(racers[0], raceInvite.token),
]);
check(
  sameTwice.every((r) => r.status < 400) &&
    rows(
      await rest(
        lorne,
        "GET",
        `/passport_occasion_members?occasion_id=eq.${raceOcc}&user_id=eq.${racers[0].id}&select=user_id`,
      ),
    ).length <= 1,
  "one person double-clicking a link never becomes two members",
);

console.log(
  failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
