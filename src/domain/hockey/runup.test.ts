import { describe, expect, it } from "vitest";
import {
  daysLine,
  daysOut,
  runupItems,
  runupStage,
  type RunupFacts,
} from "./runup";

// UTC, so this machine's tz data (British Columbia kept on UTC−7 after
// November 2026) cannot move a midnight; the arithmetic is the same in any zone.
const ZONE = "UTC";
const PUCK = "2026-11-15T03:00:00Z";

describe("the run-up's stages", () => {
  it("counts calendar days in the arena's zone, not 24-hour blocks", () => {
    // 11pm the night before is "tomorrow", though under 24 h away.
    expect(daysOut(new Date("2026-11-14T23:00:00Z"), PUCK, ZONE)).toBe(1);
    expect(daysOut(new Date("2026-11-15T00:30:00Z"), PUCK, ZONE)).toBe(0);
    expect(daysOut(new Date("2026-11-01T20:00:00Z"), PUCK, ZONE)).toBe(14);
  });

  it("maps days out to a stage", () => {
    const at = (d: string) => runupStage(new Date(d), PUCK, ZONE).stage;
    expect(at("2026-11-01T20:00:00Z")).toBe("invite"); // 14 days
    expect(at("2026-11-09T20:00:00Z")).toBe("invite"); // 6
    expect(at("2026-11-10T20:00:00Z")).toBe("rivalry"); // 5
    expect(at("2026-11-11T20:00:00Z")).toBe("rivalry"); // 4
    expect(at("2026-11-12T20:00:00Z")).toBe("chirp"); // 3
    expect(at("2026-11-13T20:00:00Z")).toBe("chirp"); // 2
    expect(at("2026-11-14T20:00:00Z")).toBe("final"); // 1
    expect(at("2026-11-15T00:30:00Z")).toBe("gameday"); // 0
    expect(at("2026-11-15T04:00:00Z")).toBe("after");
  });

  it("says the days the way a person would", () => {
    expect(daysLine(6)).toBe("6 days to puck drop");
    expect(daysLine(1)).toBe("Tomorrow");
    expect(daysLine(0)).toBe("Tonight");
  });
});

describe("what is still open", () => {
  const facts: RunupFacts = {
    members: 4,
    declared: 2,
    myTeam: true,
    dinnerVotes: 1,
    dinnerOn: true,
    myPicks: { mine: 3, total: 7 },
    picksOn: true,
    challengesOpen: 0,
    myChallenges: 0,
    challengesOn: true,
    said: 0,
    isHost: false,
  };

  it("asks the host, alone, to invite before anything else", () => {
    const items = runupItems("invite", {
      ...facts,
      members: 1,
      declared: 1,
      isHost: true,
    });
    expect(items[0]).toMatchObject({
      id: "invite",
      done: false,
      room: "group",
    });
    expect(items[0].label).toMatch(/just you/);
    // A guest is never asked to invite.
    expect(
      runupItems("invite", { ...facts, members: 1 }).some(
        (i) => i.id === "invite",
      ),
    ).toBe(false);
  });

  it("in the first week asks for teams, not picks", () => {
    const ids = runupItems("invite", facts).map((i) => i.id);
    expect(ids).toContain("team");
    expect(ids).not.toContain("picks");
    expect(ids).not.toContain("dinner");
  });

  it("later asks for dinner, picks, a challenge and some talk — open things first, four at most", () => {
    const items = runupItems("chirp", facts);
    expect(items).toHaveLength(4);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items.map((i) => i.id)).toEqual([
      "team",
      "dinner",
      "picks",
      "challenge",
    ]);
    expect(items.find((i) => i.id === "picks")?.label).toBe(
      "Seal your picks: 3 of 7",
    );
  });

  it("shows a thing done as done and sinks it", () => {
    const items = runupItems("final", {
      ...facts,
      declared: 4,
      dinnerVotes: 4,
      myPicks: { mine: 7, total: 7 },
      myChallenges: 1,
    });
    expect(items.every((i) => i.done)).toBe(true);
    expect(items.find((i) => i.id === "picks")?.label).toBe(
      "Your picks are sealed",
    );
    expect(items.find((i) => i.id === "challenge")?.label).toBe(
      "You're in 1 challenge",
    );
  });

  it("asks for nothing social of a person alone", () => {
    const ids = runupItems("rivalry", {
      ...facts,
      members: 1,
      declared: 1,
    }).map((i) => i.id);
    expect(ids).not.toContain("challenge");
    expect(ids).not.toContain("chat");
  });
});
