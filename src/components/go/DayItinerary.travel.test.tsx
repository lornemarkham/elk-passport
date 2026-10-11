import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DayPlanned } from "@/domain/day/build";
import { DRIVE_TIMES_UNKNOWN } from "@/domain/day/build";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { legsAnswerFrom } from "@/lib/routing/atlasLegs";
import { LEGS_DRIVING_MOCK } from "@/lib/routing/fixtures";
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
});
