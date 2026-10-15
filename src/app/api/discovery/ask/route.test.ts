import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { POST } = await import("./route");

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://passport.test/api/discovery/ask", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );

/**
 * **Reading a question on the server.** Without a key it answers with the
 * same deterministic reading the browser has; it refuses anything that is
 * not a question and a day.
 */
describe("POST /api/discovery/ask", () => {
  it("reads the sentence with the words alone when no model is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await post({
      said: "three hours with my kid",
      today: "2026-10-11",
      verbs: ["Hiking"],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.by).toBe("words");
    expect(body.ask).toMatchObject({ hours: 3, company: "child" });
  });

  it("refuses an empty, overlong or dateless question", async () => {
    expect((await post({ said: "", today: "2026-10-11" })).status).toBe(400);
    expect(
      (await post({ said: "x".repeat(301), today: "2026-10-11" })).status,
    ).toBe(400);
    expect((await post({ said: "three hours" })).status).toBe(400);
    expect(
      (
        await POST(
          new Request("http://passport.test/api/discovery/ask", {
            method: "POST",
            body: "not json",
          }),
        )
      ).status,
    ).toBe(400);
  });
});

/**
 * **A request here can spend OpenAI quota**, so it is bounded: one origin,
 * and a count per client that refuses with the same 429 the travel routes use.
 */
describe("POST /api/discovery/ask — who may ask, and how often", () => {
  const question = { said: "three hours with my kid", today: "2026-10-11" };

  it("refuses a page on another site", async () => {
    const response = await post(question, {
      origin: "https://elsewhere.example",
      "sec-fetch-site": "cross-site",
      "x-forwarded-for": "203.0.113.50",
    });
    expect(response.status).toBe(403);
  });

  it("answers 429 with Retry-After once a client has asked too often, and keeps answering others", async () => {
    const heavy = { "x-forwarded-for": "203.0.113.7" };
    const statuses: number[] = [];
    for (let i = 0; i < 14; i += 1)
      statuses.push((await post(question, heavy)).status);
    expect(statuses.slice(0, 12).every((status) => status === 200)).toBe(true);
    expect(statuses.slice(12)).toEqual([429, 429]);

    const refused = await post(question, heavy);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(refused.headers.get("Cache-Control")).toBe("no-store");
    expect(await refused.json()).toMatchObject({ error: "rate-limited" });

    const other = await post(question, { "x-forwarded-for": "203.0.113.8" });
    expect(other.status).toBe(200);
  });

  it("does not count a malformed request against the limit", async () => {
    const quiet = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 20; i += 1)
      expect((await post({ said: "" }, quiet)).status).toBe(400);
    expect((await post(question, quiet)).status).toBe(200);
  });
});
