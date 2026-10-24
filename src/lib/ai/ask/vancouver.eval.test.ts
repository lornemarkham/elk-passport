import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { distanceKm } from "@/lib/environment/geo";
import { readAsk, readBack } from "./read";
import { answerAsk } from "./answer";
import { NEARBY_KM } from "./apply";

/**
 * **A Vancouver visitor's questions against production's own pool** — a lens,
 * not a gate. Runs only with `VAN_POOL=<experiences.json>`: the mapped
 * `experiences` array production's Discovery page sends the browser
 * (`scripts/vancouver/pool.mjs` extracts it from a saved page). Distance is
 * measured in a straight line from JW Marriott Parq, as Atlas would from a
 * shared position. `VAN_TODAY`, `VAN_OUT`.
 *
 *   VAN_POOL=pool.json VAN_OUT=van.txt npx vitest run src/lib/ai/ask/vancouver.eval
 */
const POOL = process.env.VAN_POOL;
const TODAY = process.env.VAN_TODAY ?? "2026-10-26";
const PARQ = { latitude: 49.2746, longitude: -123.1138 };

export const VANCOUVER_QUESTIONS = [
  "What's good near my hotel?",
  "Where should we grab dinner?",
  "We have 45 minutes before our next session.",
  "Show me cool bars within walking distance.",
  "What can five coworkers do tonight?",
  "Something fun after dinner.",
  "Plan an amazing Saturday in Vancouver.",
  "Find somewhere for coffee and a walk.",
  "Great coffee near JW Marriott Parq",
  "A good restaurant for five coworkers tonight",
  "Something fun within a 20-minute walk",
  // The conference's own doors into Discovery (askDoorsFor).
  "What's good near the venue?",
  "Coffee within a 10-minute walk",
  "Something fun after the sessions, within walking distance",
  "Where can our group go tonight?",
];

describe.skipIf(!POOL)("a Vancouver visitor asking", () => {
  it("answers from the Parq", () => {
    const pool = JSON.parse(readFileSync(POOL!, "utf8")) as Experience[];
    const placed = pool.map((e) => {
      const c = e.geography?.coordinates;
      return {
        ...e,
        distance: c
          ? {
              state: "measured" as const,
              km:
                Math.round(
                  distanceKm(PARQ, { latitude: c[1], longitude: c[0] }) * 10,
                ) / 10,
              basis: "coordinates" as const,
            }
          : { state: "unknown" as const },
      } as Experience;
    });
    const area = placed.filter(
      (e) =>
        !e.geography?.area?.name || e.geography.area.name === "Metro Vancouver",
    );
    const verbs = [
      ...new Set(
        pool.flatMap((e) =>
          (e.knowledge?.affordances ?? []).map((a) => a.name),
        ),
      ),
    ];
    const out: string[] = [
      `pool ${pool.length} · area ${area.length} · ${TODAY}`,
    ];
    for (const said of VANCOUVER_QUESTIONS) {
      const ask = readAsk(said, { today: TODAY, verbs });
      // The page's radius: a stated one, else "nearby" as `applyAsk` sets it.
      const within =
        ask.lens === "drive"
          ? undefined
          : (ask.withinKm ?? (ask.near ? NEARBY_KM : undefined));
      const inside =
        within === undefined
          ? area
          : area.filter(
              (e) =>
                e.distance?.state === "measured" && e.distance.km <= within,
            );
      const answer = answerAsk(ask.lens === "drive" ? placed : inside, ask, {
        today: TODAY,
        origin: PARQ,
        originLabel: "where you are",
        home: "Metro Vancouver",
        reference: area,
      });
      out.push(
        `\n## "${said}"`,
        `   read: ${readBack(ask, { today: TODAY }).join(" · ") || "-"}  [lens ${ask.lens ?? "-"}] ${JSON.stringify(ask)}`,
        `   ${answer.heading} — ${answer.note}`,
      );
      for (const p of answer.picks) {
        const e = p.experience;
        const km =
          e.distance?.state === "measured" ? `${e.distance.km}km` : "?km";
        out.push(
          `   • ${e.title} [${e.kind}/${e.subtype ?? "-"}] ${km}${e.heroMedia || e.presentationImage ? " 📷" : ""} — ${p.reasons.join(" | ")}${p.caveat ? `  ⚠ ${p.caveat}` : ""}`,
        );
      }
      if (answer.picks.length === 0) out.push("   (nothing)");
      for (const gap of answer.gaps) out.push(`   ? ${gap.text}`);
    }
    writeFileSync(process.env.VAN_OUT ?? "/dev/stdout", out.join("\n"));
  });
});
