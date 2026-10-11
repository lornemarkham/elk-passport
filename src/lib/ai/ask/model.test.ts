import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const { fillGaps, readAskWithModel } = await import("./model");
const { readAsk } = await import("./read");

const context = { today: "2026-10-11", verbs: ["Hiking", "Playground"] };
const reply = (content: unknown) =>
  create.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(content) } }],
  });

/**
 * **A model fills gaps; it never overrules what was said and never names a
 * place.** Every rule here runs without a key.
 */
describe("filling the gaps a sentence left", () => {
  it("keeps everything the words found", () => {
    const floor = readAsk("three hours with my 6 year old", context);
    const filled = fillGaps(
      floor,
      { hours: 8, childAge: 2, company: "group", lens: "drive" },
      context,
    );
    expect(filled.hours).toBe(3);
    expect(filled.childAge).toBe(6);
    expect(filled.company).toBe("child");
    expect(filled.lens).toBe("kids");
  });

  it("fills what the words did not find", () => {
    const floor = readAsk("burn off the little monsters' energy", context);
    const filled = fillGaps(
      floor,
      {
        company: "child",
        day: "today",
        hours: 2,
        doing: "playground",
        shelter: "outdoor",
      },
      context,
    );
    expect(filled).toMatchObject({
      company: "child",
      on: "2026-10-11",
      hours: 2,
      window: "half-day",
      doing: "Playground",
      shelter: "outdoor",
    });
  });

  it("drops a verb Atlas does not offer and a town it does not know", () => {
    const floor = readAsk("something", context);
    const filled = fillGaps(
      floor,
      { doing: "bowling", town: "Atlantis" },
      context,
    );
    expect(filled.doing).toBeUndefined();
    expect(filled.townId).toBeUndefined();
  });

  it("accepts a real town however it is written", () => {
    const filled = fillGaps(
      readAsk("something", context),
      { town: "Vernon, BC" },
      context,
    );
    expect(filled.townId).toBe("vernon");
  });
});

describe("asking a model, where one is configured", () => {
  const key = process.env.OPENAI_API_KEY;
  beforeEach(() => create.mockReset());
  afterEach(() => {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  });

  it("is never asked without a key", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await readAskWithModel("three hours", context);
    expect(result.by).toBe("words");
    expect(result.ask.hours).toBe(3);
    expect(create).not.toHaveBeenCalled();
  });

  it("fills the reading when it answers in shape", async () => {
    process.env.OPENAI_API_KEY = "test";
    reply({ company: "child", lens: "kids" });
    const result = await readAskWithModel("tire out the twins", context);
    expect(result.by).toBe("model");
    expect(result.ask).toMatchObject({ company: "child", lens: "kids" });
  });

  it("falls back to the words on anything out of shape", async () => {
    process.env.OPENAI_API_KEY = "test";
    reply({ company: "a dragon" });
    const result = await readAskWithModel("three hours", context);
    expect(result).toEqual({
      by: "words",
      ask: readAsk("three hours", context),
    });
  });

  it("falls back to the words when the call fails", async () => {
    process.env.OPENAI_API_KEY = "test";
    create.mockRejectedValueOnce(new Error("timeout"));
    const result = await readAskWithModel("three hours", context);
    expect(result.by).toBe("words");
  });
});
