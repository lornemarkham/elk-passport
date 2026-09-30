import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **My October, answering "what is coming up for me?"**
 *
 * The domain rule is pinned in `anticipation.test.ts`. These pin the page: the
 * signal appears, the order is the one a person would ask for, a thing the
 * calendar has gone past is shown honestly and is *not* moved to Lived, and a
 * subject with no dates is given no urgency at all.
 *
 * `now` is a prop for exactly this reason — a page that read the clock could
 * not be asked what it looks like on the 9th of October.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/october/mine",
}));
const didThis = vi.fn(async (id: string) => ({ entityId: id }));
const forget = vi.fn<(id: string) => Promise<void>>(async () => {});
vi.mock("@/lib/october/october-repo", () => ({
  didThis: (id: string) => didThis(id),
  forget: (id: string) => forget(id),
}));
vi.mock("@/lib/movies/movies-repo", () => ({ saveReaction: async () => ({}) }));

const { MyOctober } = await import("./MyOctober");

const noonOn = (day: string) => new Date(`${day}T19:00:00.000Z`);

const thing = (over: Partial<OctoberThing>): OctoberThing => ({
  entityId: "e1",
  entityKind: "Event",
  name: "A thing",
  startsAt: null,
  state: "ahead",
  wantedAt: "2026-09-20T10:00:00.000Z",
  livedAt: null,
  ...over,
});

const experience = (over: Partial<Experience>): Experience =>
  ({
    id: "e1",
    kind: "Event",
    title: "A thing",
    shortDescription: "",
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    regionIds: [],
    familyFriendly: true,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...over,
  }) as Experience;

/** The real Draconids: an Event Atlas holds as Oct 6 → Oct 10, date-only. */
const DRACONIDS = experience({
  id: "draconids",
  title: "Draconid meteor shower 2026",
  startTime: "2026-10-06T00:00:00.000Z",
  endTime: "2026-10-10T00:00:00.000Z",
  timePrecision: "day",
});
const draconids = (over: Partial<OctoberThing> = {}) =>
  thing({
    entityId: "draconids",
    name: "Draconid meteor shower 2026",
    startsAt: "2026-10-06T00:00:00.000Z",
    ...over,
  });

/** The real Field of Screams: nights listed, with gaps between them. */
const FIELD_OF_SCREAMS = experience({
  id: "fos",
  kind: "Experience",
  title: "Field of Screams",
  availability: {
    basis: "stated-days",
    days: ["2026-10-09", "2026-10-10", "2026-10-30", "2026-10-31"],
  },
});
const fieldOfScreams = () =>
  thing({ entityId: "fos", name: "Field of Screams", startsAt: null });

/** The real Black Mountain: its own record states no day at all. */
const BLACK_MOUNTAIN = experience({
  id: "bmhh",
  kind: "Experience",
  title: "The Black Mountain Haunted House",
  availability: { basis: "unstated" },
});

const nearnessOf = (row: HTMLElement) => row.getAttribute("data-nearness");
const rows = () => screen.getAllByTestId("ahead-thing");
const names = () => rows().map((r) => r.textContent ?? "");

beforeEach(() => {
  didThis.mockClear();
  forget.mockClear();
});

