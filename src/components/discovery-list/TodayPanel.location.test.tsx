import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import {
  EMPTY_SITUATION,
  type PlaceContext,
} from "@/domain/discovery/situation";
import { TodayPanel, placeNote } from "./TodayPanel";

/**
 * **"Vernon" and "the Vernon area" are different claims.**
 *
 * One says the forecast is for Vernon. The other says it is a default about
 * the corpus and not about the reader. Passport showed the first while only
 * ever being entitled to the second, which is the defect this panel's copy
 * exists to close — so every state below is checked for what it asserts, not
 * for how it looks.
 */

const VERNON = {
  wet: true,
  chance: 70,
  description: "Chance of showers",
  source: "Environment Canada",
  area: "Vernon",
};

function panel(place: PlaceContext, weather: typeof VERNON | null = VERNON) {
  return render(
    <TodayPanel
      today="Saturday, October 10"
      {...(weather ? { weather } : {})}
      place={place}
      {...(place.state === "default" ? { ask: () => {} } : {})}
      experiences={[] as readonly Experience[]}
      situation={EMPTY_SITUATION}
      onSituation={() => {}}
    />,
  );
}

describe("before anybody has shared where they are", () => {
  it("calls the default area a default, in so many words", () => {
    panel({ state: "default" });
    expect(screen.getByTestId("today-area")).toHaveTextContent("Vernon area");
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "not for wherever you are",
    );
  });

  it("offers to use their location, with no explanation up front", () => {
    panel({ state: "default" });
    expect(screen.getByTestId("use-my-location")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("claims no area at all when there is no forecast", () => {
    panel({ state: "default" }, null);
    expect(screen.queryByTestId("today-area")).not.toBeInTheDocument();
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Passport has no forecast for today",
    );
  });
});

describe("once they have", () => {
  const KELOWNA = {
    ...VERNON,
    description: "Sunny",
    wet: false,
    area: "Kelowna",
  };

  it("names the city the forecast belongs to, and how far it is", () => {
    panel({ state: "observed", area: "Kelowna", km: 12 }, KELOWNA);
    // "Kelowna", not "the Kelowna area": this forecast is being shown because
    // of where this person is, and it names the city it is published for.
    expect(screen.getByTestId("today-area")).toHaveTextContent("Kelowna");
    expect(screen.getByTestId("today-area")).not.toHaveTextContent("area");
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Nearest forecast to you — Kelowna, about 12 km away",
    );
  });

  it("says nothing about a distance the provider did not give", () => {
    panel({ state: "observed", area: "Kelowna" }, KELOWNA);
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Nearest forecast to you — Kelowna.",
    );
  });

  it("drops the distance when standing in the reporting city", () => {
    // "about 0 km away" reads as a broken template, not as good news.
    panel({ state: "observed", area: "Vernon", km: 0 }, VERNON);
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Nearest forecast to you — Vernon.",
    );
    expect(screen.getByTestId("today-place")).not.toHaveTextContent("0 km");
  });
});

describe("when it got nowhere", () => {
  it("keeps the default and says why, without re-offering", () => {
    panel({ state: "unavailable", lapse: "denied" });
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Showing the Vernon area, since Passport can't see where you are",
    );
    expect(screen.getByTestId("today-area")).toHaveTextContent("Vernon area");
    expect(screen.queryByTestId("use-my-location")).not.toBeInTheDocument();
  });

  it("distinguishes nothing published nearby from a refusal", () => {
    panel({ state: "unavailable", lapse: "no-forecast" });
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Environment Canada publishes no forecast near you",
    );
  });

  it("still shows the rest of the panel", () => {
    panel({ state: "unavailable", lapse: "denied" });
    expect(screen.getByTestId("today-panel")).toBeInTheDocument();
    expect(screen.getByTestId("today-known")).toHaveTextContent(
      "Chance of showers",
    );
  });

  it("shows that it is working while the browser decides", () => {
    panel({ state: "asking" });
    expect(screen.getByTestId("location-asking")).toBeInTheDocument();
    expect(screen.queryByTestId("use-my-location")).not.toBeInTheDocument();
  });
});

describe("the sentence itself", () => {
  it("never names a coordinate, in any state", () => {
    const said = [
      placeNote({ state: "default" }, "Vernon"),
      placeNote({ state: "observed", area: "Vernon", km: 11 }, "Vernon"),
      placeNote({ state: "unavailable", lapse: "denied" }, "Vernon"),
      placeNote({ state: "unavailable", lapse: "no-forecast" }, "Vernon"),
      placeNote({ state: "unavailable", lapse: "failed" }, "Vernon"),
    ];
    for (const line of said) {
      expect(line).not.toMatch(/-?\d+\.\d{2,}/);
      expect(line).not.toContain("latitude");
    }
  });

  it("distinguishes a default it was given from one it fell back to", () => {
    expect(placeNote({ state: "default" }, "Vernon")).not.toEqual(
      placeNote({ state: "unavailable", lapse: "denied" }, "Vernon"),
    );
  });
});
