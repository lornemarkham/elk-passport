#!/usr/bin/env node
/**
 * **Attack Our Seats the way a hostile member would** — straight at
 * PostgREST with real GoTrue sessions, as `rls-attack.mjs` does for the
 * rest of the night. Whatever this script cannot do, nobody can do by
 * skipping the Passport UI.
 *
 * Needs the local stack with the seats migration (stack.mjs start; the
 * default). Exits non-zero on any failure.
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
    body: JSON.stringify({ email, password: "correct-horse-battery-9" }),
  });
  const body = await res.json();
  if (!body.access_token)
    throw new Error(`signup failed: ${JSON.stringify(body)}`);
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
const rows = (r) => (Array.isArray(r.body) ? r.body : []);
const refused = (r) => r.status >= 400 || rows(r).length === 0;

const rpc = (who, fn, args) => rest(who, "POST", `/rpc/${fn}`, args);

async function night(host) {
  const r = await rpc(host, "passport_create_occasion", {
    p_template: "sycle-hockey-night",
    p_title: "Sycle Hockey Night",
    p_starts_at: new Date(Date.now() + 7 * 864e5).toISOString(),
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

const seat = (occ, who, by, extra = {}) => ({
  occasion_id: occ,
  user_id: who,
  section: "309",
  row_label: "12",
  seats: "3",
  updated_by: by,
  ...extra,
});
const T = "/passport_occasion_seats";

const [host, ana, bo, stranger] = await Promise.all(
  ["Host", "Ana", "Bo", "Stranger"].map(signUp),
);
const occ = await night(host);
check(typeof occ === "string", "host starts a night");
check(await bringIn(host, occ, ana), "Ana joins");
check(await bringIn(host, occ, bo), "Bo joins");

console.log("\nSigned out");
check(refused(await rest(null, "GET", `${T}?select=*`)), "anon reads no seats");
check(
  refused(await rest(null, "POST", T, seat(occ, null, null))),
  "anon writes no seats",
);

console.log("\nA guest and their own seat");
const anaSeat = await rest(ana, "POST", T, seat(occ, ana.id, ana.id));
check(anaSeat.status === 201, `Ana adds her own seat (${anaSeat.status})`);
const anaEdit = await rest(
  ana,
  "PATCH",
  `${T}?occasion_id=eq.${occ}&user_id=eq.${ana.id}`,
  { seats: "3-4", gate: "10", updated_by: ana.id },
);
check(rows(anaEdit).length === 1, "Ana edits her own seat");
check(
  refused(
    await rest(ana, "POST", T, seat(occ, ana.id, ana.id, { section: "101" })),
  ),
  "Ana cannot add a second row for herself",
);

console.log("\nA guest and somebody else's seat");
check(
  refused(await rest(ana, "POST", T, seat(occ, bo.id, ana.id))),
  "Ana cannot add a seat for Bo",
);
check(
  refused(await rest(ana, "POST", T, seat(occ, null, ana.id))),
  "Ana cannot set the group block",
);
const boSeat = await rest(bo, "POST", T, seat(occ, bo.id, bo.id));
check(boSeat.status === 201, "Bo adds his own seat");
check(
  refused(
    await rest(ana, "PATCH", `${T}?user_id=eq.${bo.id}`, {
      section: "101",
      updated_by: ana.id,
    }),
  ),
  "Ana cannot change Bo's seat",
);
check(
  refused(await rest(ana, "DELETE", `${T}?user_id=eq.${bo.id}`)),
  "Ana cannot clear Bo's seat",
);
check(
  refused(
    await rest(ana, "PATCH", `${T}?user_id=eq.${ana.id}`, {
      section: "101",
      updated_by: bo.id,
    }),
  ),
  "Ana cannot sign her edit as Bo",
);
check(
  refused(
    await rest(bo, "POST", T, {
      ...seat(occ, bo.id, ana.id),
    }),
  ),
  "Bo cannot write a row stamped as Ana",
);
const rehome = await rest(ana, "PATCH", `${T}?user_id=eq.${ana.id}`, {
  user_id: bo.id,
});
check(
  rehome.status >= 400,
  `Ana cannot move her row to Bo (column not granted, ${rehome.status})`,
);
const occ2 = await night(stranger);
const rehomeNight = await rest(ana, "PATCH", `${T}?user_id=eq.${ana.id}`, {
  occasion_id: occ2,
});
check(
  rehomeNight.status >= 400,
  `Ana cannot move her row to another night (${rehomeNight.status})`,
);

console.log("\nSharing");
const boReads = await rest(bo, "GET", `${T}?occasion_id=eq.${occ}&select=*`);
check(
  rows(boReads).some((r) => r.user_id === ana.id),
  "Bo reads Ana's shared seat",
);
await rest(ana, "PATCH", `${T}?user_id=eq.${ana.id}`, {
  shared: false,
  updated_by: ana.id,
});
check(
  !rows(await rest(bo, "GET", `${T}?occasion_id=eq.${occ}&select=*`)).some(
    (r) => r.user_id === ana.id,
  ),
  "Bo cannot read Ana's seat once she stops sharing it",
);
check(
  rows(await rest(host, "GET", `${T}?occasion_id=eq.${occ}&select=*`)).some(
    (r) => r.user_id === ana.id,
  ),
  "the host still reads it",
);
check(
  rows(await rest(ana, "GET", `${T}?occasion_id=eq.${occ}&select=*`)).some(
    (r) => r.user_id === ana.id,
  ),
  "Ana still reads it",
);

console.log("\nThe host");
const block = await rest(
  host,
  "POST",
  T,
  seat(occ, null, host.id, { seats: "1-8" }),
);
check(block.status === 201, "host sets the group block");
check(
  rows(await rest(bo, "GET", `${T}?occasion_id=eq.${occ}&user_id=is.null`))
    .length === 1,
  "a guest reads the group block",
);
const dupBlock = await rest(host, "POST", T, seat(occ, null, host.id));
check(
  dupBlock.status === 409,
  `there is only one group block (${dupBlock.status})`,
);
const hostEdit = await rest(
  host,
  "PATCH",
  `${T}?occasion_id=eq.${occ}&user_id=eq.${bo.id}`,
  { seats: "5", updated_by: host.id },
);
check(rows(hostEdit).length === 1, "host edits Bo's seat");
await rest(bo, "DELETE", `${T}?user_id=eq.${bo.id}`);
const hostAdds = await rest(host, "POST", T, seat(occ, bo.id, host.id));
check(hostAdds.status === 201, "host adds a seat for Bo");
check(
  refused(await rest(host, "POST", T, seat(occ, stranger.id, host.id))),
  "host cannot add a seat for someone not on the night",
);

console.log("\nStrangers and other nights");
check(
  rows(await rest(stranger, "GET", `${T}?occasion_id=eq.${occ}&select=*`))
    .length === 0,
  "a stranger reads no seats",
);
check(
  refused(await rest(stranger, "POST", T, seat(occ, stranger.id, stranger.id))),
  "a stranger cannot add themselves a seat",
);
check(
  refused(await rest(ana, "POST", T, seat(occ2, ana.id, ana.id))),
  "Ana cannot add a seat on a night she isn't on",
);
check(
  refused(
    await rest(stranger, "PATCH", `${T}?occasion_id=eq.${occ}`, {
      section: "999",
      updated_by: stranger.id,
    }),
  ),
  "the other night's host cannot touch this night's seats",
);

console.log("\nMeeting point (in the night's details)");
check(
  refused(
    await rest(ana, "PATCH", `/passport_occasions?id=eq.${occ}`, {
      details: { meetup: { gate: "10" } },
    }),
  ),
  "a guest cannot set the meeting point",
);
const hostMeet = await rest(host, "PATCH", `/passport_occasions?id=eq.${occ}`, {
  details: { opponent: "Wild", meetup: { gate: "10", time: "18:15" } },
});
check(rows(hostMeet).length === 1, "the host sets the meeting point");

console.log("\nRemoval");
await rest(
  host,
  "DELETE",
  `/passport_occasion_members?occasion_id=eq.${occ}&user_id=eq.${bo.id}`,
);
check(
  rows(await rest(bo, "GET", `${T}?occasion_id=eq.${occ}&select=*`)).length ===
    0,
  "a removed guest reads no seats, not even their own",
);
check(
  refused(
    await rest(bo, "PATCH", `${T}?user_id=eq.${bo.id}`, {
      section: "101",
      updated_by: bo.id,
    }),
  ),
  "a removed guest cannot change their old seat",
);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
