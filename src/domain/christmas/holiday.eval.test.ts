import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { answer, findsIn, readAsk } from "./discover";

/**
 * **The holiday season in a real Atlas corpus, community by community** —
 * run on demand (owner brief M1053, "real event counts by community"):
 *
 *   HOLIDAY_CORPUS=~/scratch/m1053-data/prod.json \
 *   HOLIDAY_OUT=~/scratch/m1053-data/holiday.txt \
 *   npx vitest run src/domain/christmas/holiday.eval
 *
 * Counts, from each town at 30 km, what Christmas would offer: confirmed for
 * some day of November 23 – January 3, on New Year's Eve, on New Year's Day,
 * and what has no confirmed place (held apart, never called near). A corpus
 * without Atlas's distance readings is measured from coordinates only.
 * Skipped without a corpus.
 */
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
];

describe.skipIf(!file)("the holiday season in a real corpus", () => {
  it("counts what each community would be offered", () => {
    const raw = readFileSync(file!);
    const parsed = JSON.parse(
      (file!.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
    );
    const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
      ? parsed
      : parsed.candidates;
    const today = process.env.HOLIDAY_TODAY ?? "2026-11-23";
    const finds = findsIn(candidates.map(candidateToExperience), today);
    const lines: string[] = [`today ${today}, ${finds.length} finds`];
    for (const at of TOWNS) {
      const count = (params: Record<string, string>) => {
        const a = answer(finds, readAsk({ at, ...params }, { today }), {
          today,
        });
        const near = a.shelves.find((s) => s.id === "near")?.finds ?? [];
        return { near, unplaced: a.unplaced };
      };
      const season = count({ from: today, to: "2027-01-03" });
      const events = season.near.filter((f) => f.experience.kind === "Event");
      const nye = count({ when: "nye" });
      const nyd = count({ when: "nyd" });
      const newyear = count({ theme: "newyear" });
      lines.push(
        `${at}: season ${season.near.length} (events ${events.length}, unplaced ${season.unplaced}) · NYE ${nye.near.length} · NYD ${nyd.near.length} · New Year's category ${newyear.near.length} (unplaced ${newyear.unplaced})`,
      );
      for (const f of newyear.near)
        lines.push(
          `   🎆 ${f.when.from ?? "?"} ${f.experience.title} — ${f.km?.toFixed(1)} km`,
        );
      for (const f of nye.near.filter(
        (f) => !f.reading.themes.includes("newyear"),
      ))
        lines.push(`   NYE also: ${f.experience.title}`);
    }
    if (process.env.HOLIDAY_OUT)
      writeFileSync(process.env.HOLIDAY_OUT, lines.join("\n"));
    expect(finds.length).toBeGreaterThan(0);
  });
});
