/**
 * Everything here is invented — same disclosed exception as Experiment
 * 01's two sandboxes (see `docs/content-model/future.md`). Eighteen
 * adventure cards, none tied to a real Atlas place, built to test one
 * interaction, not to represent real inventory.
 */

export type Vibe =
  "water" | "adrenaline" | "chill" | "social" | "nature" | "food";

export interface SwipeCard {
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
  readonly vibes: readonly Vibe[];
  /** Shown briefly when this specific card is Super Liked (swiped up) — falls back to `SUPER_LIKE_FALLBACKS` when absent. */
  readonly reaction?: string;
  /**
   * Phase 2 — "The Card Talks Back." Rarer, bigger, more personal than
   * `reaction` — rolled roughly one swipe in ten, only on a positive
   * swipe, only for cards that have one. Voiced as the *experience*
   * talking, never as "Passport" — this is not Tinder, and Passport
   * itself never flirts with anyone; the wakeboard does. Not every card
   * has one, deliberately — the silence around it is what makes it land
   * as a surprise instead of a running bit.
   */
  readonly talkBack?: readonly string[];
}

export const VIBE_LABEL: Record<Vibe, string> = {
  water: "Water",
  adrenaline: "Adrenaline",
  chill: "Chill",
  social: "Social",
  nature: "Nature",
  food: "Food",
};

export const SWIPE_CARDS: readonly SwipeCard[] = [
  {
    id: "wakeboard",
    emoji: "🏄",
    title: "Wakeboarding",
    line: "Feel the lake pull you out of your comfort zone.",
    vibes: ["water", "adrenaline"],
    reaction: "I had a feeling.",
    talkBack: ["I knew you'd like me."],
  },
  {
    id: "sunrise-paddle",
    emoji: "🌅",
    title: "Sunrise Paddle",
    line: "Tomorrow begins quietly.",
    vibes: ["water", "chill"],
    reaction: "I've been waiting for you.",
    talkBack: ["I'll be waiting tomorrow."],
  },
  {
    id: "hidden-lake",
    emoji: "🛶",
    title: "Hidden Lake",
    line: "The kind of place you'll tell your friends about.",
    vibes: ["water", "nature"],
    reaction: "Nobody else knows about this one yet.",
  },
  {
    id: "patio-beer",
    emoji: "🍺",
    title: "Patio Beer",
    line: "Stay longer than you planned.",
    vibes: ["social", "chill"],
    reaction: "I'll save you a seat.",
    talkBack: ["I saved you a chair."],
  },
  {
    id: "skydive",
    emoji: "🪂",
    title: "Skydiving",
    line: "The kind of scared that turns into a story.",
    vibes: ["adrenaline"],
    reaction: "So... we're really doing this?",
    talkBack: [
      "...still thinking about it?",
      "You looked twice.",
      "I dare you.",
    ],
  },
  {
    id: "campfire",
    emoji: "🏕️",
    title: "Campfire Night",
    line: "Some of the best conversations happen after dark.",
    vibes: ["social", "chill", "nature"],
    reaction: "See you around the fire.",
    talkBack: ["The fire's already going."],
  },
  {
    id: "mtb",
    emoji: "🚵",
    title: "Mountain Biking",
    line: "Dust, speed, and a trail you'll want to ride again.",
    vibes: ["adrenaline", "nature"],
  },
  {
    id: "farmers-market",
    emoji: "🍓",
    title: "Farmers Market Morning",
    line: "Slow mornings taste better.",
    vibes: ["food", "chill"],
  },
  {
    id: "cliff-jump",
    emoji: "🤿",
    title: "Cliff Jumping",
    line: "Three seconds of falling, a lifetime of bragging rights.",
    vibes: ["water", "adrenaline"],
  },
  {
    id: "motorcycle",
    emoji: "🏍️",
    title: "Canyon Ride",
    line: "Wind, curves, and nowhere else to be.",
    vibes: ["adrenaline"],
    talkBack: ["Take the long way."],
  },
  {
    id: "sunset-viewpoint",
    emoji: "🌇",
    title: "Sunset Viewpoint",
    line: "Worth pulling over for.",
    vibes: ["nature", "chill"],
  },
  {
    id: "brewery",
    emoji: "🍻",
    title: "Local Brewery",
    line: "Cold glass, good company.",
    vibes: ["social", "food"],
  },
  {
    id: "waterfall-hike",
    emoji: "💦",
    title: "Waterfall Hike",
    line: "The sound gets louder before you see it.",
    vibes: ["nature", "water"],
  },
  {
    id: "food-truck",
    emoji: "🌮",
    title: "Food Truck Row",
    line: "Eat first, decide later.",
    vibes: ["food", "social"],
  },
  {
    id: "golf",
    emoji: "🏌️",
    title: "A Round of Golf",
    line: "Good walk, better banter.",
    vibes: ["social", "chill"],
  },
  {
    id: "dog-beach",
    emoji: "🐕",
    title: "Dog Beach",
    line: "Bring the dog. Obviously.",
    vibes: ["water", "chill", "social"],
  },
  {
    id: "live-music",
    emoji: "🎸",
    title: "Live Music on a Patio",
    line: "The night finds its own rhythm.",
    vibes: ["social"],
  },
  {
    id: "stargazing",
    emoji: "✨",
    title: "Stargazing",
    line: "Somewhere dark enough to remember how many there are.",
    vibes: ["nature", "chill"],
  },
  {
    id: "winery",
    emoji: "🍷",
    title: "Winery Afternoon",
    line: "Slow sips, long views.",
    vibes: ["food", "chill", "social"],
    talkBack: ["You seem like my type."],
  },
  {
    id: "coffee",
    emoji: "☕",
    title: "Morning Coffee",
    line: "Everything starts here.",
    vibes: ["chill", "food"],
    talkBack: ["You'll need me tomorrow."],
  },
];

