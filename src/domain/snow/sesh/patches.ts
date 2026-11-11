/**
 * **Patches** — embroidered squadron-style insignia a rider earns.
 *
 * Every patch is derived from what happened (clips, votes, results), never
 * granted by hand, so it can't drift from the record and the demo earns them
 * with the same code. Half of them are for taking part, not winning: ranking
 * is not the only measure here.
 *
 * Each has an `art` spec the badge component stitches (shape, colours, a
 * motif) and a `code` a physical patch could carry (see SESH-WARS.md, P2).
 */
import type { World } from "./model";
import { featureOf, results } from "./rules";
import { hillSeason } from "./time";

export type PatchShape = "roundel" | "shield" | "wings" | "pennant";
export type Motif =
  | "plane"
  | "rail"
  | "star"
  | "crown"
  | "swords"
  | "phoenix"
  | "peaks"
  | "binoculars"
  | "flare";

export interface PatchArt {
  readonly shape: PatchShape;
  readonly field: string;
  readonly border: string;
  readonly ink: string;
  readonly motif: Motif;
}

export interface PatchDef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly how: string;
  readonly art: PatchArt;
  /** Shown locked with this note until the part of Sesh Wars it needs exists. */
  readonly comingWith?: string;
}

const OLIVE = "#4b5320";
const CREAM = "#efe6cf";
const ORANGE = "#c8641e";
const RED = "#a8322d";
const CHAR = "#2b2a27";
const SKY = "#5b7f95";

export const PATCHES: readonly PatchDef[] = [
  {
    id: "first-flight",
    code: "SW-01",
    name: "First Flight",
    how: "Post your first clip.",
    art: {
      shape: "roundel",
      field: SKY,
      border: CREAM,
      ink: CREAM,
      motif: "plane",
    },
  },
  {
    id: "gauntlet",
    code: "SW-02",
    name: "Gauntlet Thrown",
    how: "Answer someone's clip with a challenge.",
    art: {
      shape: "pennant",
      field: RED,
      border: CREAM,
      ink: CREAM,
      motif: "swords",
    },
  },
  {
    id: "top-cover",
    code: "SW-03",
    name: "Top Cover",
    how: "Vote in 10 challenges. Spectators keep the skies honest.",
    art: {
      shape: "roundel",
      field: CHAR,
      border: ORANGE,
      ink: CREAM,
      motif: "binoculars",
    },
  },
  {
    id: "rail-ace",
    code: "SW-04",
    name: "Rail Ace",
    how: "Win a challenge on a rail or box.",
    art: {
      shape: "shield",
      field: OLIVE,
      border: ORANGE,
      ink: CREAM,
      motif: "rail",
    },
  },
  {
    id: "style-commander",
    code: "SW-05",
    name: "Style Commander",
    how: "Win a Best Style challenge.",
    art: {
      shape: "wings",
      field: ORANGE,
      border: CHAR,
      ink: CHAR,
      motif: "star",
    },
  },
  {
    id: "comeback-kid",
    code: "SW-06",
    name: "Comeback Kid",
    how: "Win a challenge after losing one.",
    art: {
      shape: "shield",
      field: CREAM,
      border: RED,
      ink: RED,
      motif: "phoenix",
    },
  },
  {
    id: "local-legend",
    code: "SW-07",
    name: "Local Legend",
    how: "Finish a season as a feature's champion.",
    art: {
      shape: "roundel",
      field: RED,
      border: CREAM,
      ink: CREAM,
      motif: "crown",
    },
  },
  {
    id: "mountain-legend",
    code: "SW-08",
    name: "Mountain Legend",
    how: "Win challenges on three different features.",
    art: {
      shape: "wings",
      field: OLIVE,
      border: CREAM,
      ink: CREAM,
      motif: "peaks",
    },
  },
  {
    id: "squadron-leader",
    code: "SW-09",
    name: "Squadron Leader",
    how: "Organize a crew challenge.",
    art: {
      shape: "pennant",
      field: CHAR,
      border: CREAM,
      ink: ORANGE,
      motif: "flare",
    },
    comingWith: "Crews arrive in the next release.",
  },
];

export const patchById = (id: string) => PATCHES.find((p) => p.id === id);

export interface Earned {
  readonly patch: PatchDef;
  /** ISO time it was earned. */
  readonly at: string;
}

export function earnedPatches(
  w: World,
  now: number,
  riderId: string,
): Earned[] {
  const out: Earned[] = [];
  const add = (id: string, at: string | undefined) => {
    const patch = patchById(id);
    if (patch && at) out.push({ patch, at });
  };
  const mine = w.clips
    .filter((c) => c.riderId === riderId)
    .sort((a, b) => a.at.localeCompare(b.at));
  add("first-flight", mine[0]?.at);

  const mineIds = new Set(mine.map((c) => c.id));
  const thrown = w.challenges
    .filter((c) => mineIds.has(c.challengerClipId))
    .sort((a, b) => a.at.localeCompare(b.at));
  add("gauntlet", thrown[0]?.at);

  const votes = w.votes
    .filter((v) => v.voterId === riderId)
    .sort((a, b) => a.at.localeCompare(b.at));
  add("top-cover", votes[9]?.at);

  const rs = results(w, now);
  const wins = rs.filter((r) => r.winnerRiderId === riderId);
  add(
    "rail-ace",
    wins.find((r) => {
      const k = featureOf(w, r.challenge.featureId)?.kind;
      return k === "rail" || k === "box" || k === "jib";
    })?.closedAt,
  );
  add(
    "style-commander",
    wins.find((r) => r.challenge.category === "best-style")?.closedAt,
  );

  let lost = false;
  let comeback: string | undefined;
  for (const r of rs) {
    if (r.loserRiderId === riderId) lost = true;
    else if (r.winnerRiderId === riderId && lost) {
      comeback = r.closedAt;
      break;
    }
  }
  add("comeback-kid", comeback);

  const legend = (w.legends ?? []).find(
    (l) => l.riderId === riderId && l.season !== hillSeason(now),
  );
  add(
    "local-legend",
    legend ? `${legend.season.slice(0, 4)}-07-31T12:00:00Z` : undefined,
  );

  const features = new Set<string>();
  let third: string | undefined;
  for (const r of wins) {
    features.add(r.challenge.featureId);
    if (features.size === 3) {
      third = r.closedAt;
      break;
    }
  }
  add("mountain-legend", third);
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Patches this rider earned at or after `since` — for "you just earned…". */
export const newPatches = (
  w: World,
  now: number,
  riderId: string,
  since: number,
) => earnedPatches(w, now, riderId).filter((e) => Date.parse(e.at) >= since);
