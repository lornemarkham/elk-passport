import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryCandidate, Place } from "./types";

/**
 * **The board told a person it was empty while they were looking at two things
 * they had saved.**
 *
 * Two production screenshots, from signed-in human testing:
 *
 * ```
 * Case A   sidebar: "My Places — 6 experiences saved"      board showed 4
 *          missing: Swan Lake Market & Garden, Canyon Frights
 * Case B   sidebar: "My Places — 2 experiences saved"      board: "Nothing saved yet."
 *          saved:   Ultimate 90s Night, Canyon Frights
 * ```
 *
 * One cause, not two. The sidebar resolves saved ids against
 * `/discovery/candidates` — 2,683 subjects of every kind. This loader resolved
 * them against `/places`, which is 393 **Places and nothing else**:
 *
 * ```
 * candidates   Organization 1584 · Activity 390 · Event 377 · Place 323
 * places       393 Places
 * ```
 *
 * *Canyon Frights* and *Ultimate 90s Night* are Events. *Swan Lake Market &
 * Garden* is an Organization. The four that survived Case A are all Places.
 * Every id these fixtures use is the real production id for that subject.
 */

const user = vi.fn(async () => ({ id: "ana" }) as { id: string } | null);
vi.mock("@/lib/auth/currentUser", () => ({ currentUser: () => user() }));

const BOARD = {
  id: "board-1",
  ownerId: "ana",
  name: "My Places",
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
};
vi.mock("@/lib/collaboration/boardAccess", () => ({
  accessToBoard: async () => ({ board: BOARD, role: "owner", ownerId: "ana" }),
}));

const items = vi.fn(async () => [] as { experienceId: string }[]);
vi.mock("./boards-server", () => ({
  listBoardItemsFor: () => items(),
}));

const listPlaces = vi.fn(async () => [] as Place[]);
const listDiscoveryCandidates = vi.fn(async () => [] as DiscoveryCandidate[]);
vi.mock("./atlas-repo", () => ({
  listPlaces: () => listPlaces(),
  listDiscoveryCandidates: () => listDiscoveryCandidates(),
}));

const { loadBoardWithExperiences } = await import("./loadBoardWithExperiences");

const saved = (...ids: string[]) =>
  items.mockResolvedValue(ids.map((experienceId) => ({ experienceId })));

const candidate = (id: string, name: string, kind: string) =>
  ({
    id,
    kind,
    name,
    description: "",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    availability: {},
  }) as unknown as DiscoveryCandidate;

const place = (id: string, name: string) =>
  ({ id, name, description: "", regionIds: [] }) as unknown as Place;

/** Real production ids and real kinds. */
const KALAMOIR = candidate("02a2c0b4", "Kalamoir Park", "Place");
const GAMBELL = candidate("ca5f52ad", "Gambell Farms", "Place");
const FOOTHILLS = candidate("65c5da2d", "Silver Star Foothills", "Place");
const RESORT = candidate("d3116035", "Silver Star Mountain Resort", "Place");
const SWAN_LAKE = candidate(
  "4b90d0b2",
  "Swan Lake Market & Garden",
  "Organization",
);
const CANYON_FRIGHTS = candidate("a0ebf89d", "Canyon Frights", "Event");
const NINETIES = candidate("77cccaca", "Ultimate 90s Night", "Event");

const ALL = [
  KALAMOIR,
  GAMBELL,
  FOOTHILLS,
  RESORT,
  SWAN_LAKE,
  CANYON_FRIGHTS,
  NINETIES,
];

/** Only the Places reach `/places`, exactly as production serves it. */
const PLACES = [KALAMOIR, GAMBELL, FOOTHILLS, RESORT].map((c) =>
  place(c.id, c.name),
);

const names = async (id = "board-1") => {
  const result = await loadBoardWithExperiences(id);
  if (result.status !== "ok") throw new Error(result.status);
  return {
    shown: result.experiences.map((e) => e.title),
    unresolved: result.unresolved,
  };
};

