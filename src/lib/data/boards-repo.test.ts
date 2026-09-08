import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBoard,
  isSignedOut,
  listBoards,
  saveExperienceToBoard,
} from "./boards-repo";

/**
 * **The browser asks Passport, and Passport asks Atlas.**
 *
 * These pin the two properties that changed when boards stopped being a
 * free-for-all: the browser no longer names an Atlas host at all, and a
 * signed-out response is a distinguishable thing rather than a generic failure
 * that would have been shown to a visitor as "please try again".
 */
function respondWith(status: number, body: unknown) {
  // Typed by its argument tuple rather than named parameters, so the calls can
  // be inspected without declaring two arguments the body never reads.
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("where board requests go", () => {
  it("calls Passport's own API, never Atlas directly", async () => {
    const fetchMock = respondWith(200, []);

    await listBoards();

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/boards");
    // The old version hardcoded http://localhost:3000, which is both an
    // unauthenticated read of the whole database and a request that cannot
    // succeed from anywhere but this laptop.
    expect(String(url)).not.toContain("localhost:3000");
  });

  it("never sends an ownerId — the server decides whose boards these are", async () => {
    const fetchMock = respondWith(201, { id: "b1" });

    await createBoard("Okanagan weekend");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("ownerId");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Okanagan weekend",
    });
  });
});

describe("a signed-out answer", () => {
  it("is its own kind of error, not a failure", async () => {
    respondWith(401, {
      error: "signed-out",
      message: "Sign in to keep this. Browsing needs no account.",
    });

    const error = await saveExperienceToBoard("b1", "kekuli-bay").catch(
      (caught) => caught,
    );

    expect(isSignedOut(error)).toBe(true);
    expect((error as Error).message).toContain("Sign in to keep this");
  });

  it("is not confused with a real failure", async () => {
    respondWith(500, { error: "boom" });

    const error = await listBoards().catch((caught) => caught);

    expect(isSignedOut(error)).toBe(false);
    expect((error as Error).message).toBe("Failed to load boards.");
  });
});
