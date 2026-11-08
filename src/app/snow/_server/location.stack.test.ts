// @vitest-environment node
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createAdventure } from "@/lib/adventures/store";
import { inviteLink, joinDay, startDay } from "./shared";
import { Off, readCrew, share, stop } from "./location";

/**
 * **Find your crew, against a real database**: opt-in, temporary, mutual,
 * private. Real GoTrue accounts, real PostgREST, Postgres with the Snow and
 * location migrations applied twice. Every refusal asserted here is
 * Postgres', not the app's.
 *
 *   node docs/product/snow/verification/stack.mjs start
 *   SNOW_STACK_ENV=~/passport/scratch/snow-stack/env \
 *     npx vitest run src/app/snow/_server/location.stack.test.ts
 */
const ENV_FILE = process.env.SNOW_STACK_ENV?.replace(
  /^~/,
  process.env.HOME ?? "",
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

const client = (): SupabaseClient =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

async function signUp(name: string) {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "correct horse battery",
  });
  if (error || !data.user) throw error ?? new Error("no user");
  return { id: data.user.id, db };
}

const rider = {
  discipline: "ski",
  ability: "intermediate",
  ownGear: true,
} as const;
/** Superuser SQL against the throwaway stack, with the stack's own `pg`. */
const nowSql = async <T>(q: string, args: unknown[] = []): Promise<T[]> => {
  const pg = createRequire(path.join(path.dirname(ENV_FILE!), "node_modules/"))(
    "pg",
  ) as {
    Client: new (url: string) => {
      connect(): Promise<void>;
      query(sql: string, args: unknown[]): Promise<{ rows: T[] }>;
      end(): Promise<void>;
    };
  };
  const c = new pg.Client(env.ADVENTURES_STACK_PG!);
  await c.connect();
  try {
    return (await c.query(q, args)).rows;
  } finally {
    await c.end();
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!ENV_FILE)("Find your crew (real stack)", () => {
  it("is opt-in, mutual, rounded, temporary, stoppable and private", async () => {
    const lorne = await signUp("lorne");
    const jess = await signUp("jess");
    const mallory = await signUp("mallory");

    const id = await startDay(lorne.db, {
      title: "Where are you",
      name: "Lorne",
      discipline: "ski",
      ability: "advanced",
      ownGear: true,
    });
    const token = await inviteLink(lorne.db, id, lorne.id);
    await joinDay(jess.db, jess.id, token, { name: "Jess", ...rider });

    const fix = { lat: 50.12345678, lng: -122.9876543, accuracyM: 8 };

    // ---- nothing is shared until someone chooses to
    expect(await readCrew(lorne.db, id, lorne.id)).toEqual({
      sharing: null,
      others: [],
    });
    expect(
      await nowSql(
        "select count(*)::int n from passport_snow_locations where adventure_id = $1",
        [id],
      ),
    ).toEqual([{ n: 0 }]);

    // ---- Lorne shares; he sees nobody, and Jess (not sharing) sees nobody
    await share(lorne.db, id, fix, 30);
    const l1 = await readCrew(lorne.db, id, lorne.id);
    expect(l1.sharing).not.toBeNull();
    expect(l1.others).toEqual([]);
    expect((await readCrew(jess.db, id, jess.id)).others).toEqual([]);
    // Direct to PostgREST too: Jess is not sharing, so she reads nothing.
    expect(
      (await jess.db.from("passport_snow_locations").select("*")).data,
    ).toEqual([]);

    // ---- stored rounded to ~11 m, by Postgres, whatever the phone sent
    const stored = await nowSql<{ lat: number; lng: number }>(
      "select lat, lng from passport_snow_locations where adventure_id = $1",
      [id],
    );
    expect(stored).toEqual([{ lat: 50.1235, lng: -122.9877 }]);

    // ---- Jess shares: now each sees the other, with no account ids
    await share(
      jess.db,
      id,
      { lat: 50.1246, lng: -122.9881, accuracyM: 20 },
      60,
    );
    const l2 = await readCrew(lorne.db, id, lorne.id);
    const j2 = await readCrew(jess.db, id, jess.id);
    expect(l2.others).toHaveLength(1);
    expect(j2.others).toHaveLength(1);
    expect(l2.others[0]).toMatchObject({ lat: 50.1246, lng: -122.9881 });
    expect(JSON.stringify(l2) + JSON.stringify(j2)).not.toContain(jess.id);
    expect(JSON.stringify(l2) + JSON.stringify(j2)).not.toContain(lorne.id);

    // ---- a share cannot be lengthened or re-homed behind the app's back
    const extend = await lorne.db
      .from("passport_snow_locations")
      .update({ expires_at: new Date(Date.now() + 6 * 3600_000).toISOString() })
      .eq("adventure_id", id);
    expect(extend.error?.code).toBe("42501");
    const tooLong = await lorne.db.from("passport_snow_locations").insert({
      adventure_id: id,
      lat: 1,
      lng: 1,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 3600_000).toISOString(),
    });
    expect(tooLong.error).not.toBeNull();
    // ...nor can anyone write or stop somebody else's position
    const forged = await lorne.db
      .from("passport_snow_locations")
      .update({ lat: 0, lng: 0 })
      .eq("adventure_id", id)
      .eq("user_id", jess.id)
      .select();
    expect(forged.data ?? []).toEqual([]);
    const cut = await lorne.db
      .from("passport_snow_locations")
      .delete()
      .eq("user_id", jess.id)
      .select();
    expect(cut.data ?? []).toEqual([]);

    // ---- moving the dot: too soon is quietly skipped, later is applied,
    //      and the clock never moves
    const before = (await readCrew(lorne.db, id, lorne.id)).sharing!.expiresAt;
    await share(lorne.db, id, { lat: 50.2, lng: -123.1, accuracyM: 5 }, null);
    expect((await readCrew(jess.db, id, jess.id)).others[0]).toMatchObject({
      lat: 50.1235,
    });
    await sleep(10_500);
    await share(lorne.db, id, { lat: 50.2, lng: -123.1, accuracyM: 5 }, null);
    expect((await readCrew(jess.db, id, jess.id)).others[0]).toMatchObject({
      lat: 50.2,
      lng: -123.1,
    });
    expect((await readCrew(lorne.db, id, lorne.id)).sharing!.expiresAt).toBe(
      before,
    );

    // ---- strangers, and other kinds of adventure, see and change nothing
    await expect(readCrew(mallory.db, id, mallory.id)).rejects.toThrow();
    expect(
      (await mallory.db.from("passport_snow_locations").select("*")).data,
    ).toEqual([]);
    await expect(share(mallory.db, id, fix, 30)).rejects.toThrow();
    const hockey = await createAdventure(lorne.db, {
      kind: "hockey-night",
      title: "Game",
      displayName: "Lorne",
      startsOn: null,
      endsOn: null,
      timeZone: null,
      destinationLabel: null,
      destinationTownId: null,
    });
    await expect(share(lorne.db, hockey, fix, 30)).rejects.toThrow();

    // ---- time is up: even the owner of a finished share cannot read it,
    //      and the next ask erases it
    // (The guard trigger is the very thing that stops a client doing this.)
    await nowSql(
      "alter table passport_snow_locations disable trigger passport_snow_locations_guard",
    );
    await nowSql(
      "update passport_snow_locations set expires_at = now() - interval '1 minute', started_at = now() - interval '31 minutes' where user_id = $1",
      [lorne.id],
    );
    await nowSql(
      "alter table passport_snow_locations enable trigger passport_snow_locations_guard",
    );
    // Lorne's own is unreadable now, and with no live share of his own he
    // sees nobody else's either (mutual).
    expect(
      (await lorne.db.from("passport_snow_locations").select("user_id")).data,
    ).toEqual([]);
    expect((await readCrew(jess.db, id, jess.id)).others).toEqual([]);
    expect(
      await nowSql(
        "select count(*)::int n from passport_snow_locations where user_id = $1",
        [lorne.id],
      ),
    ).toEqual([{ n: 0 }]);

    // ---- Stop deletes the row (not hides it); the other side goes dark
    await share(lorne.db, id, fix, 30);
    expect((await readCrew(jess.db, id, jess.id)).others).toHaveLength(1);
    await stop(jess.db, id);
    expect(
      await nowSql(
        "select count(*)::int n from passport_snow_locations where user_id = $1",
        [jess.id],
      ),
    ).toEqual([{ n: 0 }]);
    expect((await readCrew(lorne.db, id, lorne.id)).others).toEqual([]);

    // ---- leaving erases it
    await share(jess.db, id, fix, 30);
    await jess.db
      .from("passport_adventure_members")
      .delete()
      .eq("adventure_id", id)
      .eq("user_id", jess.id);
    expect(
      await nowSql(
        "select count(*)::int n from passport_snow_locations where user_id = $1",
        [jess.id],
      ),
    ).toEqual([{ n: 0 }]);
  }, 60_000);

  it("says plainly when the table is not there yet", async () => {
    // The migration is absent in production until applied; the app must say so.
    const lorne = await signUp("lorne-off");
    const id = await startDay(lorne.db, {
      title: "Off",
      name: "Lorne",
      discipline: "ski",
      ability: "advanced",
      ownGear: true,
    });
    await nowSql(
      "alter table passport_snow_locations rename to passport_snow_locations_x",
    );
    try {
      await expect(readCrew(lorne.db, id, lorne.id)).rejects.toBeInstanceOf(
        Off,
      );
      await expect(
        share(lorne.db, id, { lat: 1, lng: 1, accuracyM: null }, 30),
      ).rejects.toBeInstanceOf(Off);
    } finally {
      await nowSql(
        "alter table passport_snow_locations_x rename to passport_snow_locations",
      );
      await nowSql("notify pgrst, 'reload schema'");
    }
  }, 30_000);
});
