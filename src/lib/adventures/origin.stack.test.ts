// @vitest-environment node
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  addIdeas,
  adventureFor,
  clearDay,
  createAdventure,
  createInvite,
  redeemInvite,
  Refused,
  saveDay,
  swapDays,
} from "./store";

/**
 * **ADR 012 against a real database**: Passport's suggestions, kept stops,
 * Undo, swapping days — and the `origin` column's rules, which Postgres
 * enforces, not this code.
 *
 *   ADVENTURES_STACK_ENV=$STACK/env npx vitest run src/lib/adventures/origin.stack.test.ts
 *
 * On a stack started with ADVENTURES_WITHOUT_ORIGIN=1 the same file proves
 * the fallback: everything still works, and a dropped suggestion goes back
 * to the ideas as ADR 010 had it.
 */
const ENV_FILE = process.env.ADVENTURES_STACK_ENV;
const WITHOUT = process.env.ADVENTURES_WITHOUT_ORIGIN === "1";
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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

interface Person {
  readonly id: string;
  readonly db: SupabaseClient;
}
const stamp = Date.now().toString(36);
async function signUp(name: string): Promise<Person> {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `${name}-origin-${stamp}@example.test`,
    password: "a-whole-weekend-9",
  });
  if (error || !data.user)
    throw new Error(`sign-up ${name}: ${error?.message}`);
  return { id: data.user.id, db };
}

const SAT = "2026-10-24";
const SUN = "2026-10-25";
const ask = (say: string, on: string) =>
  new URLSearchParams({ say, on, at: "kelowna" }).toString();

