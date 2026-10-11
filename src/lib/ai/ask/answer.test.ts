import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { answerAsk, dayHref, DRIVE_FROM_KM, substantial } from "./answer";
import { readAsk } from "./read";

// A Sunday.
const today = "2026-10-11";
const VERNON = { latitude: 50.267, longitude: -119.272 };
const context = {
  today,
  origin: VERNON,
  originLabel: "Vernon",
  home: "Okanagan",
};

let n = 0;
/**
 * One subject, with Atlas's distance reading already attached the way the
 * page attaches it. `km: undefined` is a subject Atlas could not place.
 */
function subject(
  name: string,
  over: Partial<DiscoveryCandidate> & {
    km?: number | null;
    verbs?: string[];
    photo?: boolean;
  } = {},
): Experience {
  const { km = 5, verbs = [], photo = true, ...rest } = over;
  n += 1;
  const candidate: DiscoveryCandidate = {
    id: `${name.toLowerCase().replace(/\W+/g, "-")}-${n}`,
    kind: "Place",
    name,
    subtype: "park",
    description: "A description long enough to be real, about this place.",
    mediaCount: photo ? 1 : 0,
    ...(photo ? { heroUrl: `https://atlas.test/${n}.jpg` } : {}),
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      // Spread out so no two fixtures share a spot by accident.
      coordinates: [-119.272 + n * 0.01, 50.267 + (km ?? 0) / 111],
    },
    ...(verbs.length
      ? {
          knowledge: {
            affordances: verbs.map((name) => ({
              name,
              basis: "stated-activity",
            })),
          },
        }
      : {}),
    ...rest,
  };
  const experience = candidateToExperience(candidate);
  return {
    ...experience,
    distance:
      km === null
        ? { state: "unknown" }
        : { state: "measured", km, basis: "coordinates", within: km <= 60 },
  };
}

const ask = (said: string) =>
  readAsk(said, {
    today,
    verbs: ["Hiking", "Swimming", "Playground", "Llama trekking"],
  });
const titles = (answer: ReturnType<typeof answerAsk>) =>
  answer.picks.map((p) => p.experience.title);

describe("what can we do with three hours?", () => {
  const pool = [
    subject("Polson Park", { km: 1, verbs: ["Playground", "Walking"] }),
    subject("Mission Hill Park", { km: 2, verbs: ["Playground", "Walking"] }),
    subject("Marshall Fields", { km: 3, verbs: ["Playground", "Walking"] }),
    subject("Lakeview Park", { km: 3, verbs: ["Playground", "Walking"] }),
    subject("Vernon Museum", {
      km: 2,
      subtype: "museum",
      verbs: ["Exhibits"],
    }),
    subject("Davison Orchards", {
      km: 6,
      subtype: "farm",
      verbs: ["U-pick"],
    }),
    subject("Silver Star", { km: 45, subtype: "resort", verbs: ["Hiking"] }),
  ];
  const answer = answerAsk(pool, ask("What can we do with three hours?"), {
    ...context,
  });

  it("answers with a few, not a list", () => {
    expect(answer.picks.length).toBe(4);
    expect(answer.heading).toBe("Three hours, close to Vernon");
  });

  it("mixes kinds instead of four parks with playgrounds", () => {
    expect(titles(answer)).toContain("Vernon Museum");
    expect(titles(answer)).toContain("Davison Orchards");
    const parks = answer.picks.filter((p) => p.experience.subtype === "park");
    expect(parks.length).toBeLessThanOrEqual(2);
  });

  it("prefers close by when the time is short", () => {
    expect(titles(answer)).not.toContain("Silver Star");
  });

  it("never claims how long anything takes", () => {
    const all = [answer.note, ...answer.picks.flatMap((p) => p.reasons)];
    expect(all.join(" ")).not.toMatch(/\bminutes?\b|\bmins?\b/i);
    expect(answer.note).toMatch(/publishes how long/);
  });

  it("asks from where, when there is nowhere to measure from", () => {
    const blind = answerAsk(pool, ask("three hours"), { today });
    expect(blind.gaps.map((g) => g.about)).toEqual(["origin"]);
    expect(blind.heading).toBe("Three hours — where I'd start");
  });
});

