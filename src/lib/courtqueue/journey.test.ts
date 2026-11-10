import { describe, expect, it } from "vitest";
import { applyClub } from "./engine";
import { demoScenarios } from "./demo";
import { cleanJourney, encouragement } from "./journey";
import { LESSONS, TECHNIQUES, CHALLENGES } from "./learn";
import { propose } from "./fair";
import { as, club, must, night, ORG, T0 } from "./testkit";
import { nightView } from "./view";

/** Play. Learn. Grow. Together.: private, optional, never a barrier. */

const journey = (c: ReturnType<typeof club>, id: string, cmd: object) => {
  const out = applyClub(c, as(id), { type: "journey", ...cmd } as never, T0);
  if (!out.ok) throw new Error(out.error);
  return out.value;
};

describe("my badminton journey", () => {
  it("is optional, changeable and cleared by 'rather not say'", () => {
    let c = club(2);
    c = journey(c, "p1", { level: "intermediate", wantsHelp: true });
    expect(c.players.p1!.journey).toMatchObject({
      level: "intermediate",
      wantsHelp: true,
      asked: true,
    });
    c = journey(c, "p1", { level: null, wantsHelp: false });
    expect(c.players.p1!.journey?.level).toBeUndefined();
    expect(c.players.p1!.journey?.wantsHelp).toBeUndefined();
    // Skipping still means "asked", so nobody is nagged.
    c = journey(c, "p2", {});
    expect(c.players.p2!.journey?.asked).toBe(true);
    expect(c.players.p2!.journey?.level).toBeUndefined();
  });

  it("refuses made-up levels and drops unknown techniques and challenges", () => {
    const c = club(1);
    const bad = applyClub(c, as("p1"), { type: "journey", level: "pro" }, T0);
    expect(bad.ok).toBe(false);
    const j = cleanJourney({
      goals: ["  rally   for 20  ", "", "b", "c", "d"],
      practising: ["low-serve", "low-serve", "nope"],
      done: ["call-it", "nope"],
    });
    expect(j.goals).toEqual(["rally for 20", "b", "c"]);
    expect(j.practising).toEqual(["low-serve"]);
    expect(j.done).toEqual(["call-it"]);
  });

  it("lets no one set another player's journey", () => {
    const c = club(2);
    const out = applyClub(c, ORG, { type: "journey", level: "advanced" }, T0);
    // The organizer is a player too: it can only ever be their own.
    expect(out.ok && out.value.players.p1!.journey).toBeFalsy();
  });

  it("never sends one player's level, mood or wish for help to anyone else", () => {
    const c = journey(
      journey(club(8), "p1", { level: "advanced", wantsHelp: true }),
      "p2",
      { level: "beginner" },
    );
    let s = night();
    for (const id of ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
      s = must(c, s, as(id), { type: "play" }, T0);
    }
    s = must(c, s, as("p1"), { type: "mood", mood: "challenge" }, T0);
    s = must(c, s, as("p2"), { type: "mood", mood: "help" }, T0);
    const theirs = JSON.stringify(nightView(c, s, "p3", T0));
    expect(theirs).not.toMatch(/advanced|beginner|wantsHelp|journey/i);
    expect(theirs).not.toContain('"challenge"');
    expect(theirs).not.toContain('"help"');
  });

  it("encourages and never scores", () => {
    const j = cleanJourney({ practising: ["low-serve"], done: ["call-it"] });
    const lines = encouragement(j, { attended: 3, games: 5, partners: 4 });
    expect(lines.join(" ")).toMatch(/5 games/);
    expect(lines.join(" ")).not.toMatch(/rank|score|rating|best|worst|behind/i);
    expect(
      encouragement(cleanJourney({}), {
        attended: 0,
        games: 0,
        partners: 0,
      })[0],
    ).toMatch(/everyone starts here/);
  });
});

