import { describe, expect, it } from "vitest";
import { liveExperience, withResponse } from "./engine";
import { activePhase, phaseReached, relativeTime } from "./phase";
import { emptyState } from "./store";
import { dateNight, hockeyNight, threeHours } from "../fixtures";
import type { ExperienceDefinition } from "./types";

const at = (definition: ExperienceDefinition, offsetMinutes: number): Date =>
  new Date(new Date(definition.anchorAt).getTime() + offsetMinutes * 60_000);

describe("phases", () => {
  it("is in its first phase long before anything starts", () => {
    expect(activePhase(hockeyNight, at(hockeyNight, -100000)).id).toBe(
      "before",
    );
  });

  it("moves to the next phase the moment its time arrives", () => {
    expect(activePhase(hockeyNight, at(hockeyNight, 1)).id).toBe("live");
  });

  it("knows a later phase has not been reached", () => {
    expect(phaseReached(hockeyNight, "live", at(hockeyNight, -1))).toBe(false);
    expect(phaseReached(hockeyNight, "live", at(hockeyNight, 1))).toBe(true);
  });

  it("writes the gap to the anchor the way a person would say it", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    expect(relativeTime(new Date("2026-01-04T12:00:00.000Z"), now)).toBe(
      "in 3 days",
    );
    expect(relativeTime(new Date("2026-01-01T10:00:00.000Z"), now)).toBe(
      "2 hours ago",
    );
  });
});

describe("locking and revealing", () => {
  const state = emptyState(hockeyNight.slug);

  it("keeps sealed picks hidden from someone who has not answered", () => {
    const live = liveExperience(hockeyNight, state, at(hockeyNight, -1000));
    const score = live.prompts.find((p) => p.prompt.id === "final-score")!;
    expect(score.locked).toBe(false);
    expect(score.revealed).toBe(false);
    expect(score.responses.length).toBeGreaterThan(0);
  });

  it("reveals a sealed pick to someone once they have committed to one", () => {
    const withMine = withResponse(
      { ...state, meId: "mike" },
      "final-score",
      "mike",
      [2, 2],
      new Date().toISOString(),
    );
    const live = liveExperience(hockeyNight, withMine, at(hockeyNight, -1000));
    expect(
      live.prompts.find((p) => p.prompt.id === "final-score")!.revealed,
    ).toBe(true);
  });

  it("locks every pick at puck drop", () => {
    const live = liveExperience(hockeyNight, state, at(hockeyNight, 5));
    expect(live.prompts.find((p) => p.prompt.id === "final-score")!.open).toBe(
      false,
    );
  });

  it("shows a vote as it happens, without waiting for a lock", () => {
    const live = liveExperience(hockeyNight, state, at(hockeyNight, -1000));
    expect(
      live.prompts.find((p) => p.prompt.id === "pregame-spot")!.revealed,
    ).toBe(true);
  });
});

describe("what the group is allowed to know", () => {
  it("withholds an answer the world has not produced yet", () => {
    const live = liveExperience(
      hockeyNight,
      emptyState(hockeyNight.slug),
      at(hockeyNight, -60),
    );
    expect(
      live.prompts.find((p) => p.prompt.id === "final-score")!.prompt
        .resolution,
    ).toBeUndefined();
    expect(live.standings.every((row) => row.points === 0)).toBe(true);
    expect(live.settled).toBe(false);
  });

  it("scores the night once every question has an answer", () => {
    const live = liveExperience(
      hockeyNight,
      emptyState(hockeyNight.slug),
      at(hockeyNight, 400),
    );
    expect(live.settled).toBe(true);
    expect(live.standings[0].points).toBeGreaterThan(0);
  });

  it("only shows moments that have already happened", () => {
    const before = liveExperience(
      hockeyNight,
      emptyState(hockeyNight.slug),
      at(hockeyNight, -60),
    );
    const after = liveExperience(
      hockeyNight,
      emptyState(hockeyNight.slug),
      at(hockeyNight, 400),
    );
    expect(after.moments.length).toBeGreaterThan(before.moments.length);
    expect(before.moments.some((m) => m.text?.includes("Empty netter"))).toBe(
      false,
    );
  });
});

describe("the page changes shape with the phase", () => {
  it("shows the picks before the game and the recap the morning after", () => {
    const before = liveExperience(
      hockeyNight,
      emptyState(hockeyNight.slug),
      at(hockeyNight, -1000),
    );
    const morning = liveExperience(
      hockeyNight,
      emptyState(hockeyNight.slug),
      at(hockeyNight, 950),
    );
    expect(before.blocks.map((b) => b.id)).toContain("picks");
    expect(before.blocks.map((b) => b.id)).not.toContain("recap");
    expect(morning.blocks.map((b) => b.id)).toContain("recap");
    expect(morning.blocks.map((b) => b.id)).not.toContain("picks");
  });
});

describe("the fixtures that were written to break it", () => {
  it("gives a date night no competition at all", () => {
    const live = liveExperience(
      dateNight,
      emptyState(dateNight.slug),
      at(dateNight, -100),
    );
    expect(live.isCompetitive).toBe(false);
    expect(live.standings).toEqual([]);
    expect(live.definition.blocks.some((b) => b.kind === "leaderboard")).toBe(
      false,
    );
  });

  it("never lets a private answer reach Passport's mouth", () => {
    const answered = withResponse(
      { ...emptyState(dateNight.slug), meId: "you" },
      "private",
      "you",
      "something I would not say out loud",
      new Date().toISOString(),
    );
    const live = liveExperience(dateNight, answered, at(dateNight, -100));
    expect(live.commentary.join(" ")).not.toContain("would not say");
    expect(live.prompts.find((p) => p.prompt.id === "private")!.revealed).toBe(
      false,
    );
  });

  it("carries an experience with nothing at its centre", () => {
    const live = liveExperience(
      threeHours,
      emptyState(threeHours.slug),
      new Date(),
    );
    expect(live.blocks.length).toBeGreaterThan(0);
    expect(live.isCompetitive).toBe(false);
  });
});

describe("answering", () => {
  it("replaces an earlier answer rather than adding a second one", () => {
    let state = emptyState("x");
    state = withResponse(state, "p", "a", "one", "2026-01-01T00:00:00.000Z");
    state = withResponse(state, "p", "a", "two", "2026-01-01T00:01:00.000Z");
    expect(state.responses).toHaveLength(1);
    expect(state.responses[0].value).toBe("two");
  });
});

describe("relativeTime rounds to a unit it can honour", () => {
  it("calls thirteen hours thirteen hours, not a day", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(relativeTime(new Date("2026-01-01T13:00:00.000Z"), now)).toBe(
      "in 13 hours",
    );
  });

  it("switches to days only once a day has actually passed", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(relativeTime(new Date("2026-01-02T02:00:00.000Z"), now)).toBe(
      "in 1 day",
    );
  });
});
