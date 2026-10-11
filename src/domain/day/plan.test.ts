import { describe, expect, it } from "vitest";
import { dayPlan, type PlanFact } from "./plan";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **The plan is allowed to say three things, and the third one is the point.**
 *
 * These pin the rule the slice exists for: it repeats Atlas, it contradicts a
 * plan where Atlas contradicts it, and everywhere else it says *unknown* out
 * loud. Nothing here may invent an opening hour, a drive time or a verdict
 * about a child.
 */
const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

const plan = (over: Partial<DiscoveryCandidate>, input = {}) =>
  dayPlan(candidateToExperience(candidate(over)), input);

const fact = (result: ReturnType<typeof dayPlan>, label: string): PlanFact =>
  result.facts.find((f) => f.label === label)!;

describe("whether it is open on the day", () => {
  it("says so when Atlas lists the day", () => {
    const open = fact(
      plan(
        {
          occurrence: {
            reading: "recurring-in-run",
            actionable: true,
            days: ["2026-10-11", "2026-10-18"],
          },
        },
        { on: "2026-10-11" },
      ),
      "Open on your date",
    );
    expect(open.value).toContain("2026-10-11");
    expect(open.against).toBeUndefined();
  });

  it("argues against the day when Atlas's own list excludes it", () => {
    const open = fact(
      plan(
        {
          occurrence: {
            reading: "recurring-in-run",
            actionable: true,
            days: ["2026-10-10"],
          },
        },
        { on: "2026-10-11" },
      ),
      "Open on your date",
    );
    expect(open.against).toBe(true);
  });

  it("reads a weekday pattern against the day somebody picked", () => {
    // 2026-10-11 is a Sunday.
    const sunday = fact(
      plan(
        {
          occurrence: {
            reading: "recurring-in-run",
            actionable: true,
            weekdays: ["sunday"],
          },
        },
        { on: "2026-10-11" },
      ),
      "Open on your date",
    );
    expect(sunday.value).toContain("Sundays");
    expect(sunday.against).toBeUndefined();

    const saturday = fact(
      plan(
        {
          occurrence: {
            reading: "recurring-in-run",
            actionable: true,
            weekdays: ["saturday"],
          },
        },
        { on: "2026-10-11" },
      ),
      "Open on your date",
    );
    expect(saturday.against).toBe(true);
  });

  /**
   * **The expensive lie.** Osoyoos Farmers' Market holds a 161-day interval
   * and opens 23 times inside it. A plan that reads the interval as an
   * opening sends somebody on a drive on a day the market is shut.
   */
  it("calls a run a season, not an opening", () => {
    const open = fact(
      plan(
        {
          kind: "Event",
          startTime: "2026-05-01T00:00:00.000Z",
          endTime: "2026-10-31T00:00:00.000Z",
          timePrecision: "day",
        },
        { on: "2026-10-11" },
      ),
      "Open on your date",
    );
    expect(open.value).toContain("season, not an opening");
    // And it is not reported as a confirmation of the day.
    expect(open.value).not.toMatch(/open on 2026-10-11/i);
  });

  it("says it does not know rather than filling the heading in", () => {
    const open = fact(plan({}, { on: "2026-10-11" }), "Open on your date");
    expect(open.value).toBeUndefined();
    expect(open.unknown).toContain("not a closure");
    expect(plan({}, { on: "2026-10-11" }).unknowns).toContain(
      "Open on your date",
    );
  });
});

describe("how far, and the capability Passport does not have", () => {
  it("measures a straight line and says that is what it is", () => {
    const far = fact(
      plan(
        {
          geography: {
            state: "observed",
            coordinates: [-119.27, 50.267],
            locality: "Vernon",
          },
        },
        { origin: { latitude: 50.1, longitude: -119.3 } },
      ),
      "How far",
    );
    expect(far.value).toContain("km away");
    expect(far.value).toContain("not a drive time");
  });

  it("measures nothing when Atlas has not placed it", () => {
    const far = fact(
      plan({}, { origin: { latitude: 50.1, longitude: -119.3 } }),
      "How far",
    );
    expect(far.value).toBeUndefined();
    expect(far.unknown).toContain("not placed this on a map");
  });

  it("measures nothing when nobody has said where they are", () => {
    const far = fact(
      plan({
        geography: { state: "observed", coordinates: [-119.27, 50.267] },
      }),
      "How far",
    );
    expect(far.unknown).toContain("not shared where you are");
  });
});

