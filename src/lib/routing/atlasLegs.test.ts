import { describe, expect, it, vi } from "vitest";
import {
  LEGS_PATH,
  NOT_JUST_NOW_BECAUSE,
  UNKNOWN_STOP_BECAUSE,
  legsAnswerFrom,
  legsQuestions,
  readLegs,
} from "./atlasLegs";
import { chainLegs, isPlaced, type PlacedLeg } from "./legs";
import {
  ATLAS_LEGS_DRIVING_MOCK,
  DAVISON,
  LEGS_DRIVING_MOCK,
  OKEEFE,
  atlasLegsBody,
} from "./fixtures";

/** A person standing somewhere precise: the thing that must not leave as-is. */
const PERSON = {
  name: "you",
  at: { latitude: 50.267123, longitude: -119.272345 },
};

/** Start → Davison → O'Keefe → back to the start. */
const legs = chainLegs(PERSON, [DAVISON, OKEEFE], {
  returnHome: true,
}).filter(isPlaced) as PlacedLeg[];

const answering = (response: Response) =>
  vi.fn(async (pathAndQuery: string) => {
    void pathAndQuery;
    return response;
  });

const LEG = LEGS_DRIVING_MOCK.legs[0]!;

describe("legsQuestions — what leaves Passport", () => {
  it("asks a whole day as one question, by Atlas id, with the start rounded to ~1 km", () => {
    const [only, ...rest] = legsQuestions(legs, "driving");
    expect(rest).toEqual([]);
    expect(only!.question).toEqual({
      stops: ["davison-orchards", "okeefe-ranch"],
      mode: "driving",
      origin: { lat: 50.267123, lng: -119.272345 },
    });
    // The way home ends at a town centre, which is not a question Atlas takes.
    expect(only!.at).toEqual([0, 1]);
  });

  it("opens a new question where the day's legs stop following on", () => {
    const gap = [legs[0]!, { from: OKEEFE, to: DAVISON } as PlacedLeg];
    expect(legsQuestions(gap, "walking").map((c) => c.question.stops)).toEqual([
      ["davison-orchards"],
      ["okeefe-ranch", "davison-orchards"],
    ]);
  });
});

