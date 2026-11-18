import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { session } = vi.hoisted(() => ({
  session: { current: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => session.current,
}));

import { ownsNight } from "./store";

/** A stand-in for the signed-in server client, with one night row (or none). */
function clientWith(opts: {
  user: boolean;
  row?: { slug: string } | null;
  error?: boolean;
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ? { id: "owner" } : null },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            opts.error
              ? { data: null, error: { message: "boom" } }
              : { data: opts.row ?? null, error: null },
        }),
      }),
    }),
  };
}

describe("ownsNight", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });
  afterEach(() => {
    session.current = null;
  });

  it("is true only for a signed-in caller whose night row is visible", async () => {
    session.current = clientWith({
      user: true,
      row: { slug: "lorne-and-jess" },
    });
    await expect(ownsNight("lorne-and-jess")).resolves.toBe(true);
  });

  it("is false when signed out, even if a row would be visible", async () => {
    session.current = clientWith({
      user: false,
      row: { slug: "lorne-and-jess" },
    });
    await expect(ownsNight("lorne-and-jess")).resolves.toBe(false);
  });

  it("is false for a signed-in stranger (no row under RLS)", async () => {
    session.current = clientWith({ user: true, row: null });
    await expect(ownsNight("lorne-and-jess")).resolves.toBe(false);
  });

  it("fails closed on a database error", async () => {
    session.current = clientWith({ user: true, error: true });
    await expect(ownsNight("lorne-and-jess")).resolves.toBe(false);
  });

  it("fails closed when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    session.current = clientWith({
      user: true,
      row: { slug: "lorne-and-jess" },
    });
    await expect(ownsNight("lorne-and-jess")).resolves.toBe(false);
  });
});
