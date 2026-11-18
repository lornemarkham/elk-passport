import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPERIENCES,
  LABS_HREF,
  LAB_EXPERIENCES,
  LABS_NOW,
  SEASONAL_ARCHIVE,
  currentExperience,
  currentLabsExperience,
} from "./experiences";

describe("experience registry", () => {
  it("has unique hrefs, labels and test ids", () => {
    for (const key of ["href", "label", "testId"] as const) {
      const values = EXPERIENCES.map((e) => e[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("features exactly the five strongest products, in order", () => {
    expect(EXPERIENCES.map((e) => e.label)).toEqual([
      "Christmas",
      "Hockey Night",
      "Snow Day",
      "Sesh Wars",
      "Date Night",
    ]);
  });

  it("moves Conference, October and Badminton to Labs without changing a URL", () => {
    expect(LAB_EXPERIENCES.map((e) => [e.label, e.href])).toEqual([
      ["People's Pulse", "/labs/pulse"],
      ["Conference", "/conferences"],
      ["October", "/october"],
      ["Badminton Game Night", "/badminton"],
    ]);
    for (const e of LAB_EXPERIENCES) {
      expect(EXPERIENCES.map((m) => m.href)).not.toContain(e.href);
    }
  });

  it("labels every Labs experience with one of the four honest statuses", () => {
    for (const e of LAB_EXPERIENCES) {
      expect([
        "Experimental",
        "Coming Soon",
        "In Development",
        "Archived",
        "Out of Season",
      ]).toContain(e.status);
      expect(e.description.length).toBeGreaterThan(20);
      expect(existsSync(join(process.cwd(), "public", e.preview))).toBe(true);
    }
  });

  it("keeps October in the Seasonal Archive, labelled, with a reactivation checklist", () => {
    expect(SEASONAL_ARCHIVE.map((e) => e.href)).toEqual(["/october"]);
    for (const e of SEASONAL_ARCHIVE) {
      expect(e.status).toBe("Out of Season");
      expect(e.seasonal?.reactivation.length).toBeGreaterThan(0);
      // Archived is not removed: it is still a Labs experience with a route.
      expect(LAB_EXPERIENCES).toContain(e);
      expect(EXPERIENCES.map((m) => m.href)).not.toContain(e.href);
    }
    expect(LABS_NOW.map((e) => e.href)).not.toContain("/october");
  });

  it("knows which Labs experience a path belongs to", () => {
    expect(currentLabsExperience("/boards/conference/x")?.label).toBe(
      "Conference",
    );
    expect(currentLabsExperience("/badminton/game-night")?.label).toBe(
      "Badminton Game Night",
    );
    expect(currentLabsExperience("/labs/pulse/abcd2345")?.label).toBe(
      "People's Pulse",
    );
    expect(currentLabsExperience("/christmas")).toBeUndefined();
    expect(LABS_HREF).toBe("/labs");
  });

  it.each([...EXPERIENCES, ...LAB_EXPERIENCES].map((e) => [e.label, e.href]))(
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
    expect(currentExperience("/badminton/demo")).toBeUndefined();
    expect(currentExperience("/discovery")).toBeUndefined();
  });

  it("lights an experience on the other routes it lives under", () => {
    expect(currentExperience("/night/abc")?.label).toBe("Date Night");
    expect(currentExperience("/date-night/plan")?.label).toBe("Date Night");
    expect(currentExperience("/nightly")).toBeUndefined();
  });
});
