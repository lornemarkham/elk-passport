import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **A refusal is not an absence.**
 *
 * Every October surface wrote `listDiscoveryCandidates().catch(() => [])`, so
 * four different faults — no service token, a refused token, Atlas not
 * configured, Atlas not answering — all arrived as an empty array. The page
 * then said *"Nothing Passport knows about is on tonight. That is most
 * nights."* over a corpus of two and a half thousand things, calmly, which is
 * what made it dangerous.
 *
 * These pin the difference at the seam. What the pages do with it is theirs;
 * what they must never again receive is `[]` for a question nobody answered.
 */
const ORIGINAL = process.env.ATLAS_SERVICE_TOKEN;

function respondWith(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

beforeEach(() => {
  process.env.ATLAS_SERVICE_TOKEN = "outage-test-token";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  if (ORIGINAL === undefined) delete process.env.ATLAS_SERVICE_TOKEN;
  else process.env.ATLAS_SERVICE_TOKEN = ORIGINAL;
});

describe("when Atlas refuses Passport", () => {
  it("is not reported as an empty corpus", async () => {
    respondWith(401, { error: "Unauthorized." });
    const { discoveryCandidates } = await import("./atlas-repo");
    const read = await discoveryCandidates();

    expect(read.candidates).toEqual([]);
    // The candidates are empty either way. The difference is that a surface
    // can now tell why, which is the whole repair.
    expect(read.outage).toBe("unauthorized");
  });

  it("names our own missing token when we never sent one", async () => {
    delete process.env.ATLAS_SERVICE_TOKEN;
    respondWith(401, { error: "Unauthorized." });
    const { discoveryCandidates } = await import("./atlas-repo");

    expect((await discoveryCandidates()).outage).toBe("not-configured");
  });

  it("separates Atlas's own misconfiguration from ours", async () => {
    // Atlas answers 503 when *its* ATLAS_SERVICE_TOKEN is unset.
    respondWith(503, {
      error: "Atlas service authentication is not configured.",
    });
    const { discoveryCandidates } = await import("./atlas-repo");

    expect((await discoveryCandidates()).outage).toBe("unavailable");
  });

  it("reports nothing answering at all", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch failed")));
    const { discoveryCandidates } = await import("./atlas-repo");

    expect((await discoveryCandidates()).outage).toBe("unreachable");
  });

  it("tells the operator which fault it was, in the log and not on the page", async () => {
    respondWith(401);
    const { discoveryCandidates } = await import("./atlas-repo");
    await discoveryCandidates();

    expect(console.error).toHaveBeenCalled();
    const logged = (
      console.error as unknown as { mock: { calls: string[][] } }
    ).mock.calls[0]!.join(" ");
    expect(logged).toContain("unauthorized");
  });
});

describe("when Atlas answers", () => {
  it("reports a genuinely quiet month as quiet, with no outage", async () => {
    respondWith(200, { candidates: [] });
    const { discoveryCandidates } = await import("./atlas-repo");
    const read = await discoveryCandidates();

    expect(read.candidates).toEqual([]);
    expect(read.outage).toBeUndefined();
  });

  it("passes the corpus through untouched", async () => {
    const candidate = { id: "a", kind: "Event", name: "A thing" };
    respondWith(200, { candidates: [candidate] });
    const { discoveryCandidates } = await import("./atlas-repo");
    const read = await discoveryCandidates();

    expect(read.candidates).toEqual([candidate]);
    expect(read.outage).toBeUndefined();
  });
});

/**
 * The surfaces themselves, asserted against their source: rendering them here
 * would mean standing up Supabase, a session and Atlas, and the thing worth
 * guarding is smaller than that — that no October lane still swallows the read.
 */
describe("the October surfaces", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  const SURFACES = [
    "src/app/october/page.tsx",
    "src/components/labs/october/synthesis/OctoberDiscoverySurface.tsx",
    "src/lib/labs/october/pool.ts",
    "src/app/october/explore/[area]/page.tsx",
    "src/app/october/mine/page.tsx",
  ];

  it("no longer catch the read into an empty array", () => {
    for (const surface of SURFACES) {
      expect(read(surface)).not.toContain("listDiscoveryCandidates().catch");
    }
  });

  it("say so on the two lanes that lead with what is on", () => {
    expect(read("src/app/october/page.tsx")).toContain("atlas.outage");
    expect(read("src/app/october/page.tsx")).toContain("<Unanswered />");

    // Discover is a route over a shared surface now. The outage travels on
    // the pool it reads, and the surface renders the same `Unanswered`.
    const surface = read(
      "src/components/labs/october/synthesis/OctoberDiscoverySurface.tsx",
    );
    expect(surface).toContain("pool.outage");
    expect(surface).toContain("<Unanswered />");
    expect(read("src/lib/labs/october/pool.ts")).toContain("atlas.outage");
  });

  it("do not print a credential's name to a visitor", () => {
    for (const surface of SURFACES) {
      expect(read(surface)).not.toContain("ATLAS_SERVICE_TOKEN");
      expect(read(surface)).not.toContain("ADMIN_TOKEN");
    }
  });
});
