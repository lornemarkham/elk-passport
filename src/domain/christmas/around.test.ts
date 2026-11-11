import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { distanceTo } from "@/domain/discovery/proximity";
import { townById } from "@/domain/discovery/towns";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { around } from "./around";
import { SEED } from "./lights/seed";
import { visible } from "./lights/model";
import { answer, findsIn, readAsk } from "./discover";

/**
 * Christmas Around You, on Atlas's real corpus of 2026-10-24 (the committed
 * stand-in the e2e runs against), read as of 2026-11-10.
 */
const TODAY = "2026-11-10";
const file = resolve(
  __dirname,
  "../../../docs/product/christmas/verification/atlas-candidates-2026-10-24.json.gz",
);
const parsed = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
  ? parsed
  : parsed.candidates;
const finds = findsIn(candidates.map(candidateToExperience), TODAY);

const NOW = new Date("2026-11-10T20:00:00Z");
const pins = visible({ pins: SEED }, { key: null, reviewer: false }, NOW);

/** The stand-in carries no distance readings, so measure the way Passport does. */
function sectionsFor(at: string) {
  const town = townById(at)!;
  const origin = { latitude: town.latitude, longitude: town.longitude };
  const ask = readAsk({ at });
  const measured = finds.map((f) => {
    const km = distanceTo(f.experience, origin);
    return km === undefined ? f : { ...f, km };
  });
  return around(answer(measured, ask), TODAY, ask.km, pins);
}

describe("Christmas Around You on the real corpus", () => {
  for (const at of ["vernon", "kelowna"]) {
    describe(at, () => {
      const sections = sectionsFor(at);

      it("has real sections and no empty one", () => {
        expect(sections.length).toBeGreaterThanOrEqual(2);
        for (const s of sections)
          expect(s.finds.length + s.pins.length).toBeGreaterThan(0);
      });

      it("shows each find once", () => {
        const ids = sections.flatMap((s) =>
          s.finds.map((f) => f.experience.id),
        );
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("never offers last year's finds, and puts sure ones first", () => {
        for (const s of sections) {
          expect(s.finds.every((f) => f.when.confidence !== "past")).toBe(true);
          const rank = s.finds.map((f) =>
            ["dated", "check", "unconfirmed"].indexOf(f.when.confidence),
          );
          if (s.id !== "soon")
            expect(rank).toEqual([...rank].sort((a, b) => a - b));
        }
      });

      it("keeps Happening soon inside four weeks and soonest first", () => {
        const soon = sections.find((s) => s.id === "soon");
        expect(soon).toBeDefined();
        if (!soon) return;
        const froms = soon.finds.map((f) => f.when.from!);
        expect(froms).toEqual([...froms].sort());
        for (const f of soon.finds) {
          expect(f.when.confidence).toBe("dated");
          expect(f.when.to! >= TODAY).toBe(true);
          expect(f.when.from! <= "2026-12-08").toBe(true);
        }
      });

      it("keeps local sections local and the drive further out", () => {
        for (const s of sections) {
          for (const f of s.finds) {
            if (s.id === "drive") expect(f.km).toBeGreaterThan(50);
            else if (f.km !== undefined) expect(f.km).toBeLessThanOrEqual(50);
          }
        }
      });
    });
  }

  it("keeps local pins apart from Atlas finds and only near the town", () => {
    for (const at of ["vernon", "kelowna"]) {
      for (const s of sectionsFor(at))
        for (const p of s.pins) {
          expect(p.status).toBe("approved");
          expect(p.running).not.toBe("over");
        }
    }
    // Kelowna's pins are Kelowna's, not Vernon's.
    const kelowna = sectionsFor("kelowna").flatMap((s) => s.pins);
    expect(kelowna.length).toBeGreaterThan(0);
    expect(kelowna.every((p) => p.town === "kelowna")).toBe(true);
  });

  it("changes with the town", () => {
    const names = (at: string) =>
      sectionsFor(at)
        .flatMap((s) => [
          ...s.finds.map((f) => f.experience.title),
          ...s.pins.map((p) => p.name),
        ])
        .join("|");
    expect(names("vernon")).not.toEqual(names("kelowna"));
  });
});
