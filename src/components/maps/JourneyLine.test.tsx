import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneyLine } from "./JourneyLine";
import type { Journey } from "@/lib/routing/journey";

const straight: Journey = {
  kind: "straight-line",
  km: 22,
  basis: "coordinates",
};
const routed: Journey = {
  kind: "routed",
  mode: "driving",
  minutes: 61,
  roadKm: 50.4,
  straightKm: 22,
  provider: "osrm-demo",
  calculatedAt: "2026-10-11T17:04:12.000Z",
  limitations: ["no live or typical traffic"],
};

const line = () => screen.getByTestId("journey-line");

describe("JourneyLine", () => {
  it("shows Atlas's routed journey when there is one", () => {
    render(
      <JourneyLine status="ready" routed={routed} straightLine={straight} />,
    );
    expect(line().dataset.journey).toBe("routed");
    expect(line().textContent).toMatch(/1 h 1 min drive · 50 km by road/);
    expect(line().textContent).toMatch(/Estimated by osrm-demo/);
  });

  it("while loading, shows the straight line as a straight line", () => {
    render(<JourneyLine status="loading" straightLine={straight} />);
    expect(line().dataset.journey).toBe("straight-line");
    expect(line().getAttribute("aria-busy")).toBe("true");
    expect(line().textContent).toMatch(/22 km in a straight line/);
    expect(line().textContent).toMatch(/Working out a travel time/);
    expect(line().textContent).not.toMatch(/drive/);
  });

  it("says travel times are not available yet, and does not invent one", () => {
    render(<JourneyLine status="not-served" straightLine={straight} />);
    expect(line().textContent).toMatch(/not available from Atlas yet/);
    expect(line().textContent).not.toMatch(/\bmin\b|drive/);
  });

  it("says it failed rather than showing nothing", () => {
    render(<JourneyLine status="failed" />);
    expect(line().dataset.journey).toBe("none");
    expect(line().textContent).toBe("Could not get a travel time just now.");
  });

  it("says when Atlas routed others but not this one", () => {
    render(<JourneyLine status="ready" straightLine={straight} />);
    expect(line().textContent).toMatch(/no travel time for this place/);
  });

  it("ignores a routed journey that arrives without a ready status", () => {
    render(
      <JourneyLine status="failed" routed={routed} straightLine={straight} />,
    );
    expect(line().dataset.journey).toBe("straight-line");
  });

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<JourneyLine status="idle" />);
    expect(container.firstChild).toBeNull();
  });
});
