import type {
  Award,
  Participant,
  Prompt,
  Response,
  ResponseValue,
} from "./types";

/**
 * Bragging rights, derived — never stored.
 *
 * The whole leaderboard is a pure function of (prompts that have a
 * resolution) × (responses). Nothing writes a score anywhere, which means
 * resolving a question late, or correcting it, just changes the standings
 * with no migration and no drift. It also means a fixture with no scored
 * prompts produces no leaderboard at all rather than an empty one — the
 * mechanism by which Date Night is not a competition.
 */

export interface ScoreLine {
  readonly promptId: string;
  readonly question: string;
  readonly points: number;
  readonly kind: "exact" | "partial";
  readonly note: string;
}

export interface Standing {
  readonly participant: Participant;
  readonly points: number;
  readonly exactCount: number;
  readonly answered: number;
  readonly lines: readonly ScoreLine[];
  readonly rank: number;
}

function sameValue(a: ResponseValue, b: ResponseValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/** Correct winner but wrong score: the partial-credit rule for a `pair`. */
function samePairWinner(a: readonly number[], b: readonly number[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  return Math.sign(a[0] - a[1]) === Math.sign(b[0] - b[1]);
}

export function scorePrompt(
  prompt: Prompt,
  response: Response | undefined,
): ScoreLine | null {
  if (!prompt.scoring || prompt.resolution === undefined || !response)
    return null;

  if (sameValue(response.value, prompt.resolution)) {
    return {
      promptId: prompt.id,
      question: prompt.question,
      points: prompt.scoring.points,
      kind: "exact",
      note: prompt.scoring.label ?? "Nailed it",
    };
  }

  if (
    prompt.kind === "pair" &&
    prompt.scoring.partial &&
    Array.isArray(response.value) &&
    Array.isArray(prompt.resolution) &&
    samePairWinner(
      response.value as readonly number[],
      prompt.resolution as readonly number[],
    )
  ) {
    return {
      promptId: prompt.id,
      question: prompt.question,
      points: prompt.scoring.partial.points,
      kind: "partial",
      note: prompt.scoring.partial.label,
    };
  }

  return null;
}

export function standings(
  participants: readonly Participant[],
  prompts: readonly Prompt[],
  responses: readonly Response[],
  carryOver: readonly { participantId: string; points: number }[] = [],
): Standing[] {
  const scored = prompts.filter((p) => p.scoring);
  if (scored.length === 0) return [];

  /**
   * A cooperative quest that anybody completed is completed by everybody.
   *
   * The point of a group quest is that the group did a thing, so it must not
   * turn into a race to be the one who taps the button — which is exactly
   * what happened the first time it scored per-person.
   */
  const sharedWins = new Set(
    scored
      .filter((p) => p.scoring?.shared && p.resolution !== undefined)
      .filter((p) =>
        responses.some(
          (r) => r.promptId === p.id && sameValue(r.value, p.resolution!),
        ),
      )
      .map((p) => p.id),
  );

  const rows = participants.map((participant) => {
    const mine = responses.filter((r) => r.participantId === participant.id);
    const lines: ScoreLine[] = [];
    for (const prompt of scored) {
      if (sharedWins.has(prompt.id)) {
        lines.push({
          promptId: prompt.id,
          question: prompt.question,
          points: prompt.scoring!.points,
          kind: "exact",
          note: prompt.scoring!.label ?? "Together",
        });
        continue;
      }
      const line = scorePrompt(
        prompt,
        mine.find((r) => r.promptId === prompt.id),
      );
      if (line) lines.push(line);
    }
    const carried =
      carryOver.find((c) => c.participantId === participant.id)?.points ?? 0;
    return {
      participant,
      points: lines.reduce((sum, l) => sum + l.points, 0) + carried,
      exactCount: lines.filter((l) => l.kind === "exact").length,
      answered: mine.filter((r) => scored.some((p) => p.id === r.promptId))
        .length,
      lines,
      rank: 0,
    };
  });

  rows.sort((a, b) => b.points - a.points || b.exactCount - a.exactCount);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface GrantedAward {
  readonly award: Award;
  readonly participant: Participant;
  readonly detail: string;
}

/**
 * Titles. Who wins each is computed from the same standings; what the title
 * is *called* comes from the fixture, which is why a ski day gives out "Run
 * of the Day" and a hockey night gives out "Passport Potato" without the
 * engine knowing either phrase exists.
 */
export function grantAwards(
  awards: readonly Award[],
  table: readonly Standing[],
  responses: readonly Response[],
): GrantedAward[] {
  if (table.length === 0) return [];
  const granted: GrantedAward[] = [];
  /**
   * Nobody collects two titles while somebody else has none.
   *
   * The first version let the winner sweep — champion, prophet *and* boldest
   * wrong opinion — which is both unfunny and, in the case of the last one,
   * self-contradicting. Spreading them is what makes the end of the night
   * feel like the group had one, rather than like one person won.
   */
  const taken = new Set<string>();
  const pick = (candidates: readonly Standing[]): Standing | undefined =>
    candidates.find((c) => !taken.has(c.participant.id)) ?? candidates[0];

  for (const award of awards) {
    let winner: Standing | undefined;
    let detail = "";

    switch (award.basis) {
      case "top":
        winner = table[0];
        detail = `${winner.points} points`;
        break;
      case "bottom":
        winner = pick([...table].reverse());
        detail = winner ? `${winner.points} points, and a long walk home` : "";
        break;
      case "mostExact":
        winner = pick([...table].sort((a, b) => b.exactCount - a.exactCount));
        detail = winner
          ? `${winner.exactCount} exact ${winner.exactCount === 1 ? "call" : "calls"}`
          : "";
        if (winner && winner.exactCount === 0) winner = undefined;
        break;
      case "boldest": {
        // The person whose answers the fewest other people shared.
        const scores = table.map((row) => {
          const mine = responses.filter(
            (r) => r.participantId === row.participant.id,
          );
          const company = mine.reduce((sum, r) => {
            const others = responses.filter(
              (o) =>
                o.promptId === r.promptId &&
                o.participantId !== r.participantId &&
                JSON.stringify(o.value) === JSON.stringify(r.value),
            );
            return sum + others.length;
          }, 0);
          return { row, company, answers: mine.length };
        });
        // "Boldest wrong opinion" has to actually be wrong, or it is just
        // another name for the winner.
        const bold = scores
          .filter((s) => s.answers > 0 && s.row.exactCount === 0)
          .sort((a, b) => a.company - b.company)
          .map((s) => s.row);
        winner = pick(bold);
        detail = "Went where nobody else would";
        break;
      }
      case "quietest": {
        const quiet = pick([...table].sort((a, b) => a.answered - b.answered));
        winner =
          quiet && quiet.answered < Math.max(...table.map((t) => t.answered))
            ? quiet
            : undefined;
        detail = `Answered ${quiet?.answered ?? 0}`;
        break;
      }
    }

    if (winner) {
      taken.add(winner.participant.id);
      granted.push({ award, participant: winner.participant, detail });
    }
  }

  return granted;
}
