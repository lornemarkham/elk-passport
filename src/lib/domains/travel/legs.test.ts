import { describe, expect, it } from "vitest";
import { assessFeasibility, legsOf } from "../adventure/feasibility";
import {
  anAdventure,
  north,
  subjectMoment,
  VERNON_POINT,
} from "../adventure/fixtures";
import {
  readTravelLegsAnswer,
  travelLegsQuery,
  travelLegsQuestionProblems,
  type TravelLegsQuestion,
} from "./contracts";
import { adventureTravelQuestion, withTravel } from "./legs";

/**
 * The Adventure, Atlas's M144 `/travel/legs` answer, and feasibility, joined.
 *
 * Bodies follow the shape the M145 report describes (`legs[].travel`,
 * `total.state`, `failure`, `state: "unsupported"`). Minutes from Vernon are
 * M147's live openrouteservice measurements; place-to-place minutes are
 * **synthetic** and say so in their provider.
 */

const LIMITS = [
  "© openrouteservice.org by HeiGIT · map data © OpenStreetMap contributors",
];
const estimated = (
  minutes: number,
  routeKm: number,
  provider = "openrouteservice",
) => ({
  state: "estimated",
  mode: "driving",
  minutes,
  routeKm,
  straightKm: routeKm / 1.4,
  provider,
  calculatedAt: "2026-10-11T08:00:00.000Z",
  limitations: LIMITS,
});

const day = anAdventure({
  moments: [subjectMoment("davison-orchards"), subjectMoment("kal-beach")],
});

describe("asking Atlas about an Adventure's legs", () => {
  it("asks by Atlas id, in order, with the start rounded to ~1 km", () => {
    const asked = adventureTravelQuestion(
      anAdventure({
        constraints: {
          ...day.constraints,
          origin: {
            name: "home",
            point: { latitude: 50.26712, longitude: -119.27234 },
          },
        },
        moments: day.moments,
      }),
      "driving",
    );
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(travelLegsQuery(asked.question)).toBe(
      "stops=davison-orchards%2Ckal-beach&mode=driving&lat=50.27&lng=-119.27",
    );
  });

  it("rounds an origin even when the caller built the question by hand", () => {
    const q: TravelLegsQuestion = {
      stops: ["a"],
      mode: "walking",
      origin: { lat: 49.2827291, lng: -123.1207375 },
    };
    expect(travelLegsQuery(q)).toContain("lat=49.28&lng=-123.12");
  });

  it("names the questions Atlas would refuse, instead of sending them", () => {
    expect(
      travelLegsQuestionProblems({ stops: ["a"], mode: "driving" }),
    ).toEqual(["Atlas needs two stops, or one stop and an origin."]);
    expect(
      travelLegsQuestionProblems({ stops: ["a", "b", "a"], mode: "driving" }),
    ).toContain("Atlas refuses a stop repeated in one day.");
    const twelve = Array.from({ length: 12 }, (_, i) => `s${i}`);
    expect(
      travelLegsQuestionProblems({ stops: twelve, mode: "driving" })[0],
    ).toMatch(/at most 10 stops; this day has 12/);
  });

  it("does not ask about time kept free: it has no place", () => {
    const asked = adventureTravelQuestion(
      anAdventure({
        moments: [
          subjectMoment("davison-orchards"),
          {
            kind: "free",
            id: "lunch",
            label: "Lunch, wherever",
            minutes: 45,
            notes: [],
          },
          subjectMoment("kal-beach"),
        ],
      }),
      "driving",
    );
    expect(asked.ok && asked.question.stops).toEqual([
      "davison-orchards",
      "kal-beach",
    ]);
  });

  it("asks the same number of legs legsOf builds, so they line up by index", () => {
    const asked = adventureTravelQuestion(day, "driving");
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    // With an origin: one leg per stop.
    expect(legsOf(day)).toHaveLength(asked.question.stops.length);
  });
});

