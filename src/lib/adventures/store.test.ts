import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adventureFor,
  createInvite,
  hashInviteToken,
  newInviteToken,
  Refused,
  removeMember,
  Unavailable,
  updateAdventure,
} from "./store";

/**
 * The store's own logic, without a database: how answers are shaped and how
 * Postgres's silences and refusals are read. What Postgres allows is proven
 * against a real one in acceptance.stack.test.ts.
 */

type Result = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

/** A chainable stand-in: every call returns the chain; awaiting it yields `answer(table)`. */
function fakeDb(answer: (table: string, calls: string[]) => Result) {
  const inserted: Record<string, unknown>[] = [];
  const db = {
    from(table: string) {
      const calls: string[] = [];
      const chain: Record<string, unknown> = {};
      const passthrough = new Proxy(chain, {
        get(_target, prop: string) {
          if (prop === "then") {
            const result = answer(table, calls);
            return (resolve: (r: Result) => unknown) => resolve(result);
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => {
              calls.push(prop);
              return Promise.resolve(answer(table, calls));
            };
          }
          return (...args: unknown[]) => {
            calls.push(prop);
            if (prop === "insert")
              inserted.push(args[0] as Record<string, unknown>);
            return passthrough;
          };
        },
      });
      return passthrough;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return { db: db as unknown as SupabaseClient, inserted };
}

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

describe("writes Postgres refuses silently", () => {
  it("zero rows changed is Refused, never success", async () => {
    const { db } = fakeDb(() => ({ data: [], error: null }));
    await expect(
      updateAdventure(db, "a", { title: "x" }),
    ).rejects.toBeInstanceOf(Refused);
    await expect(removeMember(db, "a", "m")).rejects.toBeInstanceOf(Refused);
  });

  it("a permission error is Refused; anything else is Unavailable", async () => {
    const denied = fakeDb(() => ({
      data: null,
      error: { code: "42501", message: "denied" },
    }));
    await expect(
      updateAdventure(denied.db, "a", { title: "x" }),
    ).rejects.toBeInstanceOf(Refused);
    const broken = fakeDb(() => ({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    }));
    await expect(
      updateAdventure(broken.db, "a", { title: "x" }),
    ).rejects.toBeInstanceOf(Unavailable);
  });
});

describe("invite tokens", () => {
  it("are 32 random bytes, and only their SHA-256 is written", async () => {
    const a = newInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newInviteToken()).not.toBe(a);
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );

    const { db, inserted } = fakeDb(() => ({
      data: {
        id: "i",
        label: null,
        max_uses: 1,
        uses: 0,
        expires_at: null,
        created_at: "t",
      },
      error: null,
    }));
    const { token } = await createInvite(db, "adv", ALICE, {
      label: null,
      maxUses: 1,
      expiresInDays: null,
    });
    expect(JSON.stringify(inserted)).not.toContain(token);
    expect(inserted[0].token_hash).toBe(hashInviteToken(token));
  });
});

describe("what a member sees", () => {
  const tables: Record<string, Result> = {
    passport_adventures: {
      data: {
        id: "adv",
        kind: "hockey-night",
        title: "Night A",
        owner_id: ALICE,
        starts_on: null,
        ends_on: null,
        time_zone: null,
        destination_label: null,
        destination_town_id: null,
        created_at: "t",
        updated_at: "t",
      },
      error: null,
    },
    passport_adventure_members: {
      data: [
        {
          user_id: ALICE,
          member_id: "m-alice",
          role: "owner",
          display_name: "Alice",
          visibility: "members",
        },
        {
          user_id: BOB,
          member_id: "m-bob",
          role: "participant",
          display_name: null,
          visibility: "members",
        },
      ],
      error: null,
    },
    passport_adventure_items: {
      data: [
        {
          id: "i1",
          atlas_ref: "ent_1",
          label: null,
          note: null,
          status: "proposed",
          on_day: null,
          starts_at: null,
          position: 0,
          added_by: BOB,
        },
        {
          id: "i2",
          atlas_ref: null,
          label: "Pub",
          note: null,
          status: "confirmed",
          on_day: null,
          starts_at: null,
          position: 1,
          added_by: BOB,
        },
      ],
      error: null,
    },
    passport_adventure_responses: {
      data: [
        { item_id: "i1", user_id: ALICE, response: "in" },
        { item_id: "i1", user_id: BOB, response: "maybe" },
      ],
      error: null,
    },
    passport_adventure_hockey: { data: null, error: null },
    passport_adventure_days: {
      data: [
        {
          on_day: "2026-10-25",
          ask: "say=Saturday&on=2026-10-25",
          updated_at: "2026-10-21T00:00:00Z",
        },
      ],
      error: null,
    },
  };

  it("never carries a user id, and says what is yours and what you may change", async () => {
    const { db } = fakeDb((table) => tables[table]);
    const view = await adventureFor(db, "adv", BOB);
    expect(view).not.toBeNull();
    expect(JSON.stringify(view)).not.toContain(ALICE);
    expect(JSON.stringify(view)).not.toContain(BOB);

    expect(view!.role).toBe("participant");
    expect(view!.you.memberId).toBe("m-bob");
    expect(view!.members.map((m) => m.displayName)).toEqual([
      "Alice",
      "A traveller",
    ]);
    const [proposed, confirmed] = view!.items;
    expect(proposed.addedBy).toBe("m-bob");
    expect(proposed.canChange).toBe(true);
    expect(confirmed.canChange).toBe(false);
    expect(proposed.responses).toEqual({ in: 1, maybe: 1, out: 0 });
    expect(proposed.yourResponse).toBe("maybe");
    expect(view!.hockey).toEqual({
      puckDrop: null,
      homeTeam: null,
      awayTeam: null,
      arenaAtlasRef: null,
      arenaLabel: null,
    });
  });

  it("is null when the adventure is not readable — missing and not-yours alike", async () => {
    const { db } = fakeDb((table) =>
      table === "passport_adventures"
        ? { data: null, error: null }
        : tables[table],
    );
    expect(await adventureFor(db, "adv", BOB)).toBeNull();
  });
});
