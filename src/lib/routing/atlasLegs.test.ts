import { describe, expect, it, vi } from "vitest";
import {
  LEGS_PATH,
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

  it("is not-served on a 404 (no route served, or an unknown stop)", async () => {
    const answer = await readLegs(
      answering(new Response("", { status: 404 })),
      legs,
      "driving",
    );
    expect(answer).toMatchObject({ state: "not-served", mode: "driving" });
  });

  it("throws on a temporary failure, so the caller can say so and retry", async () => {
    for (const status of [429, 502]) {
      await expect(
        readLegs(answering(new Response("", { status })), legs, "driving"),
      ).rejects.toThrow(/temporarily-unavailable/);
    }
    await expect(
      readLegs(
        answering(Response.json({ ...ATLAS_LEGS_DRIVING_MOCK, failure: {} })),
        legs,
        "driving",
      ),
    ).rejects.toThrow(/temporarily-unavailable/);
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
