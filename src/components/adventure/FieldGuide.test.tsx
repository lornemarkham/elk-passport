import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PrintableAdventure } from "./PrintableAdventure";
import { sampleAdventure } from "@/lib/analog/sample";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";
import { printableFromDay, type PrintOptions } from "@/lib/analog/printable";

const VERNON = townById("vernon")!;

// Fixtures, not Atlas: placed points north of Vernon.
const placed = (
  name: string,
  north: number,
  extra: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  subtype: name,
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
    coordinates: [VERNON.longitude, VERNON.latitude + north / 111.2],
  },
  ...extra,
});

const placedAdventure = (options: PrintOptions = {}) =>
  printableFromDay(
    buildDay({
      pool: [
        placed("North Park", 3, {
          knowledge: {
            practical: [
              { label: "Hours", value: "Daily 8am–9pm" },
              { label: "Parking", value: "Lot off the north entrance" },
            ],
          },
        }),
        placed("Far Park", 7),
      ].map(candidateToExperience),
      brief: readBrief("Four hours near Vernon"),
    }),
    options,
  );

describe("the route", () => {
  it("draws a sketch with a numbered mark for every placed stop", () => {
    render(<PrintableAdventure adventure={placedAdventure()} />);
    const sketch = screen.getByTestId("adventure-sketch");
    expect(sketch).toHaveAttribute(
      "aria-label",
      expect.stringContaining("1, North Park"),
    );
    expect(sketch.textContent).toContain("N");
    expect(sketch.textContent).toMatch(/\d+(\.\d)? km/);
    expect(screen.getByTestId("adventure-route")).toHaveTextContent(
      "A sketch, not a map.",
    );
  });

  it("draws nothing for the sample, which has no positions, and says why", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    expect(screen.queryByTestId("adventure-sketch")).toBeNull();
    expect(screen.getByTestId("adventure-no-sketch")).toBeInTheDocument();
  });

  it("lists every leg, home included, as a straight line with room to write", () => {
    render(<PrintableAdventure adventure={placedAdventure()} />);
    const legs = screen.getAllByTestId("adventure-leg");
    expect(legs).toHaveLength(3);
    expect(legs[0]).toHaveTextContent("Vernon → 1. North Park");
    expect(legs[0]).toHaveTextContent("3 km, straight line");
    expect(legs[2]).toHaveTextContent("(home)");
    expect(within(legs[0]!).getByText("Left:")).toBeInTheDocument();
    expect(screen.queryByTestId("adventure-attribution")).toBeNull();
  });

  it("prints a routed time only when one was given, and credits who said so", () => {
    render(
      <PrintableAdventure
        adventure={placedAdventure({
          travel: {
            "far-park": {
              kind: "routed",
              mode: "driving",
              minutes: 8,
              roadKm: 5.4,
              provider: "openrouteservice",
            },
          },
        })}
      />,
    );
    const legs = screen.getAllByTestId("adventure-leg");
    expect(legs[0]).toHaveTextContent("straight line");
    expect(legs[1]).toHaveTextContent("8 min driving, 5 km by road");
    expect(screen.getByTestId("adventure-attribution")).toHaveTextContent(
      "Travel times by openrouteservice",
    );
  });
});

describe("the weather", () => {
  it("leaves a box for the forecast when none was handed in", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    expect(screen.getByTestId("adventure-forecast-blank")).toBeInTheDocument();
    expect(screen.queryByTestId("adventure-forecast")).toBeNull();
  });

  it("prints a forecast with its source and area when one was", () => {
    render(
      <PrintableAdventure
        adventure={placedAdventure({
          forecast: {
            wet: true,
            chance: 70,
            description: "Showers",
            source: "Environment Canada",
            area: "Vernon",
          },
        })}
      />,
    );
    const box = screen.getByTestId("adventure-forecast");
    expect(box).toHaveTextContent("Environment Canada, for Vernon");
    expect(box).toHaveTextContent("Showers, 70% chance at worst");
    expect(screen.queryByTestId("adventure-forecast-blank")).toBeNull();
  });

  it("says when Atlas has no word on the rain, rather than calling it outdoor", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    expect(screen.getByTestId("adventure-rain")).toHaveTextContent(
      "No word on rain:",
    );
  });
});

describe("what each stop published", () => {
  it("prints hours and other facts in the place's words, marked as published", () => {
    render(<PrintableAdventure adventure={placedAdventure()} />);
    const north = screen
      .getAllByTestId("guide-stop")
      .find((s) => s.textContent?.includes("North Park"))!;
    expect(within(north).getByTestId("adventure-open")).toHaveTextContent(
      "Published hours: Daily 8am–9pm (Published)",
    );
    expect(within(north).getByTestId("adventure-published")).toHaveTextContent(
      "Lot off the north entrance",
    );
  });
});

describe("the pocket card", () => {
  it("carries every stop and how to find it", () => {
    const adventure = sampleAdventure();
    render(<PrintableAdventure adventure={adventure} />);
    const card = screen.getByTestId("adventure-pocket");
    for (const stop of adventure.stops) {
      expect(card).toHaveTextContent(stop.title);
      if (stop.findBy) expect(card).toHaveTextContent(stop.findBy);
    }
    expect(card).toHaveTextContent("Where we parked");
  });
});

describe("branding", () => {
  it("is a Go have a day field guide, not October", () => {
    const { container } = render(
      <PrintableAdventure adventure={sampleAdventure()} />,
    );
    expect(container.textContent).not.toMatch(/october/i);
    expect(container.textContent).toContain("Field guide");
  });
});
