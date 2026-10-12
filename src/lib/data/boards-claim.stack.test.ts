// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * **The board owner-claim hole, proven against the production baseline —
 * and closed by the proposed fix.**
 *
 * `passport_board_members_self_claim` (baseline, live) lets anyone insert an
 * owner row for any board id. This suite shows a removed member doing exactly
 * that and then reading the members and minting invites, then applies
 * `docs/product/group-adventures/boards-owner-claim-fix.sql` and shows the
 * same attempt refused while a genuine first claim still works.
 *
 *   node docs/product/group-adventures/verification/stack.mjs start
 *   ADVENTURES_STACK_ENV=/tmp/adventures-stack/env \
 *     npx vitest run src/lib/data/boards-claim.stack.test.ts
 *
 * It applies the fix to the stack, so the "hole" half runs only on a stack
 * that has not had it yet (a fresh `start`).
 */

const ENV_FILE = process.env.ADVENTURES_STACK_ENV;
const ROOT = path.resolve(__dirname, "../../..");
const STACK = path.join(
  ROOT,
  "docs/product/group-adventures/verification/stack.mjs",
);
const FIX = path.join(
  ROOT,
  "docs/product/group-adventures/boards-owner-claim-fix.sql",
);

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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await db.auth.signUp({
    email: `${name}-${stamp}@example.test`,
    password: "board-claim-test-9",
  });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  return { id: data.user.id, db };
}

/** What `ensureOwnerMembership` writes, as whoever runs it. */
function claim(db: SupabaseClient, boardId: string, userId: string) {
  return db.from("passport_board_members").insert({
    board_id: boardId,
    board_owner_id: userId,
    user_id: userId,
    role: "owner",
  });
}

describe.skipIf(!ENV_FILE)("board owner self-claim", () => {
  it("is a hole on the baseline, and the proposed fix closes it without breaking real claims", async () => {
    const [olive, bob, mallory, mallory2] = await Promise.all([
      person("olive"),
      person("bob"),
      person("mallory"),
      person("mallory2"),
    ]);
    const board = `board-${stamp}`;

    // Olive owns a board and shares it with Bob.
    expect((await claim(olive.db, board, olive.id)).error).toBeNull();
    await olive.db.from("passport_board_members").insert({
      board_id: board,
      board_owner_id: olive.id,
      user_id: bob.id,
      role: "editor",
    });

    const fixed = !(
      await mallory.db.rpc("passport_board_has_members", { p_board_id: board })
    ).error;

    if (!fixed) {
      // THE HOLE. Mallory — who knows the board id, say because she was once
      // on it — claims to own it, and the baseline policy lets her.
      expect((await claim(mallory.db, board, mallory.id)).error).toBeNull();

      // She now reads the real membership…
      const { data: seen } = await mallory.db
        .from("passport_board_members")
        .select("user_id, role")
        .eq("board_id", board);
      expect((seen ?? []).map((r) => r.user_id).sort()).toEqual(
        [olive.id, bob.id, mallory.id].sort(),
      );

      // …and mints an invite naming Olive as the board's owner, which a
      // second account redeems into a membership that points at Olive — the
      // id `accessToBoard` would then ask Atlas for Olive's board with.
      const token = `claim-${stamp}-${"x".repeat(20)}`;
      expect(
        (
          await mallory.db.from("passport_board_invites").insert({
            token,
            board_id: board,
            board_owner_id: olive.id,
            role: "editor",
            created_by: mallory.id,
          })
        ).error,
      ).toBeNull();
      const redeemed = await mallory2.db.rpc("passport_redeem_board_invite", {
        p_token: token,
      });
      expect(redeemed.data).toBe(board);
      const { data: row } = await mallory2.db
        .from("passport_board_members")
        .select("board_owner_id")
        .eq("board_id", board)
        .eq("user_id", mallory2.id)
        .single();
      expect(row?.board_owner_id).toBe(olive.id);

      // Clean Mallory's rows away (as Olive, the real owner can), then fix.
      await olive.db
        .from("passport_board_members")
        .delete()
        .eq("board_id", board)
        .in("user_id", [mallory.id, mallory2.id]);
      execFileSync(process.execPath, [STACK, "apply", FIX], {
        stdio: "ignore",
      });
    }

    // THE FIX. The same claim on a board somebody is already on is refused…
    const refused = await claim(mallory.db, board, mallory.id);
    expect(refused.error?.code).toBe("42501");
    const { data: after } = await mallory.db
      .from("passport_board_members")
      .select("user_id")
      .eq("board_id", board);
    expect(after ?? []).toEqual([]);

    // …while a genuine first claim on a new board still works, and the
    // owner's own re-claim (ensureOwnerMembership's upsert) still succeeds.
    const fresh = `board-new-${stamp}`;
    expect((await claim(olive.db, fresh, olive.id)).error).toBeNull();
    const again = await olive.db.from("passport_board_members").upsert(
      {
        board_id: fresh,
        board_owner_id: olive.id,
        user_id: olive.id,
        role: "owner",
      },
      { onConflict: "board_id,user_id" },
    );
    expect(again.error).toBeNull();
  });
});
