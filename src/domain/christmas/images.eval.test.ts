import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { cardPictures } from "@/lib/media/cardPicture";
import { answer, findsIn, readAsk, type Find } from "./discover";
import { around, strongest } from "./around";
import { longRun } from "./ways";
import { christmasPictures } from "./pictures";

/**
 * **Christmas image coverage, measured on a real Atlas pool** (mission 1126).
 *
 *   IMAGES_CORPUS=out.json IMAGES_OUT=images.json IMAGES_TODAY=2026-11-25 \
 *     npx vitest run src/domain/christmas/images.eval
 *
 * For each priority town it takes the same cards the pages show — the front
 * page's four (`NearYou`: `around`'s order, a long run not leading) and the
 * whole Discover answer for the season — and says, per card, whether Christmas
 * can show a picture of this very thing, and if not, what Atlas holds that it
 * will not show (a venue's or organiser's photo, a stand-in). The JSON it
 * writes feeds `docs/product/christmas/verification/image-urls.mjs`, which
 * checks every picture actually loads.
 */
const file = process.env.IMAGES_CORPUS;
const TOWNS = [
  "vernon",
  "coldstream",
  "armstrong",
  "lumby",
  "silverstar",
  "lake-country",
  "kelowna",
  "west-kelowna",
  "penticton",
  "salmon-arm",
  "vancouver",
  "burnaby",
  "richmond",
  "surrey",
  "north-vancouver",
];

function status(f: Find) {
  const e = f.experience;
  const shown = christmasPictures(e)[0];
  const held = cardPictures(e).filter((p) => p.label);
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    when: f.when.from,
    km: f.km,
    themes: f.reading.themes,
    shown: shown?.src,
    from: shown
      ? e.heroMedia?.src === shown.src
        ? "own"
        : "presented-exact"
      : undefined,
    withheld: held.map((p) => ({ src: p.src, label: p.label })),
    area: e.geography?.area?.name,
  };
}

describe.skipIf(!file)("m1126 christmas image coverage", () => {
  it("measures", () => {
    const parsed = JSON.parse(readFileSync(file!, "utf8"));
    const c: DiscoveryCandidate[] = parsed.candidates;
    const today = process.env.IMAGES_TODAY ?? "2026-11-25";
    const finds = findsIn(c.map(candidateToExperience), today);
    const towns = TOWNS.map((at) => {
      const ask = readAsk({ at }, { today });
      const answered = answer(finds, ask, { today });
      const front = strongest(around(answered, today, [], ask.km), 4, longRun);
      const season = answer(
        finds,
        readAsk({ at, from: today, to: "2027-01-03" }, { today }),
        { today },
      );
      const all = season.shelves
        .flatMap((s) => s.finds)
        .filter(
          (f, i, xs) =>
            xs.findIndex((g) => g.experience.id === f.experience.id) === i,
        );
      return {
        at,
        front: front.map(status),
        all: all.map(status),
      };
    });
    const everyFind = finds.map(status);
    writeFileSync(
      process.env.IMAGES_OUT ?? "images.json",
      JSON.stringify({ today, poolSize: c.length, towns, everyFind }, null, 1),
    );
    expect(finds.length).toBeGreaterThan(0);
  });
});
