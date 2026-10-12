// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * **Nobody but a board's owner may name that owner.**
 *
 * `accessToBoard` asks Atlas for a shared board *on behalf of the
 * `board_owner_id` its membership row names*. So whoever can write a row or an
 * invite naming Olive can reach Olive's Atlas board, whatever role Passport
 * thinks they hold.
 *
 * The first claim fix (d1ba0be) stopped a stranger claiming a board somebody is
 * already on. It still let them claim a board nobody is on yet — every board
 * that was never shared. Having claimed it, they were "owner" in Passport, and
 * the baseline owner-writes policies let an owner write any `board_owner_id`:
 * repoint their own row at Olive, or mint an invite naming her. This suite
 * proves each of those refused by `boards-owner-claim-fix.sql`, and every
 * write Olive's own sharing makes still allowed.
 *
 *   node docs/product/group-adventures/verification/stack.mjs start
 *   ADVENTURES_STACK_ENV=/tmp/adventures-stack/env \
 *     npx vitest run src/lib/data/boards-owner-forgery.stack.test.ts
 */

const ENV_FILE = process.env.ADVENTURES_STACK_ENV;
const ROOT = path.resolve(__dirname, "../../..");
const STACK = path.join(
  ROOT,
  "docs/product/group-adventures/verification/stack.mjs",
);
// BOARDS_FIX_SQL runs the suite against another version of the fix, e.g.
// `git show d1ba0be:docs/product/group-adventures/boards-owner-claim-fix.sql`.
const FIX =
  process.env.BOARDS_FIX_SQL ??
  path.join(ROOT, "docs/product/group-adventures/boards-owner-claim-fix.sql");

