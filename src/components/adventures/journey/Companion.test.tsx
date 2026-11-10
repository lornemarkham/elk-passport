import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ItemView } from "@/lib/adventures/store";
import type { DayDetail } from "@/lib/adventures/propose";
import { TodayPanel } from "./TodayPanel";
import { RecapView } from "./RecapView";

/** `package.json` is a shared contract, so no user-event: fireEvent is enough. */
const userEvent = {
  setup: () => ({
    click: async (el: Element) => {
      fireEvent.click(el);
      await Promise.resolve();
    },
  }),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const stop = (id: string, label: string, position: number): ItemView => ({
  id,
  atlasRef: null,
  label,
  note: null,
  status: "confirmed",
  onDay: "2026-11-14",
  startsAt: null,
  position,
  addedBy: null,
  mine: true,
  canChange: true,
  responses: { in: 0, maybe: 0, out: 0 },
  yourResponse: null,
  origin: "person",
});

const stops = [
  stop("a", "Coffee", 0),
  stop("b", "Waterfall", 1),
  stop("c", "Brewery", 2),
];

const detail: DayDetail = {
  onDay: "2026-11-14",
  title: "Coffee, falls, beer",
  stops: {},
  unknowns: [],
  leftOut: [],
  clocked: false,
};

const panel = (changePlan?: (s: string) => void) =>
  render(
    <TodayPanel
      adventureId="adv1"
      adventureTitle="Saturday out"
      onDay="2026-11-14"
      stops={stops}
      names={{}}
      experiences={{}}
      detail={detail}
      changePlan={changePlan}
    />,
  );

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Start your day", () => {
  it("offers one clear start, and no companion controls before it", () => {
    panel();
    expect(screen.getByTestId("start-day")).toBeEnabled();
    expect(screen.queryByTestId("today-done")).toBeNull();
    expect(screen.queryByTestId("capture")).toBeNull();
    expect(screen.getByTestId("today-next")).toHaveTextContent("Coffee");
  });

  it("becomes a companion: now, then, directions, and moving on", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByTestId("start-day"));
    expect(screen.getByTestId("today-panel")).toHaveAttribute(
      "data-started",
      "yes",
    );
    expect(screen.getByTestId("today-next")).toHaveTextContent("Coffee");
    expect(screen.getByTestId("today-after")).toHaveTextContent("Waterfall");
    expect(screen.getByTestId("today-directions")).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps/dir"),
    );
    await user.click(screen.getByTestId("today-done"));
    expect(screen.getByTestId("today-next")).toHaveTextContent("Waterfall");
    // Kept on this device, so a reload picks up where they were.
    expect(window.localStorage.getItem("gh.done.adv1.2026-11-14")).toBe(
      '["a"]',
    );
  });

  it("remembers it was started after a reload", async () => {
    const user = userEvent.setup();
    const first = panel();
    await user.click(screen.getByTestId("start-day"));
    first.unmount();
    panel();
    expect(await screen.findByTestId("today-done")).toBeInTheDocument();
  });

  it("skipping is not the same as doing, and says so", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByTestId("start-day"));
    await user.click(screen.getByTestId("today-skip"));
    expect(screen.getByTestId("today-next")).toHaveTextContent("Waterfall");
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(window.localStorage.getItem("gh.done.adv1.2026-11-14")).toBeNull();
    expect(window.localStorage.getItem("gh.skipped.adv1.2026-11-14")).toBe(
      '["a"]',
    );
  });

  it("says running behind is on the phone only, and can be undone", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByTestId("start-day"));
    await user.click(screen.getByTestId("behind-more"));
    expect(screen.getByTestId("behind-note")).toHaveTextContent(
      /15 min.*phone only.*hasn.t changed/s,
    );
    await user.click(screen.getByTestId("behind-reset"));
    expect(screen.queryByTestId("behind-note")).toBeNull();
  });

  it("hands a sentence to the change box rather than guessing a change", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    panel(change);
    await user.click(screen.getByTestId("start-day"));
    await user.click(screen.getByTestId("today-change"));
    expect(change).toHaveBeenCalledOnce();
  });
});

