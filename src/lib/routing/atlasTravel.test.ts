import { describe, expect, it, vi } from "vitest";
import {
  answerFrom,
  journeyFromReading,
  readTravelTimes,
  travelQuery,
} from "./atlasTravel";
import { withinMinutes } from "./journey";
import {
  ATLAS_TODAY,
  DRIVING_FROM_VERNON,
  TRANSIT_UNSUPPORTED,
  VERNON,
  WALKING_UNSUPPORTED,
} from "./fixtures";

const answering = (body: unknown, status = 200) =>
  vi.fn<(path: string) => Promise<Response>>(async () =>
    Response.json(body, { status }),
  );

describe("travelQuery", () => {
  it("rounds the origin to ~1 km before it leaves Passport", () => {
    expect(
      travelQuery({ latitude: 50.26712, longitude: -119.27234 }, "driving"),
    ).toBe("lat=50.27&lng=-119.27&unplaced=drop&travel=driving");
  });
});

describe("readTravelTimes against Atlas's driving probe from Vernon", () => {
  it("asks the candidates feed for one mode", async () => {
    const get = answering(DRIVING_FROM_VERNON);
    await readTravelTimes(get, VERNON, "driving");
    expect(get).toHaveBeenCalledWith(
      "/discovery/candidates?lat=50.27&lng=-119.27&unplaced=drop&travel=driving",
    );
  });

  it("keeps road minutes and straight km apart, and Fintry is not near", async () => {
    const answer = await readTravelTimes(
      answering(DRIVING_FROM_VERNON),
      VERNON,
      "driving",
    );
    expect(answer.state).toBe("ready");
    if (answer.state !== "ready") return;
    const fintry = answer.journeys["fintry-provincial-park"];
    expect(fintry).toMatchObject({
      kind: "routed",
      minutes: 61,
      roadKm: 50.4,
      straightKm: 22,
      provider: "osrm-demo",
    });
    // Kangaroo Creek Farm is further in a straight line and nearer by road.
    const farm = answer.journeys["kangaroo-creek-farm"];
    expect(withinMinutes(farm, 45)).toBe(true);
    expect(withinMinutes(fintry, 45)).toBe(false);
  });

  it("keeps the access caution and the provider's limitations", async () => {
    const answer = await readTravelTimes(
      answering(DRIVING_FROM_VERNON),
      VERNON,
      "driving",
    );
    if (answer.state !== "ready") throw new Error("not ready");
    const kal = answer.journeys["kalamalka-lake-park"];
    expect(kal?.kind).toBe("routed");
    if (kal?.kind !== "routed") return;
    expect(kal.accessCaution).toMatch(/minor tracks/);
    expect(kal.limitations).toHaveLength(3);
  });

  it("reports an unroutable place as no route, not as far or near", async () => {
    const answer = await readTravelTimes(
      answering(DRIVING_FROM_VERNON),
      VERNON,
      "driving",
    );
    if (answer.state !== "ready") throw new Error("not ready");
    const back = answer.journeys["monashee-backcountry"];
    expect(back).toEqual({
      kind: "no-route",
      mode: "driving",
      provider: "osrm-demo",
      because: "the destination is 3.1 km from the nearest routable road",
    });
    expect(withinMinutes(back, 600)).toBeUndefined();
  });
});

describe("modes Atlas cannot route", () => {
  it("walking where only a driving profile is configured", async () => {
    const answer = await readTravelTimes(
      answering(WALKING_UNSUPPORTED),
      VERNON,
      "walking",
    );
    expect(answer).toMatchObject({
      state: "ready",
      journeys: {
        "davison-orchards": { kind: "unsupported", mode: "walking" },
      },
    });
  });

  it("transit, which no configured provider serves", async () => {
    const answer = await readTravelTimes(
      answering(TRANSIT_UNSUPPORTED),
      VERNON,
      "transit",
    );
    expect(answer).toMatchObject({
      state: "ready",
      journeys: {
        "okanagan-science-centre": { kind: "unsupported", mode: "transit" },
      },
    });
  });
});

describe("Atlas as it is today", () => {
  it("is not-served, not 'no route' for every place", async () => {
    const answer = await readTravelTimes(
      answering(ATLAS_TODAY),
      VERNON,
      "driving",
    );
    expect(answer).toEqual({
      state: "not-served",
      mode: "driving",
      because: "Atlas does not serve travel times yet",
    });
  });

  it("an empty feed is an empty answer, not a missing capability", () => {
    expect(answerFrom([], "driving")).toEqual({
      state: "ready",
      mode: "driving",
      journeys: {},
    });
  });

  it("throws on an HTTP failure rather than answering empty", async () => {
    await expect(
      readTravelTimes(answering({ error: "x" }, 500), VERNON, "driving"),
    ).rejects.toThrow(/500/);
    await expect(
      readTravelTimes(answering({ nope: true }), VERNON, "driving"),
    ).rejects.toThrow(/no candidates/);
  });
});

describe("a reading Passport cannot trust becomes unknown, never a guess", () => {
  const good = DRIVING_FROM_VERNON.candidates[0]!.travel;
  const cases: [string, unknown][] = [
    ["null", null],
    ["no state", { ...good, state: undefined }],
    ["fractional minutes", { ...good, minutes: 8.6 }],
    ["negative minutes", { ...good, minutes: -1 }],
    ["minutes as a string", { ...good, minutes: "9" }],
    ["no route km", { ...good, routeKm: undefined }],
    ["no provider", { ...good, provider: "" }],
    ["no limitations", { ...good, limitations: undefined }],
    ["unparseable time", { ...good, calculatedAt: "yesterday" }],
    ["an unknown mode", { ...good, mode: "teleport" }],
    [
      "unavailable without a reason",
      { state: "unavailable", mode: "driving", provider: "x" },
    ],
  ];
  it.each(cases)("%s", (_, reading) => {
    expect(journeyFromReading(reading, "driving")).toEqual({
      kind: "unknown",
      because: "Atlas sent a travel reading Passport could not read",
    });
  });

  it("refuses a drive time answered to a walking question", () => {
    expect(journeyFromReading(good, "walking").kind).toBe("unknown");
  });
});
