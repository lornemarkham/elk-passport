import { CHALLENGES, type Challenge } from "./challenges";
import type { Party } from "./discover";
import type { Need } from "./request";
import type { ThemeId } from "./themes";

/**
 * **The right extras for the right evening** (owner brief, Christmas
 * Experience 2.0, phase 6). Hockey Night's dares are fun with a crew and
 * wrong on a date, so what an itinerary offers depends on who is going:
 *
 * - **romantic** — a few quiet moments to remember, never a dare;
 * - **family** — Christmas's own kid-friendly challenges, the ones that fit
 *   what's on the plan first;
 * - **friends** — vote on the plan together, then a friendly ranking;
 * - **a lights tour** — rate the displays for other families, Lights Bingo.
 *
 * Every one is optional and says so. Passport's words only: nothing here
 * names a business or claims anything about a place.
 */

export interface Moment {
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
  /** Where it happens in Passport, when somewhere already does it. */
  readonly href?: string;
}

export interface Moments {
  readonly kind: "romantic" | "family" | "friends" | "lights" | "everyone";
  readonly title: string;
  readonly line: string;
  readonly items: readonly Moment[];
}

const ROMANTIC: readonly Moment[] = [
  {
    emoji: "📸",
    title: "One photo, just the two of you",
    line: "Under the best lights of the night. Ask a stranger, or hold the phone up high.",
  },
  {
    emoji: "✨",
    title: "Pick your favourite display",
    line: "Each of you, without telling the other — then compare on the drive home.",
  },
  {
    emoji: "🥂",
    title: "A toast to this year",
    line: "One thing you loved about it. One thing you're looking forward to.",
  },
];

const THEME_OF: Partial<Record<Need, ThemeId>> = {
  lights: "lights",
  santa: "santa",
  skating: "winter",
  market: "markets",
  coffee: "food",
  show: "shows",
};

const asMoment = (c: Challenge): Moment => ({
  emoji: c.emoji,
  title: c.title,
  line: c.dare,
});

export function momentsFor(input: {
  readonly party: Party | null;
  readonly romantic: boolean;
  readonly needs: readonly Need[];
}): Moments {
  const themes = new Set(
    input.needs.flatMap((n) => (THEME_OF[n] ? [THEME_OF[n]!] : [])),
  );
  if (input.romantic || input.party === "couple")
    return {
      kind: "romantic",
      title: "A few moments to remember",
      line: "Optional, and only if you feel like it. No dares tonight.",
      items: ROMANTIC,
    };
  if (input.party === "family") {
    const kids = CHALLENGES.filter((c) => c.kids);
    const fitting = kids.filter((c) => c.theme && themes.has(c.theme));
    const rest = kids.filter((c) => !fitting.includes(c));
    return {
      kind: "family",
      title: "Christmas challenges for the kids",
      line: "Optional — pick one, or none. Finish it with a photo and it's a memory.",
      items: [...fitting, ...rest].slice(0, 3).map(asMoment),
    };
  }
  if (input.party === "friends")
    return {
      kind: "friends",
      title: "Do it together",
      line: "Optional. Share the plan and everyone votes in, maybe or out.",
      items: [
        {
          emoji: "🗳️",
          title: "Vote on the plan",
          line: "Share it: signed in, it becomes an adventure your friends join, vote on and change.",
        },
        ...CHALLENGES.filter((c) =>
          ["hot-chocolate", "best-lights", "group-photo"].includes(c.id),
        ).map(asMoment),
      ].slice(0, 3),
    };
  if (input.needs.includes("lights"))
    return {
      kind: "lights",
      title: "Make the lights a game",
      line: "Optional extras for the drive.",
      items: [
        {
          emoji: "⭐",
          title: "Rate the displays",
          line: "Tell other families which ones are magical — on the community lights map.",
        },
        {
          emoji: "🎯",
          title: "Christmas Lights Bingo",
          line: "Inflatable snowman, a reindeer on the roof, a whole street in white lights…",
          href: "/christmas/lights/bingo",
        },
        asMoment(CHALLENGES.find((c) => c.id === "best-lights")!),
      ],
    };
  return {
    kind: "everyone",
    title: "Something extra",
    line: "Optional.",
    items: CHALLENGES.filter((c) => c.theme && themes.has(c.theme))
      .slice(0, 2)
      .map(asMoment),
  };
}
