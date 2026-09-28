import { describe, expect, it } from "vitest";
import {
  beginsWithin,
  byDay,
  byOctoberSpecificity,
  hasMedia,
  knownFacts,
  leadOf,
  withoutAlreadyShown,
  withoutLead,
} from "./presentation";
import type { DiscoveryUnit } from "./discoveryUnits";
import type { Experience } from "@/domain/experience/types";

/**
 * Presentation must never become ranking.
 *
 * These pin the one property that keeps that true: the lane's order is
 * temporal truth and nothing in here is allowed to reorder it. The large slot
 * is chosen from what is *known* about a record, which is a fact, rather than
 * from what anyone thinks of it, which the corpus cannot support.
 */

function unit(
  id: string,
  title: string,
  extra: Partial<Experience> = {},
  options: Experience[] = [],
): DiscoveryUnit {
  return {
    head: {
      id,
      slug: id,
      title,
      kind: "Event",
      subtype: "Event",
      shortDescription: "",
      regionIds: [],
      ...extra,
    } as Experience,
    options,
  };
}

const withPicture = {
  heroMedia: {
    type: "image" as const,
    src: "https://example.test/a.jpg",
    alt: "",
  },
};

describe("presentation", () => {
  it("gives the large slot to the soonest thing that can carry a picture", () => {
    const lane = [
      unit("a", "No picture"),
      unit("b", "Has a picture", withPicture),
      unit("c", "Also has one", withPicture),
    ];
    expect(leadOf(lane)!.head.id).toBe("b");
  });

  it("falls back to the soonest when nothing has a picture", () => {
    const lane = [unit("a", "First"), unit("b", "Second")];
    expect(leadOf(lane)!.head.id).toBe("a");
  });

  it("never reorders the lane", () => {
    // The rest keeps its temporal order even when the lead is taken from the
    // middle of it. Soonest-first is truth, not a display preference.
    const lane = [
      unit("a", "First"),
      unit("b", "Second", withPicture),
      unit("c", "Third"),
    ];
    expect(withoutLead(lane).map((u) => u.head.id)).toEqual(["a", "c"]);
  });

  it("has nothing to lead with when the lane is empty", () => {
    expect(leadOf([])).toBeUndefined();
    expect(withoutLead([])).toEqual([]);
  });

  it("counts what is known without judging it", () => {
    expect(knownFacts(unit("a", "Bare"))).toBe(0);
    expect(
      knownFacts(
        unit("b", "Full", {
          ...withPicture,
          startTime: "2026-10-17T19:00:00Z",
          shortDescription: "Something",
        }),
      ),
    ).toBe(3);
    expect(hasMedia(unit("c", "Pic", withPicture))).toBe(true);
    expect(hasMedia(unit("d", "None"))).toBe(false);
  });

  it("files a lane under the day each thing next happens", () => {
    const lane = [
      unit("a", "Later", { startTime: "2026-10-20T02:00:00Z" }),
      unit("b", "Sooner", { startTime: "2026-10-18T02:00:00Z" }),
      unit("c", "Same day as b", { startTime: "2026-10-18T05:00:00Z" }),
    ];
    const days = byDay(lane, "2026-10-17");
    expect(days.map((d) => d.day)).toEqual(["2026-10-17", "2026-10-19"]);
    // Grouped, not duplicated: two things on one day share one heading.
    expect(days[0]!.units).toHaveLength(2);
  });

  it("leaves out anything with no day ahead rather than inventing one", () => {
    const undated = unit("x", "No date at all");
    expect(byDay([undated], "2026-10-17")).toEqual([]);
  });

  it("files a grouped attraction under its next night, once", () => {
    // Eight nights must produce one row under the next one, not eight rows.
    const nights = {
      availability: {
        basis: "stated-days" as const,
        days: ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-31"],
      },
    };
    const haunt = unit("h", "A Haunt", nights, [
      { id: "h-1", title: "Evening Haunt" } as Experience,
    ]);
    const days = byDay([haunt], "2026-10-17");
    expect(days).toHaveLength(1);
    expect(days[0]!.day).toBe("2026-10-17");
  });
});

describe("composing one lane against another", () => {
  const u = (id: string, days?: string[], startTime?: string) =>
    ({
      head: {
        id,
        slug: id,
        title: id,
        kind: "Event",
        subtype: "Event",
        shortDescription: "",
        regionIds: [],
        ...(days
          ? { availability: { basis: "stated-days" as const, days } }
          : {}),
        ...(startTime ? { startTime } : {}),
      },
      options: [],
    }) as unknown as DiscoveryUnit;

  it("asks This weekend for what Tonight has not already shown", () => {
    const tonight = [u("a"), u("b")];
    const weekend = [u("a"), u("b"), u("c"), u("d")];
    expect(withoutAlreadyShown(weekend, tonight).map((x) => x.head.id)).toEqual(
      ["c", "d"],
    );
  });

  it("subtracts by identity, never by title", () => {
    // Two different records that share a name are two things, and both stay.
    const tonight = [u("id-1")];
    const same = u("id-2");
    (same.head as { title: string }).title = "id-1";
    expect(withoutAlreadyShown([same], tonight)).toHaveLength(1);
  });

  it("removes nothing when the earlier lane is empty", () => {
    const weekend = [u("a"), u("b")];
    expect(withoutAlreadyShown(weekend, [])).toHaveLength(2);
  });

  it("ranks a thing that begins in the window above one already running", () => {
    // Hiring Event Staff runs Sep 29 → next June and clamps to Oct 1; a real
    // October 1st occurrence should not sit underneath it.
    const running = u("already-running", ["2026-09-29", "2026-10-01"]);
    const begins = u("begins-oct-1", ["2026-10-01"]);
    const order = byOctoberSpecificity([running, begins], "2026-10-01");
    expect(order.map((x) => x.head.id)).toEqual([
      "begins-oct-1",
      "already-running",
    ]);
  });

  it("is not a duration rule — a long run that starts in the window still leads", () => {
    const longButStartsHere = u("long", [
      "2026-10-01",
      "2026-10-31",
      "2027-06-25",
    ]);
    const shortButRunning = u("short", ["2026-09-30", "2026-10-01"]);
    expect(
      byOctoberSpecificity(
        [shortButRunning, longButStartsHere],
        "2026-10-01",
      ).map((x) => x.head.id),
    ).toEqual(["long", "short"]);
  });

  it("keeps the lane's existing order among equals", () => {
    const a = u("a", ["2026-10-02"]);
    const b = u("b", ["2026-10-03"]);
    const c = u("c", ["2026-10-04"]);
    expect(
      byOctoberSpecificity([a, b, c], "2026-10-01").map((x) => x.head.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("reads an Event's own start, not only stated days", () => {
    const begins = u("ev", undefined, "2026-10-05T02:00:00.000Z");
    expect(beginsWithin(begins, "2026-10-01")).toBe(true);
    expect(beginsWithin(begins, "2026-11-01")).toBe(false);
  });
});
