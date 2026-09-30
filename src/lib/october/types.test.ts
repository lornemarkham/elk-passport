import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OCTOBER_KINDS, isOctoberKind, type OctoberKind } from "./types";

/**
 * **The two halves of one contract, checked against each other.**
 *
 * `OCTOBER_KINDS` is the guard the API applies before writing; the check
 * constraint on `passport_october_things.entity_kind` is what the database
 * will actually accept. They are written in different languages, in different
 * repositories, by different hands — and when they disagree a person is told
 * their thing was kept and it was not.
 *
 * That is not hypothetical. Movie Night called `wantToDo({ entityKind:
 * "Movie" })` from 2026-09-22, this array never named `Movie`, and every call
 * was refused with a 400 while the screen behind the toast read *"It's in your
 * October."* Eight days, no failing test, because nothing anywhere compared
 * these two lists.
 *
 * So this test reads the SQL. It is deliberately not a hand-copied duplicate
 * of the list: a duplicate would have been updated in the same commit as the
 * mistake.
 */

/** Every kind the live check accepts, read out of the migration that set it. */
function kindsInTheCheckConstraint(): string[] {
  // Atlas owns this project's migration history, so the statements that change
  // a Passport table live there (`supabase/README.md`). The path is relative to
  // this repository inside the workspace both products sit in.
  const migration = resolve(
    process.cwd(),
    "../atlas/supabase/migrations/202609301000_october_things_movie.sql",
  );
  if (!existsSync(migration)) {
    // Loudly, not skipped. A contract test that quietly passes when it cannot
    // read one side of the contract is how the Movie bug lasted eight days.
    throw new Error(
      `Cannot check OCTOBER_KINDS against the database: ${migration} is not here. ` +
        `Atlas and Passport are checked out side by side in one workspace (see the root CLAUDE.md).`,
    );
  }
  const sql = readFileSync(migration, "utf8");
  const check = sql.match(
    /add constraint passport_october_things_entity_kind_check\s*check \(entity_kind in \(([^)]*)\)\)/i,
  );
  if (!check)
    throw new Error("No entity_kind check constraint in the migration.");
  return [...check[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe("what My October may hold", () => {
  it("accepts exactly what the database accepts", () => {
    expect([...OCTOBER_KINDS].sort()).toEqual(
      kindsInTheCheckConstraint().sort(),
    );
  });

  it("holds a Movie, because a film is a thing you mean to do in October", () => {
    expect(OCTOBER_KINDS).toContain<OctoberKind>("Movie");
    expect(isOctoberKind("Movie")).toBe(true);
    expect(kindsInTheCheckConstraint()).toContain("Movie");
  });

  it("still holds every kind it held before", () => {
    // The Experience migration widened this list by rewriting it, and dropped
    // `Movie` on the way past. Nothing may leave by accident again.
    for (const kind of [
      "Place",
      "Organization",
      "Activity",
      "Event",
      "Experience",
    ] as const) {
      expect(isOctoberKind(kind)).toBe(true);
    }
  });

  it("refuses anything else", () => {
    expect(isOctoberKind("Sandwich")).toBe(false);
    expect(isOctoberKind("place")).toBe(false);
    expect(isOctoberKind(undefined)).toBe(false);
    expect(isOctoberKind(null)).toBe(false);
    expect(isOctoberKind(7)).toBe(false);
  });
});
