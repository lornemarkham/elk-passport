import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { defaultFeed } from "@/domain/discovery/defaultFeed";
import { DISCOVERY_TOWNS } from "@/domain/discovery/towns";
import { distanceKm } from "@/lib/environment/geo";
import { gunzipSync } from "node:zlib";
import { readAsk, readBack } from "./read";
import { answerAsk } from "./answer";
import { readConversation } from "./conversation";

/**
 * **Real questions against a real Atlas response** — not a gate, a lens.
 *
 * Runs only with `ASK_CORPUS=/path/to/candidates.json` (a saved
 * `GET /discovery/candidates` body) and writes what Discovery would answer
 * from Vernon and from Vancouver. Atlas measures distance server-side and a
 * saved body has none, so it is measured here the way Atlas does: straight
 * line from stated coordinates, else from the centre of a stated town
 * (`basis: "town"`), else unknown. `ASK_TODAY` sets the day; `ASK_WET=1` a
 * wet forecast; `ASK_OUT` the file.
 *
 *   ASK_CORPUS=/tmp/feed.json ASK_OUT=/tmp/ask.txt npx vitest run src/lib/ai/ask/corpus.eval
 *
 * A `.json.gz` body — the committed critic fixture — is read as it is, and
 * so is a bare array of candidates. `CONVERSATIONS` below are read as whole
 * conversations, each turn answered from what everything before it said.
 */
const CORPUS = process.env.ASK_CORPUS;
const TODAY = process.env.ASK_TODAY ?? "2026-10-11";

const ORIGINS = {
  Vernon: { latitude: 50.267, longitude: -119.272, home: "Okanagan" },
  Vancouver: {
    latitude: 49.2827,
    longitude: -123.1207,
    home: "Metro Vancouver",
  },
} as const;

export const QUESTIONS = [
  "What can we do with three hours?",
  "I've got an hour",
  "Something unusual nearby",
  "Hidden gems around here",
  "Where can I take my 6 year old this afternoon?",
  "Date night tonight",
  "Something to do with my partner this weekend",
  "Something to do on my own today",
  "Friends are in town, what should we do?",
  "What's on today?",
  "What's happening this weekend?",
  "It's raining, what can we do inside?",
  "Get outside this afternoon",
  "What is worth driving an hour for?",
  // Discovery 2.0 (2026-10-16): the twelve the mission names.
  "I'm bored.",
  "Something fun with my five-year-old.",
  "We have three hours and don't want to drive far.",
  "Something unusual tonight.",
  "It's raining. What can we do indoors?",
  "A romantic afternoon.",
  "I want to get outside but not hike.",
  "Something adventurous near Vancouver.",
  "Something free within 30 minutes.",
  "I want to do something I've never tried.",
  "Movies tonight",
  "Something for grandparents",
  // Natural Discovery (2026-10-20): the five the mission names.
  "What can I do with my five-year-old today?",
  "It's raining. Find something fun indoors.",
  "What can we do within 30 minutes of Vernon?",
  "Surprise me with something unusual.",
  "What's happening in Vancouver this weekend?",
];

/** Whole conversations, turn by turn. */
export const CONVERSATIONS: readonly (readonly string[])[] = [
  [
    "Something fun with my daughter.",
    "About three hours.",
    "Maybe 45 minutes.",
    "Actually, somewhere indoors.",
  ],
  ["Something unusual tonight.", "Actually, make that tomorrow."],
  ["Hiking", "Show me something completely different."],
];

const townAt = (name: string) =>
  DISCOVERY_TOWNS.find(
    (t) => t.name.replace(/,\s*BC$/, "").toLowerCase() === name.toLowerCase(),
  );

function measured(
  experiences: readonly Experience[],
  origin: { latitude: number; longitude: number },
): Experience[] {
  return experiences.map((e) => {
    const c = e.geography?.coordinates;
    if (c) {
      const km = distanceKm(origin, { latitude: c[1], longitude: c[0] });
      return {
        ...e,
        distance: {
          state: "measured" as const,
          km: Math.round(km * 10) / 10,
          basis: "coordinates" as const,
        },
      };
    }
    const town = e.geography?.locality
      ? townAt(e.geography.locality)
      : undefined;
    if (town) {
      const km = distanceKm(origin, town);
      return {
        ...e,
        distance: {
          state: "measured" as const,
          km: Math.round(km * 10) / 10,
          basis: "town" as const,
          town: town.name.replace(/,\s*BC$/, ""),
        },
      };
    }
    return { ...e, distance: { state: "unknown" as const } };
  });
}