describe("what's something unusual nearby?", () => {
  const parks = Array.from({ length: 14 }, (_, i) =>
    subject(`Park ${i}`, { km: 2 + i, verbs: ["Playground"] }),
  );
  const llamas = subject("Ridge Llamas", {
    km: 9,
    subtype: "llama farm",
    verbs: ["Llama trekking"],
  });
  const answer = answerAsk(
    [...parks, llamas],
    ask("What's something unusual nearby?"),
    context,
  );

  it("leads with the rarest thing Atlas holds", () => {
    expect(answer.picks[0]?.experience.title).toBe("Ridge Llamas");
    expect(answer.picks[0]?.reasons[0]).toBe(
      "The only llama farm in Okanagan that Atlas knows of",
    );
  });

  it("says what 'unusual' means, honestly", () => {
    expect(answer.heading).toBe("Something unusual, close by");
    expect(answer.note).toMatch(/not a judgement of taste/);
  });
});

describe("where can I take my kid this afternoon?", () => {
  const pool = [
    subject("Taproom", { km: 1, subtype: "brewery", verbs: ["Beer"] }),
    subject("Polson Park", { km: 2, verbs: ["Playground", "Picnic areas"] }),
    subject("Kal Beach", { km: 6, subtype: "beach", verbs: ["Swimming"] }),
  ];

  it("leads with somewhere a child can do something, by stated evidence", () => {
    const answer = answerAsk(
      pool,
      ask("Where can I take my kid this afternoon?"),
      context,
    );
    expect(answer.heading).toBe("Somewhere to take a kid this afternoon");
    expect(answer.picks[0]?.experience.title).toBe("Polson Park");
    expect(answer.picks[0]?.reasons).toContain(
      "Playground · Picnic areas, as listed",
    );
  });

  it("asks how old rather than guessing", () => {
    const answer = answerAsk(
      pool,
      ask("Where can I take my kid this afternoon?"),
      context,
    );
    expect(answer.gaps).toEqual([expect.objectContaining({ about: "age" })]);
  });

  it("says when it has no published hours for the day asked", () => {
    const answer = answerAsk(
      pool,
      ask("Where can I take my kid this afternoon?"),
      context,
    );
    expect(answer.picks[0]?.caveat).toBe(
      "No hours published — check before you go",
    );
  });
});

