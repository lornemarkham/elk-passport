import { describe, expect, it } from "vitest";
import { liveExperience } from "@/experience-lab/core/engine";
import { scorePrompt } from "@/experience-lab/core/scoring";
import { observe } from "@/experience-lab/core/voice";
import type { Prompt } from "@/experience-lab/core/types";
import { hockeyNight } from "@/experience-lab/fixtures/hockeyNight";
import { renderBotRow, type BotRow } from "./chirp";
import { PICKS_LINES } from "./chirp-library";
import { spectacularlyWrong } from "./cup";
import { composeNight, templatePrompts, SYCLE_HOCKEY_NIGHT } from "./night";
import { readGame, suggestedCalls } from "./nhl";
import { answerText } from "./reveal";
import { chooseGame } from "./schedule";
import { pairFromKey, scoreWords, sidesOf, winnerOf } from "./score";

/**
 * **A prediction means the same thing everywhere.**
 *
 * On 25 October 2026 (Canucks vs Wild, Rogers Arena) the host meant "the
 * Wild win 5–0" and Alex meant "the Wild win 4–2"; the page showed bare
 * pairs and the room read them the other way round. The league's record of
 * that game (api-web.nhle.com, gamecenter 2026020184, read 2026-11-01) has
 * the Wild winning 4–2: home VAN 2, away MIN 4. These tests pin the one
 * convention — **stored `[home, away]`, always said with both codes** — at
 * every place a score is entered, suggested, scored or said.
 */

/** The league's record of the real game, trimmed to what `readGame` reads. */
const LEAGUE_RECORD = {
  id: 2026020184,
  gameState: "OFF",
  periodDescriptor: { number: 3, periodType: "REG" },
  homeTeam: { abbrev: "VAN", score: 2, commonName: { default: "Canucks" } },
  awayTeam: { abbrev: "MIN", score: 4, commonName: { default: "Wild" } },
  summary: {
    scoring: [
      {
        periodDescriptor: { number: 1, periodType: "REG" },
        goals: [
          {
            isHome: false,
            teamAbbrev: { default: "MIN" },
            name: { default: "M. Shabanov" },
            timeInPeriod: "18:33",
          },
        ],
      },
      {
        periodDescriptor: { number: 2, periodType: "REG" },
        goals: [
          {
            isHome: false,
            teamAbbrev: { default: "MIN" },
            name: { default: "B. Brink" },
            timeInPeriod: "05:54",
          },
          {
            isHome: false,
            teamAbbrev: { default: "MIN" },
            name: { default: "Q. Hughes" },
            timeInPeriod: "12:55",
          },
        ],
      },
      {
        periodDescriptor: { number: 3, periodType: "REG" },
        goals: [
          {
            isHome: false,
            teamAbbrev: { default: "MIN" },
            name: { default: "K. Kaprizov" },
            timeInPeriod: "03:38",
          },
          {
            isHome: true,
            teamAbbrev: { default: "VAN" },
            name: { default: "M. Sasson" },
            timeInPeriod: "06:24",
          },
          {
            isHome: true,
            teamAbbrev: { default: "VAN" },
            name: { default: "B. Boeser" },
            timeInPeriod: "16:53",
          },
        ],
      },
    ],
  },
};

const WILD_WIN_4_2: [number, number] = [2, 4]; // VAN 2, MIN 4
const SIDES = { home: "Canucks", away: "Wild" };

function finalScorePrompt(): Prompt {
  const prompts = templatePrompts(SYCLE_HOCKEY_NIGHT.details, "Lorne", [
    { id: "u1", name: "Lorne", emoji: "🧭", hue: 10, present: true },
  ]);
  const p = prompts.find((x) => x.id === "final-score");
  if (!p) throw new Error("no final-score prompt");
  return p;
}

describe("the score's one convention", () => {
  it("names both codes around the numbers, home first", () => {
    expect(scoreWords(WILD_WIN_4_2, SIDES)).toBe("VAN 2–4 MIN");
    expect(scoreWords(WILD_WIN_4_2, SIDES, "name")).toBe("Canucks 2–4 Wild");
    expect(scoreWords([5, 0], SIDES)).toBe("VAN 5–0 MIN");
  });

  it("never re-orders a stored pick, and says so with no sides", () => {
    expect(scoreWords([2, 4], null)).toBe("2–4");
    expect(winnerOf([2, 4])).toBe("away");
    expect(winnerOf([5, 0])).toBe("home");
    expect(winnerOf([3, 3])).toBe("tie");
  });

  it("reads Chirp Bot's key the same way it was written", () => {
    expect(pairFromKey("5-0")).toEqual([5, 0]);
    expect(pairFromKey("x")).toBeNull();
  });
});

