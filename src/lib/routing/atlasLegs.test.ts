import { describe, expect, it, vi } from "vitest";
import { LEGS_PATH, legsAnswerFrom, legsBody, readLegs } from "./atlasLegs";
import { chainLegs, isPlaced, type PlacedLeg } from "./legs";
import {
  DAVISON,
  LEGS_DRIVING_MOCK,
  LEGS_ONE_UNROUTED_MOCK,
  OKEEFE,
} from "./fixtures";

/** A person standing somewhere precise: the thing that must not leave as-is. */
const PERSON = {
  name: "you",
  at: { latitude: 50.267123, longitude: -119.272345 },
};

const legs = chainLegs(PERSON, [DAVISON, OKEEFE], {
  returnHome: true,
}).filter(isPlaced) as PlacedLeg[];

const answering = (response: Response) => vi.fn(async () => response);

describe("legsBody — what leaves Passport", () => {
  it("rounds a start point to ~1 km and keeps a place's own point", () => {
    const body = legsBody(legs, "driving");
    expect(body.legs[0]!.from).toEqual({ at: { lng: -119.27, lat: 50.27 } });
    expect(body.legs[0]!.to).toEqual({
      id: "davison-orchards",
      at: { lng: -119.2958, lat: 50.2853 },
    });
    expect(body.legs[2]!.to).toEqual({ at: { lng: -119.27, lat: 50.27 } });
    // No name, and no finer position than ~1 km, anywhere in it.
    const wire = JSON.stringify(body);
    expect(wire).not.toMatch(/50\.267|119\.272|you|Davison Orchards/);
  });
});

describe("readLegs", () => {
  it("posts ADR 097's shapes to the proposed path, and reads a journey per leg", async () => {
    const post = answering(Response.json(LEGS_DRIVING_MOCK));
    const answer = await readLegs(post, legs, "driving");
    expect(post).toHaveBeenCalledWith(LEGS_PATH, legsBody(legs, "driving"));
    expect(answer.state).toBe("ready");
    if (answer.state !== "ready") return;
    expect(answer.journeys.map((j) => j.kind)).toEqual([
      "routed",
      "routed",
      "routed",
    ]);
    // The real leg, from Atlas's probe.
    expect(answer.journeys[0]).toMatchObject({ minutes: 9, roadKm: 4.5 });
    // The mock legs say they are mock, all the way to the screen.
    expect(answer.journeys[1]).toMatchObject({
      provider: "MOCK-not-a-real-route",
    });
  });

  it("keeps a leg with no route as no-route, beside the routed ones", async () => {
    const answer = await readLegs(
      answering(Response.json(LEGS_ONE_UNROUTED_MOCK)),
      legs,
      "driving",
    );
    expect(answer.state === "ready" && answer.journeys[1]).toMatchObject({
      kind: "no-route",
      because: "no route between them",
    });
  });

  it.each([404, 405, 501])(
    "is not-served when Atlas has no such endpoint (%i)",
    async (status) => {
      const answer = await readLegs(
        answering(new Response("", { status })),
        legs,
        "driving",
      );
      expect(answer).toMatchObject({ state: "not-served", mode: "driving" });
    },
  );

  it("throws on a temporary failure, so the caller can say so and retry", async () => {
    await expect(
      readLegs(answering(new Response("", { status: 502 })), legs, "driving"),
    ).rejects.toThrow(/502/);
    await expect(
      readLegs(answering(new Response("", { status: 429 })), legs, "driving"),
    ).rejects.toThrow(/429/);
  });

  it("asks nothing for no legs", async () => {
    const post = vi.fn();
    expect(await readLegs(post, [], "walking")).toEqual({
      state: "ready",
      mode: "walking",
      journeys: [],
    });
    expect(post).not.toHaveBeenCalled();
  });
});

describe("legsAnswerFrom", () => {
  it("refuses an answer that does not line up with the question", () => {
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
      answer.state === "ready" && answer.journeys.map((j) => j.kind),
    ).toEqual(["routed", "unknown", "unknown"]);
  });

  it("refuses a drive time offered as a walk", () => {
    const answer = legsAnswerFrom(LEGS_DRIVING_MOCK, 3, "walking");
    expect(
      answer.state === "ready" &&
        answer.journeys.every((j) => j.kind === "unknown"),
    ).toBe(true);
  });
});
