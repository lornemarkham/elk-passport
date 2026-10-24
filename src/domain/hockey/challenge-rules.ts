/**
 * The closed sets a challenge is made of — kinds, the questions a bet can
 * ride on, sides, team reactions. A leaf module on purpose: `actions.ts`
 * builds its schema from these while the page is still loading, and the
 * rest of `challenges.ts` sits inside the night/schedule/teams import cycle.
 */
export const CHALLENGE_KINDS = [
  "bet",
  "defend",
  "commentary",
  "hottake",
  "prophecy",
] as const;
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number];

export const MARKETS = ["winner", "first-goal", "overtime", "goals"] as const;
export type Market = (typeof MARKETS)[number];

export const SIDES = ["home", "away", "yes", "no", "over", "under"] as const;
export type Side = (typeof SIDES)[number];

export const TEAM_REACTIONS = ["🫡", "🤡", "🧂", "🔥", "🪦"] as const;
