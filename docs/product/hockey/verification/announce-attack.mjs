#!/usr/bin/env node
/**
 * Announcements and replies, straight at PostgREST with real JWTs — what a
 * member with devtools could try (`announce-migration.sql` applied):
 *
 *   - a guest cannot insert kind 'announce'; the host can
 *   - an announcement needs a known tag, words, and a link that is https
 *     or Passport's own path; a plain line cannot carry a tag or a link
 *   - a reply must point at a moment on the same night, of a kind that
 *     can be answered; a reply across nights is refused
 *   - a non-member reads nothing; a ✅ (Got it!) is the person's own row
 *   - the host can delete an announcement; a guest cannot delete the host's
 *
 *   STACK=~/passport/scratch/hockey-stack node docs/product/hockey/verification/announce-attack.mjs
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
let checks = 0;
const check = (ok, label) => {
  checks++;
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

async function createOccasion(host, startsAt) {
  const r = await rpc(host, "passport_create_occasion", {
    p_template: "sycle-hockey-night",
    p_title: "Hockey Night",
    p_starts_at: startsAt,
    p_details: { opponent: "Wild" },
    p_display_name: host.name,
    p_emoji: "🧭",
    p_hue: 155,
    p_prompts: [{ id: "final-score", reveal: "onLock", lockOffsetMinutes: 0 }],
  });
  return r.body;
}
async function invite(host, occasionId) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await rest(host, "POST", "/passport_occasion_invites", {
    occasion_id: occasionId,
    token_hash: hash,
    label: "x",
    max_uses: 1,
    created_by: host.id,
  });
  return token;
}
const join = (who, token) =>
  rpc(who, "passport_redeem_occasion_invite", {
    p_token: token,
    p_display_name: who.name,
    p_emoji: "🧭",
    p_hue: 250,
  });

const [host, guest, other, stranger] = await Promise.all(
  ["Host", "Guest", "Other", "Stranger"].map(signUp),
);
const future = new Date(Date.now() + 7 * 864e5).toISOString();
const night = await createOccasion(host, future);
await join(guest, await invite(host, night));
const otherNight = await createOccasion(other, future);
check(
  typeof night === "string" && typeof otherNight === "string",
  "two nights exist",
);

const say = (who, occasion, extra) =>
  rest(who, "POST", "/passport_occasion_moments", {
    occasion_id: occasion,
    actor_id: who.id,
    kind: "note",
    text: "hi",
    ...extra,
  });
const announce = (who, occasion, extra = {}) =>
  rest(who, "POST", "/passport_occasion_moments", {
    occasion_id: occasion,
    actor_id: who.id,
    kind: "announce",
    tag: "venue",
    text: "Boston Pizza instead.",
    ...extra,
  });

console.log("\n-- who may announce");
let r = await announce(guest, night);
check(
  r.status === 403 || r.status === 401,
  `guest cannot announce (${r.status})`,
);
r = await announce(stranger, night);
check(r.status >= 400, `stranger cannot announce (${r.status})`);
r = await announce(host, night);
check(r.status === 201, `host can announce (${r.status})`);
const announcement = rows(r)[0]?.id;
r = await announce(guest, night, { actor_id: host.id });
check(
  r.status >= 400,
  `guest cannot announce in the host's name (${r.status})`,
);

console.log("\n-- what an announcement must be");
r = await announce(host, night, { tag: "panic" });
check(r.status >= 400, `unknown tag refused (${r.status})`);
r = await announce(host, night, { text: null });
check(r.status >= 400, `no words refused (${r.status})`);
r = await announce(host, night, { href: "javascript:alert(1)" });
check(r.status >= 400, `javascript: link refused (${r.status})`);
r = await announce(host, night, { href: "http://evil.test" });
check(r.status >= 400, `http: link refused (${r.status})`);
r = await announce(host, night, {
  href: "https://maps.apple.com/?q=Boston+Pizza",
});
check(r.status === 201, `https link accepted (${r.status})`);
r = await announce(host, night, { href: "/passport/abc" });
check(r.status === 201, `Passport path accepted (${r.status})`);
r = await announce(host, night, { text: "x".repeat(501) });
check(r.status >= 400, `501 characters refused (${r.status})`);
r = await say(host, night, { tag: "venue" });
check(r.status >= 400, `a plain line cannot carry a tag (${r.status})`);
r = await say(host, night, { href: "https://x.test" });
check(r.status >= 400, `a plain line cannot carry a link (${r.status})`);
r = await announce(host, night, { reply_to: announcement });
check(r.status >= 400, `an announcement is not a reply (${r.status})`);

console.log("\n-- replies");
r = await say(guest, night, { text: "Who's bringing the flag?" });
check(r.status === 201, `guest says a line (${r.status})`);
const line = rows(r)[0]?.id;
r = await say(host, night, { text: "Me.", reply_to: line });
check(
  r.status === 201 && rows(r)[0]?.reply_to === line,
  `host replies to it (${r.status})`,
);
r = await say(guest, night, { text: "Got it", reply_to: announcement });
check(r.status === 201, `a reply to an announcement is allowed (${r.status})`);
r = await say(other, otherNight, { text: "hi", reply_to: line });
check(r.status >= 400, `a reply across nights is refused (${r.status})`);
r = await say(host, night, {
  text: "hi",
  reply_to: "00000000-0000-4000-8000-000000000000",
});
check(r.status >= 400, `a reply to nothing is refused (${r.status})`);
const joinRow = rows(
  await rest(
    host,
    "GET",
    `/passport_occasion_moments?occasion_id=eq.${night}&kind=eq.join&select=id`,
  ),
)[0];
if (joinRow) {
  r = await say(host, night, { text: "hi", reply_to: joinRow.id });
  check(r.status >= 400, `a reply to a join line is refused (${r.status})`);
}

console.log("\n-- reading and Got it!");
r = await rest(
  stranger,
  "GET",
  `/passport_occasion_moments?occasion_id=eq.${night}&select=id`,
);
check(rows(r).length === 0, "stranger reads nothing");
r = await rest(
  other,
  "GET",
  `/passport_occasion_moments?occasion_id=eq.${night}&kind=eq.announce&select=id`,
);
check(rows(r).length === 0, "another night's host reads nothing");
r = await rest(
  guest,
  "GET",
  `/passport_occasion_moments?occasion_id=eq.${night}&kind=eq.announce&select=id,tag,href`,
);
check(
  rows(r).length === 3,
  `guest reads the host's announcements (${rows(r).length})`,
);
r = await rest(guest, "POST", "/passport_occasion_reactions", {
  occasion_id: night,
  moment_id: announcement,
  emoji: "✅",
  user_id: guest.id,
});
check(r.status === 201, `guest's Got it! is a ✅ of their own (${r.status})`);
r = await rest(guest, "POST", "/passport_occasion_reactions", {
  occasion_id: night,
  moment_id: announcement,
  emoji: "✅",
  user_id: host.id,
});
check(r.status >= 400, `guest cannot Got it! for the host (${r.status})`);
r = await rest(stranger, "POST", "/passport_occasion_reactions", {
  occasion_id: night,
  moment_id: announcement,
  emoji: "✅",
  user_id: stranger.id,
});
check(r.status >= 400, `stranger cannot Got it! (${r.status})`);

console.log("\n-- taking it down");
r = await rest(
  guest,
  "DELETE",
  `/passport_occasion_moments?id=eq.${announcement}`,
);
check(rows(r).length === 0, "guest cannot take the host's announcement down");
r = await rest(
  host,
  "DELETE",
  `/passport_occasion_moments?id=eq.${announcement}`,
);
check(rows(r).length === 1, "host takes it down");
r = await rest(
  guest,
  "GET",
  `/passport_occasion_reactions?moment_id=eq.${announcement}&select=emoji`,
);
check(rows(r).length === 0, "its Got it!s went with it");

console.log(
  `\n${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ""}`,
);
process.exit(failures ? 1 : 0);
