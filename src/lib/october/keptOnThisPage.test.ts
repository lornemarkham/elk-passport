import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OCTOBER_KINDS } from "./types";

/**
 * **One read for a page, and only kinds October can actually hold.**
 *
 * Two rules that are easy to break without noticing. A card that asks for its
 * own saved state turns thirty-nine cards into thirty-nine requests and makes
 * every control flicker a second after paint; and a control offered for a kind
 * `passport_october_things` refuses is a press that fails at the database,
 * which is the exact shape of the Movie bug this product has already had once.
 */
const currentUser = vi.fn();
const octoberThingsFor = vi.fn();

vi.mock("@/lib/auth/currentUser", () => ({
  currentUser: () => currentUser(),
}));
vi.mock("@/lib/october/octoberThings", () => ({
  octoberThingsFor: (u: unknown) => octoberThingsFor(u),
}));

const load = async () => await import("./keptOnThisPage");

beforeEach(() => {
  vi.resetModules();
  currentUser.mockReset();
  octoberThingsFor.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what this person has already kept", () => {
  it("is read once, whatever a page is about to draw", async () => {
    currentUser.mockResolvedValue({ id: "u1" });
    octoberThingsFor.mockResolvedValue([
      { entityId: "a" },
      { entityId: "b" },
      { entityId: "c" },
    ]);

    const { keptOnThisPage } = await load();
    const page = await keptOnThisPage();

    expect(octoberThingsFor).toHaveBeenCalledTimes(1);
    expect(page.signedIn).toBe(true);
    expect([...page.kept].sort()).toEqual(["a", "b", "c"]);
  });

  it("answers every card from that one read, in constant time", async () => {
    currentUser.mockResolvedValue({ id: "u1" });
    octoberThingsFor.mockResolvedValue([{ entityId: "kept-one" }]);

    const { keptOnThisPage } = await load();
    const page = await keptOnThisPage();

    // Forty lookups, still one request.
    for (let i = 0; i < 40; i++) page.kept.has(`card-${i}`);
    expect(page.kept.has("kept-one")).toBe(true);
    expect(page.kept.has("never-kept")).toBe(false);
    expect(octoberThingsFor).toHaveBeenCalledTimes(1);
  });

  it("is an empty October for a visitor, and asks the database nothing", async () => {
    currentUser.mockResolvedValue(null);

    const { keptOnThisPage } = await load();
    const page = await keptOnThisPage();

    expect(page.signedIn).toBe(false);
    expect(page.kept.size).toBe(0);
    expect(octoberThingsFor).not.toHaveBeenCalled();
  });

  it("does not take a page down when the read fails", async () => {
    currentUser.mockResolvedValue({ id: "u1" });
    octoberThingsFor.mockRejectedValue(new Error("supabase said no"));

    const { keptOnThisPage } = await load();
    const page = await keptOnThisPage();

    // Nothing renders as kept, which is the safe direction: the unsafe one is
    // claiming a thing is in somebody's October when the read never answered.
    expect(page.signedIn).toBe(true);
    expect(page.kept.size).toBe(0);
  });
});

describe("which subjects may be kept at all", () => {
  it("accepts exactly the kinds the My October contract accepts", async () => {
    const { keepableKind } = await load();
    for (const kind of OCTOBER_KINDS) expect(keepableKind(kind)).toBe(kind);
  });

  it("includes Movie, after the repair that made a film keepable", async () => {
    const { keepableKind } = await load();
    expect(keepableKind("Movie")).toBe("Movie");
  });

  it("offers nothing for a kind the database would refuse", async () => {
    const { keepableKind } = await load();
    // No control beats a control that fails at the constraint.
    expect(keepableKind("Region")).toBeUndefined();
    expect(keepableKind("Sandwich")).toBeUndefined();
    expect(keepableKind("place")).toBeUndefined();
  });
});

/**
 * The surfaces, asserted against their source. Rendering them would mean
 * standing up Atlas, Supabase and a session; what is worth guarding is
 * smaller — that each reads the saved state once and hands it down.
 */
describe("the October surfaces", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const SURFACES = [
    "src/app/october/page.tsx",
    "src/app/october/discover/page.tsx",
    "src/app/october/explore/[area]/page.tsx",
  ];

  it("all pass a keep control to their cards", () => {
    for (const surface of SURFACES) {
      expect(read(surface)).toMatch(/keep(For)?\(/);
      expect(read(surface)).toContain("keep=");
    }
  });

  it("read the saved state once per page, not once per card", () => {
    for (const surface of SURFACES) {
      const source = read(surface);
      const reads = source.match(/keptOnThisPage\(\)/g) ?? [];
      // October home reuses the rows it already fetched for its tallies.
      if (surface.endsWith("october/page.tsx")) {
        expect(reads).toHaveLength(0);
        expect(source).toContain("octoberThingsFor");
      } else {
        expect(reads).toHaveLength(1);
      }
    }
  });

  it("send a visitor back to the surface they were on", () => {
    expect(read("src/app/october/page.tsx")).toContain('"/october"');
    expect(read("src/app/october/discover/page.tsx")).toContain(
      '"/october/discover"',
    );
    expect(read("src/app/october/explore/[area]/page.tsx")).toContain(
      "/october/explore/${area.id}",
    );
  });

  it("leaves the dense calendar rows alone", () => {
    // `CompactRow` and `BrowseRow` are a fortnight and a month at a glance.
    // A column of hearts there would make the calendar about the hearts.
    const cards = read("src/components/october/discover/cards.tsx");
    for (const name of ["CompactRow", "BrowseRow"]) {
      expect(bodyOf(cards, name)).not.toContain("keep");
    }
    // The ones with a photograph on them do carry it.
    for (const name of ["LeadCard", "DiscoverCard", "FeatureCard"]) {
      expect(bodyOf(cards, name)).toContain("keep");
    }
  });

  /** One exported function's source, up to the next one. */
  function bodyOf(source: string, name: string): string {
    const start = source.indexOf(`export function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  }
});
