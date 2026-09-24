import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlaceDetail, getSubjectDetail } from "./atlas-repo";

/**
 * **Passport asks Atlas one public question.**
 *
 * The traveller page used to build the subject graph itself out of
 * `/admin/entities` and `/admin/relationships` — an admin token in a page a
 * visitor opens, and a uuid join Passport had no business performing. These
 * pin what replaced it, and that nothing here reaches an admin route.
 */
function respondWith(status: number, body?: unknown) {
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

const composition = {
  root: {
    id: "bmhh",
    kind: "Organization",
    name: "Black Mountain Haunted House",
    description: "",
    keyFacts: [],
    temporal: { policyVersion: 1, claims: [], asOf: {}, withheld: 0 },
    when: [],
    related: [],
    depth: 0,
  },
  sources: [],
  verbs: ["offers", "includes", "hosts"],
  maxDepth: 2,
};

describe("getSubjectDetail", () => {
  it("asks Atlas's public composed read for an Organization", async () => {
    const fetchMock = respondWith(200, composition);
    const result = await getSubjectDetail("organizations", "bmhh");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://localhost:3000/organizations/bmhh/detail",
    );
    expect(result?.root.name).toBe("Black Mountain Haunted House");
  });

  it("uses the same read for an Experience", async () => {
    const fetchMock = respondWith(200, composition);
    await getSubjectDetail("experiences", "exp-black-mountain-evening-haunt");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://localhost:3000/experiences/exp-black-mountain-evening-haunt/detail",
    );
  });

  it("hands an explicit day to Atlas rather than answering it here", async () => {
    const fetchMock = respondWith(200, composition);
    await getSubjectDetail("organizations", "bmhh", "2026-10-16");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://localhost:3000/organizations/bmhh/detail?on=2026-10-16",
    );
  });

  it("never reaches an admin route or a relationship table", async () => {
    const fetchMock = respondWith(200, composition);
    await getSubjectDetail("organizations", "bmhh", "2026-10-16");

    for (const [url] of fetchMock.mock.calls) {
      expect(url).not.toMatch(/\/admin\//);
      expect(url).not.toMatch(/relationships/);
    }
    expect(fetchMock.mock.calls.every(([, init]) => !init?.headers)).toBe(true);
  });

  it("returns null when there is no such subject, or the id is another kind", async () => {
    respondWith(404, { error: "No Organization with id evening" });
    expect(await getSubjectDetail("organizations", "evening")).toBeNull();

    respondWith(400, { error: 'Invalid "on"' });
    expect(await getSubjectDetail("organizations", "bmhh", "today")).toBeNull();
  });

  it("still throws when Atlas fails, rather than rendering an empty subject", async () => {
    respondWith(500, { error: "boom" });
    await expect(getSubjectDetail("organizations", "bmhh")).rejects.toThrow(
      /Failed to load subject detail/,
    );
  });

  it("leaves the Place detail read exactly where it was", async () => {
    const fetchMock = respondWith(200, { place: { id: "kal" } });
    await getPlaceDetail("kal");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://localhost:3000/places/kal/detail",
    );
  });
});
