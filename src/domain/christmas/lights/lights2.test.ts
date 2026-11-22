import { describe, expect, it } from "vitest";
import {
  EMPTY,
  isLightDisplay,
  seasonState,
  visible,
  type LightsDoc,
  type PinView,
} from "./model";
import {
  addDetails,
  approve,
  check,
  parseDetails,
  parseSubmission,
  rate,
  Refused,
  submit,
} from "./actions";
import { bestOf, fairScore, isFavourite, isHiddenGem, priorMean } from "./rank";
import { cluster } from "./cluster";
import { buildTour, timeTour, type Stop, type TourStyle } from "./tour";
import { lightUp } from "./stats";
import { AREAS, areaById, inAreaOf, pinInArea, placeLabel } from "./areas";
import { SEED } from "./seed";

/**
 * **Lights Map 2.0** (2026-11-14): ratings, fair ranking, the map showing
 * light displays only, clusters, the three-question tour, the three-step
 * submission's privacy, and the yearly "are your lights on again?".
 */

const NOW = new Date("2026-12-05T02:00:00Z");
const ALICE = "v_alice";
const REVIEWER = "elf@example.test";
const anyone = { key: null, reviewer: false };

const sub = (over: Record<string, unknown> = {}) =>
  parseSubmission({
    kind: "home",
    lat: 50.2601,
    lng: -119.2702,
    residential: true,
    features: [],
    ...over,
  });

/** A published public display Alice pinned. */
function published(id = "pin-p", at = { lat: 50.2601, lng: -119.2702 }) {
  const { doc } = submit(
    EMPTY,
    sub({
      kind: "public-display",
      residential: false,
      name: `Display ${id}`,
      ...at,
    }),
    ALICE,
    id,
    NOW,
  );
  return approve(doc, id, REVIEWER, NOW);
}

const viewOf = (doc: LightsDoc, id: string, key: string | null = null) =>
  visible(doc, { key, reviewer: false }, NOW).find((p) => p.id === id)!;

describe("How magical was it? — one rating per account per display per season", () => {
  it("counts real ratings only and shows their real mean", () => {
    let doc = published();
    expect(viewOf(doc, "pin-p").rating).toBeNull();
    doc = rate(doc, "pin-p", "v_b", 5, ["kids", "nonsense"], NOW);
    doc = rate(doc, "pin-p", "v_c", 4, [], NOW);
    const v = viewOf(doc, "pin-p", "v_b");
    expect(v.rating).toEqual({ mean: 4.5, count: 2 });
    expect(v.myRating).toEqual({ stars: 5, tags: ["kids"] });
    expect(v.tags).toEqual([{ id: "kids", n: 1 }]);
    expect(JSON.stringify(viewOf(doc, "pin-p"))).not.toContain("v_b");
  });

  it("replaces a second rating from the same account this season", () => {
    let doc = published();
    doc = rate(doc, "pin-p", "v_b", 1, [], NOW);
    doc = rate(doc, "pin-p", "v_b", 5, [], NOW);
    expect(viewOf(doc, "pin-p").rating).toEqual({ mean: 5, count: 1 });
  });

  it("keeps last season's rating beside this season's", () => {
    let doc = published();
    doc = rate(doc, "pin-p", "v_b", 3, [], new Date("2025-12-10T03:00:00Z"));
    doc = rate(doc, "pin-p", "v_b", 5, [], NOW);
    expect(viewOf(doc, "pin-p").rating).toEqual({ mean: 4, count: 2 });
  });

  it("refuses its own pinner, unpublished displays and anything but 1–5 whole stars", () => {
    const doc = published();
    expect(() => rate(doc, "pin-p", ALICE, 5, [], NOW)).toThrow(/your own/);
    for (const bad of [0, 6, 3.5, "five", null])
      expect(() => rate(doc, "pin-p", "v_b", bad, [], NOW)).toThrow(Refused);
    const pending = submit(EMPTY, sub(), ALICE, "pin-h", NOW).doc;
    expect(() => rate(pending, "pin-h", "v_b", 5, [], NOW)).toThrow(
      /isn't published/,
    );
  });
});