describe("a child, and only the age that was asked about", () => {
  const WINFIELD = {
    suitability: {
      stated: "stated",
      statements: [
        {
          about: "age",
          says: "adults-only",
          strength: "characterisation",
          ages: { min: 18 },
          text: "The location where the Adult Shinny (18+) hockey games are held.",
          basis: "stated",
        },
      ],
      forAge: { age: 5, reading: "stated-other-ages", because: [0] },
    },
  } satisfies Partial<DiscoveryCandidate>;

  it("never turns a statement about other ages into a closed door", () => {
    const age = fact(
      plan(WINFIELD, { childAge: 5 }),
      "Suitable for a 5-year-old",
    );
    expect(age.against).toBeUndefined();
    expect(age.value).toContain("not a rule against 5");
  });

  it("carries the sentence the verdict came from", () => {
    const age = fact(
      plan(WINFIELD, { childAge: 5 }),
      "Suitable for a 5-year-old",
    );
    expect(age.because).toContain("Adult Shinny");
  });

  it("argues against the plan only where Atlas states a rule", () => {
    const age = fact(
      plan(
        {
          suitability: {
            stated: "stated",
            statements: [
              {
                about: "age",
                says: "adults-only",
                strength: "rule",
                ages: { min: 19 },
                text: "19+/No Minors",
                basis: "stated",
              },
            ],
            forAge: { age: 5, reading: "excluded", because: [0] },
          },
        },
        { childAge: 5 },
      ),
      "Suitable for a 5-year-old",
    );
    expect(age.against).toBe(true);
  });

  it("asks about nobody when nobody was named", () => {
    const age = fact(plan(WINFIELD), "Who it suits");
    expect(age.unknown).toContain("not asked about anybody");
  });

  it("says unknown is unknown, not unsuitable", () => {
    const age = fact(plan({}, { childAge: 5 }), "Suitable for a 5-year-old");
    expect(age.unknown).toContain("not a yes and it is not a no");
    expect(age.against).toBeUndefined();
  });
});

describe("restrictions, in the words somebody published", () => {
  it("prints a stated rule and a stated condition, and no characterisation", () => {
    const result = plan({
      knowledge: { conditions: ["Pets on leash"] },
      suitability: {
        stated: "stated",
        statements: [
          {
            about: "age",
            says: "admits",
            strength: "rule",
            text: "ALL GUESTS MUST BE 16+",
            basis: "stated",
          },
          {
            about: "audience",
            says: "families",
            strength: "characterisation",
            text: "Perfect for families!",
            basis: "stated",
          },
        ],
      },
    });
    expect(result.restrictions).toContain("Pets on leash");
    expect(result.restrictions).toContain("ALL GUESTS MUST BE 16+");
    expect(result.restrictions).not.toContain("Perfect for families!");
  });
});

describe("the way out of the plan", () => {
  it("opens a map on a stated point", () => {
    const result = plan({
      geography: { state: "observed", coordinates: [-119.27, 50.267] },
    });
    expect(result.links[0]!.href).toContain("50.267,-119.27");
  });

  it("offers a publisher's own URL and never invents one", () => {
    const result = plan({
      knowledge: {
        practical: [
          { label: "Tickets", value: "Book at https://example.com/tickets" },
          { label: "Admission", value: "By donation" },
        ],
      },
    });
    expect(result.links).toEqual([
      { label: "Tickets", href: "https://example.com/tickets" },
    ]);
  });

  it("offers nothing where Atlas has placed nothing", () => {
    expect(plan({}).links).toEqual([]);
  });
});
