import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { publishedFacts, publishedHours } from "./published";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { prepFor, printableFromDay } from "./printable";

// Fixtures, not Atlas.
const withFacts = (
  practical: { label: string; value: string }[],
  name = "Some Museum",
) =>
  candidateToExperience({
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype: "museum",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    knowledge: { practical },
  } satisfies DiscoveryCandidate);

describe("publishedHours", () => {
  it("repeats hours in the publisher's words", () => {
    expect(
      publishedHours(
        withFacts([{ label: "Hours", value: "Tuesday to Saturday, 10am–4pm" }]),
      ),
    ).toBe("Tuesday to Saturday, 10am–4pm");
    expect(
      publishedHours(
        withFacts([{ label: "Opening hours", value: "Dawn to dusk" }]),
      ),
    ).toBe("Dawn to dusk");
  });

  it("refuses a fact labelled hours that is not a schedule", () => {
    // The corpus really does hold this under an hours label.
    expect(
      publishedHours(
        withFacts([
          {
            label: "Opening hours",
            value: "Opened in September 1888 by Lord Stanley",
          },
        ]),
      ),
    ).toBeUndefined();
  });

  it("does not read hours out of something that is not labelled hours", () => {
    expect(
      publishedHours(
        withFacts([{ label: "Parking", value: "Free after 6pm" }]),
      ),
    ).toBeUndefined();
  });
});

describe("publishedFacts", () => {
  it("keeps the rest verbatim and leaves out price and hours", () => {
    const e = withFacts([
      { label: "Admission", value: "$12 adults" },
      { label: "Hours", value: "Daily 9–5" },
      { label: "Parking", value: "Free lot on 32nd Street" },
      { label: "Accessibility", value: "Ramp at the side entrance" },
    ]);
    expect(publishedFacts(e, ["$12 adults", "Daily 9–5"])).toEqual([
      { label: "Parking", value: "Free lot on 32nd Street" },
      { label: "Accessibility", value: "Ramp at the side entrance" },
    ]);
  });

  it("skips a fact too long to print rather than cutting its words", () => {
    const e = withFacts([{ label: "Parking", value: "x".repeat(400) }]);
    expect(publishedFacts(e, [])).toEqual([]);
  });
});

describe("hours on the printed stop", () => {
  const pool = [
    withFacts([{ label: "Hours", value: "Daily 9am–5pm" }], "Open Museum"),
    withFacts([], "Quiet Museum"),
  ];
  const d = buildDay({ pool, brief: readBrief("Four hours") });

  it("prints published hours, and only on the stop that published them", () => {
    const stops = printableFromDay(d).stops;
    expect(stops.find((s) => s.title === "Open Museum")!.hours).toBe(
      "Daily 9am–5pm",
    );
    expect(
      stops.find((s) => s.title === "Quiet Museum")!.hours,
    ).toBeUndefined();
  });

  it("no longer tells you to check hours a place has published", () => {
    const hours = prepFor(d).find((i) => i.id === "hours")!;
    expect(hours.why).toContain("Quiet Museum");
    expect(hours.why).not.toContain("Open Museum");
  });
});
