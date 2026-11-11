import { describe, expect, it } from "vitest";
import {
  EMPTY,
  favourites,
  localDay,
  onThatDay,
  seasonOf,
  seasonState,
  tourable,
  visible,
  type LightsDoc,
  type Pin,
} from "./model";
import {
  approve,
  check,
  parseSubmission,
  react,
  Refused,
  remove,
  report,
  submit,
} from "./actions";
import {
  buildTour,
  directionsUrl,
  readTourQuery,
  timeTour,
  tourQuery,
  untangle,
  type Stop,
} from "./tour";
import { card, FREE, lines } from "./bingo";
import { SEED } from "./seed";

const NOW = new Date("2026-12-05T02:00:00Z");
const ALICE = "v_alice";
const BOB = "v_bob";
const REVIEWER = "elf@example.test";
const anyone = { key: null, reviewer: false };
const alice = { key: ALICE, reviewer: false };
const bob = { key: BOB, reviewer: false };
const reviewer = { key: "v_rev", reviewer: true };

const home = (over: Record<string, unknown> = {}) =>
  parseSubmission({
    kind: "home",
    name: "The Reindeer House",
    lat: 50.2601,
    lng: -119.2702,
    address: "123 Example Road",
    hours: "Dusk to 10 pm",
    features: ["music", "nonsense"],
    ...over,
  });

function withHome(): { doc: LightsDoc; pin: Pin } {
  return submit(EMPTY, home(), ALICE, "pin-a", NOW);
}

describe("Pin the Magic — a home is never shown without permission", () => {
  it("keeps a new pin private to its submitter and reviewers", () => {
    const { doc } = withHome();
    expect(visible(doc, anyone, NOW)).toHaveLength(0);
    expect(visible(doc, bob, NOW)).toHaveLength(0);
    expect(visible(doc, alice, NOW).map((p) => p.status)).toEqual(["pending"]);
    expect(visible(doc, reviewer, NOW)[0]?.review?.trail[0]?.kind).toBe(
      "submitted",
    );
  });

  it("refuses to publish a home without the owner's consent or a public listing", () => {
    const { doc } = withHome();
    expect(() => approve(doc, "pin-a", REVIEWER, NOW)).toThrow(Refused);
    expect(() =>
      approve(doc, "pin-a", REVIEWER, NOW, {
        basis: "public-listing",
        url: "not a link",
      }),
    ).toThrow(/https/);
    const ok = approve(doc, "pin-a", REVIEWER, NOW, { basis: "owner-consent" });
    const [pub] = visible(ok, anyone, NOW);
    expect(pub?.address).toBe("123 Example Road");
    expect(pub?.season).toBe("lit");
    expect(pub).not.toHaveProperty("review");
    expect(JSON.stringify(pub)).not.toContain(ALICE);
  });

  it("publishes a public display without a consent step", () => {
    const { doc } = submit(
      EMPTY,
      home({ kind: "public-display", address: undefined }),
      ALICE,
      "pin-p",
      NOW,
    );
    expect(
      visible(approve(doc, "pin-p", REVIEWER, NOW), anyone, NOW),
    ).toHaveLength(1);
  });

  it("treats any pin marked residential as a home", () => {
    const s = home({ kind: "neighbourhood", residential: true });
    expect(s.residential).toBe(true);
    const { doc } = submit(EMPTY, s, ALICE, "pin-n", NOW);
    expect(() => approve(doc, "pin-n", REVIEWER, NOW)).toThrow(Refused);
  });

  it("hides a published home at once on a privacy report — from anyone, signed in or not", () => {
    const { doc } = withHome();
    const pub = approve(doc, "pin-a", REVIEWER, NOW, {
      basis: "owner-consent",
    });
    const hidden = report(
      pub,
      "pin-a",
      "anon_x",
      "privacy",
      "It's my house",
      NOW,
    );
    expect(visible(hidden, anyone, NOW)).toHaveLength(0);
    expect(visible(hidden, reviewer, NOW)[0]?.status).toBe("hidden");
  });

  it("does not hide a public display on a report; a reviewer reads it", () => {
    const { doc } = submit(
      EMPTY,
      home({ kind: "public-display" }),
      ALICE,
      "pin-p",
      NOW,
    );
    const pub = approve(doc, "pin-p", REVIEWER, NOW);
    const reported = report(pub, "pin-p", "anon_x", "wrong", undefined, NOW);
    expect(visible(reported, anyone, NOW)).toHaveLength(1);
    expect(visible(reported, reviewer, NOW)[0]?.review?.reports).toBe(1);
  });

  it("lets only the submitter or a reviewer remove a pin, and drops its address and photo", () => {
    const { doc } = submit(EMPTY, home(), ALICE, "pin-a", NOW, "pin-a");
    expect(() => remove(doc, "pin-a", BOB, false, NOW)).toThrow(/Only/);
    const gone = remove(doc, "pin-a", ALICE, false, NOW);
    expect(gone.pins[0]?.status).toBe("removed");
    expect(gone.pins[0]?.address).toBeUndefined();
    expect(gone.pins[0]?.photo).toBeUndefined();
    expect(visible(gone, reviewer, NOW)).toHaveLength(0);
  });
});

