import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DayPlanned } from "@/domain/day/build";
import { DRIVE_TIMES_UNKNOWN } from "@/domain/day/build";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { legsAnswerFrom } from "@/lib/routing/atlasLegs";
import { LEGS_DRIVING_MOCK } from "@/lib/routing/fixtures";
import { forgetTravelLegs } from "@/lib/routing/useTravelLegs";
import { DayItinerary } from "./DayItinerary";

/**
 * **The `/go` itinerary with travel times**, against a mocked Passport API.
 * The leg answers are `LEGS_DRIVING_MOCK`: the first leg is Atlas's probe,
 * the rest are labelled MOCK.
 */
const stop = (id: string, title: string, coordinates: [number, number]) => ({
  experience: {
    id,
    kind: "Place",
    slug: id,
    title,
    geography: { coordinates },
  } as unknown as Experience,
  minutes: 120,
  because: "Because.",
  notes: [],
});

const DAY = {
  title: "Davison Orchards to O'Keefe Ranch",
  opening: "4 hours, 2 stops.",
  stops: [
    stop("davison-orchards", "Davison Orchards", [-119.2958, 50.2853]),
    stop("okeefe-ranch", "O'Keefe Ranch", [-119.2803, 50.3684]),
  ],
  unknowns: [DRIVE_TIMES_UNKNOWN],
  brief: { said: "four hours near Vernon", town: townById("vernon")! },
  closing: "",
} as unknown as DayPlanned;

afterEach(() => {
  forgetTravelLegs();
  vi.unstubAllGlobals();
});

describe("DayItinerary — travel", () => {
  it("shows each leg, the way home and the day's total from Atlas's routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(legsAnswerFrom(LEGS_DRIVING_MOCK, 3, "driving")),
      ),
    );
    render(<DayItinerary day={DAY} by="driving" onBy={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId("travel-summary").dataset.total).toBe(
        "complete",
      ),
    );
    expect(screen.getByTestId("travel-summary").textContent).toMatch(
      /41 min of driving across 3 legs.*about 4 h 41 min in all/,
    );
    const legs = screen.getAllByTestId("leg-line");
    expect(legs.map((l) => l.dataset.journey)).toEqual([
      "routed",
      "routed",
      "routed",
    ]);
    expect(screen.getByTestId("go-home-leg").textContent).toMatch(
      /back to Vernon/,
    );
    // Every leg routed: drive times are no longer something to check.
    expect(screen.getByTestId("go-unknowns").textContent).not.toMatch(
      /Drive times/,
    );
  });

  it("shows straight lines, labelled, while Atlas does not serve legs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ state: "not-served", mode: "driving", because: "x" }),
      ),
    );
    render(<DayItinerary day={DAY} />);
    await waitFor(() =>
      expect(screen.getByTestId("travel-summary").dataset.status).toBe(
        "not-served",
      ),
    );
    for (const leg of screen.getAllByTestId("leg-line")) {
      expect(leg.dataset.journey).toBe("straight-line");
      expect(leg.textContent).toMatch(/not a travel time/);
    }
    expect(screen.queryByText(/min drive/)).toBeNull();
    expect(screen.getByTestId("go-unknowns").textContent).toMatch(
      /Drive times/,
    );
  });

  it("switches mode on request", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const onBy = vi.fn();
    render(<DayItinerary day={DAY} by="driving" onBy={onBy} />);
    fireEvent.click(screen.getByRole("radio", { name: "Walking" }));
    expect(onBy).toHaveBeenCalledWith("walking");
  });

  it("puts a clock on every stop, and says 'about' while the roads are unmeasured", () => {
    const timed = {
      ...DAY,
      brief: { ...DAY.brief, startAt: 600, homeBy: 960 },
      budget: { perMove: 15 },
    } as unknown as DayPlanned;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ state: "not-served" })),
    );
    render(<DayItinerary day={timed} by="driving" onBy={() => {}} />);
    const clocks = screen.getAllByTestId("go-clock");
    expect(clocks).toHaveLength(2);
    expect(clocks[0]!.textContent).toMatch(/about 10:15 am/);
    expect(screen.getByTestId("go-verdict").dataset.verdict).toBe("tight");
  });

  it("says first, and once, what it could not keep of what you chose", () => {
    const left =
      "Gallery Vertigo is left out — what is published says it isn't on that day.";
    const day = {
      ...DAY,
      unknowns: [left, DRIVE_TIMES_UNKNOWN],
      leftOut: [left],
    } as unknown as DayPlanned;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ state: "not-served" })),
    );
    render(<DayItinerary day={day} by="driving" onBy={() => {}} />);
    expect(screen.getByTestId("go-left-out").textContent).toContain(
      "Gallery Vertigo",
    );
    expect(screen.getByTestId("go-unknowns").textContent).not.toContain(
      "Gallery Vertigo",
    );
  });

  it("keeps what was set aside in view, with a way back", () => {
    const onRestore = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ state: "not-served" })),
    );
    render(
      <DayItinerary
        day={DAY}
        by="driving"
        controls={{
          onKeep() {},
          onSwap() {},
          onChoose() {},
          onRemove() {},
          onMove() {},
          onTime() {},
          onRainPlan() {},
          onRestore,
        }}
        setAside={[{ id: "x", title: "Heli-skiing" }]}
      />,
    );
    expect(screen.getByTestId("go-set-aside").textContent).toContain(
      "Heli-skiing",
    );
    fireEvent.click(screen.getByTestId("go-put-back"));
    expect(onRestore).toHaveBeenCalledWith("x");
  });
});