describe.skipIf(!CORPUS)("asking real Atlas", () => {
  it("answers from Vernon and Vancouver", () => {
    const raw = readFileSync(CORPUS!);
    const parsed = JSON.parse(
      (CORPUS!.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"),
    ) as { candidates: DiscoveryCandidate[] } | DiscoveryCandidate[];
    const body = Array.isArray(parsed) ? { candidates: parsed } : parsed;
    const all = defaultFeed(body.candidates.map(candidateToExperience));
    const verbs = [
      ...new Set(
        all.flatMap((e) => (e.knowledge?.affordances ?? []).map((a) => a.name)),
      ),
    ];
    const out: string[] = [
      `corpus: ${all.length} in the default feed · today ${TODAY}${process.env.ASK_WET === "1" ? " · wet" : ""}`,
    ];
    let picks = 0;
    let unplaced = 0;
    for (const [town, origin] of Object.entries(ORIGINS)) {
      const placed = measured(all, origin);
      // The page's area: what Atlas places in this home area, or nowhere.
      const area = placed.filter(
        (e) =>
          !e.geography?.area?.name || e.geography.area.name === origin.home,
      );
      for (const said of QUESTIONS) {
        const ask = readAsk(said, { today: TODAY, verbs });
        // "Worth the drive" looks past the area; everything else answers
        // from it, as the page does.
        const answer = answerAsk(ask.lens === "drive" ? placed : area, ask, {
          today: TODAY,
          origin,
          originLabel: town,
          home: origin.home,
          wet: process.env.ASK_WET === "1",
          reference: area,
        });
        out.push(
          `\n## ${town} — "${said}"`,
          `   read: ${readBack(ask, { today: TODAY }).join(" · ") || "-"}  [lens ${ask.lens ?? "-"}]`,
          `   ${answer.heading} — ${answer.note}`,
        );
        for (const p of answer.picks) {
          const e = p.experience;
          picks += 1;
          if (e.distance?.state !== "measured") unplaced += 1;
          out.push(
            `   • ${e.title} [${e.kind}/${e.subtype ?? "-"}]${e.heroMedia ? " 📷" : ""} — ${p.reasons.join(" | ")}${p.caveat ? `  ⚠ ${p.caveat}` : ""}`,
          );
        }
        if (answer.picks.length === 0) out.push("   (nothing)");
        for (const gap of answer.gaps) out.push(`   ? ${gap.text}`);
      }
      for (const turns of CONVERSATIONS) {
        let shown: string[] = [];
        for (let n = 1; n <= turns.length; n++) {
          const talk = readConversation(turns.slice(0, n), { today: TODAY });
          const ask = talk.ask;
          const answer = answerAsk(ask.lens === "drive" ? placed : area, ask, {
            today: TODAY,
            origin,
            originLabel: town,
            home: origin.home,
            wet: process.env.ASK_WET === "1",
            reference: area,
            shown,
            seed: n,
          });
          shown = [...shown, ...answer.picks.map((p) => p.experience.id)];
          out.push(
            `\n## ${town} — conversation, turn ${n}: "${turns[n - 1]}"`,
            `   heard: ${readBack(ask, { today: TODAY }).join(" · ") || "-"}  [lens ${ask.lens ?? "-"}]`,
            `   ${answer.heading} — ${answer.note}`,
            ...(talk.question ? [`   → asks: ${talk.question.text}`] : []),
            ...answer.picks.map(
              (p) =>
                `   • ${p.experience.title} [${p.experience.kind}/${p.experience.subtype ?? "-"}]${p.experience.heroMedia ? " 📷" : ""} — ${p.reasons.join(" | ")}${p.caveat ? `  ⚠ ${p.caveat}` : ""}`,
            ),
          );
        }
      }
    }
    out.push(`\n${picks} picks · ${unplaced} that Atlas cannot place`);
    writeFileSync(process.env.ASK_OUT ?? "/dev/stdout", out.join("\n"));
  });
});
