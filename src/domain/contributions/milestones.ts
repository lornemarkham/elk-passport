/**
 * **Contributor milestones** (owner brief 2026-11-23, P3): five shared
 * across every Passport experience, counted on **approved** contributions
 * only. A pending suggestion earns thanks at once and nothing else; a
 * declined, duplicate or spam one never counts.
 */
export const MILESTONES = [
  { at: 1, title: "First Discovery", emoji: "🌱" },
  { at: 5, title: "Local Explorer", emoji: "🧭" },
  { at: 10, title: "Community Scout", emoji: "🔭" },
  { at: 25, title: "Discovery Champion", emoji: "🏅" },
  { at: 50, title: "Local Legend", emoji: "🏆" },
] as const;
export type Milestone = (typeof MILESTONES)[number];

export interface Progress {
  readonly approved: number;
  readonly pending: number;
  /** Every milestone reached, lowest first. */
  readonly earned: readonly Milestone[];
  /** The latest one reached, if any. */
  readonly current?: Milestone;
  /** The next one, with how many more approvals it needs; absent at the top. */
  readonly next?: { readonly milestone: Milestone; readonly remaining: number };
}

export function progress(approved: number, pending = 0): Progress {
  const earned = MILESTONES.filter((m) => approved >= m.at);
  const upcoming = MILESTONES.find((m) => approved < m.at);
  return {
    approved,
    pending,
    earned,
    ...(earned.length ? { current: earned[earned.length - 1] } : {}),
    ...(upcoming
      ? { next: { milestone: upcoming, remaining: upcoming.at - approved } }
      : {}),
  };
}

/** Which milestone, if any, this approval just reached. */
export function reachedBy(approvedBefore: number, approvedAfter: number) {
  return MILESTONES.find((m) => approvedBefore < m.at && approvedAfter >= m.at);
}

/** One warm line for the moment after sending, honest about what is pending. */
export function thanks(p: Progress): string {
  if (p.next)
    return p.approved === 0
      ? `Thanks for making Passport better! Your suggestion is in for review. Once it's approved you'll earn ${p.next.milestone.emoji} ${p.next.milestone.title}.`
      : `Thanks! That's in for review. You have ${p.approved} approved so far — ${p.next.remaining} more to ${p.next.milestone.emoji} ${p.next.milestone.title}.`;
  return `Thanks! That's in for review. You're a ${p.current?.emoji ?? "🏆"} ${p.current?.title ?? "Local Legend"} — ${p.approved} approved and counting.`;
}
