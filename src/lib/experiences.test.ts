import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPERIENCES, currentExperience } from "./experiences";

describe("experience registry", () => {
  it("has unique hrefs, labels and test ids", () => {
    for (const key of ["href", "label", "testId"] as const) {
      const values = EXPERIENCES.map((e) => e[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it.each(EXPERIENCES.map((e) => [e.label, e.href]))(
    "%s (%s) is a real page",
    (_label, href) => {
      const dir = join(process.cwd(), "src/app", href);
      // A page, or an optional catch-all page that answers the bare route.
      const pages = [
        join(dir, "page.tsx"),
        join(dir, "[[...path]]", "page.tsx"),
      ];
      expect(pages.some(existsSync)).toBe(true);
    },
  );

  it("lights the most specific experience only", () => {
    expect(currentExperience("/snow/sesh-wars/demo")?.label).toBe("Sesh Wars");
    expect(currentExperience("/snow/day/abc")?.label).toBe("Snow Day");
    expect(currentExperience("/badminton/demo")?.label).toBe(
      "Badminton Game Night",
    );
    expect(currentExperience("/discovery")).toBeUndefined();
  });
});
