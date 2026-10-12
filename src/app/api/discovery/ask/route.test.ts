import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(
    new Request("http://passport.test/api/discovery/ask", {
      method: "POST",
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
