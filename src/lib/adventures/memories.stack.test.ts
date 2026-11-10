// @vitest-environment node
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createAdventure, createInvite, redeemInvite } from "./store";
import { dropMemory, keepMemory, memoriesOf } from "./memories";
import type { Memory } from "./companion";

/**
 * **A person's memories against a real database**: kept in their name, theirs
 * alone, never the owner's or a co-member's, and the same id twice is one
 * memory. Postgres decides all of it (the table has no other policy).
 *
 *   ADVENTURES_STACK_ENV=$STACK/env npx vitest run src/lib/adventures/memories.stack.test.ts
 */
const ENV_FILE = process.env.ADVENTURES_STACK_ENV;
const env: Record<string, string> = ENV_FILE
  ? Object.fromEntries(
      fs
        .readFileSync(ENV_FILE, "utf8")
        .trim()
        .split("\n")
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    )
  : {};

const client = (): SupabaseClient =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

const stamp = Date.now().toString(36);
async function signUp(name: string) {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `${name}-mem-${stamp}@example.test`,
    password: "a-whole-weekend-9",
  });
  if (error || !data.user)
    throw new Error(`sign-up ${name}: ${error?.message}`);
  return { id: data.user.id, db };
}

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const memory = (id: string, over: Partial<Memory> = {}): Memory => ({
  id,
  kind: "note",
  at: "2026-11-10T18:00:00.000Z",
  itemId: null,
  text: "Best waffle of my life",
  photo: null,
  ...over,
});

describe.skipIf(!ENV_FILE)("memories kept on the account", () => {
  it("are private to their author, even from the owner and members", async () => {
    const [alice, bob, charlie] = await Promise.all([
      signUp("alice"),
      signUp("bob"),
      signUp("charlie"),
    ]);
    const id = await createAdventure(alice.db, {
      kind: "day",
      title: "Memory day",
      startsOn: "2026-11-10",
      endsOn: "2026-11-10",
      timeZone: "America/Vancouver",
      destinationLabel: "Kelowna",
      destinationTownId: "kelowna",
      displayName: "alice",
    });
    const { token } = await createInvite(alice.db, id, alice.id, {
      label: null,
      maxUses: 1,
      expiresInDays: null,
    });
    await redeemInvite(bob.db, token, {
      displayName: "bob",
      visibility: "members",
    });

    const note = "5a1f2f9e-0000-4000-8000-000000000001";
    const photo = "5a1f2f9e-0000-4000-8000-000000000002";
    await keepMemory(bob.db, id, memory(note));
    await keepMemory(bob.db, id, memory(note)); // a retry is the same memory
    await keepMemory(
      bob.db,
      id,
      memory(photo, { kind: "photo", text: null, photo: JPEG }),
    );

    const mine = await memoriesOf(bob.db, id);
    expect(mine.map((m) => m.id)).toEqual([note, photo]);
    expect(mine[1]!.photo).toBe(JPEG);

    // The owner of the adventure sees none of it. Neither does a stranger.
    expect(await memoriesOf(alice.db, id)).toEqual([]);
    expect(await memoriesOf(charlie.db, id)).toEqual([]);

    // Nobody keeps one in someone else's name, or into an adventure they are not in.
    await expect(
      keepMemory(
        charlie.db,
        id,
        memory("5a1f2f9e-0000-4000-8000-000000000003"),
      ),
    ).rejects.toBeTruthy();
    // ...and cannot take another person's away.
    await dropMemory(alice.db, note);
    await dropMemory(charlie.db, note);
    expect((await memoriesOf(bob.db, id)).map((m) => m.id)).toEqual([
      note,
      photo,
    ]);

    // The author lets go of their own.
    await dropMemory(bob.db, note);
    expect((await memoriesOf(bob.db, id)).map((m) => m.id)).toEqual([photo]);
  });
});
