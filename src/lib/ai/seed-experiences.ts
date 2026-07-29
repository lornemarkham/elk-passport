import type { AdventureBlock, TodaysIntent } from "@/lib/schemas";

/**
 * Archetypal day templates used by the local recommender (see
 * ./local-recommender.ts) when no OPENAI_API_KEY is configured, and as the
 * few-shot grounding for the OpenAI path when it is.
 *
 * These are deliberately generic archetypes, not real named venues — Passport
 * doesn't yet have a source of real local places (see /docs/architecture.md,
 * "Recommendation flow"), and inventing fake business names would break
 * trust on the very first use. Blocks describe what to do and the vibe;
 * the user supplies where via their stated location.
 *
 * Spans the category range called out in the MVP brief
 * (/12-mvp-experience-visual-contract.md): bird watching, museums, science
 * centres, coffee shops, scenic drives, hiking, whitewater rafting, skiing,
 * paddle boarding — plus everyday-Local-Explorer categories for the other
 * intents. Not a finalized library — see /09-curation-framework.md.
 */
export type ExperienceTemplate = {
  intents: TodaysIntent[];
  title: string;
  tagline: string;
  blocks: AdventureBlock[];
};

export const EXPERIENCE_TEMPLATES: ExperienceTemplate[] = [
  {
    intents: ["Active", "Adventure"],
    title: "Trailhead & Thin Air",
    tagline: "Legs first, thoughts later.",
    blocks: [
      {
        time: "Morning",
        title: "Find your trail",
        description:
          "Pick a hiking trail you've never done before — moderate distance, a view at the top.",
      },
      {
        time: "Midday",
        title: "Summit break",
        description:
          "Eat lunch somewhere with a view. Take the photo. Don't rush it.",
      },
      {
        time: "Afternoon",
        title: "Cool down",
        description: "Wind down at a nearby spot with cold drinks and shade.",
      },
    ],
  },
  {
    intents: ["Water", "Active"],
    title: "On the Water",
    tagline: "Let the current set the pace.",
    blocks: [
      {
        time: "Morning",
        title: "Get on the water",
        description:
          "Paddle board, kayak, or canoe rental on the nearest lake or calm river.",
      },
      {
        time: "Midday",
        title: "Shoreline lunch",
        description: "Dry off and eat somewhere near the water's edge.",
      },
      {
        time: "Afternoon",
        title: "One more push",
        description:
          "If energy allows, a second short paddle at a different put-in, chasing the golden light.",
      },
    ],
  },
  {
    intents: ["Water", "Adventure"],
    title: "Whitewater Day",
    tagline: "A little fear is part of the fun.",
    blocks: [
      {
        time: "Morning",
        title: "Book the run",
        description:
          "Find a local whitewater rafting or river-running outfitter and get on the water.",
      },
      {
        time: "Midday",
        title: "Riverside refuel",
        description:
          "Grab food near the put-out point — you'll have earned it.",
      },
      {
        time: "Afternoon",
        title: "Dry off and reflect",
        description:
          "Somewhere calm to talk over the best/scariest moment of the run.",
      },
    ],
  },
  {
    intents: ["Learning"],
    title: "Curiosity Crawl",
    tagline: "Go somewhere that makes you ask questions.",
    blocks: [
      {
        time: "Morning",
        title: "Museum or science centre",
        description: "Pick the exhibit you'd normally skip and start there.",
      },
      {
        time: "Midday",
        title: "Debrief over food",
        description: "Talk through the one thing that surprised you.",
      },
      {
        time: "Afternoon",
        title: "Follow the thread",
        description:
          "A bookstore, garden, or historic site connected to what you just saw.",
      },
    ],
  },
  {
    intents: ["Learning", "Relax"],
    title: "Slow Looking",
    tagline: "Notice something you'd normally walk past.",
    blocks: [
      {
        time: "Morning",
        title: "Go birdwatching",
        description:
          "A local park, wetland, or nature reserve — bring whatever binoculars you've got, even a phone camera works.",
      },
      {
        time: "Midday",
        title: "Coffee and notes",
        description: "Write down every species or sight that surprised you.",
      },
      {
        time: "Afternoon",
        title: "One more quiet stop",
        description: "A garden or lookout to keep the slow pace going.",
      },
    ],
  },
  {
    intents: ["Food"],
    title: "Eat Your Way Through It",
    tagline: "Plan the day around what's on the plate.",
    blocks: [
      {
        time: "Morning",
        title: "Coffee shop worth the drive",
        description: "Find one you've been meaning to try, not the usual spot.",
      },
      {
        time: "Midday",
        title: "The main event",
        description:
          "Book or walk into the restaurant you've been saving for a special day.",
      },
      {
        time: "Evening",
        title: "Dessert detour",
        description: "One more stop, small portion, big payoff.",
      },
    ],
  },
  {
    intents: ["Date"],
    title: "Slow Date, No Rush",
    tagline: "Nowhere to be, nothing to prove.",
    blocks: [
      {
        time: "Afternoon",
        title: "Wander somewhere new",
        description:
          "A neighbourhood, market, or scenic walk neither of you knows well.",
      },
      {
        time: "Evening",
        title: "Dinner with a view",
        description: "Prioritize atmosphere over convenience.",
      },
      {
        time: "Night",
        title: "One last stop",
        description:
          "A lookout, a lounge, or just a slow walk back — end on something memorable.",
      },
    ],
  },
  {
    intents: ["Family"],
    title: "Everyone Wins",
    tagline: "One day, something for each of you.",
    blocks: [
      {
        time: "Morning",
        title: "Pick the kid-favorite first",
        description:
          "Science centre, park, or playground — start with what makes them light up.",
      },
      {
        time: "Midday",
        title: "Easy lunch",
        description: "Low-effort, low-mess, close to wherever you already are.",
      },
      {
        time: "Afternoon",
        title: "Add one adult win",
        description:
          "A short stop that's more for the grown-ups — coffee, a view, a market.",
      },
    ],
  },
  {
    intents: ["Road Trip"],
    title: "See Where the Road Goes",
    tagline: "The drive is the point, not the detour.",
    blocks: [
      {
        time: "Morning",
        title: "Pick a direction",
        description:
          "Choose a scenic drive route you haven't taken and just go.",
      },
      {
        time: "Midday",
        title: "Small-town stop",
        description: "Find lunch in whatever town you land in around noon.",
      },
      {
        time: "Afternoon",
        title: "One planned stop, one surprise",
        description:
          "Hit a lookout or landmark, then follow one unplanned turn.",
      },
    ],
  },
  {
    intents: ["Escape"],
    title: "Off the Grid, For a Few Hours",
    tagline: "No notifications. No plan B.",
    blocks: [
      {
        time: "Morning",
        title: "Get somewhere quiet",
        description:
          "A forest trail, lakeshore, or park far enough out that it feels like elsewhere.",
      },
      {
        time: "Midday",
        title: "Do nothing on purpose",
        description: "No itinerary here — just be where you are.",
      },
      {
        time: "Afternoon",
        title: "Ease back in",
        description:
          "A slow coffee stop on the way home instead of straight back to routine.",
      },
    ],
  },
  {
    intents: ["Relax"],
    title: "Low and Slow",
    tagline: "Nothing that feels like an errand.",
    blocks: [
      {
        time: "Morning",
        title: "Sleep in, then coffee",
        description:
          "A coffee shop with somewhere comfortable to sit for a while.",
      },
      {
        time: "Midday",
        title: "Gentle outdoors",
        description:
          "A flat, easy walk — botanical garden, waterfront, or park loop.",
      },
      {
        time: "Afternoon",
        title: "Stay horizontal",
        description:
          "A patio, a hammock, a shaded bench — end the day doing as little as possible.",
      },
    ],
  },
  {
    intents: ["Adventure", "Active"],
    title: "Winter Line",
    tagline: "Cold air, clear head.",
    blocks: [
      {
        time: "Morning",
        title: "First tracks",
        description:
          "Get to the hill early — skiing or snowboarding while the snow's still fresh.",
      },
      {
        time: "Midday",
        title: "Lodge lunch",
        description: "Warm up with something hot before heading back out.",
      },
      {
        time: "Afternoon",
        title: "One last run",
        description: "Save the best run of the day for last, then call it.",
      },
    ],
  },
];
