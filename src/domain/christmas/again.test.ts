import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { planAgain, type CurrentFind } from "./again";
import { readWhen } from "./when";

const today = "2026-11-23";
const event = (id: string, title: string, start: string, end = start) =>
  ({
    id,
    kind: "Event",
    title,
    startTime: `${start}T18:00:00-08:00`,
    endTime: `${end}T21:00:00-08:00`,
    timePrecision: "datetime",
  }) as unknown as Experience;
const place = (id: string, title: string) =>
  ({ id, kind: "Place", title }) as unknown as Experience;
const cur = (e: Experience): CurrentFind => ({
  id: e.id,
  title: e.title,
  when: readWhen(e, today),
});

describe("planAgain", () => {
  it("keeps places and events still on; leaves out ended ones with a reason", () => {
    const r = planAgain(
      [
        { id: "p", title: "Arcana", experience: place("p", "Arcana") },
        {
          id: "e1",
          title: "Old Market",
          experience: event("e1", "Old Market", "2025-12-06"),
        },
        {
          id: "e2",
          title: "Lights",
          experience: event("e2", "Lights", "2026-12-01", "2026-12-30"),
        },
      ],
      [],
      today,
    );
    expect(r.keep.map((k) => k.id)).toEqual(["p", "e2"]);
    expect(r.left).toHaveLength(1);
    expect(r.left[0]!.title).toBe("Old Market");
    expect(r.from).toBe("2026-12-01");
  });
  it("swaps an ended event for the same thing listed again", () => {
    const next = event("n", "Canyon Lights 2026", "2026-12-01", "2026-12-30");
    const r = planAgain(
      [
        {
          id: "old",
          title: "Canyon Lights 2025",
          experience: event(
            "old",
            "Canyon Lights 2025",
            "2025-12-01",
            "2025-12-30",
          ),
        },
      ],
      [cur(next)],
      today,
    );
    expect(r.swapped).toEqual([
      { from: "Canyon Lights 2025", to: "Canyon Lights 2026", id: "n" },
    ]);
    expect(r.keep).toEqual([{ id: "n", title: "Canyon Lights 2026" }]);
    expect(r.left).toHaveLength(0);
  });
  it("does not swap to something that is also over, and never duplicates", () => {
    const r = planAgain(
      [
        {
          id: "a",
          title: "Fair",
          experience: event("a", "Fair", "2025-12-01"),
        },
        { id: "a", title: "Fair", experience: place("a", "Fair") },
      ],
      [cur(event("b", "Fair", "2025-12-02"))],
      today,
    );
    expect(r.keep.map((k) => k.id)).toEqual(["a"]);
    expect(r.left).toHaveLength(1);
  });
  it("a stop nothing can name is said, not guessed", () => {
    const r = planAgain([{ id: "x", title: "" }], [], today);
    expect(r.keep).toHaveLength(0);
    expect(r.left[0]!.why).toMatch(/isn't in Atlas/);
  });
  it("a named place Atlas holds without dates stays", () => {
    const r = planAgain([{ id: "x", title: "Peak of Christmas" }], [], today);
    expect(r.keep).toEqual([{ id: "x", title: "Peak of Christmas" }]);
  });
});
