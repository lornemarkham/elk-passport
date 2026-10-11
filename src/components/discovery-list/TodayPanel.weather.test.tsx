import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

function panel(
  experiences: readonly Experience[],
  wet: boolean,
  window?: "an-hour" | "half-day" | "all-day",
) {
  render(
    <TodayPanel
      today="Saturday, October 10"
      weather={wet ? RAIN : { ...RAIN, wet: false, description: "Sunny" }}
      place={{ state: "observed", area: "Vernon" }}
      experiences={experiences}
      situation={{ company: "child", ...(window ? { window } : {}) }}
      onSituation={() => {}}
    />,
  );
}

/** Everything the answer names — verbs and the places under them. */
const listed = () =>
  screen.queryAllByTestId("today-direction").map((d) => d.textContent ?? "");

describe("a rainy afternoon", () => {
  it("counts each kind of answer separately", () => {
    panel(POOL, true);
    const said = screen.getByTestId("today-weather-caveat").textContent!;
    expect(said).toContain("2 of them say the rain does not stop them");
    expect(said).toContain("1 are out in the open");
    expect(said).toContain("1 may not be running today");
    expect(said).toContain("about the other 1");
  });

  it("names what the rain does not stop first under its verb", () => {
    panel(POOL, true, "all-day");
    const playground = screen
      .getAllByTestId("today-direction")
      .find((d) => d.dataset["doing"] === "Playground")!;
    // Coldstream has a picnic shelter; nothing else under Playground does.
    expect(
      within(playground).getAllByTestId("today-direction-place")[0],
    ).toHaveTextContent("Coldstream Park");
  });

  it("marks a direction whose every place is out in the open", () => {
    panel([STUART_PARK], true, "all-day");
    expect(screen.getByTestId("today-direction-rained-out")).toHaveTextContent(
      "every one of these is out in the open",
    );
  });

  it("does not mark one Atlas says nothing about", () => {
    // Deer Park's reading is unknown. That is not evidence it is exposed.
    panel([DEER_PARK], true, "all-day");
    expect(
      screen.queryByTestId("today-direction-rained-out"),
    ).not.toBeInTheDocument();
  });

  it("does not quietly treat may-not-run as somewhere to shelter", () => {
    panel([ICE_RINK], true, "all-day");
    expect(screen.getByTestId("today-shelter")).toHaveTextContent(
      "May not run in bad weather",
    );
  });

  it("says a derived reading is a reading, not a promise", () => {
    panel(POOL, true, "all-day");
    expect(screen.getAllByTestId("today-shelter")[0]).toHaveTextContent(
      "going by what Atlas holds",
    );
  });

  it("keeps the sentence Atlas read it from", () => {
    panel(POOL, true, "all-day");
    const coldstream = screen
      .getAllByTestId("today-direction-place")
      .find((x) => x.textContent?.includes("Coldstream Park"))!;
    expect(coldstream).toHaveAttribute("title", "Picnic shelter");
  });
});

describe("when nothing says it can take the rain", () => {
  it("says so plainly above whatever it offers", () => {
    panel([STUART_PARK, DEER_PARK], true, "all-day");
    const said = screen.getByTestId("today-weather-caveat").textContent!;
    expect(said).toContain("none of these say they can take it");
    expect(said).toContain("1 are out in the open");
    expect(said).toContain("says nothing either way about 1");
  });
});

describe("a dry afternoon", () => {
  it("argues with nothing, and still answers in verbs", () => {
    panel(POOL, false, "all-day");
    expect(
      screen.queryByTestId("today-weather-caveat"),
    ).not.toBeInTheDocument();
    // Five places, three things to do: two of them are rinks.
    expect(
      screen.getAllByTestId("today-direction").map((d) => d.dataset["doing"]),
    ).toEqual(["Skating", "Playground", "Tennis courts"]);
    expect(listed().join(" | ")).toContain("Deer Park");
  });

  it("says nothing about shelter when the sky is not arguing", () => {
    panel(POOL, false, "all-day");
    expect(screen.queryByTestId("today-shelter")).not.toBeInTheDocument();
  });
});

/**
 * **"I have a five-year-old for eight hours."**
 *
 * The length of the day decides how many different ideas to offer, and
 * nothing else. Atlas states a duration for 17 candidates out of 2,683 — all
 * hiking, all free text — so Passport cannot know how long any of this takes,
 * and does not say.
 */