describe("Keeping the moment", () => {
  it("keeps a note and a favourite against the current stop", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByTestId("start-day"));
    await user.click(screen.getByTestId("capture-note"));
    fireEvent.change(screen.getByTestId("capture-note-text"), {
      target: { value: "Best latte of my life" },
    });
    await user.click(screen.getByTestId("capture-note-save"));
    await user.click(screen.getByTestId("capture-favourite"));
    const kept = JSON.parse(window.localStorage.getItem("gh.memories.adv1")!);
    expect(kept).toHaveLength(2);
    expect(kept.map((m: { kind: string }) => m.kind)).toEqual([
      "note",
      "favourite",
    ]);
    expect(kept[0].itemId).toBe("a");
    // Favouriting twice un-favourites.
    await user.click(screen.getByTestId("capture-favourite"));
    expect(
      JSON.parse(window.localStorage.getItem("gh.memories.adv1")!),
    ).toHaveLength(1);
  });

  it("ends the day by pointing at the recap", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByTestId("start-day"));
    for (let i = 0; i < 3; i += 1)
      await user.click(screen.getByTestId("today-done"));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "That's the day.",
    );
    expect(screen.getByTestId("open-recap")).toHaveAttribute(
      "href",
      "/adventures/adv1/recap",
    );
  });
});

describe("The recap", () => {
  const recap = (members = 0, sharingOff = false) =>
    render(
      <RecapView
        adventureId="adv1"
        title="Saturday out"
        when="Sat, Nov 14"
        onDay="2026-11-14"
        stops={stops.map((s) => ({
          id: s.id,
          name: s.label!,
          experience: undefined,
        }))}
        againHref="/adventures/new?with=x"
        members={members}
        shared={[]}
        sharingOff={sharingOff}
      />,
    );

  it("tells only what happened, from what this phone kept", async () => {
    window.localStorage.setItem("gh.done.adv1.2026-11-14", '["a"]');
    window.localStorage.setItem("gh.skipped.adv1.2026-11-14", '["b"]');
    window.localStorage.setItem(
      "gh.memories.adv1",
      JSON.stringify([
        {
          id: "m1",
          kind: "note",
          at: "2026-11-14T10:00:00Z",
          itemId: "a",
          text: "Best latte",
          photo: null,
        },
        {
          id: "m2",
          kind: "favourite",
          at: "2026-11-14T10:01:00Z",
          itemId: "a",
          text: null,
          photo: null,
        },
      ]),
    );
    recap();
    expect(await screen.findByTestId("recap-line")).toHaveTextContent(
      "1 of 3 done · 1 skipped · 1 favourite",
    );
    expect(screen.getByTestId("recap-favourites")).toHaveTextContent("Coffee");
    expect(screen.getByText("Best latte")).toBeInTheDocument();
    expect(screen.getAllByTestId("recap-stop")).toHaveLength(3);
    expect(screen.getByTestId("recap-again")).toHaveAttribute(
      "href",
      "/adventures/new?with=x",
    );
    expect(screen.getByTestId("recap-new")).toBeInTheDocument();
  });

  it("is honest when the phone kept nothing", async () => {
    recap();
    expect(await screen.findByTestId("recap-empty")).toBeInTheDocument();
  });

  it("offers sharing only with other people there, and only where switched on", async () => {
    window.localStorage.setItem(
      "gh.memories.adv1",
      JSON.stringify([
        {
          id: "m1",
          kind: "note",
          at: "x",
          itemId: "a",
          text: "Hi",
          photo: null,
        },
      ]),
    );
    const alone = recap(0);
    await screen.findByText("Hi");
    expect(screen.queryByTestId("share-memory")).toBeNull();
    alone.unmount();

    const off = recap(2, true);
    await screen.findByText("Hi");
    expect(screen.queryByTestId("share-memory")).toBeNull();
    expect(screen.getByTestId("sharing-off")).toBeInTheDocument();
    off.unmount();

    recap(2, false);
    await screen.findByText("Hi");
    expect(screen.getByTestId("share-memory")).toBeInTheDocument();
  });

  it("shares one memory, in the person's name, when they press it", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "gh.memories.adv1",
      JSON.stringify([
        {
          id: "m1",
          kind: "note",
          at: "x",
          itemId: "a",
          text: "Hi",
          photo: null,
        },
      ]),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 201 }));
    recap(2);
    await user.click(await screen.findByTestId("share-memory"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/adventures/adv1/moments",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (
        fetchMock.mock.calls.find(
          (c) => c[0] === "/api/adventures/adv1/moments",
        )![1] as RequestInit
      ).body as string,
    );
    expect(body).toEqual({ kind: "moment", text: "Hi", photo: null });
    fetchMock.mockRestore();
  });

  it("can delete a memory from the phone", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "gh.memories.adv1",
      JSON.stringify([
        {
          id: "m1",
          kind: "note",
          at: "x",
          itemId: "a",
          text: "Hi",
          photo: null,
        },
      ]),
    );
    recap();
    await user.click(await screen.findByTestId("forget-memory"));
    expect(screen.queryByText("Hi")).toBeNull();
    expect(window.localStorage.getItem("gh.memories.adv1")).toBe("[]");
  });
});
