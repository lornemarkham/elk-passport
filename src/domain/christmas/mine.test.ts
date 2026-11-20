import { describe, expect, it } from "vitest";
import type { AdventureSummary } from "@/lib/adventures/store";
import { splitMine } from "./mine";
import { christmasPictures } from "./pictures";
import type { Experience } from "@/domain/experience/types";

const adv = (
  id: string,
  title: string,
  startsOn: string | null,
  endsOn: string | null = startsOn,
): AdventureSummary => ({
  id,
  kind: "christmas",
  title,
  role: "owner",
  startsOn,
  endsOn,
  destinationLabel: "Vernon",
});

describe("splitMine", () => {
  const today = "2026-11-19";
  it("leads with what is coming, soonest first, and folds the past", () => {
    const m = splitMine(
      [
        adv("a", "Old market", "2025-12-06"),
        adv("b", "Weekend", "2026-12-20", "2026-12-21"),
        adv("c", "Lights night", "2026-12-05"),
        adv("d", "Someday", null),
      ],
      today,
    );
    expect(m.upcoming.map((a) => a.id)).toEqual(["c", "b", "d"]);
    expect(m.past.map((a) => a.id)).toEqual(["a"]);
  });
  it("a multi-day adventure still under way is not past", () => {
    const m = splitMine([adv("a", "Long", "2026-11-18", "2026-11-22")], today);
    expect(m.upcoming).toHaveLength(1);
  });
  it("shows one copy of the same plan and counts the rest", () => {
    const m = splitMine(
      [
        adv("a", "Christmas evening", "2026-12-05"),
        adv("b", "Christmas  Evening", "2026-12-05"),
        adv("c", "Christmas evening", "2026-12-06"),
      ],
      today,
    );
    expect(m.upcoming.map((a) => a.id)).toEqual(["a", "c"]);
    expect(m.hidden).toBe(1);
  });
});

describe("christmasPictures", () => {
  const base = { id: "x", title: "X" } as unknown as Experience;
  it("keeps a thing's own picture and drops a stand-in for its kind", () => {
    const own = {
      ...base,
      heroMedia: { type: "image", src: "https://img/own.jpg", alt: "" },
      presentationImage: {
        url: "https://img/stock.jpg",
        relationship: "category",
        attribution: "someone",
        license: { name: "CC", author: "A" },
      },
    } as unknown as Experience;
    expect(christmasPictures(own).map((p) => p.src)).toEqual([
      "https://img/own.jpg",
    ]);
  });
  it("is empty — text-first — when only a stand-in exists", () => {
    const stock = {
      ...base,
      presentationImage: {
        url: "https://img/stock.jpg",
        relationship: "representative",
        attribution: "someone",
      },
    } as unknown as Experience;
    expect(christmasPictures(stock)).toEqual([]);
  });
});
