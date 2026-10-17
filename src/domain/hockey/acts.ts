import type { Phase } from "@/experience-lab/core/types";

/**
 * **Before the game, during it, after it.**
 *
 * The night already changes shape on its own — ten phases, each with its own
 * headline, its own blocks, and in the periods a page that says only "Put
 * your phone away". What it never said was where you are in it. A guest
 * opening the link on Wednesday could not tell that a vault opens at the
 * second intermission or that the morning after has awards in it, which is
 * most of the reason to come back.
 *
 * So: three acts, named the way a person would say them, each carrying the
 * phases it holds. Grouping only — no phase moves, no lock changes, and the
 * page is still composed by the phase, not by the act.
 */

export type ActId = "before" | "during" | "after";

export interface Act {
  readonly id: ActId;
  readonly label: string;
  /** What this act is for, in one line. Shown when it is not the current one. */
  readonly promise: string;
  readonly phaseIds: readonly string[];
}

export const ACTS: readonly Act[] = [
  {
    id: "before",
    label: "Before the game",
    promise: "Picks, the pregame vote, and questions about each other.",
    phaseIds: ["before", "warmup"],
  },
  {
    id: "during",
    label: "During",
    promise: "Phones away. Intermissions are for one stupid thing.",
    phaseIds: ["live", "int1", "p2", "int2", "p3"],
  },
  {
    id: "after",
    label: "After",
    promise: "Awards, receipts, and whether you run it back.",
    phaseIds: ["after", "morning", "again"],
  },
];

export function actOf(phaseId: string): Act {
  return ACTS.find((a) => a.phaseIds.includes(phaseId)) ?? ACTS[0];
}

/** The next phase that has a time, and what it is called — or null at the end. */
export function nextPhase(
  phases: readonly Phase[],
  currentId: string,
): Phase | null {
  const at = phases.findIndex((p) => p.id === currentId);
  return at >= 0 && at < phases.length - 1 ? phases[at + 1] : null;
}
