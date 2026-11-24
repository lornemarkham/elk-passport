import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { activityByKey, activityEvidence } from "@/domain/discovery/activities";
import { townById } from "@/domain/discovery/towns";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { SEED } from "./lights/seed";
import { visible } from "./lights/model";
import { readRequest } from "./request";
import {
  planItinerary,
  readEdits,
  usefulDay,
  writeEdits,
  type Itinerary,
} from "./itinerary";
import { momentsFor } from "./moments";

/**
 * **Christmas Experience 2.0 — every part asked for is planned or said
 * unresolved**, on Atlas's real corpora: the committed e2e stand-in of
 * 2026-10-24 (full records, published hours) and the production pool read
 * from gohaveaday.com on 2026-11-14 (this season's events; the browser pool
 * carries no hours). Lights are the lights map's researched seed, as
 * published. "Today" is 2026-11-14, a Saturday.
 */
const TODAY = "2026-11-14";
const NOW = new Date("2026-11-14T20:00:00Z");
const pins = visible({ pins: SEED }, { key: null, reviewer: false }, NOW);

function corpus(name: string) {
  const file = resolve(
    __dirname,
    `../../../docs/product/christmas/verification/${name}`,
  );
  const parsed = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  const list: DiscoveryCandidate[] = Array.isArray(parsed)
    ? parsed
    : parsed.candidates;
  return list.map(candidateToExperience);
}
const OCT = corpus("atlas-candidates-2026-10-24.json.gz");
const NOV = corpus("atlas-candidates-2026-11-14.json.gz");

function plan(
  say: string,
  at: string,
  experiences = OCT,
  params: Record<string, string> = {},
): Itinerary {
  const t = townById(at)!;
  return planItinerary(
    readRequest(say, TODAY),
    {
      experiences,
      pins,
      origin: {
        id: t.id,
        name: t.name.replace(/,\s*BC$/, ""),
        latitude: t.latitude,
        longitude: t.longitude,
      },
      today: TODAY,
    },
    readEdits(params),
  );
}

const byRef = new Map([...OCT, ...NOV].map((e) => [`atlas:${e.id}`, e]));
/** Atlas's own words put the chosen place in the activity. */
const isA = (ref: string | undefined, key: string) => {
  const e = ref ? byRef.get(ref) : undefined;
  return Boolean(e && activityEvidence(e, activityByKey(key)!).length > 0);
};

/** Every part asked for is one stop, planned or unresolved — never swapped. */
function representsEveryPart(p: Itinerary, needs: readonly string[]) {
  expect(p.stops.map((s) => s.need).sort()).toEqual([...needs].sort());
  for (const s of p.stops) {
    if (s.status === "planned") expect(s.place).toBeDefined();
    else expect(s.reason).toMatch(/\w/);
  }
}

