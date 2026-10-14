import { describe, expect, it } from "vitest";
import { legsOf } from "../adventure/feasibility";
import { anAdventure, subjectMoment } from "../adventure/fixtures";
import contract from "./__fixtures__/travel-legs-1.json";
import {
  AREA_POINT_NOTE,
  readTravelLegsAnswer,
  travelTimeReadingSchema,
  type TravelLegsQuestion,
} from "./contracts";
import { withTravel } from "./legs";

/**
 * **Atlas's own travel-legs/1 fixture, replayed through Passport's reader.**
 *
 * `__fixtures__/travel-legs-1.json` is Atlas's
 * `docs/lanes/contracts/travel-legs-1.json` (`release/routing-rc` 37f5aa4),
 * copied verbatim. Every body it records goes through `readTravelLegsAnswer`
 * here, so a body Atlas publishes that Passport misreads fails in this file.
 */

const questionOf = (query: string): TravelLegsQuestion => {
  const p = new URLSearchParams(query);
  const lat = p.get("lat");
  const lng = p.get("lng");
  return {
    stops: (p.get("stops") ?? "").split(",").filter(Boolean),
    mode: (p.get("mode") || "driving") as TravelLegsQuestion["mode"],
    ...(lat && lng ? { origin: { lat: Number(lat), lng: Number(lng) } } : {}),
  };
};

const example = (name: string) => {
  const found = contract.examples.find((e) => e.name === name);
  if (!found) throw new Error(`no example ${name}`);
  return found;
};

const routed = example("routed-live");
const routedBody = routed.body as {
  legs: { travel: Record<string, unknown> }[];
  total: Record<string, unknown>;
};

/** Two stops from an origin: the shape of the routed example's question. */
const day = anAdventure({
  moments: [subjectMoment("davison-orchards"), subjectMoment("kekuli-bay")],
});

describe("Atlas's travel-legs/1 fixture, replayed", () => {
  it("is the contract Passport reads", () => {
    expect(contract.contract).toBe("travel-legs/1");
    expect(contract.request).toMatchObject({ method: "GET" });
    expect(contract.quota.requestsPerDay).toBe(50);
  });

  it("reads the live routed example, total included", () => {
    const answer = readTravelLegsAnswer(
      routed.status,
      routed.body,
      questionOf(routed.query),
    );
    expect(answer).toMatchObject({ state: "ready", total: { minutes: 35 } });
    expect(answer.state === "ready" && answer.temporary).toBeFalsy();
    expect(
      answer.state === "ready" &&
        answer.legs.map((l) => l.ok && l.reading.state),
    ).toEqual(["estimated", "estimated"]);
  });

  it("keeps the legs of the provider-failure example, each one transient", () => {
    const e = example("transient-failure-stub");
    const answer = readTravelLegsAnswer(e.status, e.body, questionOf(e.query));
    expect(answer).toMatchObject({ state: "ready", temporary: true });
    if (answer.state !== "ready") return;
    expect(
      answer.legs.map(
        (l) => l.ok && l.reading.state === "unavailable" && l.reading.transient,
      ),
    ).toEqual([true, true]);
    expect(answer.total).toBeUndefined();
    expect(withTravel(legsOf(day), answer).map((l) => l.travelMinutes)).toEqual(
      [
        expect.objectContaining({
          state: "unknown",
          because: expect.stringMatching(/temporarily unavailable/),
        }),
        expect.objectContaining({ state: "unknown" }),
      ],
    );
  });

  it("reads both unsupported examples as the mode", () => {
    for (const name of ["unsupported-no-provider", "unsupported-transit"]) {
      const e = example(name);
      expect(
        readTravelLegsAnswer(e.status, e.body, questionOf(e.query)).state,
      ).toBe("unsupported");
    }
  });

  it("reads the notFound body as unknown stops, naming them", () => {
    const nf = contract.notFound;
    expect(
      readTravelLegsAnswer(nf.status, nf.body, questionOf(nf.query)),
    ).toMatchObject({
      state: "unknown-stops",
      unknownStops: ["not-a-candidate"],
    });
  });

  it("reads every request-error case as a question Atlas does not take", () => {
    for (const { status, body, query } of contract.requestErrors) {
      expect(readTravelLegsAnswer(status, body, questionOf(query)).state).toBe(
        "refused",
      );
    }
  });

  it("keeps areaPoint and total.areaPoints, and an area point decides nothing", () => {
    // The live example has no area point; this is its second leg with the
    // fields travel-legs/1 adds for one, and the caution text it publishes.
    const areaLeg = {
      ...routedBody.legs[1]!.travel,
      areaPoint: true,
      accessCaution: contract.areaPointCaution,
    };
    const parsed = travelTimeReadingSchema.parse(areaLeg);
    expect(parsed.state === "estimated" && parsed.areaPoint).toBe(true);

    const answer = readTravelLegsAnswer(
      200,
      {
        ...routedBody,
        legs: [routedBody.legs[0], { ...routedBody.legs[1], travel: areaLeg }],
        total: { ...routedBody.total, areaPoints: 1 },
      },
      questionOf(routed.query),
    );
    expect(answer.state === "ready" && answer.total?.areaPoints).toBe(1);
    const legs = withTravel(legsOf(day), answer);
    expect(legs[0]!.travelMinutes.state).toBe("known");
    expect(legs[1]!.travelMinutes).toMatchObject({
      state: "unknown",
      because: expect.stringMatching(/may not reach the way in/),
    });

    // The flag alone, with no caution sent, still decides nothing.
    const bare: Record<string, unknown> = { ...areaLeg };
    delete bare.accessCaution;
    const alone = withTravel(
      legsOf(day),
      readTravelLegsAnswer(
        200,
        { ...routedBody, legs: [routedBody.legs[0], { travel: bare }] },
        questionOf(routed.query),
      ),
    );
    expect(alone[1]!.travelMinutes).toMatchObject({
      state: "unknown",
      because: expect.stringContaining(AREA_POINT_NOTE),
    });
  });
});
