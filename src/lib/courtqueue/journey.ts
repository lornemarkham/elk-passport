import { CHALLENGE_IDS, TECHNIQUE_IDS, type LevelId } from "./learn";

/**
 * **My Badminton Journey.** What a player tells CourtQueue about where they
 * are, so the app can suggest games and things to try. It belongs to that
 * player: it is sent to that player's phone and nobody else's, never shown on
 * a card, never counted, never compared. Every part is optional and changeable.
 *
 * It is a gentle input to game suggestions (`fair.ts`) — behind turns, minutes
 * and waiting, which always come first — and the organizer can always assign a
 * game by hand.
 */

export type Level = LevelId;

export const LEVELS: readonly {
  id: Level;
  label: string;
  blurb: string;
}[] = [
  {
    id: "beginner",
    label: "Beginner",
    blurb: "New to the game, or just getting going.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    blurb: "Comfortable with the basics and building on them.",
  },
  {
    id: "advanced",
    label: "Advanced",
    blurb: "Playing for a while and keen to keep learning.",
  },
];

export interface Journey {
  /** Where they say they are. Absent = "I'd rather not say". */
  level?: Level;
  /** "I'd like a friendly partner who can show me a few things." */
  wantsHelp?: boolean;
  /** They have been asked (and may have skipped), so the question is not repeated. */
  asked?: boolean;
  /** Up to three goals, in their own words. */
  goals: string[];
  /** Technique ids they are practising. */
  practising: string[];
  /** Optional challenge ids they've tried. */
  done: string[];
}

export const emptyJourney = (): Journey => ({
  goals: [],
  practising: [],
  done: [],
});

export const isLevel = (v: unknown): v is Level =>
  v === "beginner" || v === "intermediate" || v === "advanced";

/** 0, 1, 2 — used only inside the suggestion engine, never sent anywhere. */
export const levelRank = (l: Level | undefined): number | null =>
  l === "beginner" ? 0 : l === "intermediate" ? 1 : l === "advanced" ? 2 : null;

const uniq = (xs: string[]) => [...new Set(xs)];

/** Whatever was stored or sent, made safe. */
export function cleanJourney(raw: unknown): Journey {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const j: Journey = {
    goals: strings(r.goals)
      .map((g) => g.replace(/\s+/g, " ").trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 3),
    practising: uniq(strings(r.practising).filter((t) => TECHNIQUE_IDS.has(t))),
    done: uniq(strings(r.done).filter((c) => CHALLENGE_IDS.has(c))),
  };
  if (isLevel(r.level)) j.level = r.level;
  if (r.wantsHelp === true) j.wantsHelp = true;
  if (r.asked === true) j.asked = true;
  return j;
}

/** What the player's own phone is told about their progress. Encouraging, never a score. */
export function encouragement(
  j: Journey,
  s: { attended: number; games: number; partners: number },
): string[] {
  const out: string[] = [];
  if (s.games === 0)
    out.push("Your first game is waiting — everyone starts here.");
  else if (s.games === 1) out.push("You've played your first game. Welcome!");
  else out.push(`${s.games} games played so far. That's real court time.`);
  if (s.partners >= 3)
    out.push(
      `You've played with ${s.partners} different partners. Friendships!`,
    );
  if (s.attended >= 2) out.push(`You've been along to ${s.attended} nights.`);
  if (j.practising.length > 0)
    out.push(
      `You're practising ${j.practising.length === 1 ? "one thing" : `${j.practising.length} things`}. Small steps add up.`,
    );
  if (j.done.length > 0)
    out.push(
      `${j.done.length === 1 ? "One challenge" : `${j.done.length} challenges`} tried. Nice.`,
    );
  return out;
}