describe("1 · romantic night of lights, dinner and a movie", () => {
  it("Vernon, Dec 5: a real dinner, lit displays, and the movie said unresolved — not a third restaurant", () => {
    for (const experiences of [OCT, NOV]) {
      const p = plan(
        "Romantic night of lights, dinner and a movie on December 5",
        "vernon",
        experiences,
      );
      representsEveryPart(p, ["dinner", "lights", "movie"]);
      const [dinner, lights, movie] = ["dinner", "lights", "movie"].map((n) =>
        p.stops.find((s) => s.need === n)!,
      );
      expect(dinner!.status).toBe("planned");
      expect(isA(dinner!.place!.ref, "restaurants")).toBe(true);
      expect(dinner!.label).toBe("Romantic dinner");
      expect(dinner!.place!.title).not.toMatch(/pub|pizza|sports|mcdonald/i);
      expect(lights!.status).toBe("planned");
      expect(lights!.place!.source).toBe("map");
      expect(lights!.time!).toBeGreaterThan(dinner!.time!);
      expect(movie!.status).toBe("unresolved");
      expect(movie!.reason).toMatch(/no cinema within 25 km of Vernon/);
      expect(movie!.nearest?.title).toMatch(/Bernie's Supper Club/);
      // Nothing food-shaped stands in for the lights or the movie.
      for (const s of p.stops.filter((x) => x.need !== "dinner"))
        expect(isA(s.place?.ref, "restaurants")).toBe(false);
    }
  });

  it("Kelowna, Dec 12: dinner → lights → movie, in that order, the movie a cinema with no invented showtime", () => {
    const p = plan(
      "Romantic night of lights, dinner and a movie Dec 12",
      "kelowna",
      NOV,
    );
    representsEveryPart(p, ["dinner", "lights", "movie"]);
    expect(p.unresolved).toBe(0);
    expect(p.stops.map((s) => s.need)).toEqual(["dinner", "lights", "movie"]);
    const times = p.stops.map((s) => s.time!);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(17 * 60 + 30);
    const movie = p.stops[2]!;
    expect(isA(movie.place!.ref, "movies")).toBe(true);
    expect(movie.timeIs).toBe("about");
    expect(movie.notes.join(" ")).toMatch(/Showtimes aren't listed/);
    expect(p.title).toBe("Our romantic Christmas evening");
    expect(p.who).toBe("The two of you");
    expect(p.km).toBeGreaterThan(0);
    expect(p.totalMinutes).toBeGreaterThan(180);
  });

  it("checks the restaurant's own hours: nothing closed that evening is chosen", () => {
    const p = plan(
      "Romantic dinner and the lights on December 5",
      "vernon",
      OCT,
    );
    const dinner = p.stops.find((s) => s.need === "dinner")!;
    expect(dinner.place!.hours).not.toMatch(/^Closed/);
    for (const alt of dinner.alternatives)
      expect(alt.hours ?? "").not.toMatch(/^Closed/);
  });
});

describe("2 · family with two children and $100", () => {
  const p = plan(
    "Family with two kids and $100, Saturday afternoon",
    "vernon",
    NOV,
  );
  it("reads the family, the children and the budget, and says what Atlas knows about prices", () => {
    expect(p.who).toMatch(/Family · 2 kids/);
    expect(p.budget).toMatch(/^Budget \$100: /);
  });
  it("suggests (not says) family parts, never a bar, and offers kids' challenges", () => {
    for (const s of p.stops) {
      expect(s.said).toBe(false);
      expect(s.place?.title ?? "").not.toMatch(/\b(pub|bar|lounge)\b/i);
    }
    expect(p.stops.some((s) => s.status === "planned")).toBe(true);
    const m = momentsFor({
      party: "family",
      romantic: false,
      needs: ["skating"],
    });
    expect(m.kind).toBe("family");
    expect(m.items[0]!.title).toBe("Get on the ice");
  });
});

describe("3 · friends visiting Christmas markets", () => {
  it("plans a Christmas market that is on that day", () => {
    const p = plan(
      "Friends visiting Christmas markets on Nov 28",
      "vernon",
      NOV,
    );
    representsEveryPart(p, ["market"]);
    expect(p.stops[0]!.status).toBe("planned");
    expect(p.stops[0]!.place!.title).toMatch(/Christmas|Holiday|Market/i);
    expect(p.title).toBe("A Christmas day with friends");
    expect(
      momentsFor({ party: "friends", romantic: false, needs: ["market"] })
        .items[0]!.title,
    ).toBe("Vote on the plan");
  });
});

describe("4 · Christmas lights driving tour", () => {
  it("strings several published, lit displays into one route with directions", () => {
    const p = plan("Christmas lights driving tour on Dec 12", "kelowna", NOV);
    const lights = p.stops[0]!;
    expect(lights.status).toBe("planned");
    expect(lights.displays!.length).toBeGreaterThanOrEqual(2);
    expect(lights.directions).toMatch(/google\.com\/maps\/dir\/.*waypoints/);
    for (const d of lights.displays!) {
      expect(d.title).not.toMatch(/yoga|class|sale|fundraiser/i);
      if (d.source === "map") expect(d.why).toMatch(/community lights map/);
    }
    expect(lights.time).toBeGreaterThanOrEqual(17 * 60);
  });

  it("never puts a private home on a tour without its owner's okay", () => {
    const home = SEED.find((p) => p.residential);
    expect(home).toBeUndefined(); // the seed is public places only…
    const p = plan("Christmas lights tour on Dec 12", "kelowna", NOV);
    // …and only approved, lit, visible pins can be chosen at all.
    for (const d of p.stops[0]!.displays ?? []) {
      const pin = pins.find((p) => `map:${p.id}` === d.ref);
      if (pin) expect(pin.status).toBe("approved");
    }
  });
});

describe("5 · changing plans halfway", () => {
  it("drop, replace, re-time and add each change only what was asked", () => {
    const base = plan(
      "Romantic night of lights, dinner and a movie Dec 12",
      "kelowna",
      NOV,
    );
    const dinner = base.stops.find((s) => s.need === "dinner")!;
    const other = dinner.alternatives[0]!;
    const changed = plan(
      "Romantic night of lights, dinner and a movie Dec 12",
      "kelowna",
      NOV,
      writeEdits({
        drop: ["movie"],
        pick: { dinner: other.ref },
        times: { dinner: 18 * 60 },
        add: ["coffee"],
      }),
    );
    expect(changed.stops.map((s) => s.need)).toEqual([
      "dinner",
      "coffee",
      "lights",
    ]);
    const d = changed.stops[0]!;
    expect(d.place!.ref).toBe(other.ref);
    expect(d.time).toBe(18 * 60);
    expect(changed.stops[1]!.time!).toBeGreaterThan(d.time!);
    // The address round-trips.
    expect(
      readEdits(writeEdits(readEdits({ drop: "movie", t: "dinner:1800" }))),
    ).toMatchObject({
      drop: ["movie"],
      times: { dinner: 18 * 60 },
    });
  });

  it("a day the lights aren't on yet offers the first night they are", () => {
    const p = plan(
      "Romantic night of lights, dinner and a movie",
      "vernon",
      NOV,
      { day: "2026-11-21" },
    );
    const lights = p.stops.find((s) => s.need === "lights")!;
    expect(lights.status).toBe("unresolved");
    expect(lights.tryDay!.day > "2026-11-21").toBe(true);
    const moved = plan(
      "Romantic night of lights, dinner and a movie",
      "vernon",
      NOV,
      { day: lights.tryDay!.day },
    );
    expect(moved.stops.find((s) => s.need === "lights")!.status).toBe(
      "planned",
    );
  });
});

describe("6 · missing or unavailable", () => {
  it("tonight in Vernon: no display is lit yet, and the plan says so instead of filling it", () => {
    const p = plan(
      "Romantic night of lights, dinner and a movie tonight",
      "vernon",
      NOV,
    );
    expect(p.day).toBe(TODAY);
    representsEveryPart(p, ["dinner", "lights", "movie"]);
    const lights = p.stops.find((s) => s.need === "lights")!;
    expect(lights.status).toBe("unresolved");
    expect(lights.reason).toMatch(/confirmed lit on Saturday, Nov 14/);
    expect(lights.reason).toMatch(/won't guess/);
    expect(p.unresolved).toBe(2);
  });

  it("no day said: plans this Saturday and asks one question — which day", () => {
    const p = plan("Christmas markets and a hot chocolate", "vernon", NOV);
    expect(p.question?.id).toBe("day");
    expect(p.question!.options[0]!.day).toBe(TODAY);
    expect(
      plan("Christmas markets on Nov 28", "vernon", NOV).question,
    ).toBeUndefined();
  });

  it("the default day is the next useful one, and still a question", () => {
    // 2026-11-14 is a Saturday: today. Mid-week points at the coming Friday.
    expect(usefulDay("2026-11-14")).toBe("2026-11-14");
    expect(usefulDay("2026-11-15")).toBe("2026-11-15");
    expect(usefulDay("2026-11-16")).toBe("2026-11-20");
    expect(usefulDay("2026-11-19")).toBe("2026-11-20");
    expect(usefulDay("2026-11-20")).toBe("2026-11-20");
  });

  it("an accessibility need is said back with what can't be confirmed", () => {
    const p = plan(
      "Lights and dinner on Nov 28, grandma uses a walker",
      "vernon",
      NOV,
    );
    expect(p.access).toMatch(/walker/);
    expect(p.access).toMatch(/can't confirm/);
    expect(plan("Lights and dinner on Nov 28", "vernon", NOV).access).toBe(
      undefined,
    );
  });

  it("with Atlas down, every part is unresolved, none invented", () => {
    const p = plan(
      "Romantic night of lights, dinner and a movie on Dec 5",
      "vernon",
      [],
    );
    expect(p.stops.find((s) => s.need === "dinner")!.status).toBe("unresolved");
    expect(p.stops.find((s) => s.need === "movie")!.status).toBe("unresolved");
  });
});

describe("contextual moments", () => {
  it("a romantic evening gets quiet moments, never dares", () => {
    const m = momentsFor({
      party: "couple",
      romantic: true,
      needs: ["dinner", "lights"],
    });
    expect(m.kind).toBe("romantic");
    expect(m.line).toMatch(/Optional/);
    expect(m.items.map((i) => i.title).join(" ")).not.toMatch(
      /dare|challenge/i,
    );
  });
  it("a lights tour gets ratings and bingo", () => {
    const m = momentsFor({ party: null, romantic: false, needs: ["lights"] });
    expect(m.items.map((i) => i.title)).toContain("Christmas Lights Bingo");
  });
});