describe("reading Atlas's answer", () => {
  const q: TravelLegsQuestion = {
    stops: ["davison-orchards", "kal-beach"],
    mode: "driving",
    origin: { lat: 50.27, lng: -119.27 },
  };

  it("keeps a failed provider apart from a missing route and a missing point", () => {
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [
          {
            travel: {
              state: "unavailable",
              mode: "driving",
              provider: "openrouteservice",
              calculatedAt: "2026-10-11T08:00:00Z",
              because: "the provider answered 429",
              transient: true,
            },
          },
          { travel: { state: "unrouted", because: "no point" } },
        ],
        total: { state: "incomplete" },
      },
      q,
    );
    expect(answer.state).toBe("ready");
    const legs = withTravel(legsOf(day), answer);
    expect(legs[0]!.travelMinutes).toMatchObject({
      state: "unknown",
      because: expect.stringMatching(/temporarily unavailable.*may change/),
    });
    expect(legs[1]!.travelMinutes).toMatchObject({
      state: "unknown",
      because: expect.stringMatching(/no point of its own/),
    });
    expect(answer.state === "ready" && answer.total).toBeUndefined();
  });

  it("reads a whole-answer provider failure as temporary, keeping the legs", () => {
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [{ travel: estimated(11, 4.5) }, { travel: {} }],
        failure: "openrouteservice answered 429",
      },
      q,
    );
    expect(answer).toMatchObject({ state: "ready", temporary: true });
    expect(answer.state === "ready" && answer.legs.map((l) => l.ok)).toEqual([
      true,
      false,
    ]);
    // A failure that also broke the legs is still only a failure.
    expect(
      readTravelLegsAnswer(200, { legs: [], failure: "429" }, q).state,
    ).toBe("temporarily-unavailable");
  });

  it("reads an unsupported mode as the mode, not the places", () => {
    expect(
      readTravelLegsAnswer(
        200,
        { state: "unsupported", legs: [] },
        { ...q, mode: "transit" },
      ),
    ).toEqual({
      state: "unsupported",
      because: "Atlas does not route by transit.",
    });
  });

  it("reads a 404 with no code as a path Atlas does not serve", () => {
    for (const body of [{ error: "Not found" }, null, { code: "other" }]) {
      const answer = readTravelLegsAnswer(404, body, q);
      expect(answer.state).toBe("not-found");
      expect(answer.state !== "ready" && answer.because).toMatch(
        /does not serve/,
      );
    }
  });

  it("reads a 404 naming unknown stops as about the day, and names them", () => {
    const answer = readTravelLegsAnswer(
      404,
      { error: "x", code: "unknown-stops", unknownStops: ["kal-beach"] },
      q,
    );
    expect(answer).toMatchObject({
      state: "unknown-stops",
      unknownStops: ["kal-beach"],
      because: expect.stringMatching(/no longer holds this stop.*kal-beach/),
    });
    expect(
      withTravel(legsOf(day), answer).every(
        (l) => l.travelMinutes.state === "unknown",
      ),
    ).toBe(true);
  });

  it("separates the token from the day", () => {
    expect(readTravelLegsAnswer(401, { error: "unauthorized" }, q).state).toBe(
      "unauthorized",
    );
    expect(readTravelLegsAnswer(400, {}, q).state).toBe("refused");
    expect(readTravelLegsAnswer(503, {}, q).state).toBe(
      "temporarily-unavailable",
    );
  });

  it("refuses an answer whose legs do not line up with the question", () => {
    expect(() =>
      readTravelLegsAnswer(200, { legs: [{ travel: estimated(11, 4.5) }] }, q),
    ).toThrow(/1 legs .* 2/);
  });

  it("refuses one leg answered in the wrong mode, and keeps the rest", () => {
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [
          { travel: { ...estimated(35, 2.8), mode: "walking" } },
          { travel: estimated(10, 4.9) },
        ],
      },
      q,
    );
    expect(answer.state === "ready" && answer.legs.map((l) => l.ok)).toEqual([
      false,
      true,
    ]);
  });

  it("passes a total through only when Atlas estimated it", () => {
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [{ travel: estimated(11, 4.5) }, { travel: estimated(10, 4.9) }],
        total: { state: "estimated", minutes: 21, basis: "every leg routed" },
      },
      q,
    );
    expect(answer.state === "ready" && answer.total).toEqual({
      minutes: 21,
      basis: "every leg routed",
    });
  });
});

describe("routed legs decide feasibility; nothing else does", () => {
  const fourHours = anAdventure({
    constraints: { ...day.constraints, time: { hours: 4 } },
    moments: [
      subjectMoment("davison-orchards", { minutes: 100 }),
      subjectMoment("kal-beach", {
        minutes: 100,
        point: { state: "known", value: north(6), source: { by: "atlas" } },
      }),
    ],
  });
  const q = adventureTravelQuestion(fourHours, "driving");
  if (!q.ok) throw new Error("fixture");

  it("is unknown with straight lines alone", () => {
    expect(assessFeasibility(fourHours).travel.verdict).toBe("unknown");
  });

  it("fits once every leg is routed inside the slack", () => {
    // Vernon → Davison Orchards 11 min (M147, live). Davison → Kal Beach: synthetic.
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [
          { travel: estimated(11, 4.5) },
          { travel: estimated(14, 8, "SYNTHETIC-not-a-real-route") },
        ],
      },
      q.question,
    );
    const legs = withTravel(legsOf(fourHours), answer);
    expect(assessFeasibility(fourHours, legs).travel.verdict).toBe("fits");
  });

  it("does not fit when routed minutes overrun the day", () => {
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [
          { travel: estimated(11, 4.5) },
          { travel: estimated(45, 40, "SYNTHETIC-not-a-real-route") },
        ],
      },
      q.question,
    );
    const feasibility = assessFeasibility(
      fourHours,
      withTravel(legsOf(fourHours), answer),
    );
    expect(feasibility.travel).toMatchObject({
      verdict: "does-not-fit",
      because: expect.stringMatching(/256 of 240/),
    });
  });

  it("lets a route that may not reach the gate decide nothing (ADR 097)", () => {
    const answer = readTravelLegsAnswer(
      200,
      {
        legs: [
          { travel: estimated(11, 4.5) },
          {
            travel: {
              ...estimated(65, 33.2),
              accessCaution: "the route averages 30 km/h over 33.2 km",
            },
          },
        ],
      },
      q.question,
    );
    const feasibility = assessFeasibility(
      fourHours,
      withTravel(legsOf(fourHours), answer),
    );
    expect(feasibility.travel.verdict).toBe("unknown");
  });

  it("leaves every leg unknown, with Atlas's reason, when Atlas did not answer", () => {
    const legs = withTravel(
      legsOf(fourHours),
      readTravelLegsAnswer(404, null, q.question),
    );
    expect(legs.every((l) => l.travelMinutes.state === "unknown")).toBe(true);
    expect(assessFeasibility(fourHours, legs).travel.verdict).toBe("unknown");
  });

  it("never turns the straight-line kilometres into minutes", () => {
    const legs = legsOf(
      anAdventure({
        constraints: {
          ...day.constraints,
          origin: { name: "Vernon", point: VERNON_POINT },
        },
      }),
    );
    expect(legs.every((l) => l.travelMinutes.state === "unknown")).toBe(true);
  });
});
