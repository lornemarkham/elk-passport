import { teamColours } from "./teams";

/**
 * **A score always names its teams.**
 *
 * On 25 October 2026 a real group read "5–0" and "4–2" in the chat and the
 * recap and could not tell which number was whose: the host had meant the
 * Wild winning 5–0, the page had the Canucks first. The order a pick is
 * *stored* in has never changed — `[home, away]`, the arena's convention,
 * which is also the order the NHL's own record and the "Call it" sheet use —
 * but a bare pair of numbers has no orientation a reader can check. So
 * nothing on the night says a score without the two codes around it:
 * "VAN 2–4 MIN".
 *
 * One function, used by the reveal, the hero, the Cup, Chirp Bot and the
 * league's suggestion, so a prediction means the same thing everywhere. It
 * never re-orders a stored pick: historical answers are read as they were
 * written, home first.
 */

export interface ScoreSides {
  /** Tonight's home team, by nickname: "Canucks". The first number is theirs. */
  readonly home: string;
  /** Tonight's visitors: "Wild". The second number is theirs. */
  readonly away: string;
}

/** The two sides a `pair` question is about, from its labels. */
export function sidesOf(
  prompt: { readonly pairLabels?: readonly [string, string] } | undefined,
): ScoreSides | null {
  const labels = prompt?.pairLabels;
  return labels ? { home: labels[0], away: labels[1] } : null;
}

/** "VAN 2–4 MIN" — or, with `style: "name"`, "Canucks 2–4 Wild". */
export function scoreWords(
  pair: readonly number[],
  sides: ScoreSides | null | undefined,
  style: "abbr" | "name" = "abbr",
): string {
  const [h, a] = pair;
  if (!sides) return `${h}–${a}`;
  const code = (name: string) =>
    style === "name" ? name : teamColours(name).abbr;
  return `${code(sides.home)} ${h}–${a} ${code(sides.away)}`;
}

/** Who a score has winning — the arena's convention, home first. */
export function winnerOf(pair: readonly number[]): "home" | "away" | "tie" {
  const [h, a] = pair;
  return h > a ? "home" : a > h ? "away" : "tie";
}

/** Chirp Bot's keys carry a pick as "5-0"; back to the pair, or null. */
export function pairFromKey(part: string | undefined): [number, number] | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(part ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}
