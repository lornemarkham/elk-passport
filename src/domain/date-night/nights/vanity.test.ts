import { describe, expect, it } from "vitest";
import { DATE_NIGHT_PATHS } from "../../../../next.config";
import { allDateNights, dateNight } from ".";

describe("Date Night short paths", () => {
  it("every night with a vanity path is rewritten to its own slug, and nothing else is", () => {
    const declared = allDateNights()
      .filter((n) => n.vanityPath)
      .map((n) => [n.vanityPath, n.slug]);
    expect(DATE_NIGHT_PATHS.map(([from, slug]) => [from, slug])).toEqual(
      declared,
    );
    for (const [, slug] of DATE_NIGHT_PATHS)
      expect(dateNight(slug)).toBeDefined();
  });
});