/** The exact spoken request the "Open Your Eyes" moment fakes hearing — quiet, water, dog. Real matching cards, not a random reshuffle, so the payoff feels earned. */
export const VOICE_REQUEST = [
  '"I want somewhere quiet."',
  '"I want water."',
  '"My dog is coming."',
];
export const VOICE_DECK_IDS = [
  "dog-beach",
  "hidden-lake",
  "sunrise-paddle",
  "stargazing",
  "waterfall-hike",
  "sunset-viewpoint",
];

export const SUPER_LIKE_FALLBACKS = [
  "Good choice.",
  "Noted — and loved.",
  "That's a keeper.",
  "Oh, we're doing this.",
];
export const RIGHT_SWIPE_LINES = [
  "Tell you more later.",
  "Filed away.",
  "Keeping this one warm.",
  "Noted.",
];
export const DOWN_SWIPE_LINES = [
  "Wrong mood today? Fair.",
  "Saved for another day.",
  "Not gone. Just not now.",
];
export const LEFT_SWIPE_LINES = ["Not today.", "Noted.", "Moving on."];

/** Triggered once a vibe's Super Like count crosses `CRUSH_THRESHOLD`. */
export const CRUSH_THRESHOLD = 3;
export const CRUSH_LINES: Record<Vibe, string> = {
  water: "I think lakes might have a crush on you.",
  adrenaline: "You keep chasing the scary ones. Respect.",
  chill: "You keep slowing down for sunsets.",
  social: "You've smiled at every patio.",
  nature: "I think you're becoming a waterfall person.",
  food: "I think coffee keeps finding you.",
};

/**
 * Phase 2 — the other half of the Crush System: what you keep saying no
 * to is also a pattern, just as human and just as safe, since it's still
 * about a category of experience, never about the person. Triggered once
 * a vibe's "Not Today" (left-swipe) count crosses `CRUSH_AVOID_THRESHOLD`
 * — checked alongside `CRUSH_LINES`, never both at once for the same
 * moment.
 */
export const CRUSH_AVOID_THRESHOLD = 3;
export const CRUSH_AVOID_LINES: Record<Vibe, string> = {
  water: "Water's not really speaking to you tonight.",
  adrenaline: "You've walked right past everything scary so far.",
  chill: "You're not here to slow down, apparently.",
  social: "Not really in a crowd mood tonight.",
  nature: "The outdoors is having a rough night with you.",
  food: "Every food truck, ignored. Bold strategy.",
};

/** Rolled on every positive swipe (right or up) — roughly one in ten, never more, never on a card with nothing to say. */
export const TALK_BACK_CHANCE = 0.1;

/**
 * Phase 2 — the Hesitation Engine's own voice, replacing generic
 * "noticing" copy. Voiced as the card, same as `talkBack` — first "..." is
 * shown almost immediately (a light presence), the rest arrive the longer
 * someone sits without deciding.
 */
export const HESITATION_LINES = [
  "...take your time.",
  "I'll wait.",
  "Not today?",
  "I almost had you.",
];

/** The page's closing beat — no button follows these, on purpose. */
export const ENDING_LINES = [
  "Interesting...",
  "I think I know what tomorrow looks like.",
];

export interface DiscoveryMode {
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
}

export const DISCOVERY_MODES: readonly DiscoveryMode[] = [
  {
    emoji: "🎤",
    title: "Voice Discovery",
    line: "Speak your mood. No form to fill out.",
  },
  {
    emoji: "🌌",
    title: "Discovery Constellation",
    line: "Every place, connected — wander the map of what's near.",
  },
  {
    emoji: "🗺️",
    title: "Discovery Map",
    line: "See it laid out, not listed out.",
  },
  {
    emoji: "👥",
    title: "Group Discovery",
    line: "Everyone swipes. Passport finds where you overlap.",
  },
  {
    emoji: "🎲",
    title: "Random Adventure",
    line: "Sometimes the best plan is no plan.",
  },
  {
    emoji: "📖",
    title: "Story Discovery",
    line: "A place, told as a scene, not a spec sheet.",
  },
  {
    emoji: "🎵",
    title: "Mood Discovery",
    line: "Pick a song. Get a day that matches it.",
  },
];
