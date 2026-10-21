import { describe, expect, it } from "vitest";
import {
  askFrom,
  dayWrites,
  daysBetween,
  groupByDay,
  moveWithin,
  planHref,
  printHref,
  seedFor,
  stopsFrom,
} from "./days";

const item = (
  id: string,
  atlasRef: string | null,
  onDay: string | null,
  position: number,
) => ({ id, atlasRef, onDay, position });

describe("an adventure's days", () => {
  it("lists every day of its dates, and a day an item names outside them", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
    expect(daysBetween("2026-10-24", null)).toEqual(["2026-10-24"]);
    expect(daysBetween(null, null)).toEqual([]);
    expect(daysBetween("2026-10-01", "2026-12-01")).toHaveLength(14);

    const { days, ideas } = groupByDay(
      [
        item("a", "x", "2026-10-25", 1),
        item("b", "y", "2026-10-25", 0),
        item("c", "z", null, 3),
        item("d", "w", "2026-11-02", 0),
      ],
      "2026-10-24",
      "2026-10-25",
    );
    expect(days.map((d) => d.onDay)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-11-02",
    ]);
    expect(days[1]!.items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(ideas.map((i) => i.id)).toEqual(["c"]);
  });

  it("starts a day from its own stops, else the ideas, at most five", () => {
    const ideas = ["1", "2", "3", "4", "5", "6"].map((n, i) =>
      item(n, `ref-${n}`, null, i),
    );
    expect(seedFor([], ideas)).toEqual([
      "ref-1",
      "ref-2",
      "ref-3",
      "ref-4",
      "ref-5",
    ]);
    expect(seedFor([item("s", "own", "2026-10-25", 0)], ideas)).toEqual([
      "own",
    ]);
  });
});

describe("the seam to Go Have a Day", () => {
  const query =
    "stops=a%3A1%2Cb-2&say=Saturday+with+a+five-year-old&age=5&at=vernon&on=2026-10-25&mins=a%3A1%3A90";

  it("keeps how a day was asked for, without its stops", () => {
    const ask = askFrom(query)!;
    const kept = new URLSearchParams(ask);
    expect(kept.has("stops")).toBe(false);
    expect(kept.get("say")).toBe("Saturday with a five-year-old");
    expect(kept.get("mins")).toBe("a:1:90");
    expect(askFrom("stops=a&on=2026-10-25")).toBeNull();
    expect(stopsFrom(query)).toEqual(["a:1", "b-2"]);
    expect(stopsFrom("stops=")).toBeNull();
    expect(stopsFrom("stops=a,b,c,d,e,f,g")).toBeNull();
    expect(stopsFrom("stops=<script>")).toBeNull();
  });

  it("reopens a planned day with its sentence; a new one from the ideas", () => {
    const again = new URL(
      planHref({
        adventureId: "adv12345",
        onDay: "2026-10-25",
        seed: ["a:1", "b-2"],
        ask: askFrom(query),
        townId: "kelowna",
      }),
      "http://x",
    );
    expect(again.pathname).toBe("/go");
    expect(again.searchParams.get("say")).toBe("Saturday with a five-year-old");
    expect(again.searchParams.get("at")).toBe("vernon");
    expect(again.searchParams.get("with")).toBe("a:1,b-2");
    expect(again.searchParams.get("adventure")).toBe("adv12345");

    const fresh = new URL(
      planHref({
        adventureId: "adv12345",
        onDay: "2026-10-26",
        seed: ["c"],
        ask: null,
        townId: null,
      }),
      "http://x",
    );
    expect(fresh.searchParams.has("say")).toBe(false);
    expect(fresh.searchParams.has("at")).toBe(false);
    expect(fresh.searchParams.get("on")).toBe("2026-10-26");
  });

  it("prints the day as it stands now, in its current order", () => {
    const href = printHref(["b-2", "a:1"], askFrom(query))!;
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/go/print");
    expect(url.searchParams.get("stops")).toBe("b-2,a:1");
    expect(url.searchParams.get("say")).toBe("Saturday with a five-year-old");
    expect(printHref([], askFrom(query))).toBeNull();
    expect(printHref(["a"], null)).toBeNull();
  });
});

describe("saving a built day", () => {
  const day = "2026-10-25";
  it("reuses this day's stops and waiting ideas, adds the rest, deletes nothing", () => {
    const writes = dayWrites(
      [
        item("on-day", "a", day, 0),
        item("dropped", "b", day, 1),
        item("idea", "c", null, 5),
        item("sunday", "d", "2026-10-26", 0),
        item("note", null, day, 2),
      ],
      day,
      ["c", "a", "d"],
    );
    expect(writes.place).toEqual([
      { id: "idea", position: 0 },
      { id: "on-day", position: 1 },
    ]);
    // Sunday's stop stays on Sunday; Saturday gets its own.
    expect(writes.add).toEqual([{ atlasRef: "d", position: 2 }]);
    // Dropped from the day: back to the ideas. A note is not a stop.
    expect(writes.release).toEqual(["dropped"]);
  });

  it("saving the same day twice changes nothing the second time", () => {
    const first = dayWrites([item("i", "a", null, 0)], day, ["a"]);
    expect(first.place).toEqual([{ id: "i", position: 0 }]);
    const second = dayWrites([item("i", "a", day, 0)], day, ["a"]);
    expect(second).toEqual({
      place: [{ id: "i", position: 0 }],
      add: [],
      release: [],
    });
  });
});

describe("moving by hand", () => {
  it("swaps neighbours and writes only the positions that change", () => {
    const group = [
      item("a", "a", null, 0),
      item("b", "b", null, 1),
      item("c", "c", null, 2),
    ];
    expect(moveWithin(group, "c", -1)).toEqual([
      { id: "c", position: 1 },
      { id: "b", position: 2 },
    ]);
    expect(moveWithin(group, "a", -1)).toBeNull();
    expect(moveWithin(group, "c", 1)).toBeNull();
  });

  it("still moves things added in one go (equal positions)", () => {
    const group = [item("a", "a", null, 4), item("b", "b", null, 4)];
    expect(moveWithin(group, "b", -1)).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ]);
  });
});
