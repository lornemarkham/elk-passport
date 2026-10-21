// @vitest-environment node
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  addIdeas,
  adventureFor,
  createAdventure,
  createInvite,
  deleteAdventure,
  describeInvite,
  redeemInvite,
  Refused,
  revokeInvite,
  roleIn,
  saveDay,
  updateItem,
} from "./store";

/**
 * **Saved → adventure → a planned day, against a real database.**
 *
 * The same local stack as `acceptance.stack.test.ts`
 * (`docs/product/group-adventures/verification/stack.mjs`): real GoTrue
 * users, real PostgREST, and the migration in `supabase/migrations/`.
 * Skipped unless `ADVENTURES_STACK_ENV` names the stack's env file.
 *
 *   ADVENTURES_STACK_ENV=$STACK/env npx vitest run src/lib/adventures/planning.stack.test.ts
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
    email: `${name}-plan-${stamp}@example.test`,
    password: "a-whole-weekend-9",
  });
  if (error || !data.user)
    throw new Error(`sign-up ${name}: ${error?.message}`);
  return { id: data.user.id, db };
}

const SAT = "2026-10-24";
const SUN = "2026-10-25";
const ask = (say: string, on: string) =>
  new URLSearchParams({ say, on, at: "vernon" }).toString();

describe.skipIf(!ENV_FILE)(
  "planning an adventure from Saved — real database",
  () => {
    let alice: Person;
    let bob: Person;
    let charlie: Person;
    let weekend = "";

    it("three people sign up", async () => {
      [alice, bob, charlie] = await Promise.all([
        signUp("alice"),
        signUp("bob"),
        signUp("charlie"),
      ]);
    });

    it("Alice turns four saved things into a weekend; they arrive as ideas", async () => {
      weekend = await createAdventure(alice.db, {
        kind: "weekend",
        title: "Vernon weekend",
        startsOn: SAT,
        endsOn: SUN,
        timeZone: "America/Vancouver",
        destinationLabel: "Vernon",
        destinationTownId: "vernon",
        displayName: "Alice",
      });
      expect(
        await addIdeas(alice.db, weekend, alice.id, ["a", "b", "c", "d"]),
      ).toBe(4);
      // Adding again adds nothing.
      expect(await addIdeas(alice.db, weekend, alice.id, ["a", "e"])).toBe(1);
      const view = (await adventureFor(alice.db, weekend, alice.id))!;
      expect(view.items.map((i) => [i.atlasRef, i.onDay, i.status])).toEqual([
        ["a", null, "proposed"],
        ["b", null, "proposed"],
        ["c", null, "proposed"],
        ["d", null, "proposed"],
        ["e", null, "proposed"],
      ]);
      expect(view.days).toEqual([]);
    });

    it("Bob joins on an open link; Alice can still revoke it after he used it", async () => {
      const link = await createInvite(alice.db, weekend, alice.id, {
        label: null,
        maxUses: null,
        expiresInDays: null,
      });
      expect(
        await redeemInvite(bob.db, link.token, {
          displayName: "Bob",
          visibility: "members",
        }),
      ).toBe(weekend);
      // The lane draft's policy refused this (WITH CHECK uses = 0 on UPDATE).
      await revokeInvite(alice.db, weekend, link.invite.id);
      expect((await describeInvite(client(), link.token))!.state).toBe(
        "revoked",
      );
      expect(
        await redeemInvite(charlie.db, link.token, {
          displayName: null,
          visibility: "members",
        }),
      ).toBeNull();
      // Bob is still in: revoking a link removes nobody.
      expect(await roleIn(bob.db, weekend)).toBe("participant");
      expect(await roleIn(charlie.db, weekend)).toBeNull();
    });

    it("Alice saves Saturday as Go Have a Day built it: its stops, in order, and the sentence", async () => {
      await saveDay(alice.db, weekend, alice.id, {
        onDay: SAT,
        ask: ask("Saturday with a five-year-old", SAT),
        stops: ["c", "a", "x"],
      });
      const view = (await adventureFor(bob.db, weekend, bob.id))!;
      const saturday = view.items
        .filter((i) => i.onDay === SAT)
        .sort((p, q) => p.position - q.position);
      expect(saturday.map((i) => [i.atlasRef, i.position, i.status])).toEqual([
        ["c", 0, "confirmed"],
        ["a", 1, "confirmed"],
        ["x", 2, "confirmed"],
      ]);
      expect(view.items.filter((i) => !i.onDay).map((i) => i.atlasRef)).toEqual(
        ["b", "d", "e"],
      );
      // Bob reads the day and how it was asked for; nobody's id comes with it.
      expect(view.days).toHaveLength(1);
      expect(new URLSearchParams(view.days[0]!.ask).get("say")).toBe(
        "Saturday with a five-year-old",
      );
      expect(JSON.stringify(view)).not.toContain(alice.id);
    });

    it("refining Saturday sends a dropped stop back to the ideas — nothing is deleted", async () => {
      await saveDay(alice.db, weekend, alice.id, {
        onDay: SAT,
        ask: ask("Saturday, indoors", SAT),
        stops: ["a", "b"],
      });
      const view = (await adventureFor(alice.db, weekend, alice.id))!;
      const on = (day: string | null) =>
        view.items
          .filter((i) => i.onDay === day)
          .sort((p, q) => p.position - q.position)
          .map((i) => i.atlasRef);
      expect(on(SAT)).toEqual(["a", "b"]);
      expect(on(null).sort()).toEqual(["c", "d", "e", "x"]);
      expect(view.items).toHaveLength(6);
      expect(
        view.days.map((d) => new URLSearchParams(d.ask).get("say")),
      ).toEqual(["Saturday, indoors"]);
    });

    it("Bob can suggest and answer, but cannot place, reorder or rewrite the day", async () => {
      expect(await addIdeas(bob.db, weekend, bob.id, ["bobs-pick"])).toBe(1);
      const view = (await adventureFor(bob.db, weekend, bob.id))!;
      const pick = view.items.find((i) => i.atlasRef === "bobs-pick")!;
      expect(pick.status).toBe("proposed");
      expect(pick.mine).toBe(true);

      await expect(
        saveDay(bob.db, weekend, bob.id, {
          onDay: SUN,
          ask: ask("Sunday my way", SUN),
          stops: ["bobs-pick"],
        }),
      ).rejects.toBeInstanceOf(Refused);
      const a = view.items.find((i) => i.atlasRef === "a")!;
      await expect(
        updateItem(bob.db, weekend, a.id, { position: 9 }),
      ).rejects.toBeInstanceOf(Refused);
      const raw = await bob.db
        .from("passport_adventure_days")
        .update({ ask: "say=hijacked&on=2026-10-24" })
        .eq("adventure_id", weekend)
        .select("on_day");
      expect(raw.data ?? []).toHaveLength(0);
      const after = (await adventureFor(alice.db, weekend, alice.id))!;
      expect(after.days).toHaveLength(1);
      expect(new URLSearchParams(after.days[0]!.ask).get("say")).toBe(
        "Saturday, indoors",
      );
      expect(after.items.filter((i) => i.onDay === SUN)).toHaveLength(0);
    });

    it("Alice reorders by hand", async () => {
      const view = (await adventureFor(alice.db, weekend, alice.id))!;
      const a = view.items.find((i) => i.atlasRef === "a" && i.onDay === SAT)!;
      const b = view.items.find((i) => i.atlasRef === "b" && i.onDay === SAT)!;
      await updateItem(alice.db, weekend, a.id, { position: 1 });
      await updateItem(alice.db, weekend, b.id, { position: 0 });
      const after = (await adventureFor(alice.db, weekend, alice.id))!;
      expect(
        after.items
          .filter((i) => i.onDay === SAT)
          .sort((p, q) => p.position - q.position)
          .map((i) => i.atlasRef),
      ).toEqual(["b", "a"]);
    });

    it("Charlie, who is in nothing, sees and changes nothing", async () => {
      for (const table of [
        "passport_adventure_days",
        "passport_adventure_items",
      ]) {
        const { data } = await charlie.db
          .from(table)
          .select("*")
          .eq("adventure_id", weekend);
        expect(data ?? []).toHaveLength(0);
      }
      expect(await adventureFor(charlie.db, weekend, charlie.id)).toBeNull();
      await expect(
        addIdeas(charlie.db, weekend, charlie.id, ["z"]),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        saveDay(charlie.db, weekend, charlie.id, {
          onDay: SUN,
          ask: ask("mine", SUN),
          stops: ["z"],
        }),
      ).rejects.toBeInstanceOf(Refused);
      const forged = await charlie.db.from("passport_adventure_days").insert({
        adventure_id: weekend,
        on_day: SUN,
        ask: "say=forged&on=2026-10-25",
        updated_by: alice.id,
      });
      expect(forged.error?.code).toBe("42501");

      // Charlie's own adventure is his alone, and Alice's is untouched by it.
      const his = await createAdventure(charlie.db, {
        kind: "day",
        title: "Charlie's day",
        startsOn: SUN,
        endsOn: null,
        timeZone: null,
        destinationLabel: null,
        destinationTownId: null,
      });
      await addIdeas(charlie.db, his, charlie.id, ["a"]);
      await saveDay(charlie.db, his, charlie.id, {
        onDay: SUN,
        ask: ask("solo", SUN),
        stops: ["a"],
      });
      expect(await adventureFor(alice.db, his, alice.id)).toBeNull();
      const alices = (await adventureFor(alice.db, weekend, alice.id))!;
      expect(alices.days.map((d) => d.onDay)).toEqual([SAT]);
    });

    it("signed-out visitors get nothing from the days table", async () => {
      const { data, error } = await client()
        .from("passport_adventure_days")
        .select("*");
      expect(error?.code === "42501" || (data ?? []).length === 0).toBe(true);
    });

    it("deleting the adventure takes its days with it", async () => {
      await deleteAdventure(alice.db, weekend);
      const { data } = await alice.db
        .from("passport_adventure_days")
        .select("*")
        .eq("adventure_id", weekend);
      expect(data ?? []).toHaveLength(0);
    });
  },
);
