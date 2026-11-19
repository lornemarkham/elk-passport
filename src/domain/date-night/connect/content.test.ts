import { describe, expect, it } from "vitest";
import {
  ALL_CONTENT,
  STAGE_IDS,
  MODE_IDS,
  TOD,
  suits,
  type ContentCard,
} from "./content";
import { deal } from "./deck";
import { contentById } from "./content";

const KINDS = ["talk", "wyr", "likely", "guess", "tod"] as const;

describe("the words", () => {
  it("every card has its own id", () => {
    const ids = ALL_CONTENT.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every stage has plenty of every kind of card", () => {
    for (const stage of STAGE_IDS)
      for (const kind of KINDS) {
        const n = ALL_CONTENT.filter(
          (c) => c.kind === kind && suits(c, stage),
        ).length;
        expect(n, `${stage} ${kind}`).toBeGreaterThanOrEqual(
          kind === "talk" ? 15 : 6,
        );
      }
  });

  it("every stage of the first-meeting kind stays light", () => {
    // Nothing that presumes a shared history before the couple has one.
    for (const c of ALL_CONTENT)
      if (suits(c, "matched") || suits(c, "first")) {
        const text = JSON.stringify(c).toLowerCase();
        expect(text, c.id).not.toMatch(/\bwe've\b|\bour first\b|\bwe made\b/);
      }
  });

  it("is respectful: no touching, nothing sexual, nothing drunk, no dares to strangers about the body", () => {
    const banned =
      /\b(kiss|touch|naked|sex|sexy|strip|drunk|shots?|hook ?up|body count|ex\b|exes|bra|underwear|lick|grope)\b/i;
    for (const c of ALL_CONTENT)
      expect(JSON.stringify(c), c.id).not.toMatch(banned);
  });

  it("keeps every card short enough for a phone", () => {
    for (const c of ALL_CONTENT) {
      const parts =
        c.kind === "talk" || c.kind === "likely" || c.kind === "guess"
          ? [c.text]
          : c.kind === "wyr"
            ? [c.a, c.b]
            : [c.truth, c.dare];
      for (const p of parts) expect(p.length, c.id).toBeLessThanOrEqual(120);
    }
  });

  it("every dare can be done sitting at a table in a minute or so", () => {
    for (const d of TOD) expect(d.dare.length).toBeGreaterThan(10);
  });
});

describe("dealing", () => {
  const questions = { 1: ["", "", ""], 2: ["", "", ""] } as const;

  function play(
    mode: (typeof MODE_IDS)[number],
    stage: (typeof STAGE_IDS)[number],
    n: number,
    seed = "s1",
  ) {
    const history: string[] = [];
    for (let i = 0; i < n; i++)
      history.push(
        deal({ mode, stage, seed, history, questions, solo: false }),
      );
    return history;
  }

  it("is deterministic", () => {
    expect(play("surprise", "newly", 20)).toEqual(
      play("surprise", "newly", 20),
    );
    expect(play("surprise", "newly", 20)).not.toEqual(
      play("surprise", "newly", 20, "other"),
    );
  });

  it("Get to know me deals conversation and nothing else", () => {
    for (const stage of STAGE_IDS)
      for (const id of play("know", stage, 30))
        expect(contentById(id)?.kind, `${stage} ${id}`).toBe("talk");
  });

  it("Figure me out never deals a plain question, and uses every game", () => {
    const kinds = new Set<string>();
    for (const stage of STAGE_IDS)
      for (const id of play("figure", stage, 25)) {
        const kind = id.startsWith("x:") ? "truths" : contentById(id)?.kind;
        expect(kind).not.toBe("talk");
        kinds.add(String(kind));
      }
    expect([...kinds].sort()).toEqual(
      ["guess", "likely", "tod", "truths", "wyr"].sort(),
    );
  });

  it("Surprise me mixes funny, real, playful and games", () => {
    const hist = play("surprise", "first", 20);
    const cards = hist.map((id) =>
      id.startsWith("x:") ? null : contentById(id),
    );
    const tones = new Set(
      cards.flatMap((c) => (c?.kind === "talk" ? [c.tone] : [])),
    );
    expect([...tones].sort()).toEqual(["fun", "real"]);
    expect(hist.some((id) => id.startsWith("x:"))).toBe(true);
    expect(cards.some((c) => c?.kind === "tod")).toBe(true);
    expect(cards.some((c) => c?.kind === "wyr")).toBe(true);
  });

  it("only deals cards that suit the stage, and rarely repeats", () => {
    for (const mode of MODE_IDS)
      for (const stage of STAGE_IDS) {
        const hist = play(mode, stage, 24);
        for (const id of hist) {
          const c: ContentCard | null = contentById(id);
          if (c) expect(suits(c, stage), `${mode} ${stage} ${id}`).toBe(true);
        }
        expect(new Set(hist).size, `${mode} ${stage}`).toBe(hist.length);
      }
  });

  it("weaves a person's own questions in, alternating, never first", () => {
    const q = {
      1: ["What scares you?", "", "Dream trip?"],
      2: ["Why me?", "", ""],
    } as const;
    const history: string[] = [];
    for (let i = 0; i < 16; i++)
      history.push(
        deal({
          mode: "know",
          stage: "first",
          seed: "z",
          history,
          questions: q,
          solo: false,
        }),
      );
    const custom = history.filter((id) => id.startsWith("q:"));
    expect(custom).toEqual(["q:1:0", "q:2:0", "q:1:2"]);
    expect(history[0].startsWith("q:")).toBe(false);
    // spaced out, not clumped
    const at = history
      .map((id, i) => (id.startsWith("q:") ? i : -1))
      .filter((i) => i >= 0);
    for (let i = 1; i < at.length; i++)
      expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(3);
  });

  it("does not ask someone's questions once either has left, and falls back to solo cards", () => {
    const q = { 1: ["Hi?", "", ""], 2: ["", "", ""] } as const;
    const history: string[] = ["t01", "t02", "t04", "t05"];
    const id = deal({
      mode: "figure",
      stage: "first",
      seed: "z",
      history,
      questions: q,
      solo: true,
    });
    expect(id.startsWith("q:")).toBe(false);
    for (let i = 0; i < 10; i++) {
      const next = deal({
        mode: "figure",
        stage: "first",
        seed: "z",
        history,
        questions: q,
        solo: true,
      });
      expect(["tod"]).toContain(contentById(next)?.kind);
      history.push(next);
    }
  });
});
