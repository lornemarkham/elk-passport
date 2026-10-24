import { describe, expect, it } from "vitest";
import { hockeyNight } from "@/experience-lab/fixtures/hockeyNight";
import type { Prompt } from "@/experience-lab/core/types";
import { countdown, gameWhen } from "./countdown";
import { planItems } from "./plan";
import { answerText, pickProgress, verdictFor } from "./reveal";
import { OPPONENTS } from "./schedule";
import { defaultTab, tabOfBlock } from "./tabs";
import { dressed, teamColours } from "./teams";

describe("team colours", () => {
  it("dresses every opponent a night can be started against", () => {
    expect(dressed()).toHaveLength(OPPONENTS.length);
    expect(teamColours("Canucks").abbr).toBe("VAN");
    expect(teamColours("Wild").abbr).toBe("MIN");
  });

  it("gives a name it does not know a plain kit, not somebody else's", () => {
    const kit = teamColours("Seals");
    expect(kit.abbr).toBe("SEA");
    expect(kit.primary).not.toBe(teamColours("Kraken").primary);
  });
});

describe("the countdown", () => {
  const anchor = new Date("2026-10-26T02:00:00Z");

  it("rounds down, and shows days only while there are any", () => {
    const c = countdown(new Date("2026-10-22T00:59:30Z"), anchor);
    expect(c.units.map((u) => `${u.value} ${u.unit}`)).toEqual([
      "4 days",
      "01 hrs",
      "00 min",
    ]);
  });

  it("counts seconds in the last hour, and stops at zero", () => {
    expect(
      countdown(new Date("2026-10-26T01:15:05Z"), anchor).units.map(
        (u) => u.value,
      ),
    ).toEqual(["44", "55"]);
    expect(countdown(new Date("2026-10-26T03:00:00Z"), anchor).past).toBe(true);
  });

  it("says the time the arena says", () => {
    expect(gameWhen(anchor)).toMatch(/Sun.*Oct.*25.*7:00/);
  });
});

describe("which room a block lives in", () => {
  const room = (id: string) =>
    tabOfBlock(hockeyNight.blocks.find((b) => b.id === id)!);

  it("puts every block in exactly one tab, by what it is for", () => {
    expect(room("pregame")).toBe("plan");
    expect(room("postgame-block")).toBe("plan");
    expect(room("again")).toBe("plan");
    expect(room("picks")).toBe("play");
    expect(room("int1-block")).toBe("play");
    expect(room("int2-block")).toBe("play");
    expect(room("cup")).toBe("play");
    expect(room("recap")).toBe("play");
    expect(room("feed")).toBe("chat");
    expect(room("roster")).toBe("group");
  });

  it("opens on the plan, except in an intermission and the morning after", () => {
    expect(defaultTab("before")).toBe("plan");
    expect(defaultTab("warmup")).toBe("plan");
    expect(defaultTab("int1")).toBe("play");
    expect(defaultTab("after")).toBe("plan");
    expect(defaultTab("morning")).toBe("play");
    expect(defaultTab("again")).toBe("plan");
  });
});

describe("the reveal", () => {
  const prompt = (id: string) =>
    hockeyNight.prompts.find((p) => p.id === id) as Prompt;
  const people = [{ id: "u1", name: "Maya" }];

  it("says an answer the way you would say it", () => {
    expect(answerText(prompt("final-score"), [4, 2])).toBe("4–2");
    expect(answerText(prompt("overtime"), false)).toBe("No");
    expect(answerText(prompt("total-goals"), 6)).toBe("6 goals");
    expect(answerText(prompt("first-team"), "canucks")).toBe("Canucks");
    expect(answerText({ kind: "person" }, "u1", people)).toBe("Maya");
  });

  it("agrees with the Cup about right, half right and wrong", () => {
    const live = { prompt: prompt("final-score"), showResolution: true };
    const r = (value: [number, number]) => ({
      promptId: "final-score",
      participantId: "u1",
      value,
      at: "",
    });
    // The fixture's final is 4–3.
    expect(verdictFor(live, r([4, 3]))).toBe("exact");
    expect(verdictFor(live, r([5, 1]))).toBe("partial");
    expect(verdictFor(live, r([1, 5]))).toBe("wrong");
    expect(verdictFor({ ...live, showResolution: false }, r([4, 3]))).toBe(
      "open",
    );
  });

  it("counts my sealed picks", () => {
    const p = (answered: boolean, open = true) =>
      ({ myResponse: answered ? {} : undefined, open }) as never;
    expect(pickProgress([p(true), p(false), p(true)])).toEqual({
      total: 3,
      mine: 2,
      open: true,
    });
  });
});

