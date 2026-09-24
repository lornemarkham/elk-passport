import { describe, expect, it } from "vitest";
import { subjectPageView } from "./subjectPage";
import type {
  ComposedSubject,
  SubjectComposition,
  SubjectSource,
} from "@/lib/data/types";

/**
 * **Atlas composed it; Passport arranges it and invents nothing.**
 *
 * The Black Mountain shape, as Atlas actually returns it: a provider that
 * offers an attraction and both of its modes, the attraction including the
 * two, a venue hosting it, and a temporal claim on each mode.
 */

const SCHEDULE: SubjectSource = {
  id: "r-schedule",
  url: "https://blackmountainhauntedhouse.com/schedule",
  sourceType: "official-website",
  retrievedAt: "2026-09-23T15:41:26.032Z",
};

const subject = (
  over: Partial<ComposedSubject> &
    Pick<ComposedSubject, "id" | "kind" | "name">,
): ComposedSubject => ({
  description: "",
  keyFacts: [],
  temporal: { policyVersion: 1, claims: [], asOf: {}, withheld: 0 },
  when: [],
  related: [],
  depth: 1,
  ...over,
});

const fact = (label: string, value: string) => ({
  label,
  value,
  sourceRecordId: SCHEDULE.id,
});

const claim = (id: string, days: string[], statesRequestedDay?: boolean) => ({
  id,
  shape: "discrete-dates",
  intervals: days.map((d) => ({ startsOn: d, endsOn: d })),
  weekdays: [],
  excludes: [],
  timesOfDay: [],
  unresolved: "time 18:00 is not in the passage",
  supportingPassage: "October 2026 at Hillcrest Farm Market …",
  sourceRecordId: SCHEDULE.id,
  observedAt: "2026-09-23T15:41:26.032Z",
  ...(statesRequestedDay === undefined ? {} : { statesRequestedDay }),
});

const EVENING = subject({
  id: "evening",
  kind: "Experience",
  name: "Evening Haunt",
  description: "Live actors · timed entry · full scares",
  keyFacts: [fact("General Admission 19+", "$20.00")],
  temporal: {
    policyVersion: 1,
    claims: [
      {
        field: "keyFacts",
        label: "General Admission 19+",
        value: "$20.00",
        class: "effective-until-changed",
        observedAt: "2026-09-23T15:41:26.032Z",
        currency: "not-decided",
        reason: "observed only",
      },
    ],
    asOf: {},
    withheld: 0,
  },
  when: [claim("tc-evening", ["2026-10-16", "2026-10-31"])],
  depth: 2,
});

const FAMILY = subject({
  id: "family",
  kind: "Experience",
  name: "Family Fun Hours",
  description: "Lights up · no actors · little ones welcome",
  keyFacts: [
    fact("Per person", "$5.00"),
    fact("Hours", "Family Fun 12 to 3pm"),
  ],
  when: [claim("tc-family", ["2026-10-31"])],
  depth: 2,
});

const VENUE = subject({
  id: "hillcrest",
  kind: "Organization",
  name: "Hillcrest Farm Market",
  address: "700 Hwy 33 E, Kelowna BC",
  depth: 2,
});

const ATTRACTION = subject({
  id: "haunt",
  kind: "Experience",
  name: "The Black Mountain Haunted House",
  description: "Built from the ground up by volunteers.",
  keyFacts: [
    fact("Door sales", "Door sales until 9:30 Fridays and Saturdays."),
  ],
  related: [
    { verb: "hosts", direction: "incoming", subject: VENUE },
    { verb: "includes", direction: "outgoing", subject: EVENING },
    { verb: "includes", direction: "outgoing", subject: FAMILY },
  ],
});

const COMPOSITION: SubjectComposition = {
  root: subject({
    id: "bmhh",
    kind: "Organization",
    name: "Black Mountain Haunted House",
    subtype: "haunted house",
    description: "A haunted house attraction.",
    address: "700 Hwy 33 E, Kelowna BC",
    keyFacts: [fact("Parking", "Free parking")],
    related: [
      { verb: "offers", direction: "outgoing", subject: ATTRACTION },
      { verb: "offers", direction: "outgoing", subject: EVENING },
      { verb: "offers", direction: "outgoing", subject: FAMILY },
    ],
    depth: 0,
  }),
  sources: [SCHEDULE],
  verbs: ["offers", "includes", "hosts"],
  maxDepth: 2,
};

