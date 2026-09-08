import { describe, expect, it, vi } from "vitest";

/**
 * **What Passport asks the database for when it wants to know what somebody said.**
 *
 * One assertion, and it is the load-bearing one for the whole explicit/learned
 * separation: the read must be scoped to `source = 'explicit'`.
 *
 * Today a CHECK constraint means every row is explicit anyway, so dropping the
 * filter would break nothing and no test would notice — right up until the
 * constraint is relaxed to admit learned signals, which is the exact thing it
 * exists to allow. From that moment an unfiltered read mixes observations into
 * the set of stated preferences, and `preferencesFromRows` keeps whichever row
 * arrives last. A boundary somebody set loses to a pattern a model noticed,
 * silently and with no error anywhere.
 */
const filters: [string, unknown][] = [];

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        },
        then: (resolve: (r: unknown) => void) =>
          resolve({ data: [], error: null }),
      };
      return chain;
    },
  }),
}));

const { preferencesFor } = await import("./preferenceService");

describe("reading a person's stated preferences", () => {
  it("asks only for rows they actually stated", async () => {
    filters.length = 0;

    await preferencesFor({
      id: "user-a",
      email: "a@example.com",
      displayName: "A",
    });

    expect(filters).toContainEqual(["user_id", "user-a"]);
    // The line this test exists for.
    expect(filters).toContainEqual(["source", "explicit"]);
  });
});