describe("a saved thing that is still to come", () => {
  it("is given a useful sense of how close it is", () => {
    render(
      <MyOctober
        things={[draconids()]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-01")}
      />,
    );

    expect(screen.getByTestId("nearness").textContent).toBe("In 5 days");
    expect(nearnessOf(rows()[0]!)).toBe("soon");
  });

  it("says Tonight on the night, which is why anyone opens this page", () => {
    render(
      <MyOctober
        things={[draconids()]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-06")}
      />,
    );

    expect(screen.getByTestId("nearness").textContent).toBe("On now");
  });
});

describe("a run of nights", () => {
  it("is counted, not flattened into a span", () => {
    render(
      <MyOctober
        things={[fieldOfScreams()]}
        experiences={[FIELD_OF_SCREAMS]}
        now={noonOn("2026-10-01")}
      />,
    );

    // Four listed nights with a three-week gap in the middle. "4 nights" is
    // the fact; "Oct 9 – Oct 31" would claim the twenty days between.
    expect(screen.getByTestId("nights").textContent).toBe("4 nights");
    expect(screen.getByTestId("nearness").textContent).not.toMatch(/–|-/);
  });

  it("is on now in the middle of itself, and not a last chance", () => {
    render(
      <MyOctober
        things={[fieldOfScreams()]}
        experiences={[FIELD_OF_SCREAMS]}
        now={noonOn("2026-10-09")}
      />,
    );

    expect(screen.getByTestId("nearness").textContent).toBe("On now");
    expect(screen.queryByTestId("last-chance")).toBeNull();
  });

  it("says so on the final night, and only then", () => {
    render(
      <MyOctober
        things={[fieldOfScreams()]}
        experiences={[FIELD_OF_SCREAMS]}
        now={noonOn("2026-10-31")}
      />,
    );

    expect(screen.getByTestId("nearness").textContent).toBe("Tonight");
    expect(screen.getByTestId("last-chance")).toBeTruthy();
  });
});

describe("the order Ahead is read in", () => {
  it("puts the sooner thing above the much later one", () => {
    render(
      <MyOctober
        things={[
          thing({
            entityId: "late",
            name: "Late",
            startsAt: "2026-10-30T02:00:00.000Z",
          }),
          draconids(),
        ]}
        experiences={[
          DRACONIDS,
          experience({ id: "late", startTime: "2026-10-30T02:00:00.000Z" }),
        ]}
        now={noonOn("2026-10-01")}
      />,
    );

    expect(names()[0]).toContain("Draconid");
    expect(names()[1]).toContain("Late");
  });

  it("puts a run that is on tonight above a concert three weeks out", () => {
    // The old order read `startsAt` alone, so Field of Screams — which has no
    // timestamp — sorted below everything dated, on the night it was on.
    render(
      <MyOctober
        things={[
          thing({
            entityId: "late",
            name: "Late concert",
            startsAt: "2026-10-30T02:00:00.000Z",
          }),
          fieldOfScreams(),
        ]}
        experiences={[
          FIELD_OF_SCREAMS,
          experience({ id: "late", startTime: "2026-10-30T02:00:00.000Z" }),
        ]}
        now={noonOn("2026-10-09")}
      />,
    );

    expect(names()[0]).toContain("Field of Screams");
  });
});

describe("a saved thing the calendar has gone past", () => {
  const passed = () =>
    render(
      <MyOctober
        things={[draconids()]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-25")}
      />,
    );

  it("does not become Lived", () => {
    passed();

    // The single most important assertion in this slice. Lived is the
    // person's word and a date passing is not them saying it.
    expect(screen.getAllByTestId("ahead-thing")).toHaveLength(1);
    expect(screen.queryAllByTestId("lived-thing")).toHaveLength(0);
  });

  it("says plainly that it has gone, and asks", () => {
    passed();

    expect(screen.getByTestId("nearness").textContent).toBe("Passed");
    expect(nearnessOf(rows()[0]!)).toBe("passed");
    expect(screen.getByText(/did you go\?/i)).toBeTruthy();
  });

  it("keeps both of the person's own answers within reach", () => {
    passed();

    // They can still say they went, or that they never did.
    expect(screen.getByTestId("did-this")).toBeTruthy();
    expect(screen.getByTestId("forget")).toBeTruthy();
  });

  it("sinks to the bottom, under everything still ahead", () => {
    render(
      <MyOctober
        things={[
          draconids(),
          thing({
            entityId: "late",
            name: "Still ahead",
            startsAt: "2026-10-30T02:00:00.000Z",
          }),
        ]}
        experiences={[
          DRACONIDS,
          experience({ id: "late", startTime: "2026-10-30T02:00:00.000Z" }),
        ]}
        now={noonOn("2026-10-25")}
      />,
    );

    expect(names()[0]).toContain("Still ahead");
    expect(names()[1]).toContain("Draconid");
  });
});

describe("what is already Lived", () => {
  it("stays Lived, whatever the calendar says", () => {
    render(
      <MyOctober
        things={[
          draconids({ state: "lived", livedAt: "2026-10-07T04:00:00.000Z" }),
        ]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-25")}
      />,
    );

    expect(screen.getAllByTestId("lived-thing")).toHaveLength(1);
    expect(screen.queryAllByTestId("ahead-thing")).toHaveLength(0);
  });

  it("carries no anticipation, because there is nothing left to anticipate", () => {
    render(
      <MyOctober
        things={[
          draconids({ state: "lived", livedAt: "2026-10-07T04:00:00.000Z" }),
        ]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-01")}
      />,
    );

    expect(screen.queryByTestId("nearness")).toBeNull();
  });
});

describe("a saved thing October holds no date for", () => {
  it("is given no urgency at all", () => {
    render(
      <MyOctober
        things={[
          thing({
            entityId: "bmhh",
            name: "The Black Mountain Haunted House",
            startsAt: null,
          }),
        ]}
        experiences={[BLACK_MOUNTAIN]}
        now={noonOn("2026-10-01")}
      />,
    );

    // Its nights live on its modes; its own record says `unstated`. Nothing
    // may be manufactured from that.
    expect(screen.queryByTestId("nearness")).toBeNull();
    expect(nearnessOf(rows()[0]!)).toBe("unknown");
    expect(names()[0]).toContain("Black Mountain");
  });

  it("renders a film sensibly, with its name and its two answers", () => {
    render(
      <MyOctober
        things={[
          thing({
            entityId: "great-pumpkin",
            entityKind: "Movie",
            name: "It's the Great Pumpkin, Charlie Brown (1966)",
          }),
        ]}
        experiences={[]}
        now={noonOn("2026-10-01")}
      />,
    );

    expect(names()[0]).toContain("Great Pumpkin");
    expect(screen.queryByTestId("nearness")).toBeNull();
    expect(screen.getByTestId("did-this")).toBeTruthy();
  });

  it("sits below the dated things rather than among them", () => {
    render(
      <MyOctober
        things={[
          thing({
            entityId: "great-pumpkin",
            entityKind: "Movie",
            name: "A film",
          }),
          draconids(),
        ]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-01")}
      />,
    );

    expect(names()[0]).toContain("Draconid");
    expect(names()[1]).toContain("A film");
  });
});

describe("what this slice did not touch", () => {
  it("still lets somebody say they did it", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");

    render(
      <MyOctober
        things={[draconids()]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-25")}
      />,
    );
    fireEvent.click(screen.getByTestId("did-this"));
    await waitFor(() => expect(didThis).toHaveBeenCalledWith("draconids"));
  });

  it("still lets somebody change their mind", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");

    render(
      <MyOctober
        things={[draconids()]}
        experiences={[DRACONIDS]}
        now={noonOn("2026-10-01")}
      />,
    );
    fireEvent.click(screen.getByTestId("forget"));
    await waitFor(() => expect(forget).toHaveBeenCalledWith("draconids"));
  });

  it("still shows a thing Atlas no longer returns, by its remembered name", () => {
    render(
      <MyOctober
        things={[draconids({ name: "Something Retired" })]}
        experiences={[]}
        now={noonOn("2026-10-01")}
      />,
    );

    expect(names()[0]).toContain("Something Retired");
    // And still says roughly how close it is, from the snapshot alone.
    //
    // **A known limit, recorded rather than papered over.** The row stores
    // `starts_at` as an instant and does not store `timePrecision`, so a
    // date-only Event kept at UTC midnight reads as the previous local
    // evening once Atlas stops returning it: the Draconids' "Oct 6" becomes
    // the 5th, and this says "In 4 days" rather than five. Reading UTC
    // midnight as "date-only" would fix these and break every genuine 5 p.m.
    // event — a heuristic this project has already measured and rejected.
    expect(screen.getByTestId("nearness").textContent).toBe("In 4 days");
  });
});
