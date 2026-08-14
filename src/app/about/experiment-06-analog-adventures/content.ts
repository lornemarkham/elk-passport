/**
 * Experiment 06 — "Analog Adventures."
 *
 * The philosophy this sketch explores is the one most in tension with
 * building an app at all: **the best Passport session ends with the phone
 * being put away.** Technology removes uncertainty, then it disappears.
 *
 * So this sandbox is deliberately quieter than the ones before it. No
 * camera, no soundscape, no particles. The interactions are the kind you'd
 * do *before* leaving — check a pack list, look at what today's sky is
 * doing, notice what you might learn out there — and then the page tells
 * you to stop reading it.
 *
 * Everything here is invented for the sketch and disclosed as such, the
 * same discipline as the rest of ELK Labs (`docs/content-model/future.md`).
 * The Sugar Lake FSR mission below is illustrative — Atlas holds none of
 * this yet, and several categories (road conditions, river levels, aurora)
 * are blocked on ADR 018 temporal validity in any case.
 */

export interface PrepItem {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  /** Whether Atlas could hold this today, or is waiting on something. */
  readonly status: "atlas-could-hold" | "needs-temporal" | "needs-new-source";
}

/**
 * What Passport would hand you before a Saturday on the Sugar Lake FSR.
 *
 * The `status` on each is the honest part of this sketch: roughly half of
 * a genuinely useful prep list is knowledge Atlas has no way to hold yet.
 */
export const PREP_ITEMS: readonly PrepItem[] = [
  {
    id: "printable-map",
    label: "Printable map",
    note: "Paper doesn't run out of battery at the far end of the lake.",
    status: "needs-new-source",
  },
  {
    id: "offline-map",
    label: "Offline map",
    note: "Downloaded before you lose signal, which happens sooner than you expect.",
    status: "needs-new-source",
  },
  {
    id: "gpx",
    label: "GPX track",
    note: "For the handheld, and for anyone you left the plan with.",
    status: "needs-new-source",
  },
  {
    id: "road-conditions",
    label: "Road conditions",
    note: "Active hauling, washouts, and whether the bridge is still there.",
    status: "needs-temporal",
  },
  {
    id: "fuel",
    label: "Last fuel stop",
    note: "And how far past it you're going.",
    status: "atlas-could-hold",
  },
  {
    id: "emergency",
    label: "Emergency information",
    note: "Nearest help, and the radio channel that reaches it.",
    status: "needs-new-source",
  },
  {
    id: "bear",
    label: "Bear awareness",
    note: "What's active this month, and what to do about it.",
    status: "needs-temporal",
  },
  {
    id: "fishing-regs",
    label: "Fishing regulations",
    note: "Which lake, which season, which limits.",
    status: "needs-temporal",
  },
  {
    id: "weather",
    label: "Weather",
    note: "Including the part where it changes at elevation.",
    status: "needs-temporal",
  },
  {
    id: "sunset",
    label: "Sunset",
    note: "So the drive out isn't the adventure.",
    status: "needs-temporal",
  },
  {
    id: "stargazing",
    label: "Tonight's sky",
    note: "What's up there, and whether the moon will wash it out.",
    status: "needs-temporal",
  },
  {
    id: "viewpoints",
    label: "Hidden viewpoints",
    note: "The pullouts that aren't signed.",
    status: "atlas-could-hold",
  },
  {
    id: "history",
    label: "Historical sites",
    note: "The mill that used to be there. The reason the road exists.",
    status: "needs-new-source",
  },
  {
    id: "wildlife",
    label: "Wildlife likely today",
    note: "Not guaranteed. Likely. That's the fun part.",
    status: "needs-temporal",
  },
];

export const STATUS_LABEL: Record<PrepItem["status"], string> = {
  "atlas-could-hold": "Atlas could hold this today",
  "needs-temporal": "Needs temporal validity (ADR 018)",
  "needs-new-source": "Needs a source category Atlas doesn't have",
};

export interface LearnTheme {
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
}

/**
 * "Learn while living." Every adventure should quietly teach something —
 * and the decision it changes isn't where you go, it's **what you notice**.
 */
