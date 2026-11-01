import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { findsIn } from "./discover";
import { evidenceLine } from "./themes";

/**
 * **What Christmas finds in a real Atlas corpus** — run on demand:
 *
 *   CHRISTMAS_CORPUS=~/scratch/van-final/corpus.json \
 *   CHRISTMAS_OUT=/tmp/christmas.txt npx vitest run src/domain/christmas/themes.eval
 *
 * Writes every find with its theme, its evidence and its date reading, so a
 * person can read the list and judge precision. Skipped without a corpus.
 */
const file = process.env.CHRISTMAS_CORPUS;

describe.skipIf(!file)("Christmas finds in a real corpus", () => {
  it("finds Christmas things and only for reasons Atlas holds", () => {
    const raw = readFileSync(file!);
    const parsed = JSON.parse(
      (file!.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
    );
    const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
      ? parsed
      : parsed.candidates;
    const today = process.env.CHRISTMAS_TODAY ?? "2026-11-01";
    const finds = findsIn(candidates.map(candidateToExperience), today);
    const lines = finds.map(
      (f) =>
        `${f.reading.christmas ? "🎄" : "  "} ${f.experience.kind.padEnd(12)} ${f.experience.title.slice(0, 48).padEnd(48)} [${f.reading.themes.join(",")}] ${f.when.confidence}${f.when.line ? ` (${f.when.line})` : ""}\n      ${evidenceLine(f.reading.evidence[0]!)}`,
    );
    if (process.env.CHRISTMAS_OUT)
      writeFileSync(
        process.env.CHRISTMAS_OUT,
        `${finds.length} finds of ${candidates.length} (${finds.filter((f) => f.reading.christmas).length} Christmas, ${finds.filter((f) => f.when.confidence === "dated").length} dated)\n\n${lines.join("\n")}\n`,
      );
    expect(finds.length).toBeGreaterThan(0);
  });
});
