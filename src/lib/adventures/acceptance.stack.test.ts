// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  addItem,
  adventureFor,
  adventuresOf,
  createAdventure,
  createInvite,
  deleteAdventure,
  describeInvite,
  hashInviteToken,
  invitesOf,
  redeemInvite,
  Refused,
  removeItem,
  removeMember,
  respond,
  revokeInvite,
  setHockeyFacts,
  updateAdventure,
  updateItem,
  updateMe,
} from "./store";

/**
 * **The group foundation, against a real database — three real people.**
 *
 * Alice, Bob and Charlie are real GoTrue accounts with real JWTs, talking to
 * a real PostgREST over real Postgres with the proposed migration applied.
 * Nothing is mocked: every "cannot" below is row-level security, a column
 * grant or a database function saying no.
 *
 * Runs only when a stack is up (it is skipped in the ordinary unit run):
 *
 *   node docs/product/group-adventures/verification/stack.mjs start
 *   ADVENTURES_STACK_ENV=/tmp/adventures-stack/env \
 *     npx vitest run src/lib/adventures/acceptance.stack.test.ts
 *
 * The suite restarts the stack part-way through (Postgres, GoTrue and
 * PostgREST, same data directory) to prove state survives.
 */

const ENV_FILE = process.env.ADVENTURES_STACK_ENV;
const STACK_SCRIPT = path.resolve(
  __dirname,
  "../../../docs/product/group-adventures/verification/stack.mjs",
);

function readEnv(file: string): Record<string, string> {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
}

const env = ENV_FILE ? readEnv(ENV_FILE) : {};
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function client(): SupabaseClient {
  return createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Person {
  readonly name: string;
  readonly email: string;
  readonly id: string;
  db: SupabaseClient;
}

const PASSWORD = "puck-drops-at-seven-9";
const stamp = Date.now().toString(36);

async function signUp(name: string): Promise<Person> {
  const db = client();
  const email = `${name.toLowerCase()}-${stamp}@example.test`;
  const { data, error } = await db.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { display_name: name } },
  });
  if (error || !data.user || !data.session) {
    throw new Error(`sign-up failed for ${name}: ${error?.message}`);
  }
  return { name, email, id: data.user.id, db };
}

/** A fresh client, signed in with a password — as after a restart. */
async function signIn(person: Person): Promise<void> {
  // Straight after a restart the first request can land on a pooled
  // keep-alive socket to the old proxy ("fetch failed"). A real client
  // retries; so does this, briefly. A wrong password is not retried.
  let last = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const db = client();
    const { error } = await db.auth.signInWithPassword({
      email: person.email,
      password: PASSWORD,
    });
    if (!error) {
      person.db = db;
      return;
    }
    last = error.message;
    if (!/fetch failed/i.test(last)) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`sign-in failed for ${person.name}: ${last}`);
}

/** Rows a raw table read returns, or the refusal — never throws. */
async function rawRows(
  db: SupabaseClient,
  table: string,
  filter?: [string, string],
) {
  let query = db.from(table).select("*");
  if (filter) query = query.eq(filter[0], filter[1]);
  const { data, error } = await query;
  return { rows: data ?? [], error };
}

const ADVENTURE_TABLES = [
  "passport_adventures",
  "passport_adventure_members",
  "passport_adventure_invites",
  "passport_adventure_items",
  "passport_adventure_responses",
  "passport_adventure_hockey",
] as const;

/** Rogers Arena is not an Atlas entity today; any stable id stands in for one. */
const ARENA_REF = "atlas-entity-rogers-arena";

