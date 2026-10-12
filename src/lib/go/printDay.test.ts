import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";

const listDiscoveryCandidates = vi.fn(async (age?: number, on?: string) => {
  void age;
  void on;
  return [] as DiscoveryCandidate[];
});
vi.mock("@/lib/data/atlas-repo", () => ({
  listDiscoveryCandidates: (age?: number, on?: string) =>
    listDiscoveryCandidates(age, on),
}));

const { resolvePrintDay } = await import("./printDay");
const { resolveDay } = await import("@/lib/detox/resolve");

const VERNON = townById("vernon")!;

/** Places north of Vernon, `km` apart in a straight line. */
const place = (name: string, km: number): DiscoveryCandidate =>
  ({
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype: name,
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    availability: {},
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
    },
  }) as unknown as DiscoveryCandidate;

const NEAR = place("Near Park", 1);
const MIDDLE = place("Middle Museum", 5);
const FAR = place("Far Farm", 10);

beforeEach(() => {
  listDiscoveryCandidates.mockReset();
  listDiscoveryCandidates.mockResolvedValue([NEAR, MIDDLE, FAR]);
});

/** Far first: the order a person set, which nearest-first would undo. */
const QUERY = {
  stops: "far-farm,near-park,middle-museum",
  say: "four hours",
  hours: "4",
  at: "vernon",
  on: "2026-10-12",
  mins: "near-park:90",
  by: "walking",
};

describe("resolvePrintDay — one day for the paper and the phone", () => {
  it("keeps the person's order, not nearest-first", async () => {
    const resolved = await resolvePrintDay(QUERY);
    expect(resolved.kind).toBe("day");
    if (resolved.kind !== "day") return;
    expect(resolved.day.stops.map((s) => s.experience.id)).toEqual([
      "far-farm",
      "near-park",
      "middle-museum",
    ]);
    expect(
      resolved.day.stops.find((s) => s.experience.id === "near-park")?.minutes,
    ).toBe(90);
  });

  it("asks Atlas about the same day the screen asked about", async () => {
    await resolvePrintDay(QUERY);
    expect(listDiscoveryCandidates).toHaveBeenCalledWith(
      undefined,
      "2026-10-12",
    );
  });

  it("does not ask Atlas when nothing was chosen", async () => {
    expect((await resolvePrintDay({ say: "x" })).kind).toBe("none");
    expect(listDiscoveryCandidates).not.toHaveBeenCalled();
  });

  it("says Atlas was unreachable rather than printing nothing", async () => {
    listDiscoveryCandidates.mockRejectedValueOnce(new Error("down"));
    expect((await resolvePrintDay(QUERY)).kind).toBe("unreachable");
  });
});

describe("Go Offline receives the exact planned day", () => {
  it("keeps the same stops, in the same order, with the same minutes", async () => {
    const paper = await resolvePrintDay(QUERY);
    const phone = await resolveDay(QUERY);
    expect(phone.kind).toBe("day");
    if (phone.kind !== "day" || paper.kind !== "day") return;
    expect(phone.day.stops.map((s) => s.id)).toEqual(
      paper.day.stops.map((s) => s.experience.id),
    );
    expect(phone.day.stops.map((s) => s.minutes)).toEqual(
      paper.day.stops.map((s) => s.minutes),
    );
  });

  it("keeps the whole query to print the paper again", async () => {
    const phone = await resolveDay({ ...QUERY, utm: "x" });
    if (phone.kind !== "day") throw new Error("expected a day");
    const kept = new URLSearchParams(phone.day.print);
    expect(kept.get("mins")).toBe("near-park:90");
    expect(kept.get("by")).toBe("walking");
    expect(kept.has("utm")).toBe(false);
  });
});
