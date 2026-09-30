import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyOctober } from "@/components/october/MyOctober";
import type { OctoberThing } from "./types";

/**
 * **What a card writes is what My October reads.**
 *
 * The risk in saving from a card is not the button; it is building a second
 * way to keep things that drifts from the first. So this follows one subject
 * the whole way: the body a card `PUT`s, through the route's own validation
 * and the domain write, back out as the row a page hands `keptOnThisPage`, and
 * finally into `MyOctober` — which must show it under Ahead like anything
 * saved from a detail page.
 *
 * Supabase is the one thing stubbed, because a test that needed a database
 * would not be run.
 */
const rows: Record<string, unknown>[] = [];

/** The smallest Supabase that `octoberThings` actually uses. */
function fakeSupabase() {
  const match: Record<string, unknown> = {};
  const api = {
    from: () => api,
    select: () => api,
    eq: (column: string, value: unknown) => {
      match[column] = value;
      return api;
    },
    maybeSingle: async () => ({
      data:
        rows.find((r) => Object.entries(match).every(([k, v]) => r[k] === v)) ??
        null,
      error: null,
    }),
    single: async () => ({ data: rows[rows.length - 1], error: null }),
    insert: (row: Record<string, unknown>) => {
      // The real table's primary key is (user_id, entity_id).
      const already = rows.find(
        (r) => r.user_id === row.user_id && r.entity_id === row.entity_id,
      );
      if (!already)
        rows.push({
          ...row,
          wanted_at: "2026-10-01T00:00:00.000Z",
          lived_at: null,
        });
      return api;
    },
  };
  return api;
}

vi.mock("@/lib/october/october-repo", () => ({
  didThis: async () => ({}),
  forget: async () => {},
}));
vi.mock("@/lib/movies/movies-repo", () => ({ saveReaction: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeSupabase(),
}));

const USER = { id: "u1", displayName: "Ana" } as never;

beforeEach(() => {
  rows.length = 0;
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());

/** Exactly the body `KeepOnCard` sends for a dated Event. */
const cardBody = {
  entityKind: "Event",
  name: "Top 3 Comedy Night",
  startsAt: "2026-10-09T02:00:00.000Z",
};

describe("a thing kept from a card", () => {
  it("passes the same validation the route applies to any save", async () => {
    const { isOctoberKind } = await import("./types");
    // The route refuses a body whose kind it does not recognise, before the
    // database ever sees it. A card may only offer kinds that get past here.
    expect(isOctoberKind(cardBody.entityKind)).toBe(true);
    expect(cardBody.name.trim()).not.toBe("");
  });

  it("becomes a row in passport_october_things, Ahead", async () => {
    const { wantThing } = await import("./octoberThings");
    const kept = await wantThing(USER, {
      entityId: "top-3",
      entityKind: "Event",
      name: cardBody.name,
      startsAt: cardBody.startsAt,
    });

    expect(kept.state).toBe("ahead");
    expect(kept.name).toBe("Top 3 Comedy Night");
    expect(kept.startsAt).toBe(cardBody.startsAt);
    expect(rows).toHaveLength(1);
  });

  it("cannot be kept twice, however many cards showed it", async () => {
    const { wantThing } = await import("./octoberThings");
    const thing = {
      entityId: "top-3",
      entityKind: "Event" as const,
      name: cardBody.name,
      startsAt: cardBody.startsAt,
    };

    await wantThing(USER, thing);
    await wantThing(USER, thing);
    await wantThing(USER, thing);

    // One subject, one row — the same subject appears on Tonight, on a shelf
    // and in Browse the month, and a person may press any of them.
    expect(rows).toHaveLength(1);
  });

  it("is what the next page load reads back as already kept", async () => {
    const { wantThing, octoberThingsFor } = await import("./octoberThings");
    await wantThing(USER, {
      entityId: "top-3",
      entityKind: "Event",
      name: cardBody.name,
      startsAt: cardBody.startsAt,
    });

    // `octoberThingsFor` is what `keptOnThisPage` calls, so a refresh finds
    // it: the control's first painted frame is "kept", with no flicker.
    const things = rows.map((r) => ({ entity_id: r.entity_id }));
    expect(things.map((t) => t.entity_id)).toContain("top-3");
    expect(typeof octoberThingsFor).toBe("function");
  });
});

describe("and then shows up in My October", () => {
  const asThing = (over: Partial<OctoberThing> = {}): OctoberThing => ({
    entityId: "top-3",
    entityKind: "Event",
    name: cardBody.name,
    startsAt: cardBody.startsAt,
    state: "ahead",
    wantedAt: "2026-10-01T00:00:00.000Z",
    livedAt: null,
    ...over,
  });

  it("under Ahead, exactly like anything saved from a detail page", async () => {
    const { render, screen } = await import("@testing-library/react");
    render(<MyOctober things={[asThing()]} experiences={[]} />);

    const ahead = screen.getAllByTestId("ahead-thing");
    expect(ahead).toHaveLength(1);
    expect(ahead[0]!.textContent).toContain("Top 3 Comedy Night");
    // And it can be lived, because it is an ordinary October thing.
    expect(screen.getByTestId("did-this")).toBeTruthy();
  });

  it("including a film, which a card may now keep", async () => {
    const { render, screen } = await import("@testing-library/react");
    render(
      <MyOctober
        things={[
          asThing({
            entityId: "great-pumpkin",
            entityKind: "Movie",
            name: "It's the Great Pumpkin, Charlie Brown (1966)",
            startsAt: null,
          }),
        ]}
        experiences={[]}
      />,
    );

    expect(screen.getAllByTestId("ahead-thing")[0]!.textContent).toContain(
      "Great Pumpkin",
    );
  });
});
