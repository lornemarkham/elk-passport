#!/usr/bin/env node
/**
 * **Real-account isolation, checked against a live Supabase project.**
 *
 * For the release owner, AFTER boards-owner-claim-fix.sql (and, for the
 * adventures half, the adventures migration) has been applied. It talks to
 * the project exactly as a browser does: the public anon key and two people's
 * own sign-ins. No service key. It writes, as those two people, only rows it
 * then deletes:
 *
 *   boards      one owner row on a made-up board id (`prodcheck-…`), which
 *               belongs to no Atlas board and so reaches nothing
 *   adventures  one adventure of kind `day`, deleted at the end
 *
 * Two accounts made for this (not anybody's real one), already signed up:
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=… \
 *   CHECK_A_EMAIL=… CHECK_A_PASSWORD=… CHECK_B_EMAIL=… CHECK_B_PASSWORD=… \
 *   node docs/product/group-adventures/verification/prod-isolation.mjs --i-mean-production [--adventures]
 *
 * Exit 0 only if every check passed and cleanup succeeded.
 */
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--i-mean-production")) {
  console.error(
    "Refusing: this writes (and removes) rows in a real project. Pass --i-mean-production.",
  );
  process.exit(2);
}
const need = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "CHECK_A_EMAIL",
  "CHECK_A_PASSWORD",
  "CHECK_B_EMAIL",
  "CHECK_B_PASSWORD",
];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(2);
}
const E = process.env;
const client = () =>
  createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let failed = 0;
const check = (ok, what, detail = "") => {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  (${detail})` : ""}`,
  );
  if (!ok) failed++;
};
const refused = (r) =>
  r.error?.code === "42501" ||
  (Array.isArray(r.data) && r.data.length === 0 && !r.error);

async function signIn(email, password) {
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.user)
    throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { db, id: data.user.id };
}

const anon = client();
const a = await signIn(E.CHECK_A_EMAIL, E.CHECK_A_PASSWORD);
const b = await signIn(E.CHECK_B_EMAIL, E.CHECK_B_PASSWORD);
check(a.id !== b.id, "two distinct accounts");

// ---------------------------------------------------------------- boards
const board = `prodcheck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const fixLive = await a.db.rpc("passport_board_has_members", {
  p_board_id: board,
});
check(
  !fixLive.error && fixLive.data === false,
  "board fix is applied (passport_board_has_members exists)",
  fixLive.error?.message,
);
const anonHas = await anon.rpc("passport_board_has_members", {
  p_board_id: board,
});
check(!!anonHas.error, "signed-out visitors can't call it");

const own = await a.db.from("passport_board_members").insert({
  board_id: board,
  board_owner_id: a.id,
  user_id: a.id,
  role: "owner",
});
check(
  !own.error,
  "A writes the first owner row of a board (first share works)",
  own.error?.message,
);

try {
  const claim = await b.db.from("passport_board_members").insert({
    board_id: board,
    board_owner_id: b.id,
    user_id: b.id,
    role: "owner",
  });
  check(
    claim.error?.code === "42501",
    "B can't claim A's board (hole 1)",
    claim.error?.code ?? "ACCEPTED",
  );

  const seen = await b.db
    .from("passport_board_members")
    .select("user_id")
    .eq("board_id", board);
  check(
    !seen.error && (seen.data ?? []).length === 0,
    "B sees none of A's board members",
  );

  const forgedInvite = await b.db.from("passport_board_invites").insert({
    token: `prodcheck-${Math.random().toString(36).slice(2)}-xxxxxxxxxxxxxxxx`,
    board_id: board,
    board_owner_id: a.id,
    role: "editor",
    created_by: b.id,
  });
  check(
    forgedInvite.error?.code === "42501",
    "B can't mint an invite to A's board",
    forgedInvite.error?.code ?? "ACCEPTED",
  );

  const repoint = await a.db
    .from("passport_board_members")
    .update({ board_owner_id: b.id })
    .eq("board_id", board)
    .eq("user_id", a.id)
    .select();
  check(
    repoint.error?.code === "42501",
    "an owner can't name somebody else as owner (hole 2)",
    repoint.error?.code ?? "ACCEPTED",
  );

  const anonRead = await anon
    .from("passport_board_members")
    .select("board_id")
    .limit(1);
  check(
    refused(anonRead),
    "signed-out visitors read no board members",
    anonRead.error?.code ?? `${anonRead.data?.length} rows`,
  );
} finally {
  await a.db.from("passport_board_invites").delete().eq("board_id", board);
  await a.db.from("passport_board_members").delete().eq("board_id", board);
  const left = await a.db
    .from("passport_board_members")
    .select("user_id")
    .eq("board_id", board);
  check(
    !left.error && (left.data ?? []).length === 0,
    "cleanup: test board rows deleted",
    left.error?.message ?? `${left.data?.length} left`,
  );
}

// ------------------------------------------------------------ adventures
if (process.argv.includes("--adventures")) {
  const made = await a.db.rpc("passport_create_adventure", {
    p_kind: "day",
    p_title: "Isolation check (deleted automatically)",
  });
  check(
    !made.error && typeof made.data === "string",
    "A creates an adventure",
    made.error?.message,
  );
  const id = made.data;
  if (typeof id === "string") {
    try {
      for (const table of [
        "passport_adventures",
        "passport_adventure_members",
        "passport_adventure_items",
        "passport_adventure_responses",
      ]) {
        const col = table === "passport_adventures" ? "id" : "adventure_id";
        const r = await b.db.from(table).select(col).eq(col, id);
        check(
          !r.error && (r.data ?? []).length === 0,
          `B reads nothing of A's adventure in ${table}`,
          r.error?.code,
        );
      }
      const forge = await b.db
        .from("passport_adventure_items")
        .insert({ adventure_id: id, label: "forged" });
      check(
        forge.error?.code === "42501",
        "B can't add to A's plan",
        forge.error?.code ?? "ACCEPTED",
      );
      const join = await b.db
        .from("passport_adventure_members")
        .insert({ adventure_id: id, user_id: b.id, role: "owner" });
      check(
        !!join.error,
        "B can't write himself into A's adventure",
        join.error?.code ?? "ACCEPTED",
      );
      const anonRead = await anon
        .from("passport_adventures")
        .select("id")
        .limit(1);
      check(
        !!anonRead.error,
        "signed-out visitors are refused outright",
        anonRead.error?.code ?? "allowed",
      );
    } finally {
      const del = await a.db
        .from("passport_adventures")
        .delete()
        .eq("id", id)
        .select();
      check(
        !del.error && del.data?.length === 1,
        "cleanup: A's test adventure deleted",
        del.error?.message,
      );
    }
  }
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
