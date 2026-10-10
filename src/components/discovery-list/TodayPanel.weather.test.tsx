import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import type { CandidateEnvironment } from "@/lib/data/types";
import { EMPTY_SITUATION } from "@/domain/discovery/situation";
import { TodayPanel } from "./TodayPanel";

/**
 * **A wet afternoon with a five-year-old, answered from evidence.**
 *
 * What this panel said before, with rain forecast in Vernon:
 *
 * > *71 of them are outdoors and rain is forecast. Passport does not know
 * > whether the other 10 are under cover.*
 *
 * and then listed Deer Park, Marshall Field, Greater Vernon Athletics Park and
 * Stuart Park under the heading **NOT RULED OUT BY THE RAIN**. Every one of
 * those is outside. The "71 outdoors" came from matching activity names
 * against a word list that contained `picnic shelter`, so the four parks that
 * actually have somewhere dry to stand were the ones being excluded.
 *
 * `candidate-environment/1` states it. Fixtures are real production blocks.
 */

const place = (
  title: string,
  affordance: string,
  environment?: CandidateEnvironment,
): Experience =>
  ({
    id: title,
    kind: "Place",
    slug: title,
    title,
    shortDescription: "",
    isActive: true,
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    knowledge: { affordances: [{ name: affordance, basis: "offers" }] },
    ...(environment ? { environment } : {}),
  }) as Experience;

const COLDSTREAM = place("Coldstream Park", "Playground", {
  setting: "unknown",
  rain: { reading: "partly-sheltered", basis: "derived" },
  statements: [
    {
      says: "covered",
      scope: "part",
      text: "Picnic shelter",
      basis: "feature",
    },
  ],
});
const MEMORIAL_ARENA = place("Memorial Arena", "Skating", {
  setting: "indoor",
  rain: { reading: "sheltered", basis: "derived" },
});
const STUART_PARK = place("Stuart Park", "Skating", {
  setting: "outdoor",
  rain: { reading: "exposed", basis: "derived" },
});
const ICE_RINK = place("Stuart Park Ice Rink", "Skating", {
  setting: "unknown",
  rain: { reading: "weather-dependent", basis: "stated" },
  statements: [
    {
      says: "weather-dependent",
      text: "Opening hours: Open daily from dusk to dawn March-November (weather dependent).",
      basis: "key-fact",
    },
  ],
});
/** Atlas says nothing. 63 of the 83 child-doable subjects look like this. */
const DEER_PARK = place("Deer Park", "Tennis courts", {
  setting: "unknown",
  rain: { reading: "unknown", basis: "none" },
});

const POOL = [COLDSTREAM, MEMORIAL_ARENA, STUART_PARK, ICE_RINK, DEER_PARK];

const RAIN = {
  wet: true,
  chance: 90,
  description: "Rain",
  source: "Environment Canada",
  area: "Vernon",
};

function panel(experiences: readonly Experience[], wet: boolean) {
  render(
    <TodayPanel
      today="Saturday, October 10"
      weather={wet ? RAIN : { ...RAIN, wet: false, description: "Sunny" }}
      place={{ state: "observed", area: "Vernon" }}
      experiences={experiences}
      situation={{ company: "child" }}
      onSituation={() => {}}
    />,
  );
}

const listed = () =>
  screen
    .queryAllByTestId("today-suggestion")
    .map((item) => item.textContent ?? "");

describe("a rainy afternoon", () => {
  it("counts each kind of answer separately", () => {
    panel(POOL, true);
    const said = screen.getByTestId("today-weather-caveat").textContent!;
    expect(said).toContain("2 of them say the rain does not stop them");
    expect(said).toContain("1 are out in the open");
    expect(said).toContain("1 may not be running today");
    expect(said).toContain("about the other 1");
  });

  it("offers what Atlas says the rain does not stop", () => {
    panel(POOL, true);
    expect(listed().join(" | ")).toContain("Coldstream Park");
    expect(listed().join(" | ")).toContain("Memorial Arena");
  });

  it("does not offer what Atlas says is out in the open", () => {
    panel(POOL, true);
    expect(listed().join(" | ")).not.toContain("Stuart Park");
  });

  it("does not offer what Atlas says nothing about", () => {
    // Deer Park used to lead this list under "not ruled out by the rain".
    // Nothing is known about it, and that is not a reason to send somebody.
    panel(POOL, true);
    expect(listed().join(" | ")).not.toContain("Deer Park");
  });

  it("does not quietly treat may-not-run as somewhere to shelter", () => {
    panel(POOL, true);
    expect(listed().join(" | ")).not.toContain("Stuart Park Ice Rink");
  });

  it("says a derived reading is a reading, not a promise", () => {
    panel(POOL, true);
    expect(screen.getAllByTestId("today-shelter")[0]).toHaveTextContent(
      "going by what Atlas holds",
    );
  });

  it("quotes the sentence Atlas read it from", () => {
    panel(POOL, true);
    expect(
      screen.getAllByTestId("today-shelter-evidence")[0],
    ).toHaveTextContent("Picnic shelter");
  });
});

describe("when nothing says it can take the rain", () => {
  it("offers nothing and says why, rather than picking one", () => {
    panel([STUART_PARK, DEER_PARK], true);
    const said = screen.getByTestId("today-weather-caveat").textContent!;
    expect(said).toContain("none of these say they can take it");
    expect(said).toContain("1 are out in the open");
    expect(said).toContain("says nothing either way about 1");
    expect(listed()).toEqual([]);
  });
});

describe("a dry afternoon", () => {
  it("argues with nothing and shows the lot", () => {
    panel(POOL, false);
    expect(
      screen.queryByTestId("today-weather-caveat"),
    ).not.toBeInTheDocument();
    expect(listed()).toHaveLength(POOL.length);
    expect(listed().join(" | ")).toContain("Deer Park");
  });

  it("says nothing about shelter when the sky is not arguing", () => {
    panel(POOL, false);
    expect(screen.queryByTestId("today-shelter")).not.toBeInTheDocument();
  });
});