describe.skipIf(!ENV_FILE)(
  "group adventures — three real people, one real database",
  () => {
    let alice: Person;
    let bob: Person;
    let charlie: Person;
    let nightA = "";
    let nightB = "";
    let conferenceC = "";
    let bobsLink = "";
    let openLinkA = "";
    let bobsItem = "";
    let alicesItem = "";
    let charliesItem = "";

    it("Alice, Bob and Charlie sign up through Passport's real auth (GoTrue)", async () => {
      [alice, bob, charlie] = await Promise.all([
        signUp("Alice"),
        signUp("Bob"),
        signUp("Charlie"),
      ]);
      expect(new Set([alice.id, bob.id, charlie.id]).size).toBe(3);
    });

    it("Alice creates Hockey Night A, with the game's facts in the hockey extension", async () => {
      nightA = await createAdventure(alice.db, {
        kind: "hockey-night",
        title: "Hockey Night A",
        startsOn: "2026-10-25",
        endsOn: null,
        timeZone: "America/Vancouver",
        destinationLabel: "Vancouver",
        destinationTownId: "vancouver",
        displayName: "Alice",
        hockey: {
          puckDrop: "2026-10-26T02:00:00.000Z",
          homeTeam: "Canucks",
          awayTeam: "Wild",
          arenaAtlasRef: ARENA_REF,
          arenaLabel: "Rogers Arena",
        },
      });
      expect(nightA).toMatch(/^[0-9a-f]{32}$/);

      const view = await adventureFor(alice.db, nightA, alice.id);
      expect(view?.role).toBe("owner");
      expect(view?.members.map((m) => m.displayName)).toEqual(["Alice"]);
      expect(view?.hockey?.arenaLabel).toBe("Rogers Arena");
      expect(view?.hockey?.arenaAtlasRef).toBe(ARENA_REF);
    });

    it("Passport makes a link for Bob; holding it reveals only that it works and what kind it is", async () => {
      const { token, invite } = await createInvite(alice.db, nightA, alice.id, {
        label: "for Bob",
        maxUses: 1,
        expiresInDays: null,
      });
      bobsLink = token;
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(invite.maxUses).toBe(1);

      // Signed out, the link says: valid, a hockey night. No title, no owner.
      const described = await describeInvite(client(), token);
      expect(described).toEqual({ state: "valid", kind: "hockey-night" });

      // The token is not stored: the owner's own read shows a hash at most.
      const { rows } = await rawRows(alice.db, "passport_adventure_invites", [
        "adventure_id",
        nightA,
      ]);
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain(token);
      expect(rows[0].token_hash).toBe(hashInviteToken(token));
    });

    it("Bob joins Alice's night through the link, and both see the same night", async () => {
      const joined = await redeemInvite(bob.db, bobsLink, {
        displayName: "Bob",
        visibility: "members",
      });
      expect(joined).toBe(nightA);

      const bobs = await adventureFor(bob.db, nightA, bob.id);
      const alices = await adventureFor(alice.db, nightA, alice.id);
      expect(bobs?.role).toBe("participant");
      expect(bobs?.title).toBe("Hockey Night A");
      expect(bobs?.members.map((m) => m.displayName).sort()).toEqual([
        "Alice",
        "Bob",
      ]);
      expect(alices?.members.map((m) => m.displayName).sort()).toEqual([
        "Alice",
        "Bob",
      ]);
      expect((await adventuresOf(bob.db, bob.id)).map((a) => a.id)).toEqual([
        nightA,
      ]);
    });

    it("Bob takes part: proposes a stop, says he's in — but cannot confirm, invite or remove", async () => {
      bobsItem = await addItem(bob.db, nightA, bob.id, {
        atlasRef: null,
        label: "Pregame at the pub on Abbott",
        note: "Doors at 5",
        status: "proposed",
        onDay: "2026-10-25",
        startsAt: null,
      });
      alicesItem = await addItem(alice.db, nightA, alice.id, {
        atlasRef: ARENA_REF,
        label: "The game",
        note: null,
        status: "confirmed",
        onDay: "2026-10-25",
        startsAt: "2026-10-26T02:00:00.000Z",
      });
      await respond(bob.db, nightA, alicesItem, bob.id, "in");
      await respond(alice.db, nightA, alicesItem, alice.id, "in");
      await respond(bob.db, nightA, bobsItem, bob.id, "maybe");
      await respond(bob.db, nightA, bobsItem, bob.id, "in"); // changes, not duplicates

      // A participant may not add something already confirmed…
      await expect(
        addItem(bob.db, nightA, bob.id, {
          atlasRef: null,
          label: "Sneaky",
          note: null,
          status: "confirmed",
          onDay: null,
          startsAt: null,
        }),
      ).rejects.toBeInstanceOf(Refused);
      // …nor confirm his own proposal, nor touch Alice's.
      await expect(
        updateItem(bob.db, nightA, bobsItem, { status: "confirmed" }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        updateItem(bob.db, nightA, alicesItem, { note: "moved" }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        removeItem(bob.db, nightA, alicesItem),
      ).rejects.toBeInstanceOf(Refused);
      // Not an owner: no links, no seeing links, no removing, no renaming.
      await expect(
        createInvite(bob.db, nightA, bob.id, {
          label: null,
          maxUses: 1,
          expiresInDays: null,
        }),
      ).rejects.toBeInstanceOf(Refused);
      expect(await invitesOf(bob.db, nightA)).toEqual([]);
      const aliceMember = (await adventureFor(
        bob.db,
        nightA,
        bob.id,
      ))!.members.find((m) => m.role === "owner")!;
      await expect(
        removeMember(bob.db, nightA, aliceMember.memberId),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        updateAdventure(bob.db, nightA, { title: "Bob's night now" }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(deleteAdventure(bob.db, nightA)).rejects.toBeInstanceOf(
        Refused,
      );

      // Bob may still edit his own proposal while it is one.
      await updateItem(bob.db, nightA, bobsItem, { note: "Doors at 5:30" });

      // The owner manages the plan: Alice confirms Bob's stop.
      await updateItem(alice.db, nightA, bobsItem, { status: "confirmed" });

      const view = await adventureFor(bob.db, nightA, bob.id);
      const game = view!.items.find((i) => i.id === alicesItem)!;
      const pub = view!.items.find((i) => i.id === bobsItem)!;
      expect(game.responses).toEqual({ in: 2, maybe: 0, out: 0 });
      expect(game.yourResponse).toBe("in");
      expect(pub.status).toBe("confirmed");
      expect(pub.note).toBe("Doors at 5:30");
      expect(pub.mine).toBe(true);
      expect(pub.canChange).toBe(false); // confirmed now: the owner's
      expect(pub.responses.in).toBe(1);
    });

    it("Charlie creates Hockey Night B — same arena, same Atlas entity, entirely separate", async () => {
      nightB = await createAdventure(charlie.db, {
        kind: "hockey-night",
        title: "Hockey Night B",
        startsOn: "2026-11-02",
        endsOn: null,
        timeZone: null,
        destinationLabel: null,
        destinationTownId: null,
        displayName: "Charlie",
        hockey: {
          puckDrop: null,
          homeTeam: "Canucks",
          awayTeam: "Oilers",
          arenaAtlasRef: ARENA_REF,
          arenaLabel: "Rogers Arena",
        },
      });
      charliesItem = await addItem(charlie.db, nightB, charlie.id, {
        atlasRef: ARENA_REF,
        label: "The game",
        note: "Charlie's private plan",
        status: "confirmed",
        onDay: "2026-11-02",
        startsAt: null,
      });
      const b = await adventureFor(charlie.db, nightB, charlie.id);
      const a = await adventureFor(alice.db, nightA, alice.id);
      // Both point at the same Atlas entity; each sees only their own plan.
      expect(b!.items.map((i) => i.atlasRef)).toEqual([ARENA_REF]);
      expect(a!.items.filter((i) => i.atlasRef === ARENA_REF)).toHaveLength(1);
      expect(b!.items[0].note).toBe("Charlie's private plan");
      expect(a!.items.some((i) => i.note === "Charlie's private plan")).toBe(
        false,
      );
      expect(b!.members.map((m) => m.displayName)).toEqual(["Charlie"]);
    });

    it("Charlie cannot read or edit Night A — through the API or straight at the database", async () => {
      expect(await adventureFor(charlie.db, nightA, charlie.id)).toBeNull();
      expect(
        (await adventuresOf(charlie.db, charlie.id)).map((a) => a.id),
      ).toEqual([nightB]);

      for (const table of ADVENTURE_TABLES) {
        const column = table === "passport_adventures" ? "id" : "adventure_id";
        const { rows } = await rawRows(charlie.db, table, [column, nightA]);
        expect(rows, `${table} leaked Night A to Charlie`).toEqual([]);
      }

      await expect(
        updateAdventure(charlie.db, nightA, { title: "Charlie's now" }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(deleteAdventure(charlie.db, nightA)).rejects.toBeInstanceOf(
        Refused,
      );
      await expect(
        addItem(charlie.db, nightA, charlie.id, {
          atlasRef: null,
          label: "Gatecrash",
          note: null,
          status: "proposed",
          onDay: null,
          startsAt: null,
        }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        updateItem(charlie.db, nightA, alicesItem, { note: "x" }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        removeItem(charlie.db, nightA, alicesItem),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        respond(charlie.db, nightA, alicesItem, charlie.id, "out"),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        createInvite(charlie.db, nightA, charlie.id, {
          label: null,
          maxUses: null,
          expiresInDays: null,
        }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        setHockeyFacts(charlie.db, nightA, {
          puckDrop: null,
          homeTeam: "Hijacked",
          awayTeam: null,
          arenaAtlasRef: null,
          arenaLabel: null,
        }),
      ).rejects.toBeInstanceOf(Refused);

      // Nothing Charlie tried changed anything Alice sees.
      const a = await adventureFor(alice.db, nightA, alice.id);
      expect(a!.title).toBe("Hockey Night A");
      expect(a!.hockey!.homeTeam).toBe("Canucks");
      expect(a!.items).toHaveLength(2);
    });

    it("Alice cannot read or edit Night B", async () => {
      expect(await adventureFor(alice.db, nightB, alice.id)).toBeNull();
      for (const table of ADVENTURE_TABLES) {
        const column = table === "passport_adventures" ? "id" : "adventure_id";
        const { rows } = await rawRows(alice.db, table, [column, nightB]);
        expect(rows, `${table} leaked Night B to Alice`).toEqual([]);
      }
      await expect(
        updateAdventure(alice.db, nightB, { title: "Mine" }),
      ).rejects.toBeInstanceOf(Refused);
      await expect(
        updateItem(alice.db, nightB, charliesItem, { note: "x" }),
      ).rejects.toBeInstanceOf(Refused);
      expect(await adventureFor(bob.db, nightB, bob.id)).toBeNull();
    });

    it("Alice creates Conference C and is in A and C at once; Bob gains nothing from having joined A", async () => {
      conferenceC = await createAdventure(alice.db, {
        kind: "conference",
        title: "Conference C",
        startsOn: "2026-10-24",
        endsOn: "2026-10-27",
        timeZone: "America/Vancouver",
        destinationLabel: "Vancouver Convention Centre",
        destinationTownId: "vancouver",
        displayName: "Alice",
      });
      const mine = await adventuresOf(alice.db, alice.id);
      expect(mine.map((a) => a.id).sort()).toEqual(
        [nightA, conferenceC].sort(),
      );
      expect(mine.every((a) => a.role === "owner")).toBe(true);
      expect((await adventuresOf(bob.db, bob.id)).map((a) => a.id)).toEqual([
        nightA,
      ]);
      expect(await adventureFor(bob.db, conferenceC, bob.id)).toBeNull();

      // A conference is not a hockey night: the hockey extension refuses it.
      await expect(
        setHockeyFacts(alice.db, conferenceC, {
          puckDrop: null,
          homeTeam: "x",
          awayTeam: null,
          arenaAtlasRef: null,
          arenaLabel: null,
        }),
      ).rejects.toBeInstanceOf(Refused);
    });

    it("one person can be a participant in several adventures, each joined on its own", async () => {
      const { token } = await createInvite(alice.db, conferenceC, alice.id, {
        label: null,
        maxUses: null,
        expiresInDays: null,
      });
      // Conference rosters default to unlisted (the conference lane's rule).
      expect(
        await redeemInvite(bob.db, token, {
          displayName: "Bob",
          visibility: "hidden",
        }),
      ).toBe(conferenceC);
      const bobs = await adventuresOf(bob.db, bob.id);
      expect(bobs.map((a) => a.id).sort()).toEqual(
        [nightA, conferenceC].sort(),
      );
      expect(bobs.every((a) => a.role === "participant")).toBe(true);

      // Unlisted on C: Alice (owner) sees Bob; he sees himself.
      const ownerView = await adventureFor(alice.db, conferenceC, alice.id);
      expect(ownerView!.members.map((m) => m.displayName).sort()).toEqual([
        "Alice",
        "Bob",
      ]);
      // Still listed on A: his choice is per adventure.
      const aView = await adventureFor(alice.db, nightA, alice.id);
      expect(
        aView!.members.find((m) => m.displayName === "Bob")!.visibility,
      ).toBe("members");

      // And Charlie, joining C, does not see unlisted Bob — nor Night A.
      expect(
        await redeemInvite(charlie.db, token, {
          displayName: "Charlie",
          visibility: "members",
        }),
      ).toBe(conferenceC);
      const charliesC = await adventureFor(charlie.db, conferenceC, charlie.id);
      expect(charliesC!.members.map((m) => m.displayName).sort()).toEqual([
        "Alice",
        "Charlie",
      ]);
      expect(await adventureFor(charlie.db, nightA, charlie.id)).toBeNull();
      expect((await adventuresOf(charlie.db, charlie.id)).length).toBe(2);
    });

    it("invitations cannot be reused improperly", async () => {
      // Bob's single-use link is spent. Charlie cannot use it.
      expect(await describeInvite(client(), bobsLink)).toEqual({
        state: "used-up",
        kind: "hockey-night",
      });
      expect(
        await redeemInvite(charlie.db, bobsLink, {
          displayName: null,
          visibility: "members",
        }),
      ).toBeNull();
      expect(await adventureFor(charlie.db, nightA, charlie.id)).toBeNull();

      // Bob following it again lands him back in A, and spends nothing.
      expect(
        await redeemInvite(bob.db, bobsLink, {
          displayName: null,
          visibility: "members",
        }),
      ).toBe(nightA);

      // A guessed or mangled token is simply unknown.
      expect(await describeInvite(client(), "x".repeat(43))).toBeNull();
      expect(
        await redeemInvite(charlie.db, bobsLink.slice(0, -1) + "A", {
          displayName: null,
          visibility: "members",
        }),
      ).toBeNull();

      // A revoked link stops working at once.
      const revoked = await createInvite(alice.db, nightA, alice.id, {
        label: null,
        maxUses: null,
        expiresInDays: null,
      });
      await revokeInvite(alice.db, nightA, revoked.invite.id);
      expect((await describeInvite(client(), revoked.token))!.state).toBe(
        "revoked",
      );
      expect(
        await redeemInvite(charlie.db, revoked.token, {
          displayName: null,
          visibility: "members",
        }),
      ).toBeNull();

      // An expired link too (the owner may shorten a link's life).
      const expiring = await createInvite(alice.db, nightA, alice.id, {
        label: null,
        maxUses: null,
        expiresInDays: 1,
      });
      const { error } = await alice.db
        .from("passport_adventure_invites")
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq("id", expiring.invite.id);
      expect(error).toBeNull();
      expect((await describeInvite(client(), expiring.token))!.state).toBe(
        "expired",
      );
      expect(
        await redeemInvite(charlie.db, expiring.token, {
          displayName: null,
          visibility: "members",
        }),
      ).toBeNull();

      // Nobody may spend or refill a link's uses by hand — not even the owner.
      const raw = await alice.db
        .from("passport_adventure_invites")
        .update({ uses: 0 })
        .eq("adventure_id", nightA);
      expect(raw.error?.code).toBe("42501");

      // An open link for A, kept for the removal test.
      openLinkA = (
        await createInvite(alice.db, nightA, alice.id, {
          label: "group chat",
          maxUses: null,
          expiresInDays: null,
        })
      ).token;

      expect(await adventureFor(charlie.db, nightA, charlie.id)).toBeNull();
    });

    it("a removed member loses access at once, and an old link does not let them back", async () => {
      const view = await adventureFor(alice.db, nightA, alice.id);
      const bobInA = view!.members.find((m) => m.displayName === "Bob")!;
      await removeMember(alice.db, nightA, bobInA.memberId);

      expect(await adventureFor(bob.db, nightA, bob.id)).toBeNull();
      for (const table of ADVENTURE_TABLES) {
        const column = table === "passport_adventures" ? "id" : "adventure_id";
        const { rows } = await rawRows(bob.db, table, [column, nightA]);
        expect(rows, `${table} still shows Night A to removed Bob`).toEqual([]);
      }
      await expect(
        addItem(bob.db, nightA, bob.id, {
          atlasRef: null,
          label: "still here?",
          note: null,
          status: "proposed",
          onDay: null,
          startsAt: null,
        }),
      ).rejects.toBeInstanceOf(Refused);

      // His answers went with him; the stop he proposed stays with the group.
      const after = await adventureFor(alice.db, nightA, alice.id);
      expect(after!.items.find((i) => i.id === alicesItem)!.responses.in).toBe(
        1,
      );
      expect(after!.items.find((i) => i.id === bobsItem)!.addedBy).toBeNull();

      // The open link made before his removal does not undo it…
      expect(
        await redeemInvite(bob.db, openLinkA, {
          displayName: "Bob",
          visibility: "members",
        }),
      ).toBeNull();
      // …and neither does the one that was his.
      expect(
        await redeemInvite(bob.db, bobsLink, {
          displayName: "Bob",
          visibility: "members",
        }),
      ).toBeNull();
      // Removal from A touches nothing else: Bob is still in C.
      expect((await adventuresOf(bob.db, bob.id)).map((a) => a.id)).toEqual([
        conferenceC,
      ]);

      // Nobody removes the owner, and the owner cannot leave (delete instead).
      const aliceInA = after!.members.find((m) => m.role === "owner")!;
      await expect(
        removeMember(alice.db, nightA, aliceInA.memberId),
      ).rejects.toBeInstanceOf(Refused);
    });

    it("leaving is yours to do, and somebody who left may come back through a live link", async () => {
      const view = await adventureFor(charlie.db, conferenceC, charlie.id);
      await removeMember(charlie.db, conferenceC, view!.you.memberId);
      expect(
        await adventureFor(charlie.db, conferenceC, charlie.id),
      ).toBeNull();

      // An owner, inviting him again with a new link, can bring Bob back to A.
      const fresh = await createInvite(alice.db, nightA, alice.id, {
        label: "Bob again",
        maxUses: 1,
        expiresInDays: null,
      });
      expect(
        await redeemInvite(bob.db, fresh.token, {
          displayName: "Bob",
          visibility: "members",
        }),
      ).toBe(nightA);
      expect((await adventureFor(bob.db, nightA, bob.id))!.role).toBe(
        "participant",
      );

      await updateMe(bob.db, nightA, bob.id, { displayName: "Bobby" });
      expect(
        (await adventureFor(alice.db, nightA, alice.id))!.members
          .map((m) => m.displayName)
          .sort(),
      ).toEqual(["Alice", "Bobby"]);
    });

    it("unauthorised database access fails — anon, forged rows, privilege escalation", async () => {
      const anon = client();
      for (const table of [
        ...ADVENTURE_TABLES,
        "passport_adventure_removals",
      ]) {
        const { rows, error } = await rawRows(anon, table);
        expect(rows, `${table} readable signed out`).toEqual([]);
        expect(error?.code, `${table} should refuse anon outright`).toBe(
          "42501",
        );
      }
      const anonCreate = await anon.rpc("passport_create_adventure", {
        p_kind: "day",
        p_title: "anon",
      });
      expect(anonCreate.error).not.toBeNull();
      const anonRedeem = await anon.rpc("passport_redeem_adventure_invite", {
        p_token: openLinkA,
      });
      expect(anonRedeem.error).not.toBeNull();

      // No direct inserts: adventures and memberships come only from functions.
      const forgedAdventure = await charlie.db
        .from("passport_adventures")
        .insert({ kind: "day", title: "forged", owner_id: charlie.id });
      expect(forgedAdventure.error?.code).toBe("42501");
      const claimOwner = await charlie.db
        .from("passport_adventure_members")
        .insert({
          adventure_id: nightA,
          user_id: charlie.id,
          role: "owner",
        });
      expect(claimOwner.error?.code).toBe("42501");

      // A participant cannot promote himself, move himself, or rename the owner.
      const promote = await bob.db
        .from("passport_adventure_members")
        .update({ role: "owner" })
        .eq("adventure_id", nightA)
        .eq("user_id", bob.id);
      expect(promote.error?.code).toBe("42501");
      const renameOwner = await bob.db
        .from("passport_adventure_members")
        .update({ display_name: "Owned" })
        .eq("adventure_id", nightA)
        .eq("user_id", alice.id)
        .select("member_id");
      expect(renameOwner.data ?? []).toEqual([]);
      const changeOwner = await alice.db
        .from("passport_adventures")
        .update({ owner_id: charlie.id })
        .eq("id", nightA);
      expect(changeOwner.error?.code).toBe("42501");
      const changeKind = await alice.db
        .from("passport_adventures")
        .update({ kind: "day" })
        .eq("id", nightA);
      expect(changeKind.error?.code).toBe("42501");

      // Writing in somebody else's name.
      const forgedProposal = await bob.db
        .from("passport_adventure_items")
        .insert({
          adventure_id: nightA,
          label: "in Alice's name",
          added_by: alice.id,
        });
      expect(forgedProposal.error?.code).toBe("42501");
      const forgedAnswer = await bob.db
        .from("passport_adventure_responses")
        .insert({
          item_id: alicesItem,
          adventure_id: nightA,
          user_id: alice.id,
          response: "out",
        });
      expect(forgedAnswer.error?.code).toBe("42501");
      // Answering on Night B's item while claiming it belongs to C, where Bob is a member.
      const crossed = await bob.db.from("passport_adventure_responses").insert({
        item_id: charliesItem,
        adventure_id: conferenceC,
        user_id: bob.id,
        response: "in",
      });
      expect(crossed.error?.code).toBe("42501");
      // Moving an item from one adventure to another.
      const move = await alice.db
        .from("passport_adventure_items")
        .update({ adventure_id: conferenceC })
        .eq("id", alicesItem);
      expect(move.error?.code).toBe("42501");

      // The removal ledger is the database's alone.
      const ledger = await alice.db
        .from("passport_adventure_removals")
        .select("*");
      expect(ledger.error?.code).toBe("42501");

      // The membership helpers answer only for the caller.
      const probe = await charlie.db.rpc("passport_is_adventure_member", {
        p_adventure: nightA,
      });
      expect(probe.data).toBe(false);
    });

    it("state survives a restart of Postgres, GoTrue and PostgREST", async () => {
      execFileSync(process.execPath, [STACK_SCRIPT, "restart"], {
        env: { ...process.env },
        stdio: "ignore",
      });
      for (const person of [alice, bob, charlie]) await signIn(person);

      const a = await adventureFor(bob.db, nightA, bob.id);
      expect(a!.title).toBe("Hockey Night A");
      expect(a!.members.map((m) => m.displayName).sort()).toEqual([
        "Alice",
        "Bobby",
      ]);
      expect(a!.items.find((i) => i.id === bobsItem)!.status).toBe("confirmed");
      expect(a!.items.find((i) => i.id === alicesItem)!.responses.in).toBe(1);
      expect(a!.hockey!.arenaLabel).toBe("Rogers Arena");

      expect(
        (await adventuresOf(alice.db, alice.id)).map((x) => x.id).sort(),
      ).toEqual([nightA, conferenceC].sort());
      expect(await adventureFor(charlie.db, nightA, charlie.id)).toBeNull();
      expect(
        (await adventureFor(charlie.db, nightB, charlie.id))!.items[0].note,
      ).toBe("Charlie's private plan");
      // The spent link is still spent; the removal is still remembered.
      expect((await describeInvite(client(), bobsLink))!.state).toBe("used-up");
    }, 90_000);

    it("one person owns several adventures and deleting one leaves the rest alone", async () => {
      const extra = await createAdventure(charlie.db, {
        kind: "birthday",
        title: "Charlie's birthday",
        startsOn: null,
        endsOn: null,
        timeZone: null,
        destinationLabel: null,
        destinationTownId: null,
        displayName: "Charlie",
      });
      expect(
        (await adventuresOf(charlie.db, charlie.id)).filter(
          (x) => x.role === "owner",
        ),
      ).toHaveLength(2);
      await deleteAdventure(charlie.db, extra);
      expect(await adventureFor(charlie.db, extra, charlie.id)).toBeNull();
      expect(await adventureFor(charlie.db, nightB, charlie.id)).not.toBeNull();
    });
  },
);