describe("learn badminton", () => {
  it("has the six lessons, each short, with a diagram and something to try", () => {
    expect(LESSONS.map((l) => l.title)).toEqual([
      "Grip and serving",
      "Footwork",
      "Clears and drops",
      "Doubles positioning",
      "Communication",
      "Improving consistency",
    ]);
    for (const l of LESSONS) {
      expect(l.points.length).toBeGreaterThanOrEqual(3);
      expect(l.tryThis.length).toBeGreaterThan(20);
    }
    for (const t of TECHNIQUES)
      expect(LESSONS.some((l) => l.id === t.lesson)).toBe(true);
    expect(CHALLENGES.length).toBeGreaterThan(3);
  });

  it("links nowhere outside the app", () => {
    const text = JSON.stringify([LESSONS, TECHNIQUES, CHALLENGES]);
    expect(text).not.toMatch(/https?:|www\.|youtube|\.com/i);
  });
});

describe("suggestions", () => {
  it("seats a newcomer who asked for help with someone happy to help — and everyone still plays", () => {
    let c = club(8);
    c.players.p1!.createdAt = Date.parse("2026-11-12") - 3 * 24 * 3600_000;
    c = journey(c, "p1", { level: "beginner", wantsHelp: true });
    let s = night();
    for (let i = 1; i <= 8; i++) {
      const id = `p${i}`;
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    s = must(c, s, as("p4"), { type: "mood", mood: "help" }, T0);
    s.queue = Array.from({ length: 8 }, (_, i) => ({
      playerId: `p${i + 1}`,
      since: T0 + i,
    }));
    const pick = propose(c, s, c.courts[0]!, T0 + 5 * 60_000)!;
    expect(pick.slots).toContain("p1");
    expect(pick.slots).toContain("p4");
    const partner = pick.slots[pick.slots.indexOf("p1") ^ 1];
    expect(partner).toBe("p4");
  });

  it("never lets mood or level skip anyone ahead in line", () => {
    let c = club(8);
    c = journey(c, "p8", { level: "advanced" });
    let s = night();
    for (let i = 1; i <= 8; i++) {
      const id = `p${i}`;
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    s = must(c, s, as("p8"), { type: "mood", mood: "challenge" }, T0);
    s = must(c, s, as("p7"), { type: "mood", mood: "challenge" }, T0);
    c = journey(c, "p7", { level: "advanced" });
    s.queue = Array.from({ length: 8 }, (_, i) => ({
      playerId: `p${i + 1}`,
      since: T0 + i,
    }));
    const pick = propose(c, s, c.courts[0]!, T0 + 5 * 60_000)!;
    // The one waiting longest is always in the game.
    expect(pick.slots).toContain("p1");
    expect(pick.why.join(" ")).not.toMatch(/advanced|beginner|level/i);
  });
});

describe("the demonstration", () => {
  const scenarios = demoScenarios();

  it("has the three scenarios, each with a made-up cast and a court", () => {
    expect(scenarios.map((s) => s.id)).toEqual([
      "new-player",
      "challenging-match",
      "newer-challenges-stronger",
    ]);
    for (const s of scenarios) {
      expect(s.players.length).toBeGreaterThanOrEqual(8);
      expect(s.frames.at(-1)!.courts.length).toBeGreaterThan(0);
    }
  });

  it("seats the new player with someone happy to help", () => {
    const c1 = scenarios[0]!.frames[0]!.courts.find((c) =>
      c.teams.flat().includes("Maya"),
    )!;
    const mayaTeam = c1.teams.find((t) => t.includes("Maya"))!;
    expect(mayaTeam).toContain("Sam");
  });

  it("gives the four who chose Challenge Me a game together while everyone else plays too", () => {
    const f = scenarios[1]!.frames[0]!;
    const together = f.courts.find((c) => c.teams.flat().includes("Alex"))!;
    expect(together.teams.flat().sort()).toEqual([
      "Alex",
      "Dana",
      "Eli",
      "Omar",
    ]);
    expect(f.courts).toHaveLength(3);
    expect(f.courts.flatMap((c) => c.teams.flat())).toHaveLength(12);
  });

  it("puts the newer player's invite to a stronger player on a court", () => {
    const f = scenarios[2]!.frames.at(-1)!;
    const g = f.courts.find((c) => c.source === "challenge")!;
    expect(g.teams.flat().sort()).toEqual(["Alex", "Dana", "Jordan", "Mina"]);
  });
});
