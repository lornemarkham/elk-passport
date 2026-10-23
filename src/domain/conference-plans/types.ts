/**
 * **Plans: something a few colleagues do together, at a time and a place.**
 *
 * "Early risers — Vancouver morning walk. Tuesday 7:00, Wednesday 7:00.
 * Meet in the hotel lobby." was organised outside the app, in a chat thread.
 * A plan is that, inside the conference: what, when (one or several
 * occurrences), where we meet, who organised it, who's invited, and who's
 * coming to each occurrence.
 *
 * Keyed on `(conferenceId, memberId)` like every module (ARCHITECTURE.md §6).
 * Places are ids, never copied facts: a curated id (`curated:vancouver:…`) or
 * an Atlas subject id, resolved at read time. A meeting point a person types
 * ("Hotel lobby") is their own words and is shown as theirs.
 *
 * Three answers, kept distinct (doctrine §2.2, VISION §7): _I'm in_, _Maybe_,
 * _Can't make it_. None of them is "saved" and none of them is "did".
 */

export const ACTIVITY_KINDS = [
  "morning-walk",
  "coffee",
  "lunch",
  "dinner",
  "drinks",
  "sightseeing",
  "explore",
  "custom",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ANSWERS = ["in", "maybe", "out"] as const;
export type Answer = (typeof ANSWERS)[number];

/** `everyone` in the conference, or only the coworkers the organiser picked. */
export type Audience = "everyone" | "selected";

export interface MeetingPoint {
  /** What people will look for: "Hotel lobby", "Waterfront Station". */
  readonly label: string;
  /** A curated or Atlas place id, when the meeting point is a known place. */
  readonly placeId?: string;
}

export interface Occurrence {
  readonly id: string;
  /** UTC instant. Typed and shown in the conference's own time zone. */
  readonly startsAt: string;
}

export interface Plan {
  readonly id: string;
  readonly conferenceId: string;
  /** The member who organised it. */
  readonly organiserId: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly description: string;
  /** Where the group gathers. */
  readonly meeting: MeetingPoint | null;
  /** Where the group is going (the restaurant, the lookout), once chosen. */
  readonly venueId: string | null;
  readonly audience: Audience;
  /** Member ids invited when `audience` is `selected`. The organiser is implied. */
  readonly invited: readonly string[];
  /** One or more, in time order. A recurring plan is a plan with several. */
  readonly occurrences: readonly Occurrence[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Rsvp {
  readonly planId: string;
  readonly occurrenceId: string;
  readonly memberId: string;
  readonly answer: Answer;
  readonly at: string;
}

/** A place somebody suggested for a plan, for the group to vote on. */
export interface VenueOption {
  readonly id: string;
  readonly planId: string;
  readonly placeId: string;
  /** The name the suggester saw. Facts are resolved again on read. */
  readonly name: string;
  readonly by: string;
  readonly at: string;
}

/** One vote per member per plan; voting again moves it. */
export interface VenueVote {
  readonly planId: string;
  readonly optionId: string;
  readonly memberId: string;
}

export interface KindInfo {
  readonly label: string;
  readonly emoji: string;
  /** A sensible start, in the conference's zone. Only a default. */
  readonly time: string;
  /** What a title could be, shown as the placeholder. */
  readonly example: string;
  /** Whether the group usually picks a place together (lunch, dinner…). */
  readonly vote: boolean;
  /** Which Explore shelf suggests places for it. */
  readonly shelf: ExploreShelf | null;
}

export const EXPLORE_SHELVES = [
  "restaurants",
  "coffee",
  "drinks",
  "waterfront",
  "sights",
  "together",
] as const;
export type ExploreShelf = (typeof EXPLORE_SHELVES)[number];

export const KINDS: Record<ActivityKind, KindInfo> = {
  "morning-walk": {
    label: "Morning walk",
    emoji: "🌅",
    time: "07:00",
    example: "Early risers — Vancouver morning walk",
    vote: false,
    shelf: "waterfront",
  },
  coffee: {
    label: "Coffee",
    emoji: "☕",
    time: "08:00",
    example: "Coffee before the first session",
    vote: true,
    shelf: "coffee",
  },
  lunch: {
    label: "Lunch",
    emoji: "🥪",
    time: "12:30",
    example: "Lunch away from the convention centre",
    vote: true,
    shelf: "restaurants",
  },
  dinner: {
    label: "Dinner",
    emoji: "🍽️",
    time: "19:00",
    example: "Team dinner",
    vote: true,
    shelf: "restaurants",
  },
  drinks: {
    label: "Drinks",
    emoji: "🍻",
    time: "17:30",
    example: "One drink after the last session",
    vote: true,
    shelf: "drinks",
  },
  sightseeing: {
    label: "Sightseeing",
    emoji: "📸",
    time: "15:00",
    example: "Up the Lookout before sunset",
    vote: false,
    shelf: "sights",
  },
  explore: {
    label: "Explore Vancouver",
    emoji: "🧭",
    time: "10:00",
    example: "Gastown to Chinatown on foot",
    vote: false,
    shelf: "together",
  },
  custom: {
    label: "Something else",
    emoji: "✨",
    time: "18:00",
    example: "Name it",
    vote: false,
    shelf: null,
  },
};

export const ANSWER_WORDS: Record<Answer, string> = {
  in: "I'm in",
  maybe: "Maybe",
  out: "Can't make it",
};

export const LIMITS = {
  title: 80,
  description: 600,
  meeting: 80,
  occurrences: 14,
  invited: 200,
  options: 8,
} as const;
