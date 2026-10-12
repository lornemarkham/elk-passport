import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalogGuide } from "./AnalogGuide";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";

/** The paper carries what the screen showed — including the rain plan. */
const VERNON = townById("vernon")!;
const at = (km: number) =>
  [VERNON.longitude, VERNON.latitude + km / 111] as [number, number];
const base = (name: string, km: number, extra: Partial<DiscoveryCandidate>) =>
  ({
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype: "park",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      coordinates: at(km),
    },
    ...extra,
  }) as DiscoveryCandidate;

const POOL = [
  base("Lakeside Beach", 2, {
    knowledge: {
      affordances: [{ name: "swimming", basis: "stated-activity" }],
    },
    environment: { rain: { reading: "exposed", basis: "stated" } },
  } as Partial<DiscoveryCandidate>),
  base("Science Hall", 2.5, {
    knowledge: {
      affordances: [{ name: "interactive exhibits", basis: "stated-activity" }],
      practical: [{ label: "Hours", value: "10am–5pm daily" }],
    },
    environment: { rain: { reading: "sheltered", basis: "stated" } },
  } as Partial<DiscoveryCandidate>),
].map(candidateToExperience);

describe("the printed guide", () => {
  it("prints the rain plan, the published hours and the time budget", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("three hours near Vernon"),
      keep: ["lakeside-beach"],
      count: 1,
      rainPlans: { "lakeside-beach": "science-hall" },
    });
    render(<AnalogGuide day={day} />);
    expect(screen.getByTestId("guide-rain-plan").textContent).toContain(
      "Science Hall",
    );
    expect(screen.getByTestId("guide-budget").textContent).toMatch(/3 hours/);
    expect(screen.getByTestId("guide-budget").textContent).toMatch(/kept back/);
  });

  it("quotes published hours where a place has them", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon"),
      keep: ["science-hall"],
      count: 1,
    });
    render(<AnalogGuide day={day} />);
    expect(screen.getByText(/Published hours: 10am–5pm daily/)).toBeTruthy();
  });
});