describe("subjectPageView", () => {
  it("nests an offering another offering includes, because Atlas asserts that edge", () => {
    const view = subjectPageView(COMPOSITION);
    expect(view.offerings.map((o) => o.subject.name)).toEqual([
      "The Black Mountain Haunted House",
    ]);
    expect(view.offerings[0]!.parts.map((p) => p.name)).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
    expect(view.offerings[0]!.venue?.name).toBe("Hillcrest Farm Market");
  });

  it("keeps every fact on the subject that holds it", () => {
    const view = subjectPageView(COMPOSITION);
    const [offering] = view.offerings;
    const evening = offering!.parts.find((p) => p.id === "evening")!;
    const family = offering!.parts.find((p) => p.id === "family")!;

    expect(view.subject.facts.map((f) => f.label)).toEqual(["Parking"]);
    expect(offering!.subject.facts.map((f) => f.label)).toEqual(["Door sales"]);
    expect(evening.facts.map((f) => f.value)).toEqual(["$20.00"]);
    expect(family.facts.map((f) => f.value)).toEqual([
      "$5.00",
      "Family Fun 12 to 3pm",
    ]);
    // Nothing is merged upward into an invented subject.
    expect(view.subject.facts.some((f) => f.value === "$20.00")).toBe(false);
    expect(offering!.subject.facts.some((f) => f.value === "$5.00")).toBe(
      false,
    );
  });

  it("carries each fact's provenance and Atlas's own currency verdict", () => {
    const view = subjectPageView(COMPOSITION);
    const price = view.offerings[0]!.parts[0]!.facts[0]!;
    expect(price.source?.url).toBe(
      "https://blackmountainhauntedhouse.com/schedule",
    );
    expect(price.observedAt).toBe("2026-09-23T15:41:26.032Z");
    // Atlas decides no currency for an Experience; Passport does not upgrade it.
    expect(price.currency).toBe("not-decided");
  });

  it("reads the days Atlas stated and computes none of its own", () => {
    const view = subjectPageView(COMPOSITION);
    const evening = view.offerings[0]!.parts[0]!;
    expect(evening.days).toEqual(["2026-10-16", "2026-10-31"]);
    expect(evening.claims[0]!.id).toBe("tc-evening");
    expect(evening.claims[0]!.unresolved).toMatch(/time 18:00/);
    expect(evening.claims[0]!.source?.url).toContain("/schedule");
    // The attraction states no season of its own, and none is synthesised
    // from its children's days.
    expect(view.offerings[0]!.subject.days).toEqual([]);
  });

  it("carries a day statement verbatim, and never turns a negative into a closure", () => {
    const withDay: SubjectComposition = {
      ...COMPOSITION,
      on: "2026-10-16",
      root: {
        ...COMPOSITION.root,
        related: [
          {
            verb: "offers",
            direction: "outgoing",
            subject: {
              ...ATTRACTION,
              related: [
                { verb: "hosts", direction: "incoming", subject: VENUE },
                {
                  verb: "includes",
                  direction: "outgoing",
                  subject: {
                    ...EVENING,
                    when: [claim("tc-evening", ["2026-10-16"], true)],
                    on: {
                      day: "2026-10-16",
                      stated: true,
                      byClaims: ["tc-evening"],
                      meaning: "a claim Atlas holds states this day",
                    },
                  },
                },
                {
                  verb: "includes",
                  direction: "outgoing",
                  subject: {
                    ...FAMILY,
                    when: [claim("tc-family", ["2026-10-31"], false)],
                    on: {
                      day: "2026-10-16",
                      stated: false,
                      byClaims: [],
                      meaning:
                        "no claim Atlas holds states this day; Atlas is not stating that it is closed",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const view = subjectPageView(withDay);
    const [evening, family] = view.offerings[0]!.parts;
    expect(view.on).toBe("2026-10-16");
    expect(evening!.day?.stated).toBe(true);
    expect(family!.day?.stated).toBe(false);
    expect(family!.day?.meaning).toBe(
      "no claim Atlas holds states this day; Atlas is not stating that it is closed",
    );
    // The mapper holds no notion of "closed" to fall back on.
    expect(JSON.stringify(view)).not.toMatch(/"closed"/);
  });

  it("roots at an Experience and reads the same structure from the other end", () => {
    const view = subjectPageView({
      ...COMPOSITION,
      root: {
        ...EVENING,
        depth: 0,
        related: [
          { verb: "includes", direction: "incoming", subject: ATTRACTION },
          {
            verb: "offers",
            direction: "incoming",
            subject: subject({
              id: "bmhh",
              kind: "Organization",
              name: "Black Mountain Haunted House",
            }),
          },
        ],
      },
    });

    expect(view.subject.name).toBe("Evening Haunt");
    expect(view.subject.facts[0]!.value).toBe("$20.00");
    expect(view.subject.days).toEqual(["2026-10-16", "2026-10-31"]);
    expect(view.partOf?.name).toBe("The Black Mountain Haunted House");
    expect(view.offeredBy?.name).toBe("Black Mountain Haunted House");
    expect(view.offerings).toEqual([]);
  });
});
