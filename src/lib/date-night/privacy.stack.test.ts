// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { parseAnswer } from "@/domain/date-night/answer";
import { LORNE_AND_JESS as night } from "@/domain/date-night/nights/lorne-and-jess";

/**
 * **Date Night against a real database.** Real GoTrue accounts, real
 * PostgREST, real Postgres with the migration applied twice — every "cannot"
 * below is Postgres saying no.
 *
 * Runs only when the stack is up (skipped in the ordinary unit run):
 *
 *   node docs/product/date-night/verification/stack.mjs start
 *   DATE_NIGHT_STACK_ENV=~/passport/scratch/date-night-stack/env \
 *     npx vitest run src/lib/date-night/privacy.stack.test.ts
 *
 * Part-way through it restarts Postgres, GoTrue and PostgREST on the same
 * data, to prove an answer survives.
 */

const ENV_FILE = process.env.DATE_NIGHT_STACK_ENV;
const STACK_SCRIPT = path.resolve(
  __dirname,
  "../../../docs/product/date-night/verification/stack.mjs",
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
const client = (): SupabaseClient =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

/** The operator, in the SQL editor. */
async function asOperator<T = unknown>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  const stack = path.dirname(ENV_FILE!);
  const pg = createRequire(path.join(stack, "node_modules/"))("pg") as {
    Client: new (url: string) => {
      connect(): Promise<void>;
      query(sql: string, args: unknown[]): Promise<{ rows: T[] }>;
      end(): Promise<void>;
    };
  };
  const db = new pg.Client(env.ADVENTURES_STACK_PG!);
  await db.connect();
  try {
    return (await db.query(sql, args)).rows;
  } finally {
    await db.end();
  }
}

async function signUp(name: string) {
  const db = client();
  const email = `${name}-${Date.now()}@example.test`;
  const { data, error } = await db.auth.signUp({
    email,
    password: "correct horse battery",
  });
  if (error || !data.user) throw error ?? new Error("no user");
  return { email, id: data.user.id, db };
}

const answer = (message: string) => {
  const parsed = parseAnswer(
    {
      picks: { "cold-plunge": "yes", sunset: "maybe" },
      ownIdeas: ["Hot springs"],
      adventurous: 4,
      food: ["Hot chocolate"],
      message,
    },
    night,
  );
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.answer;
};

const anonAnswer = (body: unknown, slug = night.slug) =>
  client().rpc("passport_date_night_answer", { p_slug: slug, p_answer: body });

