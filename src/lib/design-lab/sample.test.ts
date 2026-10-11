import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **A design comparison is only worth something if all three are rendering the
 * same real thing.**
 *
 * Three visual directions are being explored. Dressed in invented places and
 * written copy they would compare three pieces of copywriting, so every
 * prototype reads the live corpus through this one view model — and this
 * module's whole job is to pass Atlas's content through without improving it.
 */

const listDiscoveryCandidates = vi.fn(async () => [] as DiscoveryCandidate[]);
vi.mock("@/lib/data/atlas-repo", () => ({
  listDiscoveryCandidates: () => listDiscoveryCandidates(),
}));

const { byDoing, gallery, subject } = await import("./sample");

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate =>
  ({
    id: "id",
    kind: "Place",
    name: "Somewhere",
    description: "",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    availability: {},
    ...over,
  }) as DiscoveryCandidate;

/** Allan Brooks Nature Centre, as production serves it. */
const RICH = candidate({
  id: "allan-brooks",
  name: "Allan Brooks Nature Centre",
  description:
    "Perched atop the grasslands south of Vernon, the Allan Brooks Nature Centre boasts 360 degree views of the region and indoor exhibits.",
  heroUrl: "https://www.tourismvernon.com/allan-brooks.jpg",
  geography: {
    state: "observed",
    locality: "Vernon",
    localityBasis: "observed",
    area: { id: "okanagan", name: "Okanagan" },
  },
  knowledge: {
    affordances: [{ name: "Birdwatching", basis: "offers" }],
    practical: [
      { label: "Hike duration", value: "60 - 90 minute round-trip" },
      { label: "Nonsense", value: 42 as unknown as string },
    ],
  },
} as Partial<DiscoveryCandidate>);

const BARE = candidate({ id: "bare", name: "A place Atlas barely knows" });

beforeEach(() => listDiscoveryCandidates.mockResolvedValue([RICH, BARE]));

describe("the view model all three directions share", () => {
  it("carries Atlas's own sentence, photograph, town and verbs", async () => {
    const { featured } = await gallery();
    expect(featured[0]).toMatchObject({
      title: "Allan Brooks Nature Centre",
      heroUrl: "https://www.tourismvernon.com/allan-brooks.jpg",
      place: "Vernon",
      area: "Okanagan",
      doing: ["Birdwatching"],
    });
    expect(featured[0]!.blurb).toContain("Perched atop the grasslands");
  });

  it("invents nothing for a subject Atlas barely knows", async () => {
    const { rest } = await gallery();
    const bare = rest.find((s) => s.id === "bare")!;
    // No placeholder image, no filler sentence, no guessed town. A prototype
    // that borrowed one would be the fabrication this mission forbids.
    expect(bare.heroUrl).toBeUndefined();
    expect(bare.place).toBeUndefined();
    expect(bare.doing).toEqual([]);
    expect(bare.facts).toEqual([]);
  });

  it("separates what has a photograph from what does not", async () => {
    // Four subjects in five have no image Atlas will vouch for, and each
    // direction has to answer for that rather than hide it.
    const { featured, rest } = await gallery();
    expect(featured.map((s) => s.id)).toEqual(["allan-brooks"]);
    expect(rest.map((s) => s.id)).toEqual(["bare"]);
  });

  it("keeps a key fact's own label and value, and drops a malformed one", async () => {
    const { featured } = await gallery();
    expect(featured[0]!.facts).toEqual([
      { label: "Hike duration", value: "60 - 90 minute round-trip" },
    ]);
  });

  it("reports how many Atlas holds, so a prototype can be honest about scale", async () => {
    expect((await gallery()).total).toBe(2);
  });
});

describe("the corpus's own defects do not become the design's", () => {
  it("shows one of a name Atlas holds twice", async () => {
    // Atlas holds 60 names more than once. A magazine spread running the same
    // farm twice is the corpus's defect wearing a serif.
    listDiscoveryCandidates.mockResolvedValue([
      RICH,
      candidate({
        ...RICH,
        id: "allan-brooks-2",
      } as Partial<DiscoveryCandidate>),
    ]);
    expect((await gallery()).featured).toHaveLength(1);
  });

  it("leads with whatever can actually carry a page", async () => {
    const thin = candidate({
      id: "thin",
      name: "Thin",
      heroUrl: "https://example.test/a.jpg",
    });
    listDiscoveryCandidates.mockResolvedValue([thin, RICH]);
    expect((await gallery()).featured[0]!.id).toBe("allan-brooks");
  });

  it("says nothing at all when Atlas is unreachable", async () => {
    listDiscoveryCandidates.mockImplementationOnce(async () => {
      throw new Error("atlas");
    });
    expect(await gallery()).toEqual({ featured: [], rest: [], total: 0 });
  });
});

describe("one subject, for the detail prototypes", () => {
  it("is the same view model the feed used", async () => {
    expect(await subject("allan-brooks")).toMatchObject({
      title: "Allan Brooks Nature Centre",
      place: "Vernon",
    });
  });

  it("is nothing for an id Atlas does not serve", async () => {
    expect(await subject("not-a-thing")).toBeUndefined();
  });
});

/**
 * **Grouping by what Atlas says you can do.**
 *
 * Round two's directions let somebody explore by activity — a rail per verb, a
 * table of contents, chapter rules. The label is the affordance string in
 * Atlas's own spelling, because merging `Hiking` with `walking/hiking` would
 * be the taxonomy the doctrine refuses.
 */
describe("grouping by activity", () => {
  const offering = (id: string, ...doing: string[]) =>
    ({ id, title: id, kind: "Place", doing, facts: [] }) as never;

  it("keeps Atlas's own wording and spelling", () => {
    const groups = byDoing(
      [offering("a", "mountain biking"), offering("b", "mountain biking")],
      1,
    );
    expect(groups[0]!.label).toBe("mountain biking");
  });

  it("treats one spelling as one activity", () => {
    const groups = byDoing(
      [offering("a", "Playground"), offering("b", "playground")],
      1,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.subjects).toHaveLength(2);
  });

  it("leads with the activity most places stand behind", () => {
    const groups = byDoing(
      [
        offering("a", "Hiking", "Swimming"),
        offering("b", "Hiking"),
        offering("c", "Hiking"),
        offering("d", "Swimming"),
      ],
      1,
    );
    expect(groups.map((g) => g.label)).toEqual(["Hiking", "Swimming"]);
  });

  it("leaves out an activity too thin to fill a rail", () => {
    // A horizontal rail holding one tile is not a rail.
    const groups = byDoing(
      [offering("a", "Hiking", "Abseiling"), offering("b", "Hiking")],
      2,
    );
    expect(groups.map((g) => g.label)).toEqual(["Hiking"]);
  });

  it("offers nothing where Atlas states no verbs", () => {
    expect(byDoing([offering("a")], 1)).toEqual([]);
    expect(byDoing([], 1)).toEqual([]);
  });
});
