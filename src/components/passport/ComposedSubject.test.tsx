import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComposedSubjectPage } from "./ComposedSubject";
import { subjectPageView } from "@/lib/passport/subjectPage";
import type { ComposedSubject, SubjectComposition } from "@/lib/data/types";

/**
 * **What a traveller can now read, and what the page must never say.**
 *
 * Before this, the same id rendered an address, a generic sentence and
 * *"Operation period: Every October"*, over a curator's list of research
 * buttons. These pin that the composed knowledge arrives, that each subject's
 * facts stay its own, and that a day Atlas holds no claim for is reported in
 * Atlas's own words rather than as a closure.
 */

const SOURCE = {
  id: "r-schedule",
  url: "https://blackmountainhauntedhouse.com/schedule",
  sourceType: "official-website",
  retrievedAt: "2026-09-23T15:41:26.032Z",
};

const base = (
  over: Partial<ComposedSubject> &
    Pick<ComposedSubject, "id" | "kind" | "name">,
): ComposedSubject => ({
  description: "",
  keyFacts: [],
  temporal: { policyVersion: 1, claims: [], asOf: {}, withheld: 0 },
  when: [],
  related: [],
  depth: 2,
  ...over,
});

const claim = (id: string, days: string[], statesRequestedDay: boolean) => ({
  id,
  shape: "discrete-dates",
  intervals: days.map((d) => ({ startsOn: d, endsOn: d })),
  weekdays: [],
  excludes: [],
  timesOfDay: [],
  supportingPassage: "October 2026 at Hillcrest Farm Market …",
  sourceRecordId: SOURCE.id,
  observedAt: "2026-09-23T15:41:26.032Z",
  statesRequestedDay,
});

const COMPOSITION: SubjectComposition = {
  on: "2026-10-16",
  sources: [SOURCE],
  verbs: ["offers", "includes", "hosts"],
  maxDepth: 2,
  root: base({
    id: "bmhh",
    kind: "Organization",
    name: "Black Mountain Haunted House",
    subtype: "haunted house",
    description: "A haunted house attraction.",
    address: "700 Hwy 33 E, Kelowna BC",
    keyFacts: [
      { label: "Parking", value: "Free parking", sourceRecordId: SOURCE.id },
    ],
    depth: 0,
    related: [
      {
        verb: "offers",
        direction: "outgoing",
        subject: base({
          id: "haunt",
          kind: "Experience",
          name: "The Black Mountain Haunted House",
          description: "Built from the ground up by volunteers.",
          depth: 1,
          related: [
            {
              verb: "hosts",
              direction: "incoming",
              subject: base({
                id: "hillcrest",
                kind: "Organization",
                name: "Hillcrest Farm Market",
                address: "700 Hwy 33 E, Kelowna BC",
              }),
            },
            {
              verb: "includes",
              direction: "outgoing",
              subject: base({
                id: "evening",
                kind: "Experience",
                name: "Evening Haunt",
                description: "Live actors · timed entry · full scares",
                keyFacts: [
                  {
                    label: "General Admission 19+",
                    value: "$20.00",
                    sourceRecordId: SOURCE.id,
                  },
                ],
                when: [claim("tc-evening", ["2026-10-16"], true)],
                on: {
                  day: "2026-10-16",
                  stated: true,
                  byClaims: ["tc-evening"],
                  meaning: "a claim Atlas holds states this day",
                },
              }),
            },
            {
              verb: "includes",
              direction: "outgoing",
              subject: base({
                id: "family",
                kind: "Experience",
                name: "Family Fun Hours",
                description: "Lights up · no actors · little ones welcome",
                keyFacts: [
                  {
                    label: "Per person",
                    value: "$5.00",
                    sourceRecordId: SOURCE.id,
                  },
                ],
                when: [claim("tc-family", ["2026-10-31"], false)],
                on: {
                  day: "2026-10-16",
                  stated: false,
                  byClaims: [],
                  meaning:
                    "no claim Atlas holds states this day; Atlas is not stating that it is closed",
                },
              }),
            },
          ],
        }),
      },
    ],
  }),
};

describe("ComposedSubjectPage", () => {
  it("renders the attraction, both modes and each one's own price", () => {
    render(<ComposedSubjectPage view={subjectPageView(COMPOSITION)} />);

    expect(
      screen.getByRole("heading", { name: "Black Mountain Haunted House" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The Black Mountain Haunted House" }),
    ).toBeInTheDocument();
    // Each mode appears as its own block, and again in the day answer above it.
    expect(screen.getAllByText("Evening Haunt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Family Fun Hours").length).toBeGreaterThan(0);
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$5\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Free parking/)).toBeInTheDocument();
    expect(
      screen.getByText(/Hosted at Hillcrest Farm Market/),
    ).toBeInTheDocument();
  });

  it("shows the days Atlas stated, formatted and not extended", () => {
    render(<ComposedSubjectPage view={subjectPageView(COMPOSITION)} />);
    expect(screen.getByText("Fri, Oct 16, 2026")).toBeInTheDocument();
    expect(screen.getByText("Sat, Oct 31, 2026")).toBeInTheDocument();
  });

  it("reports a day nothing states in Atlas's words, never as a closure", () => {
    render(<ComposedSubjectPage view={subjectPageView(COMPOSITION)} />);
    expect(
      screen.getByText(
        /no claim Atlas holds states this day; Atlas is not stating that it is closed/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Closed$/)).toBeNull();
    expect(screen.queryByText(/Closed on this day/)).toBeNull();
  });

  it("offers a traveller no curator instruments", () => {
    render(<ComposedSubjectPage view={subjectPageView(COMPOSITION)} />);
    for (const operatorLabel of [
      /Research hours/,
      /Research the menu/,
      /Find more images/,
      /% complete/,
      /would make this page better/,
    ]) {
      expect(screen.queryByText(operatorLabel)).toBeNull();
    }
  });
});