describe("how long they have", () => {
  const MANY = [
    place("Pine Park", "Playground"),
    place("Otter Lake", "Swimming"),
    place("Kal Beach", "Beach"),
    place("Marshall Field", "Softball"),
    place("Civic Courts", "Tennis courts"),
    place("Hoop Park", "Basketball"),
  ];

  it("offers one thing for an hour", () => {
    panel(MANY, false, "an-hour");
    expect(listed()).toHaveLength(1);
    expect(screen.getByTestId("today-answer")).toHaveTextContent(
      "One thing you could do",
    );
  });

  it("offers two for half a day", () => {
    panel(MANY, false, "half-day");
    expect(listed()).toHaveLength(2);
    expect(screen.getByTestId("today-answer")).toHaveTextContent(
      "A couple of ideas for the afternoon",
    );
  });

  it("offers four for the whole day", () => {
    panel(MANY, false, "all-day");
    expect(listed()).toHaveLength(4);
    expect(screen.getByTestId("today-answer")).toHaveTextContent(
      "A few different ideas for the day",
    );
  });

  it("offers something before they have said how long", () => {
    panel(MANY, false);
    expect(listed()).toHaveLength(3);
  });

  it("offers what there is, when there is less than that", () => {
    panel([place("Pine Park", "Playground")], false, "all-day");
    expect(listed()).toHaveLength(1);
  });

  it("never claims how long any of it takes", () => {
    panel(MANY, false, "all-day");
    const said = screen.getByTestId("today-answer").textContent!.toLowerCase();
    expect(said).toContain("does not know how long any of these take");
    for (const invented of ["minutes", "hours each", "itinerary", "schedule"]) {
      expect(said).not.toContain(invented);
    }
  });

  it("answers in verbs, not in a list of records", () => {
    panel(MANY, false, "all-day");
    expect(
      screen.getAllByTestId("today-direction").map((d) => d.dataset["doing"]),
      // One place behind each, so the evidence cannot separate them and the
      // order is alphabetical rather than arbitrary.
    ).toEqual(["Basketball", "Beach", "Playground", "Softball"]);
  });
});

/**
 * **Four different ideas should be four different ideas.**
 *
 * Measured in Vernon with a five-year-old and the whole day, the first cut
 * offered Playground · Swimming · Beach · Basketball — and Swimming and Beach
 * each opened with Kal Beach and Kin Beach. Two of the four were the same
 * lake. Both verbs are true; they do not make a second afternoon.
 */
describe("ideas that are actually different", () => {
  const lake = place("Kal Beach", "Swimming");
  const alsoLake = {
    ...lake,
    id: "kal",
    knowledge: {
      affordances: [
        { name: "Swimming", basis: "offers" },
        { name: "Beach", basis: "offers" },
      ],
    },
  } as Experience;

  it("passes over a verb that adds no place an earlier one did not", () => {
    const pool = [alsoLake, place("Pine Park", "Playground")];
    panel(pool, false, "all-day");
    const doing = screen
      .getAllByTestId("today-direction")
      .map((d) => d.dataset["doing"]);
    // One of the two, not both — whichever ranked first keeps the slot, and
    // the other adds nowhere new. Which one wins is the evidence's business.
    expect(doing.filter((d) => d === "Swimming" || d === "Beach")).toHaveLength(
      1,
    );
    expect(doing).toContain("Playground");
  });

  it("keeps a verb that brings somewhere new", () => {
    const pool = [
      alsoLake,
      place("Kalavista Boat Launch", "Beach"),
      place("Pine Park", "Playground"),
    ];
    panel(pool, false, "all-day");
    expect(
      screen.getAllByTestId("today-direction").map((d) => d.dataset["doing"]),
    ).toContain("Beach");
  });

  it("fills the slot with the next idea rather than offering fewer", () => {
    const pool = [
      alsoLake,
      place("Pine Park", "Playground"),
      place("Hoop Park", "Basketball"),
    ];
    panel(pool, false, "all-day");
    // Swimming, Playground, Basketball — Beach skipped, three still offered.
    expect(screen.getAllByTestId("today-direction")).toHaveLength(3);
  });
});