describe("Ranking fairly by rating quality and volume", () => {
  const v = (id: string, mean: number, count: number, total = 0) =>
    ({
      id,
      name: id,
      status: "approved",
      kind: "public-display",
      rating: count ? { mean, count } : null,
      total,
    }) as unknown as PinView;

  it("ranks thirty 4.6s above one 5", () => {
    expect(fairScore({ mean: 4.6, count: 30 })).toBeGreaterThan(
      fairScore({ mean: 5, count: 1 }),
    );
  });

  it("never lists an unrated display as best, and uses the map's own average once there are enough", () => {
    const views = [v("a", 5, 1), v("b", 4.6, 30), v("c", 0, 0), v("d", 3, 20)];
    expect(bestOf(views, () => true).map((x) => x.id)).toEqual(["b", "a", "d"]);
    expect(priorMean([v("a", 5, 2)])).toBe(3.5);
    expect(priorMean([v("a", 4, 10)])).toBe(4);
  });

  it("calls a quiet, much-loved display a hidden gem — and a famous one not", () => {
    expect(isHiddenGem(v("a", 4.8, 2))).toBe(true);
    expect(isHiddenGem(v("b", 4.8, 40))).toBe(false);
    expect(isHiddenGem(v("c", 3, 2))).toBe(false);
    expect(isFavourite(v("b", 4.8, 40))).toBe(true);
    expect(isFavourite(v("a", 5, 1))).toBe(false);
  });
});

describe("The lights map shows light displays", () => {
  it("draws homes, displays, neighbourhoods and trees — not markets or shows", () => {
    expect(isLightDisplay("home")).toBe(true);
    expect(isLightDisplay("community-tree")).toBe(true);
    expect(isLightDisplay("market")).toBe(false);
    expect(isLightDisplay("festive-attraction")).toBe(false);
    // The researched markets and shows are kept, just not as lights.
    expect(SEED.some((p) => !isLightDisplay(p.kind))).toBe(true);
  });

  it("clusters markers that would overlap, and leaves apart the ones that don't", () => {
    const g = cluster(
      [
        { item: "a", x: 100, y: 100 },
        { item: "b", x: 120, y: 110 },
        { item: "c", x: 300, y: 300 },
      ],
      40,
    );
    expect(g.map((x) => x.items)).toEqual([["a", "b"], ["c"]]);
    expect(g[0]!.x).toBe(110);
  });
});

describe("Build My Lights Tour — three questions", () => {
  const at = (dLat: number, dLng: number) => ({
    lat: 50.267 + dLat,
    lng: -119.272 + dLng,
  });
  const stop = (id: string, over: Partial<Stop> = {}): Stop => ({
    id,
    name: id,
    at: at(0.01, 0),
    kind: "home",
    ...over,
  });
  const stops: Stop[] = [
    stop("famous", {
      at: at(0.02, 0),
      rating: { mean: 4.9, count: 40 },
      love: 30,
    }),
    stop("gem", { at: at(0.025, 0.01), rating: { mean: 4.9, count: 2 } }),
    stop("kids", { at: at(-0.02, 0), kids: 12, features: ["family"] }),
    stop("near", { at: at(0.001, 0) }),
    ...Array.from({ length: 10 }, (_, i) =>
      stop(`close-${i}`, { at: at(0.002 * i, 0.003) }),
    ),
  ];
  const ask = (style: TourStyle, minutes = 240, n = 1) =>
    buildTour(
      {
        from: at(0, 0),
        mode: "drive",
        minutes,
        stops: n,
        prefer: [],
        festive: false,
        style,
      },
      stops,
    );

  it("leads with the kind asked for", () => {
    expect(ask("best").stops[0]!.stop.id).toBe("famous");
    expect(ask("gems").stops[0]!.stop.id).toBe("gem");
    expect(ask("family").stops[0]!.stop.id).toBe("kids");
  });

  it("fits more stops in for Most displays, and every tour inside its time", () => {
    const most = ask("most", 60, 20);
    const best = ask("best", 60, 8);
    expect(most.stops.length).toBeGreaterThanOrEqual(best.stops.length);
    expect(ask("most", 240, 20).stops.length).toBeGreaterThan(8);
    for (const t of [most, best, ask("family", 30, 8), ask("gems", 30, 8)]) {
      expect(t.over).toBe(false);
      expect(t.minutes).toBeLessThanOrEqual(t === most || t === best ? 60 : 30);
      for (const s of t.stops) expect(s.stay).toBeGreaterThan(0);
    }
    expect(timeTour(at(0, 0), "drive", []).minutes).toBe(0);
  });

  it("never invents a stop: an empty area builds an empty tour", () => {
    const t = buildTour(
      {
        from: at(0, 0),
        mode: "drive",
        minutes: 60,
        stops: 8,
        prefer: [],
        festive: false,
        style: "best",
      },
      [],
    );
    expect(t.stops).toHaveLength(0);
  });
});