describe("readLegs — Atlas GET /travel/legs", () => {
  it("sends ids, mode and a rounded start, and reads a journey per leg", async () => {
    const get = answering(Response.json(ATLAS_LEGS_DRIVING_MOCK));
    const answer = await readLegs(get, legs, "driving");
    expect(get).toHaveBeenCalledTimes(1);
    const sent = get.mock.calls[0]![0];
    expect(sent.startsWith(`${LEGS_PATH}?`)).toBe(true);
    const params = new URLSearchParams(sent.split("?")[1]);
    expect(params.get("stops")).toBe("davison-orchards,okeefe-ranch");
    expect(params.get("mode")).toBe("driving");
    expect(params.get("lat")).toBe("50.27");
    expect(params.get("lng")).toBe("-119.27");
    expect(sent).not.toMatch(/50\.267|119\.272|you|Davison Orchards/);

    expect(answer.state).toBe("ready");
    if (answer.state !== "ready") return;
    expect(answer.journeys.map((j) => j?.kind)).toEqual([
      "routed",
      "routed",
      undefined,
    ]);
    expect(answer.journeys[0]).toMatchObject({ minutes: 9, roadKm: 4.5 });
  });

  it("does not blame the place when the provider failed (transient)", async () => {
    const failed = {
      state: "unavailable",
      mode: "driving",
      provider: "openrouteservice",
      calculatedAt: LEG.calculatedAt,
      because: "rate limited",
      transient: true,
    };
    const answer = await readLegs(
      answering(Response.json(atlasLegsBody([LEG, failed]))),
      legs,
      "driving",
    );
    expect(answer.state === "ready" && answer.journeys[1]).toMatchObject({
      kind: "unknown",
      because: expect.stringMatching(/may change/),
    });
  });

  it("says a place has no point, rather than 'could not read', for unrouted", async () => {
    const answer = await readLegs(
      answering(Response.json(atlasLegsBody([{ state: "unrouted" }, LEG]))),
      legs,
      "driving",
    );
    expect(answer.state === "ready" && answer.journeys[0]).toMatchObject({
      kind: "unknown",
      because: expect.stringMatching(/no point of its own/),
    });
  });

  it("keeps a real no-route as no-route", async () => {
    const none = {
      state: "unavailable",
      mode: "driving",
      provider: "openrouteservice",
      calculatedAt: LEG.calculatedAt,
      because: "no route between them",
    };
    const answer = await readLegs(
      answering(Response.json(atlasLegsBody([LEG, none]))),
      legs,
      "driving",
    );
    expect(answer.state === "ready" && answer.journeys[1]).toMatchObject({
      kind: "no-route",
    });
  });

  it("marks every leg unsupported when Atlas does not route the mode", async () => {
    const answer = await readLegs(
      answering(Response.json({ state: "unsupported", legs: [] })),
      legs,
      "transit",
    );
    expect(
      answer.state === "ready" && answer.journeys.map((j) => j?.kind),
    ).toEqual(["unsupported", "unsupported", undefined]);
  });

  it("is not-served on a 404 that names no stop (Atlas lacks the route)", async () => {
    for (const response of [
      new Response("", { status: 404 }),
      Response.json({ error: "Not found" }, { status: 404 }),
    ]) {
      const answer = await readLegs(answering(response), legs, "driving");
      expect(answer).toMatchObject({ state: "not-served", mode: "driving" });
    }
  });

  it("marks only the legs touching an unknown stop, and keeps other questions' legs", async () => {
    // Two questions: start → Davison, then O'Keefe → Davison (not following on).
    const twoQuestions = [legs[0]!, { from: OKEEFE, to: DAVISON } as PlacedLeg];
    const get = vi.fn(async (pathAndQuery: string) =>
      pathAndQuery.includes("okeefe-ranch")
        ? Response.json(
            {
              error: "Atlas holds no Discovery candidate okeefe-ranch.",
              code: "unknown-stops",
              unknownStops: ["okeefe-ranch"],
            },
            { status: 404 },
          )
        : Response.json(atlasLegsBody([LEG])),
    );
    const answer = await readLegs(get, twoQuestions, "driving");
    expect(get).toHaveBeenCalledTimes(2);
    expect(answer).toMatchObject({
      state: "ready",
      unknownStops: ["okeefe-ranch"],
    });
    if (answer.state !== "ready") return;
    expect(answer.journeys[0]).toMatchObject({ kind: "routed", minutes: 9 });
    expect(answer.journeys[1]).toEqual({
      kind: "unknown",
      because: UNKNOWN_STOP_BECAUSE,
    });
    expect(answer.temporary).toBeUndefined();
  });

  it("leaves a leg that touches no unknown stop as a straight line, unasked", async () => {
    const answer = await readLegs(
      answering(
        Response.json(
          { code: "unknown-stops", unknownStops: ["okeefe-ranch"] },
          { status: 404 },
        ),
      ),
      legs,
      "driving",
    );
    expect(answer.state === "ready" && answer.journeys).toEqual([
      undefined,
      { kind: "unknown", because: UNKNOWN_STOP_BECAUSE },
      undefined,
    ]);
  });

  it("keeps the answered legs when the provider failed for others (top-level failure)", async () => {
    const failed = {
      state: "unavailable",
      mode: "driving",
      provider: "openrouteservice",
      calculatedAt: LEG.calculatedAt,
      because: "the routing provider did not answer",
      transient: true,
    };
    const answer = await readLegs(
      answering(
        Response.json({
          ...atlasLegsBody([LEG, failed]),
          failure: "openrouteservice answered 429",
        }),
      ),
      legs,
      "driving",
    );
    expect(answer).toMatchObject({ state: "ready", temporary: true });
    if (answer.state !== "ready") return;
    expect(answer.journeys[0]).toMatchObject({ kind: "routed" });
    expect(answer.journeys[1]).toMatchObject({
      kind: "unknown",
      because: expect.stringMatching(/could not answer just now/),
    });
    // Every leg answered, with a failure reported: still kept, still temporary.
    expect(
      await readLegs(
        answering(Response.json({ ...ATLAS_LEGS_DRIVING_MOCK, failure: {} })),
        legs,
        "driving",
      ),
    ).toMatchObject({ state: "ready", temporary: true });
  });

  it("keeps one question's legs when Atlas fails another; throws only when nothing answered", async () => {
    const twoQuestions = [legs[0]!, { from: OKEEFE, to: DAVISON } as PlacedLeg];
    const answer = await readLegs(
      vi.fn(async (pathAndQuery: string) =>
        pathAndQuery.includes("okeefe-ranch")
          ? new Response("", { status: 502 })
          : Response.json(atlasLegsBody([LEG])),
      ),
      twoQuestions,
      "driving",
    );
    expect(answer).toMatchObject({ state: "ready", temporary: true });
    expect(answer.state === "ready" && answer.journeys[1]).toEqual({
      kind: "unknown",
      because: NOT_JUST_NOW_BECAUSE,
    });

    for (const status of [429, 502]) {
      await expect(
        readLegs(answering(new Response("", { status })), legs, "driving"),
      ).rejects.toThrow(/temporarily-unavailable/);
    }
  });

  it("keeps areaPoint on the journey, so it is never a verified drive time", async () => {
    const area = {
      ...LEG,
      areaPoint: true,
      accessCaution:
        "Atlas holds no entrance, parking or trailhead for this area",
    };
    const answer = await readLegs(
      answering(Response.json(atlasLegsBody([LEG, area]))),
      legs,
      "driving",
    );
    expect(answer.state === "ready" && answer.journeys[1]).toMatchObject({
      kind: "routed",
      areaPoint: true,
      accessCaution: expect.stringMatching(/no entrance/),
    });
  });

  it("refuses an answer with the wrong number of legs", async () => {
    await expect(
      readLegs(answering(Response.json(atlasLegsBody([LEG]))), legs, "driving"),
    ).rejects.toThrow(/legs/);
  });

  it("asks nothing for no legs", async () => {
    const get = vi.fn();
    expect(await readLegs(get, [], "walking")).toEqual({
      state: "ready",
      mode: "walking",
      journeys: [],
    });
    expect(get).not.toHaveBeenCalled();
  });
});

describe("legsAnswerFrom (fixtures)", () => {
  it("refuses readings that do not line up with the question", () => {
    expect(() =>
      legsAnswerFrom({ legs: LEGS_DRIVING_MOCK.legs.slice(1) }, 3, "driving"),
    ).toThrow(/did not match/);
    expect(() => legsAnswerFrom({}, 3, "driving")).toThrow();
  });

  it("drops one unreadable reading to unknown, and keeps the rest", () => {
    const answer = legsAnswerFrom(
      {
        legs: [
          LEGS_DRIVING_MOCK.legs[0],
          { ...LEGS_DRIVING_MOCK.legs[1], minutes: 13.5 },
          { ...LEGS_DRIVING_MOCK.legs[2], limitations: undefined },
        ],
      },
      3,
      "driving",
    );
    expect(
      answer.state === "ready" && answer.journeys.map((j) => j?.kind),
    ).toEqual(["routed", "unknown", "unknown"]);
  });

  it("refuses a drive time offered as a walk", () => {
    const answer = legsAnswerFrom(LEGS_DRIVING_MOCK, 3, "walking");
    expect(
      answer.state === "ready" &&
        answer.journeys.every((j) => j?.kind === "unknown"),
    ).toBe(true);
  });
});
