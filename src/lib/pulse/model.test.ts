import { describe, expect, it } from "vitest";
import { checkDraft, checkScope, cleanCity, newId, textProblem } from "./model";

const NOW = new Date("2026-11-18T18:00:00Z");
const ok = (input: Parameters<typeof checkDraft>[0]) => {
  const r = checkDraft(input, NOW);
  if (!r.ok) throw new Error(`${r.field}: ${r.message}`);
  return r.draft;
};
const why = (input: Parameters<typeof checkDraft>[0]) => {
  const r = checkDraft(input, NOW);
  if (r.ok) throw new Error("expected a refusal");
  return r;
};

describe("creating a Pulse", () => {
  it("accepts the simplest Pulse: a question and Yes/No, scoped to Canada", () => {
    const d = ok({
      question: "Should Canada adopt year-round daylight time?",
      options: ["Yes", "No"],
    });
    expect(d.options).toEqual([
      { id: "o1", label: "Yes" },
      { id: "o2", label: "No" },
    ]);
    expect(d.scope).toEqual({ kind: "canada" });
    expect(d.claim).toBeNull();
    expect(d.expiresAt).toBeNull();
  });

  it("cleans whitespace and needs two to six distinct answers", () => {
    expect(
      ok({
        question: "  Best   Okanagan  lake?  ",
        options: [" Kal ", "Okanagan", "Wood", ""],
      }).question,
    ).toBe("Best Okanagan lake?");
    expect(
      why({ question: "Best Okanagan lake?", options: ["Kal"] }).field,
    ).toBe("options");
    expect(
      why({ question: "Best Okanagan lake?", options: ["Kal", "kal"] }).message,
    ).toMatch(/different/);
    expect(
      why({
        question: "Best Okanagan lake?",
        options: ["a", "b", "c", "d", "e", "f", "g"],
      }).field,
    ).toBe("options");
    expect(why({ question: "Hm?", options: ["Yes", "No"] }).field).toBe(
      "question",
    );
  });

  it("refuses personal information, links outside the source field, and attacks", () => {
    expect(
      why({
        question: "Should I call Dave at 250-555-0199 about this?",
        options: ["Yes", "No"],
      }).message,
    ).toMatch(/personal/);
    expect(
      why({
        question: "Is jane.doe@example.com right about the bylaw?",
        options: ["Yes", "No"],
      }).field,
    ).toBe("question");
    expect(
      why({
        question: "Is this fair?",
        options: ["Yes", "No"],
        description: "Read www.spam.example/now",
      }).field,
    ).toBe("description");
    expect(textProblem("He should be shot for that")).toBe("abuse");
    expect(textProblem("Lives at 1234 Maple Street")).toBe("personal-info");
    expect(textProblem("Postal code V1T 2K4")).toBe("personal-info");
    expect(
      textProblem("Should Vernon build a second sheet of ice by 2030?"),
    ).toBeNull();
  });

  it("requires attribution for a published statistic", () => {
    const base = {
      question: "Do you support a second sheet of ice?",
      options: ["Yes", "No"],
    };
    expect(
      why({
        ...base,
        claim: { text: "An article reports 65% support it.", percent: 65 },
      }).message,
    ).toMatch(/published/);
    expect(
      why({
        ...base,
        claim: {
          text: "An article reports 65% support it.",
          percent: 65,
          source: "Morning Star",
        },
      }).message,
    ).toMatch(/Link/);
    expect(
      why({
        ...base,
        claim: {
          text: "x".repeat(10),
          percent: 140,
          source: "S",
          url: "https://a.ca/x",
        },
      }).message,
    ).toMatch(/0 to 100/);
    const d = ok({
      ...base,
      claim: {
        text: "An article reports that 65% support a second sheet.",
        percent: "65",
        optionId: "o1",
        source: "Vernon Morning Star",
        url: "https://www.vernonmorningstar.com/news/ice",
      },
    });
    expect(d.claim).toEqual({
      text: "An article reports that 65% support a second sheet.",
      percent: 65,
      optionId: "o1",
      source: "Vernon Morning Star",
      url: "https://www.vernonmorningstar.com/news/ice",
    });
  });

  it("an empty claim block is no claim", () => {
    expect(
      ok({
        question: "Is transit good here?",
        options: ["Yes", "No"],
        claim: { text: "", percent: "", source: "", url: "" },
      }).claim,
    ).toBeNull();
  });

  it("takes a province or city scope and an end date at least an hour out", () => {
    expect(checkScope({ kind: "province", province: "BC" })).toEqual({
      kind: "province",
      province: "BC",
    });
    expect(
      checkScope({ kind: "city", province: "BC", city: "  north VANCOUVER " }),
    ).toEqual({
      kind: "city",
      province: "BC",
      city: "North Vancouver",
    });
    expect(checkScope({ kind: "province", province: "XX" })).toBeNull();
    const base = { question: "Is transit good here?", options: ["Yes", "No"] };
    expect(why({ ...base, expiresAt: "2026-11-18T18:30:00Z" }).field).toBe(
      "expiresAt",
    );
    expect(ok({ ...base, expiresAt: "2026-11-25T18:00:00Z" }).expiresAt).toBe(
      "2026-11-25T18:00:00.000Z",
    );
  });

  it("cleans a city name or refuses it", () => {
    expect(cleanCity("vernon")).toBe("Vernon");
    expect(cleanCity("<script>")).toBe("Script");
    expect(cleanCity("1")).toBeNull();
  });

  it("makes 8-character ids from an unambiguous alphabet", () => {
    const id = newId(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 255]));
    expect(id).toMatch(/^[a-z2-9]{8}$/);
    expect(id).not.toMatch(/[lo01]/);
  });
});