describe.skipIf(!ENV_FILE)("ADR 012 — suggestions, keeping, undo, swap", () => {
  let alice: Person;
  let bob: Person;
  let id = "";

  const view = async (p: Person) => (await adventureFor(p.db, id, p.id))!;
  const on = async (p: Person, day: string) =>
    (await view(p)).items
      .filter((i) => i.onDay === day)
      .sort((a, b) => a.position - b.position);

  it("Alice starts a weekend with one saved place; Bob joins", async () => {
    [alice, bob] = await Promise.all([signUp("alice"), signUp("bob")]);
    id = await createAdventure(alice.db, {
      kind: "weekend",
      title: "Sketched weekend",
      startsOn: SAT,
      endsOn: SUN,
      timeZone: "America/Vancouver",
      destinationLabel: "Kelowna",
      destinationTownId: "kelowna",
      displayName: "alice",
    });
    await addIdeas(alice.db, id, alice.id, ["saved-marina"]);
    const { token } = await createInvite(alice.db, id, alice.id, {
      label: null,
      maxUses: 1,
      expiresInDays: null,
    });
    await redeemInvite(bob.db, token, {
      displayName: "bob",
      visibility: "members",
    });
  });

  it("a sketch puts Passport's suggestions on the day, and the saved place as a person's", async () => {
    await saveDay(alice.db, id, alice.id, {
      onDay: SAT,
      ask: ask("get outside", SAT),
      stops: ["saved-marina", "park-a", "cafe-b"],
      mode: "propose",
    });
    const sat = await on(alice, SAT);
    expect(sat.map((i) => i.atlasRef)).toEqual([
      "saved-marina",
      "park-a",
      "cafe-b",
    ]);
    // Nothing is decided by a sketch.
    expect(sat.every((i) => i.status === "proposed")).toBe(true);
    expect(sat.map((i) => i.origin)).toEqual(
      WITHOUT
        ? ["person", "person", "person"]
        : ["person", "passport", "passport"],
    );
  });

  it("a revision drops a suggestion nobody kept, returns a person's choice to the ideas, never touches a kept stop", async () => {
    const park = (await on(alice, SAT)).find((i) => i.atlasRef === "park-a")!;
    // Alice keeps the park.
    const { error } = await alice.db
      .from("passport_adventure_items")
      .update({ status: "confirmed" })
      .eq("id", park.id);
    expect(error).toBeNull();

    await saveDay(alice.db, id, alice.id, {
      onDay: SAT,
      ask: ask("get outside — make it cheaper", SAT),
      stops: ["park-a", "beach-c"],
      mode: "propose",
    });
    const all = (await view(alice)).items;
    const sat = all.filter((i) => i.onDay === SAT);
    expect(sat.map((i) => i.atlasRef).sort()).toEqual(["beach-c", "park-a"]);
    expect(sat.find((i) => i.atlasRef === "park-a")!.status).toBe("confirmed");
    // The saved place goes back to the ideas, never deleted.
    expect(all.find((i) => i.atlasRef === "saved-marina")!.onDay).toBeNull();
    // Passport's café: gone with the new migration; an idea without it.
    const cafe = all.find((i) => i.atlasRef === "cafe-b");
    if (WITHOUT) expect(cafe?.onDay).toBeNull();
    else expect(cafe).toBeUndefined();
  });

  it("Undo of a sketch on an empty day clears it — suggestions gone, choices back to ideas", async () => {
    await saveDay(alice.db, id, alice.id, {
      onDay: SUN,
      ask: ask("get outside", SUN),
      stops: ["saved-marina", "hill-d"],
      mode: "propose",
    });
    expect((await on(alice, SUN)).length).toBe(2);
    await clearDay(alice.db, id, SUN);
    const all = (await view(alice)).items;
    expect(all.filter((i) => i.onDay === SUN)).toEqual([]);
    expect(all.find((i) => i.atlasRef === "saved-marina")!.onDay).toBeNull();
    expect((await view(alice)).days.map((d) => d.onDay)).toEqual([SAT]);
  });

  it("swapping days moves the stops and the sentence", async () => {
    await swapDays(alice.db, id, alice.id, SAT, SUN);
    const v = await view(alice);
    expect(
      v.items
        .filter((i) => i.onDay === SUN)
        .map((i) => i.atlasRef)
        .sort(),
    ).toEqual(["beach-c", "park-a"]);
    expect(v.days.map((d) => d.onDay)).toEqual([SUN]);
    expect(new URLSearchParams(v.days[0]!.ask).get("on")).toBe(SUN);
  });

  it("Bob can't sketch, clear or swap — the database refuses", async () => {
    await expect(
      saveDay(bob.db, id, bob.id, {
        onDay: SAT,
        ask: ask("mine now", SAT),
        stops: ["x-1"],
        mode: "propose",
      }),
    ).rejects.toBeInstanceOf(Refused);
    await expect(clearDay(bob.db, id, SUN)).rejects.toBeInstanceOf(Refused);
    await expect(swapDays(bob.db, id, bob.id, SAT, SUN)).rejects.toBeInstanceOf(
      Refused,
    );
    expect((await on(alice, SUN)).length).toBe(2);
  });

  it.skipIf(WITHOUT)(
    "only the owner may write a Passport row, and nobody can relabel one",
    async () => {
      const forged = await bob.db.from("passport_adventure_items").insert({
        adventure_id: id,
        added_by: bob.id,
        atlas_ref: "bob-pick",
        status: "proposed",
        origin: "passport",
      });
      expect(forged.error?.code).toBe("42501");

      const honest = await bob.db
        .from("passport_adventure_items")
        .insert({
          adventure_id: id,
          added_by: bob.id,
          atlas_ref: "bob-pick",
          status: "proposed",
        })
        .select("id, origin")
        .single();
      expect(honest.error).toBeNull();
      expect(honest.data!.origin).toBe("person");

      // Not even the owner can turn a person's choice into a deletable suggestion.
      const relabel = await alice.db
        .from("passport_adventure_items")
        .update({ origin: "passport" })
        .eq("id", honest.data!.id);
      expect(relabel.error?.code).toBe("42501");
    },
  );
});
