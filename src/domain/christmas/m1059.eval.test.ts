import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { answer, findsIn, readAsk } from "./discover";

const file = process.env.HOLIDAY_CORPUS;
const TOWNS = [
  "vernon",
  "coldstream",
  "armstrong",
  "lumby",
  "silverstar",
  "lake-country",
  "kelowna",
  "big-white",
  "vancouver",
];
describe.skipIf(!file)("m1059 per-town events", () => {
  it("lists", () => {
    const parsed = JSON.parse(readFileSync(file!, "utf8"));
    const c: DiscoveryCandidate[] = parsed.candidates;
    const today = "2026-11-23";
    const finds = findsIn(c.map(candidateToExperience), today);
    const out: string[] = [];
    for (const at of TOWNS) {
      const a = answer(
        finds,
        readAsk({ at, from: today, to: "2027-01-03", place: "all" }, { today }),
        { today },
      );
      out.push(`## ${at} unplaced=${a.unplaced}`);
      for (const s of a.shelves)
        for (const f of s.finds)
          if (f.experience.kind === "Event")
            out.push(
              `${s.id}\t${f.experience.id.slice(0, 8)}\t${f.when.from ?? "?"}\t${f.km?.toFixed(1) ?? "-"}\t${f.experience.title}`,
            );
    }
    writeFileSync(process.env.HOLIDAY_OUT!, out.join("\n"));
    expect(finds.length).toBeGreaterThan(0);
  });
});
