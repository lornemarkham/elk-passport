import { describe, expect, it } from "vitest";
import { postgameBets, pregameBets, splitBallot } from "./candidates";
import type { NearbyPlace } from "./nearby";

const place = (name: string, over: Partial<NearbyPlace> = {}): NearbyPlace => ({
  atlasId: name,
  name,
  km: 0.4,
  walkMinutes: 5,
  basis: "straight-line",
  source: "atlas",
  ...over,
});
const photo = { url: "https://x.test/a.jpg", relationship: "exact" as const };

describe("pregame cards", () => {
  const all = [place("A"), place("B"), place("C"), place("D")];
  it("leads with the first three in the window's order", () => {
    expect(pregameBets(all, new Set()).map((p) => p.name)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
  it("skips what is on the vote already and what Atlas says is shut", () => {
    const shut = place("Shut", { gameDay: { reading: "not-on" } });
    expect(
      pregameBets([shut, ...all], new Set(["A"])).map((p) => p.name),
    ).toEqual(["B", "C", "D"]);
  });
  it("fills only the gap a short ballot leaves, and matches names loosely", () => {
    expect(pregameBets(all, new Set(["b"]), 1).map((p) => p.name)).toEqual([
      "A",
    ]);
    expect(pregameBets(all, new Set(), 0)).toEqual([]);
  });
});

describe("postgame cards", () => {
  it("lead with stated hours, then a photograph, then the walk", () => {
    const a = place("NoInfo", { km: 0.1 });
    const b = place("Photo", { image: photo, km: 0.5 });
    const c = place("Hours", {
      gameDay: { reading: "on", said: "11am-late" },
      km: 0.9,
    });
    const d = place("HoursPhoto", {
      gameDay: { reading: "on", said: "Sun 11-11" },
      image: photo,
      km: 0.7,
    });
    expect(postgameBets([a, b, c, d], new Set()).map((p) => p.name)).toEqual([
      "HoursPhoto",
      "Hours",
      "Photo",
    ]);
  });
  it("never offers a place shut on game day", () => {
    const shut = place("Shut", { gameDay: { reading: "not-on", said: "x" } });
    expect(postgameBets([shut], new Set())).toEqual([]);
  });
});

describe("what leads the vote as cards", () => {
  const opt = (label: string, votes: number) => ({
    optionId: label,
    label,
    voters: Array.from({ length: votes }),
  });
  it("puts the most-backed places first, keeps the rest as rows", () => {
    const options = [
      opt("Typed name", 5),
      opt("A", 1),
      opt("B", 3),
      opt("C", 0),
      opt("D", 0),
      opt("Concourse", 0),
    ];
    const { cards, rows } = splitBallot(options, (o) =>
      ["A", "B", "C", "D"].includes(o.label),
    );
    expect(cards.map((o) => o.label)).toEqual(["B", "A", "C"]);
    expect(rows.map((o) => o.label)).toEqual(["Typed name", "D", "Concourse"]);
  });
});