describe("Submissions are read carefully", () => {
  it("refuses a pin outside the five towns, or without a name", () => {
    expect(() => home({ lat: 49.28, lng: -123.12 })).toThrow(
      /Vernon, Coldstream/,
    );
    expect(() => home({ name: "x" })).toThrow(/name/);
    expect(() => home({ lat: "nope" })).toThrow(/pin/);
  });

  it("keeps only known features and rounds the point to about a metre", () => {
    const s = home({ lat: 50.260123456 });
    expect(s.features).toEqual(["music"]);
    expect(s.at.lat).toBe(50.26012);
    expect(s.town).toBe("vernon");
  });
});

describe("Reactions — one of each per account, pressing again takes it back", () => {
  const pub = () =>
    approve(withHome().doc, "pin-a", REVIEWER, NOW, { basis: "owner-consent" });

  it("toggles", () => {
    let doc = react(pub(), "pin-a", ALICE, "magical", NOW);
    doc = react(doc, "pin-a", BOB, "magical", NOW);
    doc = react(doc, "pin-a", ALICE, "santa", NOW);
    let [v] = visible(doc, alice, NOW);
    expect(v?.reactions.magical).toBe(2);
    expect(v?.mine).toEqual(["magical", "santa"]);
    doc = react(doc, "pin-a", ALICE, "magical", NOW);
    [v] = visible(doc, alice, NOW);
    expect(v?.reactions.magical).toBe(1);
    expect(v?.total).toBe(2);
  });

  it("refuses unknown reactions and unpublished pins", () => {
    expect(() => react(pub(), "pin-a", ALICE, "stars" as never, NOW)).toThrow(
      Refused,
    );
    expect(() => react(withHome().doc, "pin-a", ALICE, "wow", NOW)).toThrow(
      /published/,
    );
  });

  it("ranks favourites by all reactions and trending by this week's", () => {
    const old = new Date("2026-11-01T00:00:00Z");
    let doc = submit(
      pub(),
      home({ kind: "public-display", name: "Polar Park" }),
      BOB,
      "pin-b",
      NOW,
    ).doc;
    doc = approve(doc, "pin-b", REVIEWER, NOW);
    doc = react(doc, "pin-a", ALICE, "wow", old);
    doc = react(doc, "pin-a", BOB, "wow", old);
    doc = react(doc, "pin-b", ALICE, "family", NOW);
    const f = favourites(visible(doc, anyone, NOW));
    expect(f.favourites.map((p) => p.id)).toEqual(["pin-a", "pin-b"]);
    expect(f.trending.map((p) => p.id)).toEqual(["pin-b"]);
  });
});

describe("Keeping displays current — last year's lights are not this year's", () => {
  const lastYear = new Date("2025-12-10T03:00:00Z");
  const published = () =>
    approve(
      submit(EMPTY, home({ kind: "public-display" }), ALICE, "pin-p", lastYear)
        .doc,
      "pin-p",
      REVIEWER,
      lastYear,
    );

  it("names a season by its December", () => {
    expect(seasonOf("2026-12-24T00:00:00Z")).toBe(2026);
    expect(seasonOf("2027-01-03T00:00:00Z")).toBe(2026);
    expect(seasonOf("2026-08-01T00:00:00Z")).toBe(2026);
  });

  it("shows a prior-year pin as unconfirmed and keeps it off tours", () => {
    const pin = published().pins[0]!;
    expect(seasonState(pin, NOW)).toBe("unconfirmed");
    expect(tourable(pin, NOW)).toBe(false);
    expect(visible(published(), anyone, NOW)[0]?.lastConfirmed).toBe(2025);
  });

  it("is lit again once a family says the lights are on", () => {
    const doc = check(published(), "pin-p", BOB, "on", NOW);
    expect(seasonState(doc.pins[0]!, NOW)).toBe("lit");
    expect(tourable(doc.pins[0]!, NOW)).toBe(true);
    expect(() => check(doc, "pin-p", BOB, "on", NOW)).toThrow(/already/);
  });

  it("needs two families, or one reviewer, to call it dark", () => {
    let doc = check(published(), "pin-p", BOB, "on", NOW);
    const later = new Date(NOW.getTime() + 3_600_000);
    doc = check(doc, "pin-p", ALICE, "dark", later);
    expect(seasonState(doc.pins[0]!, later)).toBe("lit");
    doc = check(doc, "pin-p", "v_carol", "dark", later);
    expect(seasonState(doc.pins[0]!, later)).toBe("dark");
    const byReviewer = check(
      check(published(), "pin-p", BOB, "on", NOW),
      "pin-p",
      REVIEWER,
      "dark",
      later,
    );
    expect(seasonState(byReviewer.pins[0]!, later)).toBe("dark");
  });
});

