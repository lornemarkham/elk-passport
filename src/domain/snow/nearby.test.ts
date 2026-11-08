import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { mountainById } from "./mountains";
import { resortFacts } from "./resorts";
import {
  acquisitionRequest,
  apresRank,
  filterPicks,
  gapsIn,
  picksNear,
} from "./nearby";

/**
 * Against **production Atlas as it was on 2026-11-08** (the SilverStar area,
 * read from the public /go payload): what a SilverStar crew can actually be
 * offered, and what Atlas is missing.
 */
const body = JSON.parse(
  gunzipSync(
    readFileSync(
      path.resolve(
        __dirname,
        "../../../docs/product/snow/verification/atlas-silverstar-2026-11-08.json.gz",
      ),
    ),
  ).toString("utf8"),
) as { candidates: DiscoveryCandidate[] };
const pool = body.candidates.map(candidateToExperience);
const silverstar = mountainById("silverstar")!;
const facts = resortFacts("silverstar");
const picks = picksNear(pool, silverstar, {
  onMountainKm: facts!.onMountainKm,
});
const titled = (cat: Parameters<typeof filterPicks>[1]) =>
  filterPicks(picks, cat).map((p) => p.title);

describe("Atlas around SilverStar (production corpus, 2026-11-08)", () => {
  it("finds tubing at Tube Town on the mountain, by Atlas's own word, with its real photo", () => {
    const tube = picks.find((p) => p.title === "Tube Town")!;
    expect(tube.categories).toContain("tubing");
    expect(tube.onMountain).toBe(true);
    expect(tube.evidence.join(" ")).toMatch(/Tubing/);
    expect(tube.image).toMatch(/^https:\/\//);
  });

  it("finds skating at Brewer's Pond and snowshoeing at Sovereign Lake", () => {
    expect(titled({ category: "skating", onMountainOnly: true })).toContain(
      "Brewer's Pond",
    );
    expect(titled({ category: "snowshoe", maxKm: 5 })).toEqual(
      expect.arrayContaining(["Sovereign Lake Nordic Centre"]),
    );
  });

  it("offers a non-skier only things that aren't the skiing", () => {
    const forThem = filterPicks(picks, {
      nonSkier: true,
      onMountainOnly: true,
    });
    expect(forThem.length).toBeGreaterThan(0);
    for (const p of forThem)
      expect(p.categories.some((c) => c !== "lunch" && c !== "apres")).toBe(
        true,
      );
  });

  it("has NO lunch or après on the mountain — a gap, not an invention", () => {
    expect(
      filterPicks(picks, { category: "lunch", onMountainOnly: true }),
    ).toEqual([]);
    const gaps = gapsIn(picks);
    expect(gaps).toEqual(
      expect.arrayContaining([
        { category: "lunch", where: "mountain" },
        { category: "apres", where: "mountain" },
      ]),
    );
    // Down the hill, Vernon has real places.
    const town = apresRank(picks);
    expect(town.length).toBeGreaterThan(3);
    expect(town[0].onMountain).toBe(false);
  });

  it("writes an acquisition request naming the resort's own venues Atlas lacks", () => {
    const req = acquisitionRequest("SilverStar", facts, picks, gapsIn(picks));
    expect(req.missingDining).toEqual(
      expect.arrayContaining([
        "Long John's Pub",
        "Bugaboos Bakery Café",
        "The Red Antler",
      ]),
    );
    expect(req.text).toMatch(/Atlas holds 0\b/);
    expect(req.text).toContain("skisilverstar.com");
  });
});