export const LEARN_THEMES: readonly LearnTheme[] = [
  {
    emoji: "🪨",
    title: "Geology",
    line: "Why this valley is shaped like that.",
  },
  { emoji: "🦅", title: "Birds", line: "The one you keep hearing has a name." },
  { emoji: "🌌", title: "Astronomy", line: "Three of those aren't stars." },
  {
    emoji: "🌿",
    title: "Plants",
    line: "That one's edible. That one is very much not.",
  },
  {
    emoji: "🏚️",
    title: "History",
    line: "Someone lived here. Here's why they left.",
  },
  {
    emoji: "🐟",
    title: "Wildlife",
    line: "The salmon are doing something remarkable right now.",
  },
  {
    emoji: "🌉",
    title: "Engineering",
    line: "This bridge is older than the road it serves.",
  },
  {
    emoji: "🍞",
    title: "Food",
    line: "The bakery in town has been there four generations.",
  },
];

export interface Artifact {
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
}

/** Technology should create physical things. Paper outlasts battery. */
export const ARTIFACTS: readonly Artifact[] = [
  {
    emoji: "📖",
    title: "Family Adventure Book",
    line: "Filled in by hand, over years.",
  },
  { emoji: "🗺️", title: "Printable Maps", line: "Folded into the glovebox." },
  {
    emoji: "✅",
    title: "Camping Checklists",
    line: "The one you actually tick off.",
  },
  {
    emoji: "📓",
    title: "Field Journal",
    line: "For pressed leaves and bad sketches.",
  },
  {
    emoji: "🦌",
    title: "Wildlife Checklist",
    line: "Kids will fill this faster than you.",
  },
  { emoji: "🎫", title: "Park Passport", line: "Stamped. Collected. Kept." },
  {
    emoji: "🧭",
    title: "Road Trip Binder",
    line: "Everything, offline, in order.",
  },
  {
    emoji: "🆘",
    title: "Emergency Pack",
    line: "The one you hope stays unopened.",
  },
];

export interface SignalExample {
  readonly phrase: string;
  readonly why: string;
}

/**
 * Community knowledge as **Signals, never reviews** (ADR 020).
 *
 * These phrasings are the most concrete examples of the Signals tier
 * recorded anywhere in the project: each is an observation that becomes
 * trustworthy only through repeated independent agreement, and none of
 * them is a star rating.
 */
export const SIGNAL_EXAMPLES: readonly SignalExample[] = [
  { phrase: "Great after rain", why: "Says something a photograph can't." },
  {
    phrase: "Bring bug spray",
    why: "Learned the hard way, by several people.",
  },
  { phrase: "Worth the detour", why: "The highest praise there is." },
  { phrase: "Usually crowded", why: "So go early, or go elsewhere." },
  { phrase: "Bring cash", why: "Saves a wasted drive." },
  {
    phrase: "Good for kids",
    why: "Means something specific to whoever said it.",
  },
  { phrase: "Best viewpoint", why: "Not the signed one." },
  { phrase: "Best season", why: "Everywhere has one. Few places say so." },
];

export interface OpenQuestion {
  readonly question: string;
  readonly note: string;
}

/** What this sketch raised and did not answer. */
export const OPEN_QUESTIONS: readonly OpenQuestion[] = [
  {
    question:
      "How does an app measure success when success means you closed it?",
    note: "Every analytic we'd reach for rewards the opposite behaviour.",
  },
  {
    question:
      "What has to be true before someone trusts a plan enough to go offline with it?",
    note: "Completeness stops being a score and becomes a safety property.",
  },
  {
    question:
      "Who are the local experts, and what does Atlas even call a person?",
    note: "There's no Person entity. An expert's word is a stronger signal — still not a fact.",
  },
  {
    question:
      "Is a printed guide a different product, or the same knowledge with no links?",
    note: "Paper can't 'load more'. Everything has to already be there.",
  },
  {
    question:
      "How much wonder can we promise before the sky refuses to cooperate?",
    note: "Most of it is temporal, and temporal is the thing Atlas can't hold yet.",
  },
];
