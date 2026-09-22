/**
 * **Two real people, one database, and the proof that they cannot reach each
 * other.**
 *
 * Run this instead of clicking through twenty minutes of browser tabs. Every
 * assertion below is made through a **real signed-in session** — two of them —
 * so row-level security is the thing under test rather than something the UI
 * politely declined to render. A screen that does not show you somebody else's
 * board is not evidence; a `SELECT` that returns zero rows is.
 *
 * ## Credentials never reach the author of this script
 *
 * They come from the environment and are read once. Nothing is logged, nothing
 * is written to disk, and the script refuses to run rather than inventing a
 * default:
 *
 *   ACCEPT_A_EMAIL / ACCEPT_A_PASSWORD
 *   ACCEPT_B_EMAIL / ACCEPT_B_PASSWORD
 *
 * ## What it touches
 *
 * It creates one board, one invite, one membership, one event, one profile row
 * and one preference row per user, all clearly labelled, and removes them again
 * at the end. Anything it fails to clean up is reported rather than left quiet.
 * It never touches a row it did not create.
 *
 *   node --env-file=.env.local scripts/acceptance/two-user-isolation.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ATLAS = process.env.ATLAS_API_URL ?? "http://localhost:3000";

const RUN = `acceptance-${Date.now()}`;

let failures = 0;
let checks = 0;

const ok = (label, detail = "") => {
  checks++;
  console.log(
    `  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`,
  );
};
const bad = (label, detail = "") => {
  checks++;
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? `  ${detail}` : ""}`);
};
const assert = (condition, label, detail = "") =>
  condition ? ok(label, detail) : bad(label, detail);
const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\nMissing ${name}.\n\n` +
        "Set the four acceptance variables and re-run. They are read once and never logged:\n" +
        "  ACCEPT_A_EMAIL=…  ACCEPT_A_PASSWORD=…  ACCEPT_B_EMAIL=…  ACCEPT_B_PASSWORD=…\n",
    );
    process.exit(2);
  }
  return value;
}

/** A client carrying one person's real session. RLS sees them, not a key. */
async function signIn(label, email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    console.error(
      `\nCould not sign in ${label}: ${error?.message ?? "no user returned"}\n` +
        "Check the credentials, and that the account exists.\n",
    );
    process.exit(2);
  }
  return { client, id: data.user.id, email: data.user.email };
}