describe.skipIf(!ENV_FILE)(
  "Date Night privacy and persistence (real stack)",
  () => {
    it("does everything the brief asks, and refuses everything else", async () => {
      // Before setup the night takes nothing.
      const early = await anonAnswer(answer("too early"));
      expect(early.error?.code).toBe("P0002");
      expect(
        (await client().rpc("passport_date_night_open", { p_slug: night.slug }))
          .data,
      ).toBe(false);

      const lorne = await signUp("lorne");
      const mallory = await signUp("mallory");

      // Operator setup, by email; idempotent; not callable through the API.
      const setup = `select public.passport_date_night_setup($1, $2, 'Lorne ❤️ Jess', '2026-11-02', 'America/Vancouver', 'Around Vernon') as id`;
      const [first] = await asOperator<{ id: string }>(setup, [
        night.slug,
        lorne.email.toUpperCase(),
      ]);
      const [again] = await asOperator<{ id: string }>(setup, [
        night.slug,
        lorne.email,
      ]);
      expect(again!.id).toBe(first!.id);
      for (const db of [client(), mallory.db, lorne.db]) {
        const { error } = await db.rpc("passport_date_night_setup", {
          p_slug: "mine-now",
          p_owner_email: mallory.email,
          p_title: "x",
          p_on: "2026-11-02",
        });
        expect(error).not.toBeNull();
      }
      const noSuchAccount = asOperator(setup, [
        "someone-else",
        "nobody@example.test",
      ]);
      await expect(noSuchAccount).rejects.toThrow(/no Passport account/);

      // It is an ordinary adventure Lorne owns, kind date-night.
      const adventure = await lorne.db
        .from("passport_adventures")
        .select("id, kind, owner_id")
        .eq("id", first!.id)
        .single();
      expect(adventure.data).toMatchObject({
        kind: "date-night",
        owner_id: lorne.id,
      });
      expect(
        (
          await mallory.db
            .from("passport_adventures")
            .select("id")
            .eq("id", first!.id)
        ).data,
      ).toEqual([]);

      // Jess answers without signing in. She gets an id back and nothing else.
      expect(
        (await client().rpc("passport_date_night_open", { p_slug: night.slug }))
          .data,
      ).toBe(true);
      const saved = await anonAnswer(answer("Can't wait ❤️"));
      expect(saved.error).toBeNull();
      expect(saved.data).toMatch(/^[0-9a-f-]{36}$/);

      // Nobody but Lorne can read it: not anon, not another signed-in person.
      for (const db of [client(), mallory.db]) {
        const rows = await db.from("passport_date_night_answers").select("*");
        expect(rows.data ?? []).toEqual([]);
        const nights = await db.from("passport_date_nights").select("*");
        expect(nights.data ?? []).toEqual([]);
      }
      // Nor write around the function.
      const direct = await client()
        .from("passport_date_night_answers")
        .insert({ slug: night.slug, answer: { message: "forged" } });
      expect(direct.error).not.toBeNull();
      const directSignedIn = await mallory.db
        .from("passport_date_night_answers")
        .insert({ slug: night.slug, answer: { message: "forged" } });
      expect(directSignedIn.error).not.toBeNull();
      // Mallory cannot close the night or delete answers (RLS: zero rows touched).
      await mallory.db
        .from("passport_date_nights")
        .update({ open: false })
        .eq("slug", night.slug);
      await mallory.db
        .from("passport_date_night_answers")
        .delete()
        .eq("slug", night.slug);

      const read = await lorne.db
        .from("passport_date_night_answers")
        .select("id, answer, created_at")
        .eq("slug", night.slug);
      expect(read.error).toBeNull();
      expect(read.data).toHaveLength(1);
      expect(read.data![0]!.answer).toMatchObject({
        message: "Can't wait ❤️",
        adventurous: 4,
      });
      expect(parseAnswer(read.data![0]!.answer, night).ok).toBe(true);

      // It survives a restart of Postgres, GoTrue and PostgREST.
      execFileSync("node", [STACK_SCRIPT, "restart"], {
        stdio: "ignore",
        env: { ...process.env, STACK: path.dirname(ENV_FILE!) },
      });
      const after = await lorne.db
        .from("passport_date_night_answers")
        .select("id")
        .eq("slug", night.slug);
      expect(after.data).toHaveLength(1);

      // Limits: not an object, too large, too fast.
      expect((await anonAnswer([1, 2])).error?.code).toBe("22023");
      expect(
        (await anonAnswer({ message: "x".repeat(17_000) })).error?.code,
      ).toBe("54000");
      for (let i = 0; i < 4; i += 1)
        expect((await anonAnswer(answer(`again ${i}`))).error).toBeNull();
      const flood = await anonAnswer(answer("one too many"));
      expect(flood.error?.code).toBe("P0001");
      expect(flood.error?.hint).toBe("rate");
      expect(
        (await anonAnswer(answer("wrong night"), "somebody-else")).error?.code,
      ).toBe("P0002");

      // Lorne can tidy up and close it; then answers are refused.
      const one = (
        await lorne.db
          .from("passport_date_night_answers")
          .select("id")
          .eq("slug", night.slug)
          .limit(1)
      ).data![0]!;
      await lorne.db
        .from("passport_date_night_answers")
        .delete()
        .eq("id", one.id);
      expect(
        (
          await lorne.db
            .from("passport_date_night_answers")
            .select("id")
            .eq("slug", night.slug)
        ).data,
      ).toHaveLength(4);
      const close = await lorne.db
        .from("passport_date_nights")
        .update({ open: false })
        .eq("slug", night.slug)
        .select("open");
      expect(close.data).toEqual([{ open: false }]);
      expect((await anonAnswer(answer("closed"))).error?.code).toBe("P0002");
      await lorne.db
        .from("passport_date_nights")
        .update({ open: true })
        .eq("slug", night.slug);
    }, 120_000);
  },
);
