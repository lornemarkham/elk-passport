import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { OctoberDiscovery } from "@/components/labs/october/synthesis/OctoberDiscovery";
import { OctoberTray } from "@/components/labs/october/OctoberTray";
import { ChoicesLink } from "@/components/labs/october/ChoicesLink";
import { emptyTray } from "@/components/labs/october/tray";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import { MyOctober } from "@/components/october/MyOctober";
import type { Possibility } from "./possibility";
import type { Days } from "./filters";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **Choose → Choices → My October, followed the whole way.**
 *
 * This is the launch-critical path and it could not be walked by hand: the
 * in-app browser is signed out and signing in is not something this agent may
 * do. So it is walked deterministically instead, through the real pieces —
 * the synthesis surface, the real `useKeeping` hook, the real route path, the
 * real `wantThing` write, the real `octoberThingsFor` read, and the real
 * `MyOctober` page component.
 *
 * Only two things are stubbed: Supabase (a test that needed a database would
 * not be run) and `fetch`, which is pointed at the same domain write the route
 * handler calls so the hop is real rather than mocked away.
 *
 * What this cannot prove is stated plainly in the report: that a live Supabase
 * with RLS accepts the row for a real signed-in person.
 */

const rows: Record<string, unknown>[] = [];

/**
 * The smallest Supabase `octoberThings` actually uses.
 *
 * Two shapes, because the real client has two: a **read** builder that is
 * awaited directly (`octoberThingsFor`) or finished with `maybeSingle`, and a
 * **write** builder finished with `single`. Collapsing them into one thenable
 * object made every intermediate `await` resolve to a row list, which is not
 * what `wantThing` is holding when it calls `.insert()`.
 */
function fakeSupabase() {
  const read = (match: Record<string, unknown>) => {
    const matching = () =>
      rows.filter((r) => Object.entries(match).every(([k, v]) => r[k] === v));
    const builder = {
      eq: (column: string, value: unknown) => {
        match[column] = value;
        return builder;
      },
      order: () => builder,
      maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
      single: async () => ({ data: matching()[0] ?? null, error: null }),
      then: (resolve: (r: { data: unknown; error: null }) => void) =>
        resolve({ data: matching(), error: null }),
    };
    return builder;
  };

  const written = { row: null as Record<string, unknown> | null };
  const write = {
    select: () => write,
    single: async () => ({ data: written.row, error: null }),
  };

  return {
    from: () => ({
      select: () => read({}),
      insert: (row: Record<string, unknown>) => {
        const already = rows.find(
          (r) => r.user_id === row.user_id && r.entity_id === row.entity_id,
        );
        written.row = already ?? {
          state: "ahead",
          starts_at: null,
          ...row,
          wanted_at: "2026-10-01T00:00:00.000Z",
          lived_at: null,
        };
        if (!already) rows.push(written.row);
        return write;
      },
      delete: () => read({}),
    }),
  };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/labs/october/synthesis",
}));
vi.mock("@/lib/october/october-repo", () => ({
  didThis: async () => ({}),
  forget: async () => {},
}));
vi.mock("@/lib/movies/movies-repo", () => ({ saveReaction: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeSupabase(),
}));

const USER = { id: "u1", displayName: "Ana" } as never;

/**
 * Press Choose on a named thing rather than on whatever happens to be first.
 *
 * The ranking decides the order and the ranking is allowed to change; a test
 * that clicked position zero was really asserting today's sort order, and it
 * broke the moment the film outranked the haunt.
 */
function choose(title: string) {
  const card = screen
    .getAllByTestId(/^(row|tile|lead)$/)
    .find((el) => el.textContent?.includes(title))!;
  fireEvent.click(within(card).getByRole("button", { name: "Choose" }));
}

const DAYS: Days = {
  today: "2026-10-01",
  tomorrow: "2026-10-02",
  weekend: ["2026-10-02", "2026-10-03", "2026-10-04"],
};

const HAUNT: Possibility = {
  id: "exp-field-of-screams",
  source: "atlas",
  title: "Field of Screams",
  availability: {
    shape: "window",
    label: "SEP 25–NOV 1",
    days: ["2026-10-01", "2026-10-02"],
    tonight: true,
  },
  setting: "outdoor-night",
  href: "/passport/exp-field-of-screams?kind=experiences",
  text: "a haunted corn maze",
  tags: ["go-out"],
  keepAs: "Experience",
  startsAt: null,
  image: { src: "https://example.test/a.jpg", alt: "a photograph" },
};

const FILM: Possibility = {
  ...HAUNT,
  id: "the-changeling",
  source: "movie",
  title: "The Changeling",
  keepAs: "Movie",
  setting: "indoor",
  tags: ["stay-in", "watch"],
  availability: {
    shape: "anytime",
    label: "ANY NIGHT · 1H 47M",
    days: [],
    tonight: true,
  },
};

const POOL = [HAUNT, FILM];
const ctx = { today: DAYS.today, weather: {} };