describe("what is worth driving an hour for?", () => {
  const pool = [
    subject("Corner Park", { km: 3, verbs: ["Playground"] }),
    subject("Sovereign Lake", {
      km: 55,
      subtype: "nordic centre",
      verbs: ["Skiing", "Snowshoeing", "Hiking", "Biking"],
      containsCount: 4,
    }),
    subject("Thin Lake", { km: 70, verbs: ["Fishing"], photo: false }),
    subject("Somewhere Unplaced", { km: null, verbs: ["Hiking", "Swimming"] }),
    subject("Vancouver Aquarium", { km: 330, subtype: "aquarium" }),
  ];
  const answer = answerAsk(
    pool,
    ask("What is worth driving an hour for?"),
    context,
  );

  it(`only offers what is ${DRIVE_FROM_KM}+ km out, with the most to it first`, () => {
    expect(titles(answer)).toEqual(["Sovereign Lake", "Thin Lake"]);
    expect(answer.picks[0]?.reasons[0]).toContain("4 places inside it");
  });

  it("states distance as straight-line kilometres and refuses to time it", () => {
    expect(answer.picks[0]?.reasons).toContain(
      "≈ 55 km away, in a straight line",
    );
    expect(answer.note).toMatch(/can't time a drive/);
  });

  it("asks from where, rather than pretending", () => {
    const blind = answerAsk(pool, ask("What is worth driving an hour for?"), {
      today,
    });
    expect(blind.gaps.map((g) => g.about)).toEqual(["origin"]);
    expect(blind.note).toMatch(/from where/i);
  });
});

describe("timely things", () => {
  const event = (name: string, from: string, to: string, km = 4): Experience =>
    subject(name, {
      km,
      kind: "Event",
      subtype: "festival",
      startTime: `${from}T00:00:00.000Z`,
      endTime: `${to}T00:00:00.000Z`,
      timePrecision: "day",
    });

  it("lifts what is on today and says so", () => {
    const pool = [
      subject("Plain Park", { km: 1, verbs: ["Walking"] }),
      event("Harvest Festival", "2026-10-09", "2026-10-11"),
    ];
    const answer = answerAsk(pool, ask("something to do today"), context);
    expect(answer.picks[0]?.experience.title).toBe("Harvest Festival");
    expect(answer.picks[0]?.reasons[0]).toBe("Last day");
  });

  it("never offers something already over, or not on the day asked", () => {
    const pool = [
      subject("Plain Park", { km: 1, verbs: ["Walking"] }),
      event("Last Week's Fair", "2026-10-01", "2026-10-04"),
      event("Next Week's Fair", "2026-10-17", "2026-10-18"),
    ];
    const answer = answerAsk(pool, ask("something to do today"), context);
    expect(titles(answer)).toEqual(["Plain Park"]);
  });
});

describe("repetition and low-quality records", () => {
  it("never offers the same name twice, or two records on one spot", () => {
    const farm = subject("Kangaroo Creek Farm", { km: 4, subtype: "farm" });
    const again = subject("Kangaroo Creek Farm", { km: 8, subtype: "farm" });
    const sameSpot = {
      ...subject("Kangaroo Creek Farm Store", { km: 4, subtype: "shop" }),
      geography: farm.geography,
    } as Experience;
    const answer = answerAsk(
      [farm, again, sameSpot, subject("Elsewhere Park", { km: 3 })],
      ask("something to do"),
      context,
    );
    expect(
      titles(answer).filter((t) => t.startsWith("Kangaroo Creek")),
    ).toHaveLength(1);
  });

  it("does not offer a record with nothing to it as an answer", () => {
    const hollow = candidateToExperience({
      id: "hollow",
      kind: "Place",
      name: "Hollow",
      subtype: "park",
      description: "Hollow.",
      mediaCount: 0,
      containsCount: 0,
      regionIds: [],
      knowledge: { descriptionAddsKnowledge: false },
    });
    expect(substantial(hollow)).toBe(false);
    expect(substantial(subject("Pictured", { verbs: [] }))).toBe(true);
  });

  it("says when Atlas cannot place a pick", () => {
    const answer = answerAsk(
      [subject("Lost Park", { km: null, verbs: ["Hiking"] })],
      ask("something to do"),
      context,
    );
    expect(answer.picks[0]?.caveat).toBe(
      "Atlas can't place this, so we can't say how far",
    );
  });
});

describe("the way into Go have a day", () => {
  it("carries the sentence, the choices and the answers — never a position", () => {
    expect(
      dayHref({
        say: "three hours",
        with: ["a", "b"],
        at: "vernon",
        age: 5,
        on: today,
      }),
    ).toBe("/go?say=three+hours&with=a%2Cb&at=vernon&age=5&on=2026-10-11");
    expect(dayHref({})).toBe("/go");
  });
});

describe("found by using it", () => {
  it("offers a dated thing on today even with no photograph and one short line", () => {
    const festival = candidateToExperience({
      id: "fest",
      kind: "Event",
      name: "Harvest Festival",
      subtype: "festival",
      description: "Pumpkins and cider.",
      mediaCount: 0,
      containsCount: 0,
      regionIds: [],
      startTime: "2026-10-09T00:00:00.000Z",
      endTime: "2026-10-11T00:00:00.000Z",
      timePrecision: "day",
    });
    const answer = answerAsk(
      [festival, subject("Plain Park", { km: 1, verbs: ["Walking"] })],
      ask("What can we do with three hours?"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Harvest Festival");
  });

  it("says 'Vernon', not the picker's 'Vernon, BC'", () => {
    const answer = answerAsk([subject("Park", { km: 1 })], ask("three hours"), {
      ...context,
      originLabel: "Vernon, BC",
    });
    expect(answer.heading).toBe("Three hours, close to Vernon");
  });

  it("counts rarity over the reference it is given, not the narrowed pool", () => {
    const museum = subject("Vernon Museum", { km: 2, subtype: "museum" });
    const other = subject("Kelowna Museum", { km: 45, subtype: "museum" });
    const answer = answerAsk([museum], ask("something unusual"), {
      ...context,
      reference: [museum, other],
    });
    expect(answer.picks[0]?.reasons[0]).toBe(
      "One of 2 places Atlas calls a museum in Okanagan",
    );
  });
});
