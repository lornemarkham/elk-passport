import type { Fear } from "./catalogue";

/** Shared with the browser; the server module adds the reads and writes. */
export type Verdict = "loved" | "good" | "meh";

export interface MovieReaction {
  filmId: string;
  verdict: Verdict;
  felt: Fear | null;
  gotMe: string | null;
  reactedAt: string;
}
