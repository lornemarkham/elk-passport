import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { byPreference, statedNotOn } from "./preference";

const place = (title: string, extra: Partial<Experience> = {}): Experience =>
  ({ id: title, title, ...extra }) as unknown as Experience;

const rain = (reading: string, basis = "derived") =>
  ({
    environment: { setting: "unknown", rain: { reading, basis } },
  }) as unknown as Partial<Experience>;

describe("soft preferences", () => {
  const beach = place("Kal Beach", rain("exposed"));
  const unknown = place("Polson Park");
  const shelter = place("Allan Brooks Nature Centre", rain("sheltered"));

  it("sinks somewhere out in the open on a wet day, and only then", () => {
    const pool = [beach, unknown, shelter];
    expect(byPreference(pool, { wet: true }).map((e) => e.title)).toEqual([
      "Allan Brooks Nature Centre",
      "Polson Park",
      "Kal Beach",
    ]);
    // Dry, nothing moves.
    expect(byPreference(pool, { wet: false })).toBe(pool);
  });

  it("leaves everything Atlas is silent about in the order it arrived", () => {
    const pool = [place("a"), place("b"), place("c")];
    expect(
      byPreference(pool, { wet: true, age: 5, day: true }).map((e) => e.title),
    ).toEqual(["a", "b", "c"]);
  });

  it("lifts stated hours covering the chosen day", () => {
    const open = place("Open", {
      schedule: {
        stated: "stated",
        onDate: { date: "2026-10-12", reading: "on", basis: "stated-hours" },
      },
    });
    expect(byPreference([place("x"), open], { day: true })[0]).toBe(open);
  });
});

describe("what a chosen day rules out", () => {
  it("is only Atlas's stated not-on, never silence or disagreement", () => {
    const at = (reading: string) =>
      place(reading, {
        schedule: {
          stated: "stated",
          onDate: { date: "2026-10-12", reading, basis: "stated-hours" },
        },
      } as Partial<Experience>);
    expect(statedNotOn(at("not-on"))).toBe(true);
    expect(statedNotOn(at("conflicting"))).toBe(false);
    expect(statedNotOn(at("unknown"))).toBe(false);
    expect(statedNotOn(place("silent"))).toBe(false);
  });
});
