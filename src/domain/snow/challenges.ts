import { abilityRank, type Ability } from "./ability";

/**
 * **Mountain challenges: optional, group-sized, and safe by construction.**
 *
 * The doctrine reaches for a skiing example — *"Last run challenge. Who gets
 * down fastest?"* (§6). This product does not build that one. A prize for
 * speed is a prize for the thing that hurts people on a shared hill, and the
 * mission is explicit: never reward dangerous skiing, excessive speed, risky
 * terrain or ignoring mountain rules. The same spirit is kept — a last-run
 * ritual — without the race. (Named in the report as a doctrine/mission
 * tension; the mission wins because it is the more specific and the safer.)
 *
 * ## The rule is enforced, not hoped for
 *
 * `UNSAFE` is a deny-list that every catalogue entry and every
 * crew-written challenge is checked against (`checkChallengeText`), so an
 * edit that adds "fastest run" fails a test instead of shipping.
 */
export const CHALLENGE_CATEGORIES = [
  "run",
  "photo",
  "group",
  "apres",
  "creative",
] as const;
export type ChallengeCategory = (typeof CHALLENGE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ChallengeCategory, string> = {
  run: "On the hill",
  photo: "Photo",
  group: "Together",
  apres: "Après",
  creative: "Creative",
};

export interface Challenge {
  readonly id: string;
  readonly category: ChallengeCategory;
  readonly title: string;
  readonly detail: string;
  readonly points: number;
  /** Lowest ability this one is offered to. Absent means everyone. */
  readonly minAbility?: Ability;
  /** The line shown with it. Every challenge carries one. */
  readonly safety: string;
}

export const CHALLENGES: readonly Challenge[] = [
  {
    id: "chosen-run",
    category: "run",
    title: "Ride the crew's chosen run — together",
    detail:
      "Pick one run marked for the group's level on the resort map and ride it as a crew, regrouping at the bottom.",
    points: 20,
    minAbility: "beginner",
    safety:
      "Stay at the level of the most careful rider. Stop to regroup at the side, never mid-run.",
  },
  {
    id: "new-trail",
    category: "run",
    title: "Try a run you haven't ridden — within your ability",
    detail:
      "Choose a run marked for your own level that is new to you. Read the sign and the map first.",
    points: 25,
    minAbility: "beginner",
    safety:
      "Only runs open and marked for your level. If it looks harder than the sign says, take another.",
  },
  {
    id: "first-turns",
    category: "run",
    title: "First-timer win: link three turns in the learning area",
    detail: "Lesson first, then three controlled turns on the gentle slope.",
    points: 25,
    safety:
      "Lessons and the learning area are part of the plan, not a step to skip.",
  },
  {
    id: "viewpoint",
    category: "photo",
    title: "Find a scenic viewpoint and take it in",
    detail:
      "Somewhere safe and off the run — a lodge deck, a lookout, the top of a lift — with the best view you can find.",
    points: 15,
    safety:
      "Stop only where it's safe and clear of traffic; never on a run or below a rise.",
  },
  {
    id: "group-photo",
    category: "photo",
    title: "Group photo, everyone in it",
    detail: "One photo with the whole crew. Ask a stranger, or prop the phone.",
    points: 15,
    safety: "Take it at a lodge, a deck or a safe stop — never on a run.",
  },
  {
    id: "matching",
    category: "creative",
    title: "Most creative crew look",
    detail:
      "Matching toques, a themed scarf, a shared sticker. The crew votes.",
    points: 10,
    safety: "Keep helmets on and visibility high. Costume never replaces gear.",
  },
  {
    id: "lift-song",
    category: "creative",
    title: "Name the run or make up a lift-ride song",
    detail: "Give a run, a chair or a moment a name the crew will keep.",
    points: 10,
    safety:
      "Follow the lift's posted rules: safety bar down, poles and board handled the way the sign says.",
  },
  {
    id: "lunch-crew",
    category: "group",
    title: "Everyone eats together",
    detail: "A real break, the whole crew at one table, phones away.",
    points: 15,
    safety:
      "Eat, drink water, warm up. Tired legs are how people get hurt in the afternoon.",
  },
  {
    id: "last-run",
    category: "group",
    title: "Last run: all ride down together",
    detail:
      "Agree a last run before the lifts wind down, ride it as a crew, finish with a cheer.",
    points: 20,
    minAbility: "beginner",
    safety:
      "Everyone down together at the slowest rider's pace, before the light fades.",
  },
  {
    id: "apres-cocoa",
    category: "apres",
    title: "Après: try the lodge's best hot drink",
    detail: "Hot chocolate, cider, a tea. Vote on the winner.",
    points: 10,
    safety: "Anyone driving, or heading back out, stays alcohol-free.",
  },
  {
    id: "apres-story",
    category: "apres",
    title: "Après: everyone tells the story of their day",
    detail: "One funny moment each, around the table or the fire.",
    points: 10,
    safety:
      "Keep it kind. Nobody is the punchline unless they're laughing too.",
  },
];

/**
 * Words that mean a prize for risk. Matched as whole-ish words,
 * case-insensitively. Deliberately blunt: a false alarm is a reworded
 * challenge; a miss is a prize for someone getting hurt.
 */
const UNSAFE =
  /\b(fast(est)?|speed(ing|y)?|race|racing|record|drift|launch|huge|cliff|gap|drop|backcountry|off[- ]?piste|out[- ]of[- ]bounds|ducking|closed (run|trail|terrain)|ignore|ignoring|no helmet|without a helmet|steep(est)?|extreme|double[- ]black|dare|dares|chug|shots?|drunk|beers?|bevvies|get wasted|trick|tricks|stunt|stunts|send it|huck(ing)?|jump(s|ing)?|air)\b/i;

export type TextCheck = { ok: true } | { ok: false; reason: string };

/** Whether crew-written challenge text keeps to the rules. */
export function checkChallengeText(text: string): TextCheck {
  const t = text.trim();
  if (t.length < 4) return { ok: false, reason: "Give it a few words." };
  if (t.length > 90)
    return { ok: false, reason: "Keep it under 90 characters." };
  const hit = UNSAFE.exec(t);
  if (hit)
    return {
      ok: false,
      reason: `"${hit[0]}" isn't something Snow rewards. Try a photo, a shared moment or a new run at your own level.`,
    };
  return { ok: true };
}

/** Crew-written challenges are worth a fixed, modest amount. */
export const CUSTOM_POINTS = 10;
export const CUSTOM_PREFIX = "custom:";

export function challengeById(
  id: string,
  custom: readonly { id: string; title: string }[] = [],
): Challenge | undefined {
  const known = CHALLENGES.find((c) => c.id === id);
  if (known) return known;
  const mine = custom.find((c) => c.id === id);
  return mine
    ? {
        id: mine.id,
        category: "creative",
        title: mine.title,
        detail: "A challenge your crew wrote.",
        points: CUSTOM_POINTS,
        safety:
          "Same rules as every challenge: your level, the hill's rules, no risks.",
      }
    : undefined;
}

/** Challenges offered to a rider at this level (or everyone, if unknown). */
export function offeredTo(ability: Ability | undefined): readonly Challenge[] {
  return CHALLENGES.filter(
    (c) =>
      !c.minAbility ||
      ability === undefined ||
      abilityRank(ability) >= abilityRank(c.minAbility),
  );
}
