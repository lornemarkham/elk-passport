import { describe, expect, it } from "vitest";
import { ActionSchema } from "./actions";
import {
  NHL_TEAMS,
  fanLabel,
  isTeamAbbr,
  pairKey,
  rivalry,
  teamByAbbr,
  teamByName,
  teamsMentioned,
} from "./fans";
import { OPPONENTS } from "./schedule";
import { teamColours } from "./teams";

describe("who you bleed for — the 32", () => {
  it("has every NHL team exactly once", () => {
    expect(NHL_TEAMS).toHaveLength(32);
    expect(new Set(NHL_TEAMS.map((t) => t.abbr)).size).toBe(32);
    expect(new Set(NHL_TEAMS.map((t) => t.name)).size).toBe(32);
  });

  it("is the schedule's 31 opponents plus the Canucks — same names, same codes as the scoreboard", () => {
    const names = new Set(NHL_TEAMS.map((t) => t.name));
    for (const o of OPPONENTS) expect(names).toContain(o.name);
    expect(names).toContain("Canucks");
    for (const team of NHL_TEAMS) {
      // The chip and the matchup never disagree about a team's code or colours.
      expect(teamColours(team.name).abbr).toBe(team.abbr);
      expect(team.colours.primary).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("reads like a person's allegiance", () => {
    expect(fanLabel(teamByAbbr("CGY")!)).toBe("Calgary Flames 🔥");
    expect(teamByName("Wild")?.abbr).toBe("MIN");
    expect(teamByAbbr("XYZ")).toBeNull();
    expect(isTeamAbbr("VAN")).toBe(true);
    expect(isTeamAbbr("van")).toBe(false);
  });

  it("knows real rivalries, both ways round, and not imaginary ones", () => {
    expect(rivalry("CGY", "EDM")).toBe("the Battle of Alberta");
    expect(rivalry("EDM", "CGY")).toBe("the Battle of Alberta");
    expect(rivalry("VAN", "CGY")).toMatch(/1989 and 2004/);
    expect(rivalry("VAN", "VAN")).toBeNull();
    expect(rivalry("SJS", "CBJ")).toBeNull();
    expect(pairKey("VAN", "CGY")).toBe(pairKey("CGY", "VAN"));
  });

  it("hears a team in a sentence without hearing one in ordinary words", () => {
    expect(teamsMentioned("the Flames are toast").map((t) => t.abbr)).toEqual([
      "CGY",
    ]);
    expect(teamsMentioned("go habs go").map((t) => t.abbr)).toEqual(["MTL"]);
    expect(
      teamsMentioned("that was wild, stars were out, kings of the night"),
    ).toEqual([]);
    expect(teamsMentioned("Leafs and Canucks").map((t) => t.abbr)).toEqual([
      "TOR",
      "VAN",
    ]);
  });

  it("accepts any of the 32 as an action, and nothing else — not tonight's opponent by name", () => {
    for (const t of NHL_TEAMS)
      expect(
        ActionSchema.safeParse({ type: "setTeam", team: t.abbr }).success,
      ).toBe(true);
    expect(
      ActionSchema.safeParse({ type: "setTeam", team: null }).success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({ type: "setTeam", team: "Flames" }).success,
    ).toBe(false);
    expect(
      ActionSchema.safeParse({ type: "setTeam", team: "QUE" }).success,
    ).toBe(false);
    // Nobody names who is acting: no way to set somebody else's team.
    const forged = ActionSchema.safeParse({
      type: "setTeam",
      team: "TOR",
      userId: "00000000-0000-0000-0000-000000000000",
    });
    expect(forged.success && "userId" in forged.data).toBe(false);
  });
});