/**
 * `fetch` routed into the same domain write the API route performs.
 *
 * The route itself validates the kind and then calls `wantThing`; doing that
 * here keeps the hop real — a body the control sends that `wantThing` would
 * reject still fails this test.
 */
function routeFetchInto(write: typeof import("@/lib/october/octoberThings")) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const id = decodeURIComponent(String(url).split("/").pop()!);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const { isOctoberKind } = await import("@/lib/october/types");
    if (init?.method === "PUT") {
      if (!isOctoberKind(body.entityKind)) {
        return new Response(null, { status: 400 });
      }
      await write.wantThing(USER, {
        entityId: id,
        entityKind: body.entityKind,
        name: body.name,
        startsAt: body.startsAt ?? null,
      });
    }
    return new Response(null, { status: 200 });
  });
}

beforeEach(() => {
  rows.length = 0;
  forgetEverythingKept();
  emptyTray();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("choosing from the synthesis writes the one October row", () => {
  it("lands in passport_october_things with the kind October stores", async () => {
    const write = await import("@/lib/october/octoberThings");
    vi.stubGlobal("fetch", routeFetchInto(write));

    render(
      <OctoberDiscovery
        possibilities={POOL}
        ctx={ctx}
        days={DAYS}
        weather={{}}
        areaName="Vernon, BC"
        signedIn
        kept={[]}
      />,
    );

    choose("Field of Screams");
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Chosen" }).length).toBe(1),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].entity_id).toBe(HAUNT.id);
    expect(rows[0].entity_kind).toBe("Experience");
    expect(rows[0].user_id).toBe("u1");
  });

  it("reads back as kept, which is what the next page load paints", async () => {
    const write = await import("@/lib/october/octoberThings");
    vi.stubGlobal("fetch", routeFetchInto(write));

    render(
      <OctoberDiscovery
        possibilities={POOL}
        ctx={ctx}
        days={DAYS}
        weather={{}}
        signedIn
        kept={[]}
      />,
    );
    choose("Field of Screams");
    await waitFor(() => expect(rows).toHaveLength(1));

    // `octoberThingsFor` is what `keptOnThisPage` calls; the ids it returns
    // are what the server hands back as `kept` on the next render.
    const back = await write.octoberThingsFor(USER);
    expect(back.map((t) => t.entityId)).toContain(HAUNT.id);
  });

  it("is still chosen after a reload, and after moving to another mode", async () => {
    const write = await import("@/lib/october/octoberThings");
    vi.stubGlobal("fetch", routeFetchInto(write));

    // What the server would hand the page on the way back from a detail.
    const { unmount } = render(
      <OctoberDiscovery
        possibilities={POOL}
        ctx={ctx}
        days={DAYS}
        weather={{}}
        signedIn
        kept={[HAUNT.id]}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Chosen" }).length).toBe(1);
    unmount();
    forgetEverythingKept();

    // Same page, now in a filtered mode: the same choice, still chosen.
    render(
      <OctoberDiscovery
        possibilities={POOL}
        ctx={ctx}
        days={DAYS}
        weather={{}}
        signedIn
        kept={[HAUNT.id]}
      />,
    );
    fireEvent.click(screen.getByText("get out of the house"));
    expect(screen.getByRole("button", { name: "Chosen" })).toBeInTheDocument();
  });
});

describe("and shows up in Choices, both ways in", () => {
  it("counts in the header control and in the floating one", async () => {
    const write = await import("@/lib/october/octoberThings");
    vi.stubGlobal("fetch", routeFetchInto(write));

    render(
      <>
        <ChoicesLink seed={[]} signedIn />
        <OctoberDiscovery
          possibilities={POOL}
          ctx={ctx}
          days={DAYS}
          weather={{}}
          signedIn
          kept={[]}
        />
        <OctoberTray seed={[]} signedIn title="Choices" />
      </>,
    );

    choose("Field of Screams");
    await waitFor(() =>
      expect(screen.getByTestId("choices-link")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("choices-tray")).toHaveTextContent("1");

    // The header control opens the drawer that was always there rather than
    // navigating, so a search four filters deep survives looking at it.
    fireEvent.click(screen.getByTestId("choices-link"));
    const drawer = screen
      .getByRole("link", { name: /open my october/i })
      .closest("div")!.parentElement!;
    expect(within(drawer).getByText("Field of Screams")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open my october/i }),
    ).toHaveAttribute("href", "/october/mine");
  });

  it("arrives in My October as an ordinary October thing", () => {
    const thing: OctoberThing = {
      entityId: HAUNT.id,
      entityKind: "Experience",
      name: "Field of Screams",
      startsAt: null,
      state: "ahead",
      wantedAt: "2026-10-01T00:00:00.000Z",
      livedAt: null,
    };
    render(<MyOctober things={[thing]} experiences={[]} />);
    const ahead = screen.getAllByTestId("ahead-thing");
    expect(ahead).toHaveLength(1);
    expect(ahead[0].textContent).toContain("Field of Screams");
  });
});