describe("the question itself", () => {
  it("labels the pair home first, from the night's own details", () => {
    const p = finalScorePrompt();
    expect(p.pairLabels).toEqual(["Canucks", "Wild"]);
    expect(sidesOf(p)).toEqual(SIDES);
  });

  it("keeps the labels in the night's order for any opponent a host picks", () => {
    const chosen = chooseGame(
      { opponent: "Oilers", startsAt: "2026-12-01T03:00:00.000Z" },
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    const p = templatePrompts(chosen.details, "Host", []).find(
      (x) => x.id === "final-score",
    );
    expect(p?.pairLabels).toEqual(["Canucks", "Oilers"]);
  });
});

describe("the league's suggestion", () => {
  it("reads the real record home first and says both codes", () => {
    const game = readGame(LEAGUE_RECORD);
    expect(game?.state).toBe("final");
    expect(game?.home).toEqual({ abbrev: "VAN", score: 2 });
    expect(game?.away).toEqual({ abbrev: "MIN", score: 4 });
    const calls = suggestedCalls(game);
    expect(calls["final-score"].value).toEqual(WILD_WIN_4_2);
    expect(calls["final-score"].words).toBe("VAN 2–4 MIN");
    // The Wild scored first: the away option, by the night's option id.
    expect(calls["first-team"].value).toBe("opponent");
    expect(calls["total-goals"].value).toBe(6);
  });
});

describe("scoring the real night", () => {
  const prompt = { ...finalScorePrompt(), resolution: WILD_WIN_4_2 };
  const pick = (value: [number, number]) => ({
    promptId: "final-score",
    participantId: "u1",
    value,
    at: "2026-10-25T20:00:00Z",
  });

  it("Alex meant the Wild 4–2: stored as [2, 4] that is the exact score", () => {
    expect(scorePrompt(prompt, pick([2, 4]))?.kind).toBe("exact");
  });

  it("the host meant the Wild 5–0: stored as [0, 5] that is the right winner", () => {
    expect(scorePrompt(prompt, pick([0, 5]))?.kind).toBe("partial");
  });

  it("the same numbers the other way round are a different prediction", () => {
    expect(scorePrompt(prompt, pick([4, 2]))).toBeNull();
    expect(scorePrompt(prompt, pick([5, 0]))).toBeNull();
  });
});

describe("saying a pick", () => {
  it("the reveal says both codes", () => {
    expect(answerText(finalScorePrompt(), [2, 4])).toBe("VAN 2–4 MIN");
    expect(answerText(finalScorePrompt(), [0, 5])).toBe("VAN 0–5 MIN");
  });

  it("Passport's voice says both names", () => {
    const prompt = finalScorePrompt();
    const people = [
      { id: "u1", name: "Lorne", emoji: "🧭", hue: 10, present: true },
      { id: "u2", name: "Alex", emoji: "🥅", hue: 40, present: true },
    ];
    const lines = observe(
      prompt,
      [
        {
          promptId: "final-score",
          participantId: "u1",
          value: [0, 5],
          at: "a",
        },
        {
          promptId: "final-score",
          participantId: "u2",
          value: [0, 5],
          at: "b",
        },
      ],
      people,
    )
      .map((o) => o.detail ?? "")
      .join(" | ");
    expect(lines).toContain("Canucks 0–5 Wild");
  });

  it("Chirp Bot's sealed-picks line says both codes when told the sides", () => {
    const row: BotRow = {
      id: "m1",
      occasion_id: "o1",
      actor_id: "u1",
      kind: "chirp",
      text: "",
      at: "2026-10-26T02:00:00Z",
      bot_key: "picks:2026-10-26T0200:u1:0-5",
      bot_line: PICKS_LINES[0].id,
      bot_sig: null,
    } as unknown as BotRow;
    const fans = new Map([["u1", { id: "u1", name: "Lorne", team: "CGY" }]]);
    const line = renderBotRow(row, {
      fans: fans as never,
      verify: () => true,
      claimHolds: () => true,
      sides: SIDES,
    });
    expect(line?.text).toContain("VAN 0–5 MIN");
  });

  it("the spectacularly wrong line says both codes for the pick and the final", () => {
    // The fixture night with two picks and the real final called.
    const prompt = finalScorePrompt();
    const definition = {
      ...hockeyNight,
      anchorAt: "2026-10-26T02:00:00.000Z",
      seedResponses: [],
      seedMoments: [],
      prompts: [{ ...prompt, resolution: WILD_WIN_4_2 }],
      participants: [
        { id: "u1", name: "Lorne", emoji: "🧭", hue: 10, present: true },
        { id: "u2", name: "Alex", emoji: "🥅", hue: 40, present: true },
      ],
    };
    const state = {
      slug: "x",
      meId: "u1",
      joinedIds: ["u1", "u2"],
      responses: [
        {
          promptId: "final-score",
          participantId: "u1",
          value: [5, 0],
          at: "a",
        },
        {
          promptId: "final-score",
          participantId: "u2",
          value: [2, 4],
          at: "b",
        },
      ],
      moments: [],
      addedOptions: [],
      addedPrompts: [],
      reactions: {},
      lurking: false,
      brief: null,
    };
    const live = liveExperience(
      definition as never,
      state as never,
      new Date("2026-10-26T05:00:00Z"),
    );
    const worst = spectacularlyWrong(live);
    expect(worst?.participant.name).toBe("Lorne");
    expect(worst?.pick).toBe("VAN 5–0 MIN");
    expect(worst?.actual).toBe("VAN 2–4 MIN");
  });
});

// composeNight is exercised by night.test.ts; it is imported here so a
// rename of the adapter breaks this file too, which is the right failure.
void composeNight;