describe("Three-step submission waits for the administrator", () => {
  it("a submitted home is invisible to the public until approved, then public without any consent step", () => {
    const { doc } = submit(EMPTY, sub(), "v_neighbour", "pin-n", NOW);
    expect(visible(doc, anyone, NOW)).toHaveLength(0);
    expect(
      lightUp(
        visible(doc, anyone, NOW),
        () => "x",
        () => false,
      ).confirmed,
    ).toBe(0);
    const ok = approve(doc, "pin-n", REVIEWER, NOW);
    expect(visible(ok, anyone, NOW)).toHaveLength(1);
  });

  it("names a display plainly when no name is given", () => {
    expect(sub().name).toBe("Christmas lights in Vernon");
  });
});

describe("Details after pinning, never required", () => {
  it("lets the pinner (or a reviewer) add music, hours and the rest — nobody else", () => {
    const doc = published();
    const d = parseDetails({
      features: ["music", "walk-through", "family", "made-up"],
      hours: "Dusk to 10 pm",
      description: "Synced to 99.3 FM",
    });
    const next = addDetails(doc, "pin-p", ALICE, false, d, NOW);
    const v = viewOf(next, "pin-p");
    expect(v.features).toEqual(["music", "walk-through", "family"]);
    expect(v.hours).toBe("Dusk to 10 pm");
    expect(() => addDetails(doc, "pin-p", "v_b", false, d, NOW)).toThrow(
      /Only/,
    );
    expect(() =>
      addDetails(doc, "pin-p", REVIEWER, true, d, NOW),
    ).not.toThrow();
  });
});

describe("Every season, the lights are asked about again", () => {
  const lastYear = new Date("2025-12-10T03:00:00Z");
  const old = () => {
    const { doc } = submit(EMPTY, sub(), ALICE, "pin-o", lastYear);
    return approve(doc, "pin-o", REVIEWER, lastYear);
  };

  it("keeps last year's display, ratings and all, but not as active", () => {
    let doc = old();
    doc = rate(doc, "pin-o", "v_b", 5, [], lastYear);
    const v = viewOf(doc, "pin-o");
    expect(v.season).toBe("unconfirmed");
    expect(v.lastConfirmed).toBe(2025);
    expect(v.rating).toEqual({ mean: 5, count: 1 });
  });

  it("is back with one tap, or off for the year once two families say so", () => {
    const on = check(old(), "pin-o", ALICE, "on", NOW);
    expect(seasonState(on.pins[0]!, NOW)).toBe("lit");
    // A single family — even the submitter — isn't enough to call it dark.
    const one = check(old(), "pin-o", "v_b", "dark", NOW);
    expect(seasonState(one.pins[0]!, NOW)).toBe("unconfirmed");
    const two = check(one, "pin-o", "v_c", "dark", NOW);
    expect(seasonState(two.pins[0]!, NOW)).toBe("dark");
  });
});

describe("Areas", () => {
  it("has the brief's places, reuses October's town centres, and labels by neighbourhood or town", () => {
    for (const id of ["vernon", "coldstream", "lumby", "armstrong"])
      expect(areaById(id)).toBeDefined();
    expect(areaById("vernon")!.at).toEqual({ lat: 50.267, lng: -119.272 });
    expect(inAreaOf(areaById("lumby")!, { lat: 50.25, lng: -118.967 })).toBe(
      true,
    );
    expect(inAreaOf(areaById("lumby")!, { lat: 50.267, lng: -119.272 })).toBe(
      false,
    );
    expect(
      placeLabel({ at: { lat: 50.4483, lng: -119.196 }, town: "armstrong" }),
    ).toBe("Armstrong");
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    expect(
      placeLabel({ at: { lat: 50.2655, lng: -119.2545 }, town: "vernon" }),
    ).toBe("East Hill, Vernon");
    expect(areaById("east-hill")!.onMap).toBe(true);
  });

  it("puts Coldstream and Spirit Square on the map — dim and off tours until confirmed this season", () => {
    const doc = { pins: SEED };
    for (const id of [
      "seed-coldstream-light-up",
      "seed-spirit-square-carnival-of-lights",
    ]) {
      const v = viewOf(doc, id);
      expect(v.season).toBe("unconfirmed");
      expect(isLightDisplay(v.kind)).toBe(true);
    }
    expect(
      inAreaOf(
        areaById("coldstream")!,
        viewOf(doc, "seed-coldstream-light-up").at,
      ),
    ).toBe(true);
  });
});

describe("the Coldstream filter agrees with the town a pin is filed under", () => {
  const lavington = { lat: 50.2332, lng: -119.1077 };
  it("keeps a Lavington pin, which is Coldstream's but ~10 km from its centre", () => {
    const coldstream = areaById("coldstream")!;
    expect(inAreaOf(coldstream, lavington)).toBe(false);
    expect(pinInArea(coldstream, { at: lavington, town: "coldstream" })).toBe(
      true,
    );
    expect(pinInArea(coldstream, { at: lavington, town: "vernon" })).toBe(
      false,
    );
  });
});
