import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { findsIn, priceOf } from "./discover";
import { hasChristmasPicture } from "./pictures";
import { around } from "./around";
import { answer } from "./discover";

/**
 * **Data quality of the Christmas finds in a real Atlas corpus** — run on demand:
 *
 *   CHRISTMAS_CORPUS=docs/product/christmas/verification/atlas-candidates-2026-11-14.json.gz \
 *   CHRISTMAS_TODAY=2026-11-19 CHRISTMAS_OUT=/tmp/quality.txt \
 *   npx vitest run src/domain/christmas/quality.eval
 *
 * Counts, for the finds that are Christmas, what is confirmed, what is not,
 * what is over, and what each card could say (dates, place, price, picture) —
 * and asserts the one rule that must never break: a find whose dates have
 * gone is never offered as upcoming. Skipped without a corpus.
 */
const file = process.env.CHRISTMAS_CORPUS;

describe.skipIf(!file)("Christmas data quality in a real corpus", () => {
  it("never offers an expired event as upcoming, and reports what is missing", () => {
    const raw = readFileSync(file!);
    const parsed = JSON.parse(
      (file!.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
    );
    const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
      ? parsed
      : parsed.candidates;
    const today = process.env.CHRISTMAS_TODAY ?? "2026-11-19";
    const finds = findsIn(candidates.map(candidateToExperience), today);
    const xmas = finds.filter((f) => f.reading.christmas);
    const by = (c: string) => xmas.filter((f) => f.when.confidence === c);
    const lines: string[] = [];
    const n = (label: string, k: number) =>
      lines.push(`${label.padEnd(52)} ${k}`);
    n("candidates in corpus", candidates.length);
    n("Christmas finds", xmas.length);
    for (const c of ["dated", "check", "unconfirmed", "past"])
      n(`  ${c}`, by(c).length);
    n(
      "with a place Atlas can name (venue/where)",
      xmas.filter((f) => f.experience.venue || f.experience.geography).length,
    );
    n(
      "with a stated price in the organiser's words",
      xmas.filter((f) => priceOf(f.experience).price).length,
    );
    n(
      "with a real (non stand-in) picture",
      xmas.filter((f) => hasChristmasPicture(f.experience)).length,
    );
    n(
      "with a visit duration",
      xmas.filter((f) => f.experience.visitDuration).length,
    );
    // Events whose last day is before today but not marked past.
    const stale = xmas.filter(
      (f) => f.when.confidence !== "past" && f.when.to && f.when.to < today,
    );
    n("EXPIRED but not shelved as past (must be 0)", stale.length);

    // The front page: nothing in an "upcoming" section may be over.
    for (const at of ["vernon", "kelowna", "vancouver"]) {
      const a = answer(finds, {
        at,
        km: 100,
        ages: [],
        themes: [],
        budget: "any",
      });
      const sections = around(a, today, [], 100);
      const shown = sections.flatMap((s) => s.finds);
      const over = shown.filter((f) => f.when.to && f.when.to < today);
      n(
        `front page near ${at}: finds shown / expired among them`,
        shown.length,
      );
      lines.push(`    expired among them: ${over.length}`);
      expect(over).toHaveLength(0);
    }
    lines.push("", "Dated finds:");
    for (const f of by("dated"))
      lines.push(
        `  ${f.experience.title.slice(0, 50).padEnd(50)} ${f.when.line ?? ""} | pic=${hasChristmasPicture(f.experience)} | where=${f.experience.venue?.name ?? "—"}`,
      );
    if (process.env.CHRISTMAS_OUT)
      writeFileSync(process.env.CHRISTMAS_OUT, lines.join("\n") + "\n");
    expect(stale).toHaveLength(0);
  });
});
