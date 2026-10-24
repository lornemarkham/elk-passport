import { describe, expect, it } from "vitest";
import { reasonToVisit, walkExtremes } from "./reasons";
import type { NearbyPlace } from "./nearby";

const place = (over: Partial<NearbyPlace> = {}): NearbyPlace => ({
  atlasId: "a",
  name: "Somewhere",
  km: 0.5,
  walkMinutes: 7,
  basis: "straight-line",
  source: "atlas",
  ...over,
});
const pre = { moment: "pregame", venue: "Rogers Arena" } as const;
const post = { moment: "postgame", venue: "Rogers Arena" } as const;

describe("a reason to go, made only of what Atlas holds", () => {
  it("leads with a fact Atlas lists", () => {
    expect(reasonToVisit(place({ facts: ["Happy hour: 3-6pm"] }), pre)).toMatch(
      /happy hour/i,
    );
    expect(reasonToVisit(place({ facts: ["Screens"] }), pre)).toMatch(
      /screens/i,
    );
    expect(reasonToVisit(place({ facts: ["Patio"] }), pre)).toMatch(/patio/i);
    expect(reasonToVisit(place({ facts: ["Trivia: Tuesdays"] }), pre)).toMatch(
      /^Atlas lists: trivia: Tuesdays/,
    );
  });

  it("then the walk, only when the cards really differ", () => {
    expect(
      reasonToVisit(place({ walkMinutes: 3 }), { ...pre, shortest: true }),
    ).toMatch(/Shortest walk of the lot at 3\+ min/);
    expect(
      reasonToVisit(place({ walkMinutes: 14 }), { ...pre, longest: true }),
    ).toMatch(/longest walk here at 14\+ min/);
    // A "longest" walk of five minutes is not a thing to warn about.
    expect(
      reasonToVisit(place({ walkMinutes: 5, subtype: "Restaurant" }), {
        ...pre,
        longest: true,
      }),
    ).not.toMatch(/longest/);
  });

  it("then what Atlas files it as, with the right article", () => {
    expect(reasonToVisit(place({ subtype: "Pub" }), pre)).toMatch(
      /files it as a pub/,
    );
    expect(
      reasonToVisit(place({ subtype: "Italian restaurant" }), pre),
    ).toMatch(/files it as an italian restaurant/);
    expect(reasonToVisit(place({ subtype: "unknown" }), pre)).toBe(
      "7+ min from Rogers Arena. Somebody will have opinions.",
    );
  });

  it("after the game it is about hours, and says plainly when there are none", () => {
    expect(
      reasonToVisit(
        place({ gameDay: { reading: "on", said: "11am-late" } }),
        post,
      ),
    ).toMatch(/Atlas quotes hours/);
    expect(reasonToVisit(place({ subtype: "Bar" }), post)).toMatch(
      /no hours on file/,
    );
  });

  it("never claims a quality, a price, a crowd or an opinion", () => {
    const sentences = [
      reasonToVisit(place({ facts: ["Happy hour"], subtype: "Pub" }), pre),
      reasonToVisit(place({ subtype: "Restaurant" }), pre),
      reasonToVisit(place({ subtype: "Bar" }), post),
      reasonToVisit(place({}), pre),
    ];
    for (const s of sentences)
      expect(s).not.toMatch(
        /best|famous|popular|locals|amazing|delicious|cheap|\$|rated|stars?|must/i,
      );
  });
});

describe("the shortest and longest walk among the cards", () => {
  it("finds them, and gives neither on a tie or a single card", () => {
    expect(walkExtremes([{ km: 0.4 }, { km: 0.2 }, { km: 0.9 }])).toEqual({
      shortest: 1,
      longest: 2,
    });
    expect(walkExtremes([{ km: 0.4 }, { km: 0.4 }])).toEqual({
      shortest: -1,
      longest: -1,
    });
    expect(walkExtremes([{ km: 0.4 }])).toEqual({ shortest: -1, longest: -1 });
  });
});
