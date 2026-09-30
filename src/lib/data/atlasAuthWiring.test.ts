import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **Every server-side road to Atlas carries Passport's identity.**
 *
 * `atlasAuth.test.ts` proves the header is built correctly. This proves each
 * client actually sends it, by intercepting `fetch` and reading what went out
 * — because the failure mode here is not a wrong header, it is a call site
 * somebody forgot, and a unit test of the helper cannot see one of those.
 *
 * Atlas answers `401` to anything unauthenticated, so a missed call site does
 * not fail loudly: it returns nothing, and Passport renders an empty month.
 */
const ORIGINAL = process.env.ATLAS_SERVICE_TOKEN;
const TOKEN = "wiring-test-token";

interface Sent {
  readonly url: string;
  readonly headers: Record<string, string>;
}

let sent: Sent[] = [];

function headersOf(init?: RequestInit): Record<string, string> {
  const raw = init?.headers;
  if (!raw) return {};
  if (raw instanceof Headers) return Object.fromEntries(raw.entries());
  if (Array.isArray(raw)) return Object.fromEntries(raw);
  return { ...(raw as Record<string, string>) };
}

/** Every Atlas response these tests need, keyed loosely by path. */
function bodyFor(url: string): unknown {
  if (url.includes("/discovery/candidates")) return { candidates: [] };
  if (url.includes("/boards")) return [];
  return [];
}

beforeEach(() => {
  process.env.ATLAS_SERVICE_TOKEN = TOKEN;
  process.env.ADMIN_TOKEN = "wiring-admin-token";
  sent = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    sent.push({ url, headers: headersOf(init) });
    return Promise.resolve(
      new Response(JSON.stringify(bodyFor(url)), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  if (ORIGINAL === undefined) delete process.env.ATLAS_SERVICE_TOKEN;
  else process.env.ATLAS_SERVICE_TOKEN = ORIGINAL;
});

const bearer = (s: Sent) => s.headers.Authorization ?? s.headers.authorization;

describe("ordinary product reads", () => {
  it("send the bearer token", async () => {
    const { listDiscoveryCandidates } = await import("./atlas-repo");
    await listDiscoveryCandidates();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toContain("/discovery/candidates");
    expect(bearer(sent[0]!)).toBe(`Bearer ${TOKEN}`);
  });

  it("send it on the composed subject read the detail page depends on", async () => {
    const { getSubjectDetail } = await import("./atlas-repo");
    await getSubjectDetail("events", "some-id");

    expect(bearer(sent[0]!)).toBe(`Bearer ${TOKEN}`);
  });
});

describe("board reads and writes", () => {
  it("send it when listing", async () => {
    const { listBoardsFor } = await import("./boards-server");
    await listBoardsFor("owner-1");

    expect(sent[0]!.url).toContain("/boards");
    expect(bearer(sent[0]!)).toBe(`Bearer ${TOKEN}`);
  });

  it("send it when writing, without losing Content-Type", async () => {
    const { createBoardFor } = await import("./boards-server");
    await createBoardFor("A board", "owner-1");

    expect(bearer(sent[0]!)).toBe(`Bearer ${TOKEN}`);
    expect(sent[0]!.headers["Content-Type"]).toBe("application/json");
  });
});

describe("the fallback recommender", () => {
  it("sends it", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      sent.push({ url, headers: headersOf(init) });
      const place = {
        kind: "Place",
        id: "p1",
        name: "Kelowna",
        description: "A place.",
      };
      return Promise.resolve(
        new Response(JSON.stringify([place]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const { getLocalRecommendation } = await import("@/lib/ai/atlasClient");
    await getLocalRecommendation({
      intent: "Relax",
      constraints: {
        timeAvailable: "Half a day",
        budget: "Some spending money",
        location: "Kelowna",
      },
      dna: { traits: ["Foodie"] },
    } as never);

    expect(sent.length).toBeGreaterThan(0);
    for (const call of sent) expect(bearer(call)).toBe(`Bearer ${TOKEN}`);
  });
});

describe("admin reads", () => {
  it("send both claims: the admin token and the bearer", async () => {
    const { loadWorkspaceBundle } =
      await import("@/lib/knowledge/workspaceData");
    await loadWorkspaceBundle();

    expect(sent.length).toBeGreaterThan(0);
    for (const call of sent) {
      // The service token says this is Passport; the admin token says it may
      // read the corpus. Atlas now asks for both and neither replaces the other.
      expect(call.headers["x-admin-token"]).toBe("wiring-admin-token");
      expect(bearer(call)).toBe(`Bearer ${TOKEN}`);
    }
  });
});
