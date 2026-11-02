import { describe, expect, it } from "vitest";
import { CAUTIONS } from "../cautions";
import { offeredPlaceIds } from "../answer";
import { allDateNights, dateNight } from ".";

describe("every Date Night", () => {
  for (const night of allDateNights()) {
    describe(night.slug, () => {
      it("has unique idea ids and a real day", () => {
        const ids = night.ideas.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(night.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(
          () => new Intl.DateTimeFormat("en", { timeZone: night.timeZone }),
        ).not.toThrow();
        expect(dateNight(night.slug)).toBe(night);
      });

      it("never calls an idea safe, open or available — it says what to check", () => {
        for (const idea of night.ideas) {
          for (const c of idea.cautions ?? [])
            expect(CAUTIONS[c]).toBeDefined();
          expect(`${idea.title} ${idea.line}`).not.toMatch(
            /\b(safe|open now|guaranteed|no risk)\b/i,
          );
        }
      });

      it("names a place Atlas does not hold only alongside a check-it's-open caution", () => {
        for (const idea of night.ideas)
          if (idea.placeAtlasDoesNotKnow)
            expect(idea.cautions).toContain("unverified-place");
      });

      it("offers Atlas places by id only", () => {
        for (const id of offeredPlaceIds(night))
          expect(id).toMatch(/^[0-9a-f-]{36}$/);
      });
    });
  }

  it("risky ideas carry their checks (Lorne & Jess)", () => {
    const night = dateNight("lorne-and-jess")!;
    const cautions = (id: string) =>
      night.ideas.find((i) => i.id === id)?.cautions ?? [];
    expect(cautions("cold-plunge")).toContain("cold-water");
    expect(cautions("bird-hunting")).toContain("hunting");
    expect(cautions("fire-hot-chocolate")).toContain("fire");
    expect(cautions("backcountry-bbq")).toContain("fire");
    expect(cautions("snowmobile-scouting")).toContain("backcountry-snow");
  });
});
