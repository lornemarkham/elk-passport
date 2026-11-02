import type { ResponseValue } from "@/lib/adventures/rules";

/** One idea as the two of you voted on it. */
export interface Vote {
  readonly id: string;
  readonly confirmed: boolean;
  readonly yours: ResponseValue | null;
  /** Everybody else's best answer; null until they vote. */
  readonly theirs: ResponseValue | null;
}

export interface Plan {
  /** Locked in by the host. */
  readonly locked: readonly string[];
  /** Both of you said Love it. */
  readonly bothIn: readonly string[];
  /** One Love it and nobody against: worth a conversation. */
  readonly leaning: readonly string[];
}

/**
 * **Read the plan from the votes**, inventing nothing. Anything either of you
 * said Nope to stays out (unless the host locked it); a plan with nothing both
 * love shows what one of you loves and the other hasn't ruled out.
 */
export function planOf(votes: readonly Vote[]): Plan {
  const locked: string[] = [];
  const bothIn: string[] = [];
  const leaning: string[] = [];
  for (const v of votes) {
    if (v.confirmed) locked.push(v.id);
    else if (v.yours === "out" || v.theirs === "out") continue;
    else if (v.yours === "in" && v.theirs === "in") bothIn.push(v.id);
    else if (v.yours === "in" || v.theirs === "in") leaning.push(v.id);
  }
  return { locked, bothIn, leaning };
}
