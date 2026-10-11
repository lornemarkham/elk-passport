import { describe, expect, it } from "vitest";
import type { DayPlanned } from "@/domain/day/build";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { timelineFor } from "@/domain/day/timeline";
import { dayAsText } from "./dayText";

const stop = (title: string, extra: object = {}) => ({
  experience: {
    id: title,
    kind: "Place",
    slug: title,
    title,
  } as unknown as Experience,
  minutes: 90,
  because: "",
  notes: [],
  ...extra,
});

const day = {
  title: "Polson Park to Kal Beach",
  opening: "",
  stops: [
    stop("Polson Park", { hours: "Dawn to dusk" }),
    stop("Kal Beach", { cost: "Free" }),
  ],
  unknowns: ["Prices — only published where a place has said."],
  brief: { said: "x", startAt: 600, homeBy: 960, town: townById("vernon")! },
  budget: { perMove: 15 },
  closing: "",
} as unknown as DayPlanned;

describe("dayAsText", () => {
  const text = dayAsText(day, timelineFor(day, [], "driving"));

  it("carries the stops, their times as 'about', and the way home", () => {
    expect(text).toContain(
      "1. Polson Park — about 10:15 am (about 1 h 30 min)",
    );
    expect(text).toContain("Home about");
    expect(text).toContain("(you said by 4 pm)");
  });

  it("says what nobody published, and what to check, because there is no signal to ask", () => {
    expect(text).toContain("Published hours: Dawn to dusk");
    expect(text).toContain("No published hours — check before you go.");
    expect(text).toContain("Check before you go:");
  });

  it("has no clock at all without a leaving time", () => {
    const bare = { ...day, brief: { said: "x" } } as unknown as DayPlanned;
    expect(dayAsText(bare)).not.toMatch(/ am| pm/);
  });
});