const env: Record<string, string> = ENV_FILE
  ? Object.fromEntries(
      fs
        .readFileSync(ENV_FILE, "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    )
  : {};

const stamp = Date.now().toString(36);

async function person(
  name: string,
): Promise<{ id: string; db: SupabaseClient }> {
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db.auth.signUp({
    email: `${name}-${stamp}@example.test`,
    password: "board-forgery-test-9",
  });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  return { id: data.user.id, db };
}

/**
 * The first owner row, as a plain insert. `ensureOwnerMembership`'s upsert is
 * refused for a board with no rows yet (Postgres applies the SELECT policy to
 * an upsert's new row; see the NOTE in the fix), but an attacker sends
 * whatever request they like.
 */
function ownerInsert(db: SupabaseClient, boardId: string, userId: string) {
  return db.from("passport_board_members").insert({
    board_id: boardId,
    board_owner_id: userId,
    user_id: userId,
    role: "owner",
  });
}

/** What `ensureOwnerMembership` writes, as whoever runs it. */
function ownerUpsert(db: SupabaseClient, boardId: string, userId: string) {
  return db.from("passport_board_members").upsert(
    {
      board_id: boardId,
      board_owner_id: userId,
      user_id: userId,
      role: "owner",
    },
    { onConflict: "board_id,user_id" },
  );
}

function invite(
  db: SupabaseClient,
  row: { boardId: string; ownerId: string; createdBy: string },
) {
  const token = `forgery-${stamp}-${Math.random().toString(36).slice(2)}-xxxxxxxx`;
  return db
    .from("passport_board_invites")
    .insert({
      token,
      board_id: row.boardId,
      board_owner_id: row.ownerId,
      role: "editor",
      created_by: row.createdBy,
    })
    .then((result) => ({ ...result, token }));
}

describe.skipIf(!ENV_FILE)("board owner forgery", () => {
  it("refuses every row naming an owner who did not write it, and keeps the owner's own sharing working", async () => {
    execFileSync(process.execPath, [STACK, "apply", FIX], { stdio: "ignore" });

    const [olive, bob, mallory, mallory2] = await Promise.all([
      person("olive"),
      person("bob"),
      person("mallory"),
      person("mallory2"),
    ]);

    // An Atlas board of Olive's that she has never shared: no Passport rows.
    const unshared = `board-unshared-${stamp}`;

    // The documented residual: Mallory can still pre-claim it in her OWN name.
    // That blocks Olive from sharing it (denial), and must give Mallory nothing.
    expect(
      (await ownerInsert(mallory.db, unshared, mallory.id)).error,
    ).toBeNull();

    // 1. Repointing her own row at Olive — accessToBoard would then fetch
    //    Olive's board from Atlas and hand it to Mallory as 'owner'.
    const repoint = await mallory.db
      .from("passport_board_members")
      .update({ board_owner_id: olive.id })
      .eq("board_id", unshared)
      .eq("user_id", mallory.id)
      .select();
    expect(repoint.error?.code).toBe("42501");

    // 2. An invite naming Olive, for an accomplice to redeem.
    expect(
      (
        await invite(mallory.db, {
          boardId: unshared,
          ownerId: olive.id,
          createdBy: mallory.id,
        })
      ).error?.code,
    ).toBe("42501");

    // 3. The same invite with the creator forged as Olive too.
    expect(
      (
        await invite(mallory.db, {
          boardId: unshared,
          ownerId: olive.id,
          createdBy: olive.id,
        })
      ).error?.code,
    ).toBe("42501");

    // 4. Writing the accomplice's membership row directly.
    const direct = await mallory.db.from("passport_board_members").insert({
      board_id: unshared,
      board_owner_id: olive.id,
      user_id: mallory2.id,
      role: "editor",
    });
    expect(direct.error?.code).toBe("42501");

    // 5. An honest-looking invite in Mallory's own name stays harmless: the
    //    row it redeems into names Mallory, whose Atlas holds no such board.
    const own = await invite(mallory.db, {
      boardId: unshared,
      ownerId: mallory.id,
      createdBy: mallory.id,
    });
    expect(own.error).toBeNull();
    await mallory2.db.rpc("passport_redeem_board_invite", {
      p_token: own.token,
    });

    // After all of it, no row on the board names Olive.
    const { data: rows } = await mallory.db
      .from("passport_board_members")
      .select("board_owner_id")
      .eq("board_id", unshared);
    const { data: invites } = await mallory.db
      .from("passport_board_invites")
      .select("board_owner_id")
      .eq("board_id", unshared);
    expect(
      [...(rows ?? []), ...(invites ?? [])].map((r) => r.board_owner_id),
    ).not.toContain(olive.id);

    // OLIVE'S OWN SHARING, end to end, as the app does it.
    const shared = `board-shared-${stamp}`;
    expect((await ownerInsert(olive.db, shared, olive.id)).error).toBeNull();
    expect((await ownerUpsert(olive.db, shared, olive.id)).error).toBeNull();

    const link = await invite(olive.db, {
      boardId: shared,
      ownerId: olive.id,
      createdBy: olive.id,
    });
    expect(link.error).toBeNull();
    const redeemed = await bob.db.rpc("passport_redeem_board_invite", {
      p_token: link.token,
    });
    expect(redeemed.data).toBe(shared);
    const { data: bobRow } = await bob.db
      .from("passport_board_members")
      .select("board_owner_id, role")
      .eq("board_id", shared)
      .eq("user_id", bob.id)
      .single();
    expect(bobRow).toEqual({ board_owner_id: olive.id, role: "editor" });

    const revoked = await olive.db
      .from("passport_board_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", link.token)
      .select();
    expect(revoked.error).toBeNull();
    expect(revoked.data).toHaveLength(1);

    const removed = await olive.db
      .from("passport_board_members")
      .delete()
      .eq("board_id", shared)
      .eq("user_id", bob.id)
      .select();
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);

    // Mallory still can't claim the board Olive shares.
    expect(
      (await ownerInsert(mallory.db, shared, mallory.id)).error?.code,
    ).toBe("42501");
  });
});
