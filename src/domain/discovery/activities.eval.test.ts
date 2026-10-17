import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { distanceKm } from "@/lib/environment/geo";
import { defaultFeed } from "./defaultFeed";
import { nearYou } from "./proximity";
import { DISCOVERY_TOWNS } from "./towns";
import {
  ACTIVITIES,
  ACTIVITY_GROUPS,
  activitiesOf,
  activityEvidence,
  activityExplorer,
} from "./activities";

/**
 * **The activity vocabulary against a real Atlas corpus** — not a gate, a lens.
 *
 * Runs only with `ACTIVITY_CORPUS=/path` and writes, for Vernon and
 * Vancouver, every activity with how many places Atlas holds for it near
 * there and anywhere, and then every Atlas word no activity recognises — the
 * list to read before adding to `activities.ts`.
 *
 * The corpus is either a saved `GET /discovery/candidates` body (`.json` or
 * the committed critic fixture's `.json.gz`) or an array of Passport's own
 * mapped experiences, such as the pool production Discovery embeds in its
 * page. `ACTIVITY_OUT` sets the file.
 *
 *   ACTIVITY_CORPUS=docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz \
 *   ACTIVITY_OUT=/tmp/activities.txt npx vitest run src/domain/discovery/activities.eval
 */
const CORPUS = process.env.ACTIVITY_CORPUS;
const TODAY = process.env.ACTIVITY_TODAY ?? "2026-10-16";

const ORIGINS = {
  Vernon: { latitude: 50.267, longitude: -119.272 },
  Vancouver: { latitude: 49.2827, longitude: -123.1207 },
} as const;

function load(path: string): Experience[] {
  const raw = readFileSync(path);
  const text = path.endsWith(".gz") ? gunzipSync(raw).toString() : raw;
  const body = JSON.parse(text.toString()) as unknown;
  const list = (
    Array.isArray(body)
      ? body
      : ((body as { candidates?: unknown[] }).candidates ?? [])
  ) as Record<string, unknown>[];
  return list.map((row) =>
    "title" in row
      ? (row as unknown as Experience)
      : candidateToExperience(row as unknown as DiscoveryCandidate),
  );
}

const townAt = (name: string) =>
  DISCOVERY_TOWNS.find(
    (t) => t.name.replace(/,\s*BC$/, "").toLowerCase() === name.toLowerCase(),
  );

/**
 * Distance the way Atlas measures it for Discovery (as `corpus.eval` does): a
 * straight line from stated coordinates, else from the centre of a stated
 * town, else unknown. A saved body carries none of its own.
 */
function measured(
  experiences: readonly Experience[],
  origin: { latitude: number; longitude: number },
): Experience[] {
  return experiences.map((e) => {
    const c = e.geography?.coordinates;
    const town = e.geography?.locality
      ? townAt(e.geography.locality)
      : undefined;
    const point = c ? { latitude: c[1], longitude: c[0] } : town;
    if (!point) return { ...e, distance: { state: "unknown" as const } };
    const km = Math.round(distanceKm(origin, point) * 10) / 10;
    return c
      ? {
          ...e,
          distance: { state: "measured" as const, km, basis: "coordinates" },
        }
      : {
          ...e,
          distance: {
            state: "measured" as const,
            km,
            basis: "town" as const,
            town: town!.name.replace(/,\s*BC$/, ""),
          },
        };
  });
}

describe.skipIf(!CORPUS)("activities against a real corpus", () => {
  it("writes what each town holds for every activity", () => {
    const all = load(CORPUS!);
    const feed = defaultFeed(all);
    const lines: string[] = [
      `corpus ${CORPUS} · ${all.length} subjects · ${feed.length} in the feed · ${TODAY}`,
    ];
    for (const [town, origin] of Object.entries(ORIGINS)) {
      const near = nearYou(measured(feed, origin), origin);
      const explorer = activityExplorer(near, feed, { day: TODAY });
      lines.push("", `## ${town} — ${near.length} subjects within 50 km`);
      for (const group of explorer) {
        const label = ACTIVITY_GROUPS.find((g) => g.key === group.key)?.label;
        lines.push(`  ${label}`);
        for (const entry of group.entries) {
          const sample = entry.here
            .slice(0, 3)
            .map(
              (e) =>
                `${e.title} [${activityEvidence(e, entry.activity).join(", ")}]`,
            )
            .join("; ");
          lines.push(
            `    ${entry.activity.label}: ${entry.here.length} here · ${entry.anywhere} anywhere${entry.inSeason ? "" : " · out of season"}${sample ? ` — ${sample}` : ""}`,
          );
        }
      }
    }

    // **What no activity recognises**, most common first.
    const unread = new Map<string, number>();
    const add = (word: string) => unread.set(word, (unread.get(word) ?? 0) + 1);
    for (const e of all) {
      const recognised = activitiesOf(e);
      if (recognised.length > 0) continue;
      for (const a of e.knowledge?.affordances ?? [])
        if (a.name) add(`affordance: ${a.name.toLowerCase()}`);
      if ((e.knowledge?.affordances ?? []).length > 0 || e.kind === "Activity")
        add(`${e.kind} subtype: ${(e.subtype ?? "").toLowerCase()}`);
    }
    lines.push("", "## Atlas words on subjects no activity recognises");
    for (const [word, count] of [...unread].sort((a, b) => b[1] - a[1]))
      lines.push(`  ${count} ${word}`);
    lines.push(
      "",
      `${ACTIVITIES.length} activities in ${ACTIVITY_GROUPS.length} groups`,
    );
    writeFileSync(
      process.env.ACTIVITY_OUT ?? "/tmp/activities.txt",
      lines.join("\n"),
    );
  });
});