beforeEach(() => {
  user.mockResolvedValue({ id: "ana" });
  items.mockResolvedValue([]);
  listPlaces.mockResolvedValue(PLACES);
  listDiscoveryCandidates.mockResolvedValue(ALL);
});

describe("Case A — six saved, four shown", () => {
  const SIX = [KALAMOIR, SWAN_LAKE, GAMBELL, CANYON_FRIGHTS, FOOTHILLS, RESORT];

  it("shows all six, Organization and Event included", async () => {
    saved(...SIX.map((c) => c.id));
    const { shown, unresolved } = await names();
    expect(shown).toHaveLength(6);
    expect(shown).toContain("Swan Lake Market & Garden");
    expect(shown).toContain("Canyon Frights");
    expect(unresolved).toEqual([]);
  });

  it("would have lost exactly the two reported, on Places alone", async () => {
    // The old behaviour, pinned so nobody restores it by accident.
    listDiscoveryCandidates.mockResolvedValue([]);
    saved(...SIX.map((c) => c.id));
    const { shown } = await names();
    expect(shown.sort()).toEqual([
      "Gambell Farms",
      "Kalamoir Park",
      "Silver Star Foothills",
      "Silver Star Mountain Resort",
    ]);
  });
});

describe("Case B — two saved, nothing shown", () => {
  it("shows both Events instead of claiming the board is empty", async () => {
    saved(NINETIES.id, CANYON_FRIGHTS.id);
    const { shown, unresolved } = await names();
    expect(shown).toEqual(["Ultimate 90s Night", "Canyon Frights"]);
    expect(unresolved).toEqual([]);
  });
});

describe("nothing that worked before stops working", () => {
  it("still resolves a Place the candidate feed does not carry", async () => {
    // Measured: 70 of the 393 Places are not in the candidate feed —
    // Sovereign Lake Nordic Centre, UBC Museum of Anthropology. Swapping one
    // source for the other would have traded one broken board for another.
    listPlaces.mockResolvedValue([
      ...PLACES,
      place("legacy-1", "Sovereign Lake Nordic Centre"),
    ]);
    saved("legacy-1", CANYON_FRIGHTS.id);
    const { shown } = await names();
    expect(shown).toEqual(["Sovereign Lake Nordic Centre", "Canyon Frights"]);
  });

  it("keeps the order the board was built in", async () => {
    saved(CANYON_FRIGHTS.id, KALAMOIR.id, NINETIES.id);
    expect((await names()).shown).toEqual([
      "Canyon Frights",
      "Kalamoir Park",
      "Ultimate 90s Night",
    ]);
  });
});

describe("what it cannot show, it says", () => {
  it("reports an id neither corpus knows rather than dropping it", async () => {
    saved(KALAMOIR.id, "vanished-from-atlas");
    const { shown, unresolved } = await names();
    expect(shown).toEqual(["Kalamoir Park"]);
    expect(unresolved).toEqual(["vanished-from-atlas"]);
  });

  it("does not pretend a board is empty when its catalogue is unreachable", async () => {
    // Both corpora down. The board still holds what it holds.
    listPlaces.mockRejectedValue(new Error("atlas"));
    listDiscoveryCandidates.mockRejectedValue(new Error("atlas"));
    saved(NINETIES.id, CANYON_FRIGHTS.id);
    const { shown, unresolved } = await names();
    expect(shown).toEqual([]);
    expect(unresolved).toEqual([NINETIES.id, CANYON_FRIGHTS.id]);
  });

  it("still answers when only one corpus is reachable", async () => {
    listDiscoveryCandidates.mockRejectedValue(new Error("atlas"));
    saved(KALAMOIR.id, CANYON_FRIGHTS.id);
    const { shown, unresolved } = await names();
    expect(shown).toEqual(["Kalamoir Park"]);
    expect(unresolved).toEqual([CANYON_FRIGHTS.id]);
  });
});

describe("who may look", () => {
  it("asks a visitor to sign in rather than saying the board is missing", async () => {
    user.mockResolvedValue(null);
    expect(await loadBoardWithExperiences("board-1")).toEqual({
      status: "signed-out",
    });
  });
});
