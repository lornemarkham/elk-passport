import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const { askModel, modelConfigured, scrub } = await import("./chirp-ai");

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

describe("asking a model for Chirp Bot's words", () => {
  it("asks nothing without a key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(modelConfigured()).toBe(false);
    expect(await askModel("hi", "lorne")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("sends the persona as the system message, server side, and returns the JSON", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    create.mockResolvedValue({
      choices: [{ message: { content: '{"line":"ok"}' } }],
    });
    expect(await askModel("hello", "person-a", 0)).toBe('{"line":"ok"}');
    const body = create.mock.calls[0][0];
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[0].content).toMatch(/CHIRP BOT/);
    expect(body.messages[0].content).toMatch(/Never a person's body/);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("returns null on any failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    create.mockRejectedValue(new Error("timeout"));
    expect(await askModel("hello", "person-b", 0)).toBeNull();
  });

  it("stops asking for one person after six in ten minutes", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    create.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    for (let i = 0; i < 6; i += 1)
      expect(await askModel("x", "person-c", 1000 + i)).toBe("{}");
    expect(await askModel("x", "person-c", 2000)).toBeNull();
    expect(create).toHaveBeenCalledTimes(6);
    // Somebody else is unaffected; the same person recovers after the window.
    expect(await askModel("x", "person-d", 2000)).toBe("{}");
    expect(await askModel("x", "person-c", 1000 + 10 * 60_000 + 1)).toBe("{}");
  });

  it("asks in a shape reasoning models accept, with the effort the deploy sets", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_CHIRP_REASONING_EFFORT", "none");
    create.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await askModel("x", "person-e", 0);
    const body = create.mock.calls[0][0];
    expect(body.max_completion_tokens).toBe(300);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body.reasoning_effort).toBe("none");
    vi.stubEnv("OPENAI_CHIRP_REASONING_EFFORT", "turbo; drop table");
    await askModel("x", "person-e", 1);
    expect(create.mock.calls[1][0]).not.toHaveProperty("reasoning_effort");
  });

  it("treats an empty answer as no answer, and says why without the key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    create.mockResolvedValue({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
    });
    expect(await askModel("x", "person-f", 0)).toBeNull();
    expect(warn.mock.calls.flat().join(" ")).toMatch(/cut-off/);
    expect(scrub("Incorrect API key provided: sk-proj-ab***yz.")).toBe(
      "Incorrect API key provided: sk-….",
    );
    warn.mockRestore();
  });
});