describe("Build My Christmas Lights Tour", () => {
  const vernon = { lat: 50.267, lng: -119.272 };
  const stop = (
    id: string,
    lat: number,
    lng: number,
    extra: Partial<Stop> = {},
  ): Stop => ({
    id,
    name: id,
    at: { lat, lng },
    kind: "public-display",
    ...extra,
  });
  const near = [
    stop("a", 50.27, -119.27),
    stop("b", 50.262, -119.28, { love: 9 }),
    stop("c", 50.275, -119.26, { features: ["music"] }),
    stop("market", 50.268, -119.273, { kind: "atlas" }),
  ];
  const far = stop("kelowna", 49.88, -119.44);

  it("walks only within reach, and fits the time it was given", () => {
    const t = buildTour(
      {
        from: vernon,
        mode: "walk",
        minutes: 90,
        stops: 5,
        prefer: [],
        festive: false,
      },
      [...near, far],
    );
    expect(t.stops.map((s) => s.stop.id)).not.toContain("kelowna");
    expect(t.stops.map((s) => s.stop.id)).not.toContain("market");
    expect(t.minutes).toBeLessThanOrEqual(90);
    expect(t.over).toBe(false);
  });

  it("respects the number of stops and drops the least-loved when time is short", () => {
    const t = buildTour(
      {
        from: vernon,
        mode: "drive",
        minutes: 22,
        stops: 2,
        prefer: [],
        festive: true,
      },
      near,
    );
    expect(t.stops.length).toBeLessThanOrEqual(2);
    expect(t.stops.map((s) => s.stop.id)).toContain("b");
  });

  it("orders the path without crossing itself", () => {
    const zig = [
      stop("1", 50.3, -119.27),
      stop("2", 50.27, -119.27),
      stop("3", 50.33, -119.27),
    ];
    expect(untangle(vernon, zig).map((s) => s.id)).toEqual(["2", "1", "3"]);
  });

  it("re-times an edited tour in the family's order and says when it runs over", () => {
    const t = timeTour(vernon, "walk", [near[2]!, near[0]!], 10);
    expect(t.stops.map((s) => s.stop.id)).toEqual(["c", "a"]);
    expect(t.over).toBe(true);
    expect(t.stops[1]!.arrive).toBeGreaterThan(t.stops[0]!.arrive);
  });

  it("opens directions in the family's own map app and shares as a link", () => {
    const url = new URL(
      directionsUrl(vernon, "walk", [near[0]!.at, near[1]!.at])!,
    );
    expect(url.searchParams.get("travelmode")).toBe("walking");
    expect(url.searchParams.get("waypoints")).toBe("50.27,-119.27");
    const q = tourQuery({
      from: vernon,
      mode: "walk",
      stops: ["pin-a", "atlas:evt_1"],
      minutes: 60,
    });
    expect(readTourQuery(Object.fromEntries(new URLSearchParams(q)))).toEqual({
      from: vernon,
      mode: "walk",
      stops: ["pin-a", "atlas:evt_1"],
      minutes: 60,
    });
    expect(readTourQuery({ stops: "<script>" })).toBeNull();
  });
});

describe("Christmas Lights Bingo", () => {
  it("is a 5×5 card with the free square in the middle, the same card for the same seed", () => {
    const c = card(42);
    expect(c).toHaveLength(25);
    expect(c[12]).toBe(FREE);
    expect(new Set(c).size).toBe(25);
    expect(card(42)).toEqual(c);
    expect(card(43)).not.toEqual(c);
  });

  it("counts a line through the free square", () => {
    expect(lines(new Set([10, 11, 13, 14]))).toHaveLength(1);
    expect(lines(new Set([0, 1, 2, 3]))).toHaveLength(0);
  });

  it("never asks for a photo of a home or a person", () => {
    expect(card(7).join(" ")).not.toMatch(/photo|picture|selfie/i);
  });
});

describe("Researched pins", () => {
  it("are public places only, each with a source, inside the map", () => {
    for (const p of SEED) {
      expect(p.residential).toBe(false);
      expect(p.kind).not.toBe("home");
      expect(p.source?.url).toMatch(/^https:\/\//);
      expect(p.status).toBe("approved");
    }
  });
});

describe("A one-night light-up is only toured on its night", () => {
  const byId = (id: string) => SEED.find((p) => p.id === id)!;

  it("tours the Armstrong light-up on November 28 only", () => {
    const pin = byId("seed-armstrong-light-up");
    const now = new Date("2026-11-20T03:00:00Z");
    expect(tourable(pin, now, "2026-11-28")).toBe(true);
    expect(tourable(pin, now, "2026-11-29")).toBe(false);
  });

  it("tours Farmstrong's markets on their two Saturdays, not the days between", () => {
    const pin = byId("seed-farmstrong-markets");
    const now = new Date("2026-11-20T03:00:00Z");
    expect(onThatDay(pin, "2026-11-21")).toBe(true);
    expect(onThatDay(pin, "2026-11-24")).toBe(false);
    expect(onThatDay(pin, "2026-11-28")).toBe(true);
    expect(tourable(pin, now, "2026-11-24")).toBe(false);
  });

  it("never tours a market last confirmed in 2025", () => {
    expect(tourable(byId("seed-christkindl-kelowna"), NOW)).toBe(false);
  });

  it("reads the Okanagan's calendar day, not UTC's", () => {
    expect(localDay(new Date("2026-12-05T06:30:00Z"))).toBe("2026-12-04");
  });
});