describe("the group's plan, live", () => {
  const vote = (
    id: string,
    tally: [string, number][],
    mine?: string,
    reveal: Prompt["reveal"] = "immediate",
  ) => ({
    prompt: { id, reveal },
    locked: false,
    myResponse: mine ? { value: mine } : undefined,
    tally: tally.map(([label, n]) => ({
      optionId: label.toLowerCase(),
      label,
      voters: Array.from({ length: n }),
    })),
  });

  it("names the leader, keeps a tie a tie, and says nobody when nobody", () => {
    const items = planItems([
      vote(
        "pregame-spot",
        [
          ["Chambar", 2],
          ["Shark Club", 1],
        ],
        "chambar",
      ),
      vote("hard-out", [
        ["One", 1],
        ["Close", 1],
      ]),
      vote("meet-spot", [["Station", 0]]),
    ]);
    expect(items.map((i) => [i.label, i.leaders, i.votes])).toEqual([
      ["Eating", ["Chambar"], 2],
      ["Meeting", [], 0],
      ["Leaving", ["One", "Close"], 1],
    ]);
    expect(items[0].mine).toBe("Chambar");
    expect(items[0].voters).toBe(3);
  });

  it("says which vote answers each decision, and what's waiting on me", async () => {
    const { decisionVote, needsMyVote, voteValue } = await import("./plan");
    const items = planItems([
      vote("pregame-spot", [["Chambar", 1]], "chambar"),
      vote("hard-out", [
        ["One", 1],
        ["Close", 1],
      ]),
      vote("postgame", [["Keep going", 2]]),
    ]);
    expect(decisionVote("before", items, false)?.id).toBe("pregame-spot");
    expect(decisionVote("meeting", items, false)).toBeUndefined();
    expect(decisionVote("seats", items, false)).toBeUndefined();
    // How people are leaving until the game is over, then where we go next.
    expect(decisionVote("after", items, false)?.id).toBe("hard-out");
    expect(decisionVote("after", items, true)?.id).toBe("postgame");

    expect(items.map(voteValue)).toEqual([
      "Chambar",
      "Tied: One / Close",
      "Keep going",
    ]);
    expect(voteValue(planItems([vote("meet-spot", [["Station", 0]])])[0])).toBe(
      "No votes yet",
    );
    expect(items.map(needsMyVote)).toEqual([false, true, true]);
    expect(needsMyVote({ ...items[1], locked: true })).toBe(false);
    expect(needsMyVote({ ...items[1], open: false })).toBe(false);
  });

  it("never reads a sealed question into the plan", () => {
    expect(
      planItems([vote("pregame-spot", [["Secret", 3]], undefined, "onLock")]),
    ).toEqual([]);
  });
});

describe("the matchup", () => {
  it("reads the subtitle composeNight writes", async () => {
    const { matchupOf } = await import("./teams");
    expect(matchupOf("Canucks vs Golden Knights")).toEqual({
      home: "Canucks",
      away: "Golden Knights",
    });
    expect(matchupOf("Canucks")).toEqual({ home: "Canucks", away: "Away" });
  });
});
