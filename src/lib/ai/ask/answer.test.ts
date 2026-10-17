import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import type { DiscoveryCandidate } from "@/lib/data/types";
import {
  answerAsk,
  dayHref,
  DRIVE_FROM_KM,
  fitsConversation,
  substantial,
} from "./answer";
import { findByName } from "./byName";
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

  it("claims no length of visit Atlas does not hold", () => {
    const all = answer.picks.flatMap((p) => p.reasons);
    expect(all.join(" ")).not.toMatch(/\bminutes?\b|\bmins?\b|usually/i);
    expect(answer.note).toMatch(/Atlas's reading where it has one/);
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

describe("a drive somebody said they would make", () => {
  const routed = (e: Experience, minutes: number): Experience => ({
    ...e,
    travel: {
      kind: "routed",
      mode: "driving",
      minutes,
      roadKm: minutes,
      straightKm: minutes,
      provider: "test",
      calculatedAt: "2026-10-11T00:00:00.000Z",
      limitations: [],
    },
  });
  const verbs = ["Hiking", "Swimming"];
  const far = subject("Far Lake", { km: 132, verbs });
  const mid = subject("Mid Lake", { km: 55, verbs });
  const near = subject("Near Lake", { km: 42, verbs });

  it("reads the length, and leaves it unread when none was said", () => {
    expect(ask("What is worth driving an hour for?").driveHours).toBe(1);
    expect(ask("worth driving two hours").driveHours).toBe(2);
    expect(ask("a half an hour drive").driveHours).toBe(0.5);
    expect(ask("what is worth the drive?").driveHours).toBeUndefined();
  });

  it("drops what Atlas's own estimate puts over it, and says how many", () => {
    const answer = answerAsk(
      [routed(far, 95), routed(mid, 48), near],
      ask("What is worth driving an hour for?"),
      context,
    );
    expect(titles(answer)).toEqual(["Near Lake", "Mid Lake"]);
    expect(answer.note).toMatch(/1 over an hour was left out/);
  });

  it("never drops a place for having no routed time — a missing estimate is not a long one", () => {
    const answer = answerAsk(
      [far, mid, near],
      ask("What is worth driving an hour for?"),
      context,
    );
    expect(titles(answer)).toContain("Far Lake");
    expect(answer.note).toMatch(/straight line/);
    expect(answer.note).toMatch(/Check the drive/);
  });

  it("puts the nearest first, once a length was said", () => {
    const answer = answerAsk(
      [far, mid, near],
      ask("What is worth driving an hour for?"),
      context,
    );
    expect(titles(answer)).toEqual(["Near Lake", "Mid Lake", "Far Lake"]);
  });

  it("says which wall an empty answer hit", () => {
    const answer = answerAsk(
      [routed(far, 95), routed(mid, 80)],
      ask("What is worth driving an hour for?"),
      context,
    );
    expect(answer.picks).toEqual([]);
    expect(answer.note).toMatch(/past an hour from Vernon/);
    const bare = answerAsk(
      [subject("Corner Park", { km: 3 })],
      ask("What is worth the drive?"),
      context,
    );
    expect(bare.picks).toEqual([]);
    expect(bare.note).toMatch(/40–200 km from Vernon/);
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
    let festival = candidateToExperience({
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
      geography: {
        state: "observed",
        coordinates: [-119.27, 50.28],
        area: { id: "okanagan", name: "Okanagan" },
      },
    });
    festival = {
      ...festival,
      distance: { state: "measured", km: 2, basis: "coordinates" },
    };
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

/**
 * **Quality, measured on real questions from Vernon and Vancouver** — each
 * case below is a defect found by running `corpus.eval.test.ts` against
 * Atlas's candidates on 2026-10-11, reduced to the records that caused it.
 */
describe("somewhere, or not an answer", () => {
  const nowhere = (name: string) =>
    subject(name, {
      km: null,
      kind: "Event",
      subtype: "Retail Event",
      geography: { state: "unknown" },
      startTime: "2026-10-11T00:00:00.000Z",
      endTime: "2026-10-11T00:00:00.000Z",
      timePrecision: "day",
    });

  it("never offers what Atlas cannot place to somebody asking from a town", () => {
    // A Sun Peaks turkey sale led "three hours" from Vancouver.
    const answer = answerAsk(
      [
        nowhere("Turkey Sale"),
        subject("Close Park", { km: 2, verbs: ["Hiking"] }),
      ],
      ask("What can we do with three hours?"),
      context,
    );
    expect(titles(answer)).toEqual(["Close Park"]);
  });

  it("lets one thing placed only in this area follow, never lead", () => {
    const areaOnly = subject("Valley Museum", {
      km: null,
      geography: {
        state: "observed",
        area: { id: "okanagan", name: "Okanagan" },
      },
    });
    const answer = answerAsk(
      [
        areaOnly,
        subject("Valley Gallery", {
          km: null,
          geography: {
            state: "observed",
            area: { id: "okanagan", name: "Okanagan" },
          },
        }),
        subject("Placed Park", { km: 4, verbs: ["Hiking"] }),
      ],
      ask("something to do"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Placed Park");
    expect(answer.picks).toHaveLength(2);
    expect(answer.picks[1]?.caveat).toMatch(/can't place/);
  });
});

describe("how long, as Atlas holds it", () => {
  it("leaves out what Atlas says outlasts the time there is, and says the rest", () => {
    const answer = answerAsk(
      [
        subject("Ski Hill", {
          km: 3,
          visitDuration: { basis: "derived", minutes: [180, 420] },
        }),
        subject("Nature Centre", {
          km: 3,
          visitDuration: { basis: "derived", minutes: [30, 120] },
        }),
      ],
      ask("I've got an hour"),
      context,
    );
    expect(titles(answer)).toEqual(["Nature Centre"]);
    expect(answer.picks[0]?.reasons[0]).toBe(
      "Usually 30 min–2 h, going by what we know",
    );
  });

  it("says a source's own words where it gave them", () => {
    const answer = answerAsk(
      [
        subject("Lake Trail", {
          km: 3,
          visitDuration: {
            basis: "explicit",
            text: "Hike duration: 60 - 90 minute round-trip",
          },
        }),
      ],
      ask("three hours"),
      context,
    );
    expect(answer.picks[0]?.reasons).toContain(
      "Hike duration: 60 - 90 minute round-trip",
    );
  });
});

describe("the sky", () => {
  const indoor = (name: string, km: number) =>
    subject(name, {
      km,
      subtype: "museum",
      environment: {
        setting: "unknown",
        rain: { reading: "unknown", basis: "none" },
        exposure: { value: "indoor", basis: "derived" },
      },
    });
  const party = subject("90s Night", {
    km: 2,
    kind: "Event",
    subtype: "Party",
    startTime: "2026-10-11T00:00:00.000Z",
    endTime: "2026-10-11T00:00:00.000Z",
    timePrecision: "day",
  });

  it("asked to stay dry, somewhere Atlas reads as indoors leads a party nobody can say is", () => {
    const answer = answerAsk(
      [party, indoor("Roedde House", 1)],
      ask("It's raining, what can we do inside?"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Roedde House");
    // What it is leads — a museum is spent indoors — and Atlas's reading
    // of the place is still said.
    expect(answer.picks[0]?.reasons).toEqual(
      expect.arrayContaining(["A museum", "Indoors, going by what we know"]),
    );
  });

  it("on a wet day, an outdoor reading goes down", () => {
    const answer = answerAsk(
      [
        subject("Open Field", {
          km: 1,
          environment: {
            setting: "unknown",
            rain: { reading: "unknown", basis: "none" },
            exposure: { value: "outdoor", basis: "derived" },
          },
        }),
        indoor("Gallery", 4),
      ],
      ask("something to do"),
      { ...context, wet: true },
    );
    expect(titles(answer)).toEqual(["Gallery", "Open Field"]);
  });
});

describe("who it is with", () => {
  const burlesque = subject("Burlesque Revue", {
    km: 1,
    kind: "Event",
    subtype: "Burlesque Show",
    startTime: "2026-10-12T02:30:00.000Z",
    endTime: "2026-10-12T04:30:00.000Z",
    timePrecision: "minute",
    suitability: {
      stated: "stated",
      statements: [
        {
          about: "age",
          says: "adults-only",
          strength: "rule",
          scope: "subject",
          text: "Age restriction: 19+/No Minors",
          basis: "key-fact",
        },
      ],
    },
  });
  const playground = subject("Playground Park", {
    km: 1,
    verbs: ["Playground"],
  });

  it("for two, an adults-only show tonight leads, with its start time", () => {
    const answer = answerAsk(
      [playground, burlesque],
      ask("Date night tonight"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Burlesque Revue");
    expect(answer.picks[0]?.reasons.slice(0, 2)).toEqual([
      "Adults only, as stated",
      "Today only · 7:30 p.m.",
    ]);
    expect(answer.note).toMatch(/Atlas doesn't say what makes a good date/);
  });

  it("a stated adults-only rule is never somewhere to take a child", () => {
    const answer = answerAsk(
      [burlesque, playground],
      ask("Where can I take my kid?"),
      context,
    );
    expect(titles(answer)).toEqual(["Playground Park"]);
  });

  it("a child's answer does not lead with an event that says nothing about children", () => {
    const answer = answerAsk(
      [
        subject("Canyon Haunt", {
          km: 1,
          kind: "Event",
          subtype: "seasonal event",
          startTime: "2026-10-11T00:00:00.000Z",
          endTime: "2026-10-11T00:00:00.000Z",
          timePrecision: "day",
        }),
        subject("Beach Park", { km: 4, verbs: ["Playground"] }),
      ],
      ask("Where can I take my 6 year old this afternoon?"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Beach Park");
  });

  it("on your own says it changes nothing, rather than pretending", () => {
    const answer = answerAsk(
      [playground],
      ask("Something to do on my own"),
      context,
    );
    expect(answer.heading).toBe("On your own — where I'd start");
    expect(answer.note).toMatch(/Atlas doesn't say what suits one person/);
  });

  it("when nothing answers the question, the answer says so", () => {
    const answer = answerAsk([playground], ask("Date night tonight"), context);
    expect(answer.picks).toHaveLength(1);
    expect(answer.note).toMatch(
      /Nothing Atlas holds here clearly answers that/,
    );
  });
});

describe("unusual, counted honestly", () => {
  it("counts a kind by its family, so a spelling cannot make Stanley Park rare", () => {
    const answer = answerAsk(
      [
        subject("Stanley Park", { km: 2, subtype: "public park" }),
        subject("Queen Elizabeth Park", { km: 5, subtype: "municipal park" }),
        subject("Pinecone Park", { km: 6, subtype: "park" }),
        subject("Planetarium", { km: 3, subtype: "planetarium" }),
      ],
      ask("Something unusual nearby"),
      context,
    );
    const reasons = answer.picks.flatMap((p) => p.reasons).join(" ");
    expect(reasons).not.toMatch(/only public park/);
    expect(answer.picks[0]?.experience.title).toBe("Planetarium");
  });

  it("never calls an event rare for its publisher's filing, nor a listed non-doing", () => {
    const answer = answerAsk(
      [
        subject("Turkey Sale", {
          km: 2,
          kind: "Event",
          subtype: "Retail Event",
          startTime: "2026-10-11T00:00:00.000Z",
          endTime: "2026-10-11T00:00:00.000Z",
          timePrecision: "day",
        }),
        subject("Athletics Park", { km: 2, verbs: ["community use"] }),
      ],
      ask("Something unusual nearby"),
      context,
    );
    const reasons = answer.picks.flatMap((p) => p.reasons).join(" ");
    expect(reasons).not.toMatch(/Retail Event|community use/);
  });
});

describe("worth the drive, by what you can do there", () => {
  it("does not count 'Conventions, Trade Shows, Meetings' as things to do", () => {
    const answer = answerAsk(
      [
        subject("Convention Centre", {
          km: 89,
          verbs: ["Conventions", "Trade Shows", "Meetings", "Banquets"],
        }),
        subject("Canyon Trail", { km: 54, verbs: ["Hiking", "Cycling"] }),
      ],
      ask("What is worth driving an hour for?"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Canyon Trail");
  });
});

/**
 * **A sentence nothing was read from is not an answer.** It used to be
 * greeted with "Picked from what fits your answers, each for a reason you can
 * check" — an understanding nobody had. The picks are still real Atlas
 * subjects; they are now said to be only a starting point.
 */
describe("a sentence nothing could be read from", () => {
  const pool = [
    subject("Polson Park", { km: 2, verbs: ["Playground"] }),
    subject("Kal Beach", { km: 6, subtype: "beach", verbs: ["Swimming"] }),
  ];

  it.each(["blorp zxq", "take me to Atlantis", "the Qwerty Building"])(
    "says it did not catch %j, and still offers only real subjects",
    (said) => {
      const answer = answerAsk(pool, ask(said), context);
      expect(answer.unread).toBe(true);
      expect(answer.heading).toBe("I didn't catch what you're after");
      expect(answer.note).toMatch(/Atlas knows about/);
      expect(answer.note).not.toMatch(/each for a reason you can check/);
      const real = new Set(pool.map((p) => p.id));
      expect(answer.picks.length).toBeGreaterThan(0);
      for (const pick of answer.picks)
        expect(real).toContain(pick.experience.id);
    },
  );

  it("'waterfall' is now an activity, and nothing here offers one", () => {
    const answer = answerAsk(pool, ask("waterfall"), context);
    expect(answer.unread).toBeUndefined();
    expect(answer.note).toMatch(/doesn't list anywhere for views & waterfalls/);
  });

  it("does not apply to a sentence that read something", () => {
    const answer = answerAsk(pool, ask("a Saturday in Vernon"), context);
    expect(answer.unread).toBeUndefined();
    expect(answer.heading).not.toMatch(/didn't catch/);
  });
});

/** Discovery 2.0: what the newer readings may and may not claim. */
describe("answers to the newer readings", () => {
  const routed = (e: Experience, minutes: number): Experience => ({
    ...e,
    travel: {
      kind: "routed",
      mode: "driving",
      minutes,
      roadKm: minutes,
      straightKm: minutes,
      provider: "test",
      calculatedAt: "2026-10-11T00:00:00.000Z",
      limitations: [],
    },
  });

  it("'free' is quoted where a description says it, and never claimed with a condition", () => {
    const rink = subject("Outdoor Rink", {
      km: 1,
      subtype: "rink",
      description:
        "An outdoor rink that provides free public skating all winter.",
    });
    const pool = subject("Aquatic Centre", {
      km: 2,
      subtype: "aquatic centre",
      description:
        "A pool with a waterslide, with free admission on Family Day.",
    });
    const winery = subject("Fancy Winery", { km: 1, subtype: "winery" });
    const answer = answerAsk(
      [winery, pool, rink],
      ask("something free"),
      context,
    );
    expect(answer.picks[0]?.experience.title).toBe("Outdoor Rink");
    expect(answer.picks[0]?.reasons[0]).toBe(
      "“free public skating”, as its description says",
    );
    const aquatic = answer.picks.find(
      (p) => p.experience.title === "Aquatic Centre",
    );
    expect(aquatic?.reasons.join(" ")).not.toMatch(/free/i);
    expect(aquatic?.caveat).toBe("No price stated — check before you go");
    expect(titles(answer).at(-1)).toBe("Fancy Winery");
    expect(answer.note).toMatch(/Atlas rarely states prices/);
  });

  it("a drive limit uses Atlas's routed time, else only a physical bound", () => {
    const quick = routed(subject("Quick Lake", { km: 20 }), 18);
    const slow = routed(subject("Slow Lake", { km: 15 }), 40);
    const unrouted = subject("Unrouted Park", { km: 25 });
    const impossible = subject("Far Park", { km: 80 });
    const answer = answerAsk(
      [quick, slow, unrouted, impossible],
      ask("within 30 minutes"),
      context,
    );
    expect(titles(answer).sort()).toEqual(["Quick Lake", "Unrouted Park"]);
    expect(answer.note).toMatch(/2 were left out as further/);
  });

  it("'not hiking' leaves out a trail and keeps a park that also has a beach", () => {
    const trail = subject("Ridge Trail", {
      km: 2,
      subtype: "trail",
      verbs: ["Hiking"],
    });
    const park = subject("Lake Park", { km: 3, verbs: ["Hiking", "Swimming"] });
    const answer = answerAsk(
      [trail, park],
      ask("outside but not hiking"),
      context,
    );
    expect(titles(answer)).toEqual(["Lake Park"]);
  });

  it("'something completely different' shows none of what was shown", () => {
    const a = subject("Alpha Park", { km: 1, verbs: ["Playground"] });
    const b = subject("Beta Museum", { km: 2, subtype: "museum" });
    const answer = answerAsk(
      [a, b],
      ask("show me something completely different"),
      { ...context, shown: [a.id] },
    );
    expect(titles(answer)).toEqual(["Beta Museum"]);
  });

  it("a named activity is answered even where Atlas cannot place it, and says so", () => {
    const cinema = subject("Town Cinema", { km: null, subtype: "cinema" });
    const cinema2 = subject("Plaza Cinema", { km: null, subtype: "cinema" });
    const park = subject("Near Park", { km: 1, verbs: ["Playground"] });
    const answer = answerAsk(
      [park, cinema, cinema2],
      ask("the movies"),
      context,
    );
    expect(titles(answer).sort()).toEqual(["Plaza Cinema", "Town Cinema"]);
    expect(answer.picks[0]?.caveat).toMatch(/can't place this/);
    expect(answer.heading).toBe("Movies, from Vernon");
  });

  it("says when nothing here does the activity they named", () => {
    const park = subject("Near Park", { km: 1, verbs: ["Playground"] });
    const answer = answerAsk([park], ask("go bowling"), context);
    expect(answer.note).toMatch(
      /doesn't list anywhere for bowling, games & escape rooms/,
    );
  });

  it("'I'm bored' is answered, with nothing asked of them first", () => {
    const answer = answerAsk(
      [
        subject("Alpha Park", { km: 1, verbs: ["Playground"] }),
        subject("Beta Museum", { km: 2, subtype: "museum" }),
      ],
      ask("I'm bored"),
      context,
    );
    expect(answer.unread).toBeUndefined();
    expect(answer.picks.length).toBe(2);
    expect(answer.heading).toMatch(/A few ideas/);
  });

  it("an afternoon for two is not an evening concert", () => {
    const concert = subject("Late Concert", {
      kind: "Event",
      subtype: "Concert",
      startTime: "2026-10-11T19:30:00-07:00",
      endTime: "2026-10-11T22:00:00-07:00",
      timePrecision: "minute",
    } as Partial<DiscoveryCandidate>);
    const winery = subject("Hill Winery", { km: 4, subtype: "winery" });
    const answer = answerAsk(
      [concert, winery],
      ask("a romantic afternoon"),
      context,
    );
    expect(titles(answer)[0]).toBe("Hill Winery");
  });
});

describe("a place said by name, in the one box", () => {
  const orchard = subject("Davison Orchards", { km: 4 });
  const kangaroo = subject("Kangaroo Creek Farm", {
    km: 6,
    subtype: "farm",
  });
  const park = subject("Polson Park", { km: 2 });
  const pool = [orchard, kangaroo, park];
  const answerFor = (said: string) => {
    const reading = ask(said);
    const loose = Object.keys(reading).every((k) => k === "said");
    return answerAsk(pool, reading, {
      ...context,
      named: findByName(pool, said, { loose }),
    });
  };

  it("answers a name the reader hears nothing in with that place, and nothing passed off as an answer", () => {
    const answer = answerFor("Davison Orchards");
    expect(answer.heading).toBe("Davison Orchards");
    expect(titles(answer)).toEqual(["Davison Orchards"]);
    expect(answer.picks[0]?.reasons).toEqual(["The name you said"]);
    expect(answer.unread).toBeUndefined();
  });

  it("leads with the named place even when the sentence also reads as something", () => {
    // "Kangaroo Creek Farm" reads as *farms*; the farm they named still leads.
    const answer = answerFor("Kangaroo Creek Farm with my daughter");
    expect(titles(answer)[0]).toBe("Kangaroo Creek Farm");
  });

  it("does not lead with a one-word name merely mentioned in a sentence", () => {
    const vernon = subject("Vernon", { km: 1 });
    expect(
      findByName([vernon], "something fun near Vernon", { loose: false }),
    ).toEqual([]);
  });

  it("still says it heard nothing when nothing is named either", () => {
    const answer = answerFor("take me to Atlantis");
    expect(answer.unread).toBe(true);
    expect(answer.note).not.toMatch(/search by name below/);
  });
});

describe("the rest of the page listens to the conversation", () => {
  const exposed = (name: string, value: "indoor" | "outdoor") =>
    subject(name, {
      km: 3,
      environment: {
        setting: "unknown",
        rain: { reading: "unknown", basis: "none" },
        exposure: { value, basis: "derived" },
      },
    });
  const museum = exposed("Museum", "indoor");
  const field = exposed("Open Field", "outdoor");
  const unknown = subject("Somewhere Atlas says nothing about", { km: 3 });

  it("asked for indoors, drops what Atlas says is outdoors and keeps silence", () => {
    const fits = fitsConversation(ask("somewhere indoors"), context);
    expect([museum, field, unknown].filter(fits).map((e) => e.title)).toEqual([
      "Museum",
      "Somewhere Atlas says nothing about",
    ]);
  });

  it("asked for outdoors, drops what Atlas says is indoors", () => {
    const fits = fitsConversation(ask("get outside"), context);
    expect(fits(museum)).toBe(false);
    expect(fits(field)).toBe(true);
  });

  it("a stated drive removes only what physics or Atlas's route puts past it", () => {
    const fits = fitsConversation(ask("within 30 minutes"), context);
    expect(fits(subject("Close", { km: 10 }))).toBe(true);
    // 30 minutes at 100 km/h is 50 km in a straight line.
    expect(fits(subject("Far", { km: 80 }))).toBe(false);
    // Unplaced stays: a missing distance is not a long one.
    expect(fits(subject("Unplaced", { km: null }))).toBe(true);
  });

  it("without an origin, a stated drive removes nothing", () => {
    const fits = fitsConversation(ask("within 30 minutes"), {});
    expect(fits(subject("Far", { km: 80 }))).toBe(true);
  });
});
