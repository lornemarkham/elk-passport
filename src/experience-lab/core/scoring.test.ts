import { describe, expect, it } from "vitest";
import { grantAwards, scorePrompt, standings } from "./scoring";
import { shareStandings } from "./share";
import { hockeyNight } from "../fixtures";
import type { Award, Participant, Prompt, Response } from "./types";

const people: Participant[] = [
  { id: "a", name: "Ana", emoji: "🅰️", hue: 10, present: true },
  { id: "b", name: "Bo", emoji: "🅱️", hue: 120, present: true },
  { id: "c", name: "Cy", emoji: "©️", hue: 240, present: true },
];

const scored = (over: Partial<Prompt> = {}): Prompt => ({
  id: "p",
  question: "Final score",
  kind: "pair",
  pairLabels: ["Home", "Away"],
  phaseId: "before",
  reveal: "onLock",
  scoring: { points: 5, partial: { points: 2, label: "Right winner" } },
  resolution: [4, 3],
  ...over,
});

const answer = (participantId: string, value: Response["value"]): Response => ({
  promptId: "p",
  participantId,
  value,
  at: "2026-01-01T00:00:00.000Z",
});

describe("scorePrompt", () => {
  it("awards full points for an exact answer", () => {
    expect(scorePrompt(scored(), answer("a", [4, 3]))?.points).toBe(5);
  });

  it("awards partial points for the right winner and the wrong score", () => {
    const line = scorePrompt(scored(), answer("a", [2, 1]));
    expect(line?.points).toBe(2);
    expect(line?.kind).toBe("partial");
  });

  it("awards nothing for the wrong winner", () => {
    expect(scorePrompt(scored(), answer("a", [1, 5]))).toBeNull();
  });

  it("awards nothing while the answer is not yet known", () => {
    // The engine strips `resolution` until the resolving phase arrives; a
    // question nobody can grade yet must not quietly score as wrong.
    expect(
      scorePrompt(scored({ resolution: undefined }), answer("a", [4, 3])),
    ).toBeNull();
  });

  it("ignores a question with nothing at stake", () => {
    expect(
      scorePrompt(scored({ scoring: undefined }), answer("a", [4, 3])),
    ).toBeNull();
  });
});

describe("standings", () => {
  it("is empty when no question carries points — this is how a date night has no leaderboard", () => {
    const vote: Prompt = {
      id: "p",
      question: "Where to?",
      kind: "choice",
      phaseId: "before",
      reveal: "immediate",
    };
    expect(standings(people, [vote], [answer("a", "x")])).toEqual([]);
  });

  it("ranks by points, then by exact calls", () => {
    const table = standings(
      people,
      [scored()],
      [answer("a", [4, 3]), answer("b", [1, 0]), answer("c", [0, 9])],
    );
    expect(table.map((row) => row.participant.id)).toEqual(["a", "b", "c"]);
    expect(table.map((row) => row.points)).toEqual([5, 2, 0]);
    expect(table[0].rank).toBe(1);
  });

  it("counts somebody who answered nothing, rather than omitting them", () => {
    const table = standings(people, [scored()], [answer("a", [4, 3])]);
    expect(table).toHaveLength(3);
    expect(table[2].answered).toBe(0);
  });
});

describe("grantAwards", () => {
  const awards: Award[] = [
    { id: "top", label: "Champion", emoji: "🏆", basis: "top", blurb: "" },
    { id: "low", label: "Potato", emoji: "🥔", basis: "bottom", blurb: "" },
    {
      id: "exact",
      label: "Prophet",
      emoji: "🎯",
      basis: "mostExact",
      blurb: "",
    },
    {
      id: "bold",
      label: "Boldest wrong",
      emoji: "🤡",
      basis: "boldest",
      blurb: "",
    },
  ];

  it("does not let one person collect every title", () => {
    const responses = [
      answer("a", [4, 3]),
      answer("b", [2, 1]),
      answer("c", [0, 8]),
    ];
    const table = standings(people, [scored()], responses);
    const granted = grantAwards(awards, table, responses);
    const winners = granted.map((g) => g.participant.id);
    expect(new Set(winners).size).toBe(winners.length);
  });

  it("never gives the boldest-wrong title to somebody who was right", () => {
    const responses = [
      answer("a", [4, 3]),
      answer("b", [2, 1]),
      answer("c", [0, 8]),
    ];
    const table = standings(people, [scored()], responses);
    const bold = grantAwards(awards, table, responses).find(
      (g) => g.award.id === "bold",
    );
    expect(bold?.participant.id).not.toBe("a");
  });

  it("withholds a title nobody earned", () => {
    const responses = [answer("a", [1, 0]), answer("b", [2, 1])];
    const table = standings(people, [scored()], responses);
    const granted = grantAwards(awards, table, responses);
    expect(granted.some((g) => g.award.id === "exact")).toBe(false);
  });
});

describe("shareStandings", () => {
  it("says nothing while nobody has scored", () => {
    const table = standings(people, [scored({ resolution: undefined })], []);
    expect(shareStandings(hockeyNight, table, false)).toBeNull();
  });

  it("announces a leader while the night is still running", () => {
    const table = standings(people, [scored()], [answer("a", [4, 3])]);
    const text = shareStandings(hockeyNight, table, false)!;
    expect(text).toContain("ANA HAS TAKEN THE LEAD");
    expect(text).toContain("Ana 5");
    expect(text).toContain("Cy 0");
  });

  it("announces a winner once every question is answered", () => {
    const table = standings(people, [scored()], [answer("a", [4, 3])]);
    expect(shareStandings(hockeyNight, table, true)).toContain("ANA WINS");
  });
});