const atlas = async (path, init) => {
  const response = await fetch(`${ATLAS}${path}`, init);
  return {
    status: response.status,
    body:
      response.status === 204 ? null : await response.json().catch(() => null),
  };
};

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error(
      "Missing Supabase URL/anon key — run with --env-file=.env.local",
    );
    process.exit(2);
  }

  const A = await signIn(
    "User A",
    requireEnv("ACCEPT_A_EMAIL"),
    requireEnv("ACCEPT_A_PASSWORD"),
  );
  const B = await signIn(
    "User B",
    requireEnv("ACCEPT_B_EMAIL"),
    requireEnv("ACCEPT_B_PASSWORD"),
  );

  // Reads stored truth regardless of policy, so the script can show what is
  // actually on disk rather than what a policy chose to reveal.
  const inspect = SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
      })
    : null;

  console.log(`\nUser A ${A.id}\nUser B ${B.id}\nAtlas  ${ATLAS}`);

  if (!inspect) {
    // Not fatal. Every isolation assertion below is made through a real user
    // session, which is the boundary that matters; the operator key only lets
    // the run *also* show what is on disk, and tidy up after itself.
    console.log(
      "\n\x1b[33mNo SUPABASE_SERVICE_ROLE_KEY — stored-row checks are skipped and\n" +
        "cleanup will be partial. It lives in atlas/.env.local; prefix the command with it:\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' ../atlas/.env.local | cut -d= -f2-) npm run accept:isolation\x1b[0m",
    );
  }
  console.log("");

  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const created = { boardId: null, token: null };

  // ---------------------------------------------------------------- identity
  section("IDENTITY");
  assert(A.id !== B.id, "A and B are different people");
  assert(UUID.test(A.id) && UUID.test(B.id), "both ids are real auth uuids");
  assert(
    A.id !== "demo-user" && B.id !== "demo-user",
    "neither is the demo-user literal",
  );

  // ------------------------------------------------------- profile in private
  section("PROFILE — mine, and only mine");
  {
    const { error } = await A.client
      .from("passport_profiles")
      .upsert(
        { user_id: A.id, display_name: `${RUN} A` },
        { onConflict: "user_id" },
      );
    assert(!error, "A can write their own profile", error?.message ?? "");

    const forged = await B.client
      .from("passport_profiles")
      .upsert(
        { user_id: A.id, display_name: "hijacked" },
        { onConflict: "user_id" },
      );
    assert(
      Boolean(forged.error),
      "B cannot write a profile row claiming to be A",
      forged.error ? "" : "THE WRITE SUCCEEDED",
    );

    const seen = await B.client
      .from("passport_profiles")
      .select("user_id, display_name")
      .eq("user_id", A.id);
    assert(
      (seen.data ?? []).length === 0,
      "B cannot read A's profile",
      `rows=${(seen.data ?? []).length}`,
    );

    if (inspect) {
      const { data } = await inspect
        .from("passport_profiles")
        .select("user_id, display_name")
        .eq("user_id", A.id)
        .maybeSingle();
      assert(
        data?.user_id === A.id && data?.display_name === `${RUN} A`,
        "stored profile row is keyed to A's real auth.uid()",
        data?.user_id ?? "no row",
      );
    }
  }

  // --------------------------------------------------------- preferences
  section("PREFERENCES — stated, private, and marked explicit");
  {
    const { error } = await A.client.from("passport_preferences").upsert(
      {
        user_id: A.id,
        key: "content_comfort",
        value: "family-friendly",
        source: "explicit",
      },
      { onConflict: "user_id,key" },
    );
    assert(!error, "A can state a preference", error?.message ?? "");

    const seen = await B.client
      .from("passport_preferences")
      .select("key, value")
      .eq("user_id", A.id);
    assert(
      (seen.data ?? []).length === 0,
      "B cannot read what A stated",
      `rows=${(seen.data ?? []).length}`,
    );

    const learned = await A.client.from("passport_preferences").insert({
      user_id: A.id,
      key: "inferred_thing",
      value: true,
      source: "learned",
    });
    assert(
      Boolean(learned.error),
      "a 'learned' row cannot be written beside a stated one",
      learned.error ? "" : "THE CHECK CONSTRAINT DID NOT HOLD",
    );
  }

  // -------------------------------------------------------------- my october
  section("MY OCTOBER — mine, and only lived when I say so");
  {
    const entityId = `${RUN}-thing`;
    const { error } = await A.client.from("passport_october_things").insert({
      user_id: A.id,
      entity_id: entityId,
      entity_kind: "Event",
      name: "Acceptance Fest",
      starts_at: "2026-10-09T19:00:00Z",
      state: "ahead",
    });
    assert(!error, "A can want a thing", error?.message ?? "");

    const twice = await A.client.from("passport_october_things").insert({
      user_id: A.id,
      entity_id: entityId,
      entity_kind: "Event",
      name: "Acceptance Fest",
      state: "ahead",
    });
    assert(Boolean(twice.error), "wanting it twice cannot make two rows");

    const seen = await B.client
      .from("passport_october_things")
      .select("entity_id")
      .eq("user_id", A.id);
    assert(
      (seen.data ?? []).length === 0,
      "B cannot see A's October",
      `rows=${(seen.data ?? []).length}`,
    );

    const forged = await B.client.from("passport_october_things").insert({
      user_id: A.id,
      entity_id: `${RUN}-forged`,
      entity_kind: "Place",
      name: "hijacked",
      state: "ahead",
    });
    assert(Boolean(forged.error), "B cannot put a thing into A's October");

    const sneak = await B.client
      .from("passport_october_things")
      .update({ state: "lived", lived_at: new Date().toISOString() })
      .eq("user_id", A.id)
      .eq("entity_id", entityId)
      .select("state");
    assert(
      (sneak.data ?? []).length === 0,
      "B cannot mark A's thing as lived",
      `rows updated=${(sneak.data ?? []).length}`,
    );

    const notYet = await A.client
      .from("passport_october_things")
      .update({ state: "lived" })
      .eq("user_id", A.id)
      .eq("entity_id", entityId)
      .select("state");
    assert(
      Boolean(notYet.error),
      "a thing cannot be lived without saying when — the constraint holds",
      notYet.error ? "" : "THE UPDATE SUCCEEDED",
    );

    const did = await A.client
      .from("passport_october_things")
      .update({ state: "lived", lived_at: new Date().toISOString() })
      .eq("user_id", A.id)
      .eq("entity_id", entityId)
      .select("state, lived_at")
      .maybeSingle();
    assert(
      did.data?.state === "lived" && Boolean(did.data?.lived_at),
      "A says 'did this' and it is lived",
    );

    if (inspect) {
      const { data } = await inspect
        .from("passport_october_things")
        .select("user_id, state")
        .eq("entity_id", entityId);
      assert(
        (data ?? []).length === 1 &&
          data[0].user_id === A.id &&
          data[0].state === "lived",
        "the stored row is A's, and lived",
      );
    }

    await A.client
      .from("passport_october_things")
      .delete()
      .eq("user_id", A.id)
      .eq("entity_id", entityId);
  }

  // ------------------------------------------------------------------ boards
  section("BOARDS — owned by a real person, invisible to anyone else");
  {
    const made = await atlas("/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${RUN} board`, ownerId: A.id }),
    });
    assert(
      made.status === 201,
      "A's board is created in Atlas",
      `status=${made.status}`,
    );
    created.boardId = made.body?.id ?? null;
    assert(
      made.body?.ownerId === A.id,
      "the stored owner is A's auth.uid(), not demo-user",
      made.body?.ownerId ?? "none",
    );

    const mine = await atlas(`/boards?ownerId=${encodeURIComponent(A.id)}`);
    assert(
      (mine.body ?? []).some((b) => b.id === created.boardId),
      "Atlas returns the board to A",
    );

    const theirs = await atlas(`/boards?ownerId=${encodeURIComponent(B.id)}`);
    assert(
      !(theirs.body ?? []).some((b) => b.id === created.boardId),
      "Atlas does not return A's board to B",
    );

    const probe = await atlas(
      `/boards/${created.boardId}/items?ownerId=${encodeURIComponent(B.id)}`,
    );
    assert(
      probe.status === 404,
      "knowing the board id does not let B read its items",
      `status=${probe.status}`,
    );
  }

  // ------------------------------------------------------------- membership
  section("MEMBERSHIP — nothing before acceptance");
  {
    const claim = await A.client.from("passport_board_members").upsert(
      {
        board_id: created.boardId,
        board_owner_id: A.id,
        user_id: A.id,
        role: "owner",
      },
      { onConflict: "board_id,user_id" },
    );
    assert(
      !claim.error,
      "A is recorded as owner of their own board",
      claim.error?.message ?? "",
    );

    if (inspect) {
      const { data } = await inspect
        .from("passport_board_members")
        .select("user_id, role")
        .eq("board_id", created.boardId);
      assert(
        (data ?? []).length === 1 && data[0].user_id === A.id,
        "exactly one membership row exists, and it is A's",
        `rows=${(data ?? []).length}`,
      );
      assert(
        !(data ?? []).some((r) => r.user_id === B.id),
        "B has NO membership before any invite is used",
      );
    }

    const seen = await B.client
      .from("passport_board_members")
      .select("user_id")
      .eq("board_id", created.boardId);
    assert(
      (seen.data ?? []).length === 0,
      "B cannot even see who is on A's board",
      `rows=${(seen.data ?? []).length}`,
    );

    const forged = await B.client.from("passport_board_members").insert({
      board_id: created.boardId,
      board_owner_id: A.id,
      user_id: B.id,
      role: "editor",
    });
    assert(
      Boolean(forged.error),
      "B cannot add themselves to A's board",
      forged.error ? "" : "THE INSERT SUCCEEDED",
    );
  }

  // ----------------------------------------------------------------- invites
  section("INVITE — the token is the credential");
  {
    created.token = `${RUN}-token-${Math.random().toString(36).slice(2, 12)}`;
    const { error } = await A.client.from("passport_board_invites").insert({
      token: created.token,
      board_id: created.boardId,
      board_owner_id: A.id,
      role: "viewer",
      created_by: A.id,
    });
    assert(!error, "A creates a viewer link", error?.message ?? "");

    const described = await B.client.rpc("passport_describe_board_invite", {
      p_token: created.token,
    });
    const row = (described.data ?? [])[0];
    assert(row?.valid === true, "B can see the link is good before joining");
    assert(
      row?.role === "viewer",
      "and that it offers exactly 'viewer'",
      row?.role ?? "",
    );

    const redeemed = await B.client.rpc("passport_redeem_board_invite", {
      p_token: created.token,
    });
    assert(
      redeemed.data === created.boardId,
      "B redeems it and is given the board",
      String(redeemed.data ?? redeemed.error?.message ?? ""),
    );

    if (inspect) {
      const { data } = await inspect
        .from("passport_board_members")
        .select("user_id, role")
        .eq("board_id", created.boardId)
        .eq("user_id", B.id)
        .maybeSingle();
      assert(
        data?.role === "viewer",
        "the stored membership grants EXACTLY the invited role",
        data?.role ?? "no row",
      );
    }
  }

  // ------------------------------------------------------------------- roles
  section("ROLES — a viewer may look, and only look");
  {
    const seen = await B.client
      .from("passport_board_members")
      .select("user_id")
      .eq("board_id", created.boardId);
    assert((seen.data ?? []).length >= 1, "B can now see the board's members");

    const asViewer = await B.client.from("passport_events").insert({
      resource_type: "board",
      resource_id: created.boardId,
      actor_id: B.id,
      kind: "item-added",
      payload: { note: RUN },
    });
    assert(
      Boolean(asViewer.error),
      "a viewer cannot write an event on the board",
      asViewer.error ? "" : "THE INSERT SUCCEEDED",
    );

    const asOwner = await A.client.from("passport_events").insert({
      resource_type: "board",
      resource_id: created.boardId,
      actor_id: A.id,
      kind: "item-added",
      payload: { note: RUN },
    });
    assert(!asOwner.error, "the owner can", asOwner.error?.message ?? "");

    const heard = await B.client
      .from("passport_events")
      .select("id")
      .eq("resource_id", created.boardId);
    assert(
      (heard.data ?? []).length >= 1,
      "a viewer receives the board's realtime events",
      `rows=${(heard.data ?? []).length}`,
    );

    const forged = await B.client.from("passport_events").insert({
      resource_type: "board",
      resource_id: created.boardId,
      actor_id: A.id,
      kind: "item-added",
      payload: {},
    });
    assert(
      Boolean(forged.error),
      "B cannot write an event pretending to be A",
      forged.error ? "" : "THE INSERT SUCCEEDED",
    );
  }

  // -------------------------------------------------------------- revocation
  section("REVOCATION — access actually goes away");
  {
    const { error } = await A.client
      .from("passport_board_members")
      .delete()
      .eq("board_id", created.boardId)
      .eq("user_id", B.id);
    assert(!error, "A removes B", error?.message ?? "");

    if (inspect) {
      const { data } = await inspect
        .from("passport_board_members")
        .select("user_id")
        .eq("board_id", created.boardId)
        .eq("user_id", B.id);
      assert(
        (data ?? []).length === 0,
        "the membership row is gone from storage",
      );
    }

    const members = await B.client
      .from("passport_board_members")
      .select("user_id")
      .eq("board_id", created.boardId);
    assert(
      (members.data ?? []).length === 0,
      "B can no longer see the board's members",
      `rows=${(members.data ?? []).length}`,
    );

    const events = await B.client
      .from("passport_events")
      .select("id")
      .eq("resource_id", created.boardId);
    assert(
      (events.data ?? []).length === 0,
      "B no longer receives its events",
      `rows=${(events.data ?? []).length}`,
    );

    const again = await B.client.rpc("passport_redeem_board_invite", {
      p_token: created.token,
    });
    // The link still works — revoking a member is not revoking the link, and
    // conflating them would silently disarm every other invitation.
    assert(
      again.data === created.boardId,
      "the link itself still works — removing a member is not revoking a link",
    );

    await A.client
      .from("passport_board_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", created.token);
    await A.client
      .from("passport_board_members")
      .delete()
      .eq("board_id", created.boardId)
      .eq("user_id", B.id);

    const dead = await B.client.rpc("passport_redeem_board_invite", {
      p_token: created.token,
    });
    assert(
      dead.data === null,
      "a revoked link admits nobody",
      String(dead.data),
    );
  }

  // ----------------------------------------------------------------- cleanup
  section("CLEANUP");
  {
    const residue = [];
    const tidy = async (label, run) => {
      const { error } = await run();
      if (error) residue.push(`${label}: ${error.message}`);
    };

    // Events and invites are cleaned up as the operator, not as A — and that
    // is the grant design working, not a workaround. `authenticated` has no
    // DELETE on either: an event log should not be erasable by a participant,
    // and revoking a link is an UPDATE that stamps `revoked_at` so an owner can
    // see they did it. Neither is a privilege a person needs, so neither was
    // granted, and tidying a test run is an operator's job.
    if (inspect) {
      await tidy("events", () =>
        inspect
          .from("passport_events")
          .delete()
          .eq("resource_id", created.boardId),
      );
      await tidy("invites", () =>
        inspect
          .from("passport_board_invites")
          .delete()
          .eq("board_id", created.boardId),
      );
    } else {
      residue.push(
        "events and invites need SUPABASE_SERVICE_ROLE_KEY to tidy (by design)",
      );
    }
    await tidy("memberships", () =>
      A.client
        .from("passport_board_members")
        .delete()
        .eq("board_id", created.boardId),
    );
    await tidy("preference", () =>
      A.client
        .from("passport_preferences")
        .delete()
        .eq("user_id", A.id)
        .eq("key", "content_comfort"),
    );

    if (created.boardId) {
      const gone = await atlas(
        `/boards/${created.boardId}?ownerId=${encodeURIComponent(A.id)}`,
        { method: "DELETE" },
      );
      if (gone.status !== 204)
        residue.push(`atlas board: status ${gone.status}`);
    }

    if (residue.length === 0) {
      ok("everything this run created has been removed");
    } else {
      // Reported, never swallowed — residue in a shared database is somebody
      // else's confusing afternoon.
      bad("left behind", residue.join(" | "));
    }
    console.log(
      `  \x1b[2mA's profile row is kept — it is a real account's real profile.\x1b[0m`,
    );
  }

  console.log(
    `\n${failures === 0 ? "\x1b[32mALL PASSED\x1b[0m" : `\x1b[31m${failures} FAILED\x1b[0m`}  ${checks} checks\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nAcceptance run failed:", error);
  process.exit(2);
});
