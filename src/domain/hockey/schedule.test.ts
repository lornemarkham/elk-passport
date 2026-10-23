import { describe, expect, it } from "vitest";
import { hockeyNight } from "@/experience-lab/fixtures/hockeyNight";
import { ACTS, actOf, nextPhase } from "./acts";
import {
  chooseGame,
  isOver,
  nextGameAfter,
  suggestedGame,
  toRequest,
  vancouverInstant,
  vancouverWallClock,
} from "./schedule";

const NOW = new Date("2026-10-16T18:00:00Z");

describe("run it back when the fortnight has gone by", () => {
  it("opens the form a week from today, same time of day", () => {
    const g = nextGameAfter(
      "2026-10-26T02:00:00.000Z",
      new Date("2026-12-01T20:00:00.000Z"),
    );
    expect(g.date).toBe("2026-12-08");
    expect(g.time).toBe("19:00");
  });
});

describe("arena time", () => {
  it("7pm on 25 October is 02:00Z, the M216 instant", () => {
    expect(vancouverInstant("2026-10-25", "19:00")?.toISOString()).toBe(
      "2026-10-26T02:00:00.000Z",
    );
  });

  /**
   * Deliberately not asserting an offset for November. tzdata 2026c (this
   * machine's Node and OS) has British Columbia on UTC−7 all year from 2026;
   * older data says PST from 1 November. Whatever the runtime believes, 7pm
   * at the arena must come back as 7pm at the arena.
   */
  it("round-trips across 1 November, and refuses dates that do not exist", () => {
    for (const date of ["2026-10-31", "2026-11-08", "2027-01-15"]) {
      const at = vancouverInstant(date, "19:00")!;
      expect(vancouverWallClock(at.toISOString())).toEqual({
        date,
        time: "19:00",
      });
    }
    expect(vancouverInstant("2026-02-30", "19:00")).toBeNull();
    expect(vancouverInstant("tomorrow", "7pm")).toBeNull();
  });
});

describe("choosing a game", () => {
  it("a known opponent gets its proper name and an emoji", () => {
    const chosen = chooseGame(
      toRequest({ opponent: "  kraken ", date: "2026-11-08", time: "19:00" })!,
      NOW,
    );
    expect(chosen).toMatchObject({
      ok: true,
      startsAt: vancouverInstant("2026-11-08", "19:00")!.toISOString(),
      details: {
        opponent: "Kraken",
        opponentEmoji: "🦑",
        venue: "Rogers Arena",
      },
    });
  });

  it("anybody else is allowed, with a puck", () => {
    const chosen = chooseGame(
      toRequest({
        opponent: "Team Canada alumni",
        date: "2026-11-08",
        time: "19:00",
      })!,
      NOW,
    );
    expect(chosen.ok && chosen.details.opponentEmoji).toBe("🏒");
  });

  it("says what is wrong in words a host can fix", () => {
    const problem = (opponent: string, date: string) => {
      const r = chooseGame(toRequest({ opponent, date, time: "19:00" })!, NOW);
      return r.ok ? null : r.problem;
    };
    expect(problem("", "2026-11-08")).toMatch(/playing/);
    expect(problem("Canucks", "2026-11-08")).toMatch(/themselves/);
    expect(problem("Oilers", "2026-10-01")).toMatch(/already started/);
    expect(problem("Oilers", "2029-01-01")).toMatch(/further out/);
    expect(
      toRequest({ opponent: "Oilers", date: "2026-11-08", time: "25:00" }),
    ).toBeNull();
    expect(
      chooseGame({ opponent: "Oilers", startsAt: "not a time" }, NOW),
    ).toEqual({ ok: false, problem: "That isn't a date and time." });
  });

  it("suggests the M216 night while it is ahead, and something sensible after", () => {
    expect(suggestedGame(NOW)).toEqual({
      opponent: "Wild",
      date: "2026-10-25",
      time: "19:00",
    });
    expect(suggestedGame(new Date("2026-10-27T18:00:00Z"))).toEqual({
      opponent: "",
      date: "2026-11-03",
      time: "19:00",
    });
  });

  it("runs it back a fortnight later, same time on the arena clock", () => {
    // Across the end of daylight time: still 7pm.
    expect(nextGameAfter("2026-10-26T02:00:00.000Z")).toEqual({
      opponent: "",
      date: "2026-11-08",
      time: "19:00",
    });
  });

  it("a night is over six hours after puck drop", () => {
    expect(isOver("2026-10-26T02:00:00.000Z", NOW)).toBe(false);
    expect(
      isOver("2026-10-26T02:00:00.000Z", new Date("2026-10-26T08:01:00Z")),
    ).toBe(true);
  });
});

describe("before, during, after", () => {
  it("every phase of the night is in exactly one act", () => {
    const claimed = ACTS.flatMap((a) => a.phaseIds);
    expect([...claimed].sort()).toEqual(
      hockeyNight.phases.map((p) => p.id).sort(),
    );
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("periods are during, the morning is after", () => {
    expect(actOf("warmup").id).toBe("before");
    expect(actOf("int2").id).toBe("during");
    expect(actOf("morning").id).toBe("after");
    expect(nextPhase(hockeyNight.phases, "warmup")?.label).toBe("1st period");
    expect(nextPhase(hockeyNight.phases, "again")).toBeNull();
  });
});
