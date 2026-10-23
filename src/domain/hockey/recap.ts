import type { GrantedAward, Standing } from "@/experience-lab/core/scoring";

/**
 * **The morning-after recap, as plain text a person can paste.**
 *
 * Plain on purpose, like the lab's standings share: it survives Slack,
 * iMessage and a screenshot, needs no account and unfurls nothing. It names
 * the winner, gives the score the group played against, the table and the
 * titles, and carries the night's link — which is private, so a stranger who
 * receives it sees only that they need an invitation.
 */
export interface RecapInput {
  readonly title: string;
  /** "Canucks 3–2 Wild", when somebody has called or the league has recorded it. */
  readonly result?: string;
  readonly standings: readonly Standing[];
  readonly awards: readonly GrantedAward[];
  readonly url?: string;
  /** Every scored question has been called. Otherwise the table is "so far". */
  readonly settled?: boolean;
}

export function recapText(input: RecapInput): string | null {
  const scoring = input.standings.filter((row) => row.points > 0);
  if (scoring.length === 0) return null;

  const topPoints = scoring[0].points;
  const winners = scoring.filter((row) => row.points === topPoints);
  const names = winners.map((w) => w.participant.name).join(" and ");
  const settled = input.settled ?? true;
  const headline = settled
    ? winners.length === 1
      ? `🏆 ${names} won ${input.title}`
      : `🏆 ${names} share ${input.title}`
    : `🏆 ${names} ${winners.length === 1 ? "leads" : "lead"} ${input.title}, with a few calls still open`;

  const table = input.standings.map(
    (row) => `${row.rank}. ${row.participant.name} — ${row.points}`,
  );
  const titles = input.awards.map(
    (a) => `${a.award.emoji} ${a.award.label}: ${a.participant.name}`,
  );

  return [
    headline,
    input.result ? `🏒 ${input.result}` : "",
    "",
    ...table,
    ...(titles.length > 0 ? ["", ...titles] : []),
    "",
    "No money changed hands. Somehow that makes it worse.",
    input.url ?? "",
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n")
    .trim();
}
