import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **A month, read back in the verbs somebody would use.**
 *
 * The experiment: a My October that can hold an intention as well as an
 * entity. These pin the composition that makes that legible — Went, Watched,
 * Made — and the one interaction that turns a wish into a plan.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/october/mine",
}));
const didThis = vi.fn(async (id: string) => ({ entityId: id }));
const forget = vi.fn<(id: string) => Promise<void>>(async () => {});
const planFor = vi.fn(async (id: string, day: string | null) => ({
  entityId: id,
  startsAt: day,
}));
vi.mock("@/lib/october/october-repo", () => ({
  didThis: (id: string) => didThis(id),
  forget: (id: string) => forget(id),
  planFor: (id: string, day: string | null) => planFor(id, day),
}));
vi.mock("@/lib/movies/movies-repo", () => ({ saveReaction: async () => ({}) }));

const { MyOctober } = await import("./MyOctober");

const NOW = new Date("2026-10-09T19:00:00.000Z");
const thing = (over: Partial<OctoberThing>): OctoberThing => ({
  entityId: "x",
  entityKind: "Event",
  name: "A thing",
  startsAt: null,
  state: "ahead",
  wantedAt: "2026-10-01T10:00:00.000Z",
  livedAt: null,
  ...over,
});

const carve = (over: Partial<OctoberThing> = {}) =>
  thing({
    entityId: "carve-pumpkins",
    entityKind: "Doing",
    name: "Carve pumpkins",
    ...over,
  });

beforeEach(() => {
  didThis.mockClear();
  forget.mockClear();
  planFor.mockClear();
});

describe("a Doing in Ahead", () => {
  it("appears by name alongside everything else", () => {
    render(<MyOctober things={[carve()]} experiences={[]} now={NOW} />);
    expect(screen.getByText("Carve pumpkins")).toBeInTheDocument();
    expect(screen.getAllByTestId("ahead-thing")).toHaveLength(1);
  });

  it("gets no invented urgency, because it has no day", () => {
    render(<MyOctober things={[carve()]} experiences={[]} now={NOW} />);
    expect(screen.getByTestId("ahead-thing")).toHaveAttribute(
      "data-nearness",
      "unknown",
    );
    expect(screen.queryByTestId("nearness")).not.toBeInTheDocument();
  });

  it("offers a day, which an Atlas event never does", () => {
    render(
      <MyOctober
        things={[
          carve(),
          thing({ entityId: "evt", startsAt: "2026-10-18T02:00:00Z" }),
        ]}
        experiences={[]}
        now={NOW}
      />,
    );
    // One date control, on the Doing — never on the event, whose date is
    // Atlas's and must not be overwritten by a guess. Undated, it offers the
    // day in words; an empty `<input type="date">` painted `yyyy-mm-dd` into
    // the list, which read as a form rather than as a plan.
    expect(screen.getAllByTestId("plan-ask")).toHaveLength(1);
    expect(screen.queryByTestId("plan-day")).toBeNull();
  });

  it("turns a wish into a plan", async () => {
    render(<MyOctober things={[carve()]} experiences={[]} now={NOW} />);
    fireEvent.click(screen.getByTestId("plan-ask"));
    fireEvent.change(screen.getByTestId("plan-day"), {
      target: { value: "2026-10-17" },
    });
    await waitFor(() => expect(planFor).toHaveBeenCalled());
    expect(planFor.mock.calls[0]).toEqual(["carve-pumpkins", "2026-10-17"]);
  });

  it("anticipates it once it has one", () => {
    render(
      <MyOctober
        things={[carve({ startsAt: "2026-10-10T12:00:00-07:00" })]}
        experiences={[]}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("nearness")).toHaveTextContent("Tomorrow");
  });

  it("can have its day taken back off", async () => {
    render(
      <MyOctober
        things={[carve({ startsAt: "2026-10-17T12:00:00-07:00" })]}
        experiences={[]}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByTestId("plan-clear"));
    await waitFor(() => expect(planFor).toHaveBeenCalled());
    expect(planFor.mock.calls[0]).toEqual(["carve-pumpkins", null]);
  });

  it("becomes lived through the one act that exists", async () => {
    render(<MyOctober things={[carve()]} experiences={[]} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: /did this/i }));
    await waitFor(() => expect(didThis).toHaveBeenCalledWith("carve-pumpkins"));
  });
});

describe("a month, read back", () => {
  const lived = (over: Partial<OctoberThing>) =>
    thing({ state: "lived", livedAt: "2026-10-08T04:00:00.000Z", ...over });

  it("groups what was lived into Went, Watched and Made", () => {
    render(
      <MyOctober
        things={[
          lived({
            entityId: "fos",
            entityKind: "Experience",
            name: "Field of Screams",
          }),
          lived({
            entityId: "lost-boys",
            entityKind: "Movie",
            name: "The Lost Boys (1987)",
          }),
          lived({
            entityId: "carve-pumpkins",
            entityKind: "Doing",
            name: "Carve pumpkins",
          }),
        ]}
        experiences={[]}
        now={NOW}
      />,
    );
    const groups = screen.getAllByTestId("lived-group");
    expect(groups.map((g) => g.dataset.group)).toEqual([
      "went",
      "watched",
      "made",
    ]);
  });

  it("puts each thing under the verb somebody would use", () => {
    render(
      <MyOctober
        things={[
          lived({
            entityId: "fos",
            entityKind: "Experience",
            name: "Field of Screams",
          }),
          lived({
            entityId: "lost-boys",
            entityKind: "Movie",
            name: "The Lost Boys (1987)",
          }),
          lived({
            entityId: "carve-pumpkins",
            entityKind: "Doing",
            name: "Carve pumpkins",
          }),
        ]}
        experiences={[]}
        now={NOW}
      />,
    );
    const of = (group: string) =>
      screen
        .getAllByTestId("lived-group")
        .find((g) => g.dataset.group === group)!;
    expect(of("went")).toHaveTextContent("Field of Screams");
    expect(of("watched")).toHaveTextContent("The Lost Boys");
    expect(of("made")).toHaveTextContent("Carve pumpkins");
  });

  it("draws no empty headings", () => {
    render(
      <MyOctober
        things={[
          lived({
            entityId: "carve-pumpkins",
            entityKind: "Doing",
            name: "Carve pumpkins",
          }),
        ]}
        experiences={[]}
        now={NOW}
      />,
    );
    const groups = screen.getAllByTestId("lived-group");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.dataset.group).toBe("made");
    // "Ate" is not drawn, because Eat does not exist yet.
    expect(screen.queryByText("Ate")).not.toBeInTheDocument();
  });

  it("keeps every Atlas kind under Went without deciding anything finer", () => {
    render(
      <MyOctober
        things={[
          lived({ entityId: "a", entityKind: "Place", name: "A place" }),
          lived({ entityId: "b", entityKind: "Event", name: "An event" }),
          lived({ entityId: "c", entityKind: "Organization", name: "An org" }),
        ]}
        experiences={[]}
        now={NOW}
      />,
    );
    expect(screen.getAllByTestId("lived-group")).toHaveLength(1);
    expect(screen.getAllByTestId("lived-group")[0]!.dataset.group).toBe("went");
  });
});
