import { afterEach, describe, expect, it, vi } from "vitest";
import { isSignedOut } from "@/lib/data/boards-repo";
import { didThis, wantToDo } from "./october-repo";

function respondWith(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (...args: [url: string, init?: RequestInit]) => {
      void args;
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

describe("keeping a thing for October", () => {
  it("asks Passport, never Atlas, and never names an owner", async () => {
    const fetchMock = respondWith(201, { entityId: "e1" });
    await wantToDo({
      entityId: "e1",
      entityKind: "Event",
      name: "Fest",
      startsAt: "2026-10-09T00:00:00Z",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/october/things/e1");
    expect(String(init?.body)).not.toContain("user");
    expect(String(init?.body)).not.toContain("owner");
  });

  it("is a signed-out answer, not a failure, when there is no session", async () => {
    respondWith(401, { error: "signed-out", message: "Sign in to keep this." });
    const error = await didThis("e1").catch((e) => e);
    expect(isSignedOut(error)).toBe(true);
  });
});
