import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TravelSummary } from "./TravelSummary";
import { LegLine } from "./LegLine";
import { chainLegs, shownLeg } from "@/lib/routing/legs";
import { legsAnswerFrom } from "@/lib/routing/atlasLegs";
import {
  DAVISON,
  DRIVING_FROM_VERNON,
  LEGS_DRIVING_MOCK,
  LEGS_ONE_UNROUTED_MOCK,
  OKEEFE,
  VERNON_START,
} from "@/lib/routing/fixtures";
import { journeyFromReading } from "@/lib/routing/atlasTravel";

const LEGS = chainLegs(VERNON_START, [DAVISON, OKEEFE], { returnHome: true });
const answers = (body: { legs: unknown[] }) => {
  const a = legsAnswerFrom(body, 3, "driving");
  return a.state === "ready" ? a.journeys : [];
};

const summary = () => screen.getByTestId("travel-summary");

describe("TravelSummary", () => {
  it("adds up a fully routed day, says what it leaves out, and credits it", () => {
    render(
      <TravelSummary
        legs={LEGS}
        answers={answers(LEGS_DRIVING_MOCK)}
        status="ready"
        mode="driving"
        planned={240}
      />,
    );
    expect(summary().dataset.total).toBe("complete");
    expect(summary().textContent).toMatch(/41 min of driving across 3 legs/);
    expect(summary().textContent).toMatch(/about 4 h 41 min in all/);
    expect(summary().textContent).toMatch(/MOCK reading for tests/);
  });

  it("says at least, and names the leg, when one has no route", () => {
    render(
      <TravelSummary
        legs={LEGS}
        answers={answers(LEGS_ONE_UNROUTED_MOCK)}
        status="ready"
        mode="driving"
      />,
    );
    expect(summary().dataset.total).toBe("partial");
    expect(summary().textContent).toMatch(/At least 27 min of driving/);
    expect(summary().textContent).toMatch(/Davison Orchards → O'Keefe Ranch/);
  });

  it("credits OpenStreetMap wherever a real routed minute is shown", () => {
    const real = journeyFromReading(
      DRIVING_FROM_VERNON.candidates[0]!.travel,
      "driving",
    );
    render(
      <TravelSummary
        legs={LEGS.slice(0, 1)}
        answers={[real]}
        status="ready"
        mode="driving"
      />,
    );
    expect(screen.getByTestId("routing-attribution").textContent).toMatch(
      /OpenStreetMap contributors/,
    );
  });

  it("says Atlas cannot do this yet, and shows no total", () => {
    render(
      <TravelSummary
        legs={LEGS}
        answers={[undefined, undefined, undefined]}
        status="not-served"
        mode="driving"
      />,
    );
    expect(summary().textContent).toMatch(
      /does not give travel times between places yet/,
    );
    expect(summary().textContent).not.toMatch(/min of driving/);
    expect(screen.queryByTestId("routing-attribution")).toBeNull();
  });

  it("offers to try again after a failure", () => {
    const onRetry = vi.fn();
    render(
      <TravelSummary
        legs={LEGS}
        answers={[undefined, undefined, undefined]}
        status="failed"
        mode="driving"
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByTestId("travel-retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("LegLine", () => {
  const line = () => screen.getByTestId("leg-line");

  it("shows a routed leg with its provider", () => {
    const [first] = answers(LEGS_DRIVING_MOCK);
    render(<LegLine leg={LEGS[0]!} journey={first} first />);
    expect(line().dataset.journey).toBe("routed");
    expect(line().textContent).toMatch(
      /9 min drive · 4\.5 km by road from Vernon/,
    );
    expect(line().textContent).toMatch(/estimated by osrm-demo/);
  });

  it("shows a straight line as not a travel time", () => {
    render(<LegLine leg={LEGS[1]!} journey={shownLeg(LEGS[1]!, undefined)} />);
    expect(line().dataset.journey).toBe("straight-line");
    expect(line().textContent).toMatch(/in a straight line from the last stop/);
    expect(line().textContent).toMatch(/not a travel time/);
  });

  it("says no route, rather than a distance, when Atlas found none", () => {
    const journeys = answers(LEGS_ONE_UNROUTED_MOCK);
    render(
      <LegLine leg={LEGS[1]!} journey={shownLeg(LEGS[1]!, journeys[1])} />,
    );
    expect(line().textContent).toMatch(/No driving route found/);
  });

  it("names the way home", () => {
    render(<LegLine leg={LEGS[2]!} journey={shownLeg(LEGS[2]!, undefined)} />);
    expect(line().textContent).toMatch(/back to Vernon/);
  });

  it("flags a routed leg Atlas cautioned about", () => {
    const flagged = journeyFromReading(
      DRIVING_FROM_VERNON.candidates[4]!.travel,
      "driving",
    );
    render(<LegLine leg={LEGS[0]!} journey={flagged} first />);
    expect(line().textContent).toMatch(/may be inside the site/);
  });
});
