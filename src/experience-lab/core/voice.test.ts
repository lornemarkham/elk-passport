import { describe, expect, it } from "vitest";
import { commentary, observe, phrase } from "./voice";
import type { Participant, Prompt, Response } from "./types";

const people: Participant[] = [
  { id: "a", name: "Ana", emoji: "🅰️", hue: 10, present: true },
  { id: "b", name: "Bo", emoji: "🅱️", hue: 120, present: true },
  { id: "c", name: "Cy", emoji: "©️", hue: 240, present: true },
  { id: "d", name: "Dee", emoji: "🇩", hue: 300, present: true },
];

const prompt: Prompt = {
  id: "p",
  question: "Where are we going?",
  kind: "choice",
  phaseId: "before",
  reveal: "immediate",
  options: [
    { id: "pub", label: "The pub" },
    { id: "food", label: "Actual food" },
    { id: "home", label: "Home" },
  ],
};

const say = (participantId: string, value: string): Response => ({
  promptId: "p",
  participantId,
  value,
  at: "2026-01-01T00:00:00.000Z",
});

describe("observe", () => {
  it("finds the one person who went somewhere alone", () => {
    const found = observe(
      prompt,
      [say("a", "pub"), say("b", "pub"), say("c", "home")],
      people,
    );
    const lone = found.find((o) => o.kind === "lone");
    expect(lone?.about.map((p) => p.id)).toEqual(["c"]);
    expect(lone?.detail).toBe("Home");
  });

  it("says nothing about a lone answer when only two people have answered", () => {
    const found = observe(prompt, [say("a", "pub"), say("b", "home")], people);
    expect(found.some((o) => o.kind === "lone")).toBe(false);
  });

  it("notices unanimity", () => {
    const found = observe(
      prompt,
      [say("a", "pub"), say("b", "pub"), say("c", "pub")],
      people,
    );
    expect(found[0].kind).toBe("unanimous");
  });

  it("notices who has said nothing", () => {
    const found = observe(prompt, [say("a", "pub"), say("b", "home")], people);
    const silent = found.find((o) => o.kind === "silent");
    expect(silent?.about.map((p) => p.id)).toEqual(["c", "d"]);
  });

  it("says nothing at all about a question nobody has answered", () => {
    expect(observe(prompt, [], people)).toEqual([]);
  });
});

describe("phrase", () => {
  it("says the same observation differently for a rowdy group and for two people", () => {
    const [lone] = observe(
      prompt,
      [say("a", "pub"), say("b", "pub"), say("c", "home")],
      people,
    );
    expect(phrase(lone, "rowdy")).not.toBe(phrase(lone, "intimate"));
    expect(phrase(lone, "rowdy")).toContain("Bold strategy");
    expect(phrase(lone, "intimate")).not.toContain("Bold strategy");
  });
});

describe("commentary", () => {
  it("never repeats the same kind of joke twice in one breath", () => {
    const second: Prompt = { ...prompt, id: "q" };
    const responses = [
      say("a", "pub"),
      say("b", "pub"),
      say("c", "home"),
      { ...say("a", "pub"), promptId: "q" },
      { ...say("b", "pub"), promptId: "q" },
      { ...say("c", "food"), promptId: "q" },
    ];
    const lines = commentary([prompt, second], responses, people, "rowdy");
    const strategies = lines.filter((l) => l.includes("Bold strategy"));
    expect(strategies).toHaveLength(1);
  });

  it("never narrates an answer it promised nobody would see", () => {
    const secret: Prompt = { ...prompt, reveal: "never" };
    const lines = commentary(
      [secret],
      [say("a", "pub"), say("b", "pub"), say("c", "home")],
      people,
      "intimate",
    );
    expect(lines).toEqual([]);
  });
});
