/**
 * Idea Atlas — the master creative wall. Not documentation, not a
 * backlog. Everything invented here (personalities, moments, ideas) is
 * disclosed as sketch content, same discipline as every ELK Labs page
 * (`docs/content-model/future.md`) — except direct links to real,
 * already-built experiments, which point at real pages.
 *
 * This file is meant to grow for years. Adding a 43rd personality, a
 * new dream, a new research item is always a one-line push here, never
 * a component change — the entire discipline every `content.ts` in this
 * app already follows, just at the scale that matches this page's job.
 */

export const MANIFESTO_LINES: readonly string[] = [
  "Passport is not trying to become the world's biggest travel app.",
  "Passport is trying to become the app that helps people have the best day they can.",
  "One day. One season. One memory. At a time.",
];

export const MANIFESTO_PRINCIPLES: readonly string[] = [
  "Atlas understands. Passport inspires.",
  "Knowledge creates confidence.",
  "Anticipation creates excitement.",
  "Weather creates opportunity.",
  "People know how they want to feel before they know what they want to do.",
  "Tomorrow deserves a plan.",
];

export const MANIFESTO_CLOSE: readonly string[] = [
  "This page is never finished.",
  "Keep dreaming. Keep building. Keep surprising people.",
  "Build → Learn → Save → Continue.",
];

/* ============================================================ */
/* PASSPORT PERSONALITIES */
/* ============================================================ */

export interface Personality {
  readonly id: string;
  readonly emoji: string;
  readonly name: string;
  readonly whoFor: string;
  readonly emotion: string;
  readonly weather: string;
  readonly season: string;
  readonly soundtrack: string;
  readonly coreMemory: string;
  readonly interaction: string;
  readonly status: "Prototype" | "Idea";
  readonly href?: string;
  readonly futureIdeas: readonly string[];
}

export const PERSONALITIES: readonly Personality[] = [
  {
    id: "hell-yeah",
    emoji: "🔥",
    name: "HELL YEAH",
    whoFor: "A bachelor/bachelorette crew, loud and all in",
    emotion: "Rowdy, unfiltered joy",
    weather: "Doesn't care",
    season: "Summer weekends",
    soundtrack: "Rock, bass up, chaos rising with the room",
    coreMemory: "The moment the whole room presses Hell Yeah at once",
    interaction: "The Hell Yeah Meter — click-to-hype room energy",
    status: "Prototype",
    href: "/about/experiment-01-bachelor-party",
    futureIdeas: [
      "Real group sessions, not just one screen",
      "A printed 'the board' keepsake at the end of the night",
    ],
  },
  {
    id: "discovery-swipe",
    emoji: "💛",
    name: "Discovery Swipe",
    whoFor: "Anyone who'd rather feel their way to a plan than filter one",
    emotion: "Addictive curiosity",
    weather: "Any",
    season: "Any",
    soundtrack: "Whatever's playing while you swipe",
    coreMemory: "The card that talks back and nobody expected it to",
    interaction: "Four-direction swipe stack, a growing Mood Board",
    status: "Prototype",
    href: "/about/experiment-02-discovery-swipe",
    futureIdeas: [
      "Real Atlas places instead of invented cards",
      "Group swipe sessions that find the overlap",
    ],
  },
  {
    id: "wonder",
    emoji: "🦋",
    name: "Wonder",
    whoFor: "An uncle and a niece, a parent and a child, a mentor",
    emotion: "Shared curiosity",
    weather: "Any",
    season: "Any",
    soundtrack: "Silly songs, nature sounds, dance breaks",
    coreMemory: "Today We... — the sentence that writes itself by evening",
    interaction: "Word of the Day, Little Missions, a memory checklist",
    status: "Prototype",
    href: "/about/experiment-04-wonder",
    futureIdeas: [
      "A real printable keepsake",
      "Atlas actually knowing where the butterfly gardens are",
    ],
  },
  {
    id: "october-passport",
    emoji: "🕯️",
    name: "October Passport",
    whoFor: "Anyone who wants October to feel like a season, not a costume",
    emotion: "Tension, then relief",
    weather: "Fog, rain, clear cold nights",
    season: "October",
    soundtrack: "Real synthesized wind, silence as the default",
    coreMemory: "The photo you swear had something in it",
    interaction: "Intensity dial, Flashlight Mode, Ghost Portrait, Scare Cam",
    status: "Prototype",
    href: "/about/experiment-03-october-passport",
    futureIdeas: [
      "A full Vancouver October Passport",
      "Real Local Legends fed by Atlas, not hardcoded",
    ],
  },
  {
    id: "romantic-weekend",
    emoji: "🌹",
    name: "Romantic Weekend",
    whoFor: "Two people, no kids, no agenda",
    emotion: "Slow intimacy",
    weather: "Golden hour anything",
    season: "Any, best in shoulder season",
    soundtrack: "Strings, low and warm",
    coreMemory: "The table you didn't want to leave",
    interaction: "A day built around two, not a group",
    status: "Idea",
    futureIdeas: [
      "Quiet-table recommendations, not loudest-rated",
      "A shared countdown to the weekend itself",
    ],
  },
  {
    id: "rain-passport",
    emoji: "🌧️",
    name: "Rain Passport",
    whoFor: "Anyone who assumed the day was cancelled",
    emotion: "Cozy relief",
    weather: "Rain",
    season: "Any",
    soundtrack: "Rain on old windows, real synthesized",
    coreMemory: "Realizing rain didn't ruin the day, it made it",
    interaction: "Weather-triggered discovery shift",
    status: "Idea",
    futureIdeas: [
      "Indoor-first Atlas categories (museums, bookstores, cafés)",
      "A 'the rain is the plan' framing, not a fallback",
    ],
  },
  {
    id: "extreme-heat-passport",
    emoji: "🥵",
    name: "Extreme Heat Passport",
    whoFor: "Anyone melting and still wanting a real day",
    emotion: "Relief-seeking",
    weather: "Heat wave",
    season: "Summer",
    soundtrack: "Slow, sparse, water sounds",
    coreMemory: "Finding the one shaded, cold-water spot everyone else missed",
    interaction: "Heat-triggered water/shade prioritization",
    status: "Idea",
    futureIdeas: [
      "Shade-aware recommendations",
      "A 'cool down by 3pm' countdown",
    ],
  },
  {
    id: "snow-passport",
    emoji: "❄️",
    name: "Snow Passport",
    whoFor: "First-snow chasers and ski-season regulars",
    emotion: "Bright, crisp excitement",
    weather: "Snow",
    season: "Winter",
    soundtrack: "Sparse, cold, a distant chairlift",
    coreMemory: "The first run of the season",
    interaction: "First-snow countdown, condition-aware suggestions",
    status: "Idea",
    futureIdeas: [
      "Real snow-report integration",
      "A 'first snow of the year' celebratory moment",
    ],
  },
  {
    id: "motorcycle-passport",
    emoji: "🏍️",
    name: "Motorcycle Passport",
    whoFor: "Riders who plan a day around the road, not the destination",
    emotion: "Open-road freedom",
    weather: "Clear, dry",
    season: "Riding season",
    soundtrack: "Engine, wind, classic rock",
    coreMemory: "The canyon road nobody told you about",
    interaction: "Route-as-destination framing",
    status: "Idea",
    futureIdeas: [
      "Real curve/scenery-rated routes",
      "A 'take the long way' toggle everywhere",
    ],
  },
  {
    id: "photography-passport",
    emoji: "📷",
    name: "Photography Passport",
    whoFor: "Anyone chasing the light, not just the view",
    emotion: "Patient focus",
    weather: "Fog, golden hour, storm light",
    season: "Any",
    soundtrack: "Near silence",
    coreMemory: "The shot you almost didn't wait for",
    interaction: "Golden Hour countdown, light-condition alerts",
    status: "Idea",
    futureIdeas: [
      "Real sunrise/sunset-timed nudges",
      "A shot-list built from real nearby viewpoints",
    ],
  },
  {
    id: "bird-passport",
    emoji: "🐦",
    name: "Bird Passport",
    whoFor: "Birders, casual and serious",
    emotion: "Quiet attentiveness",
    weather: "Calm mornings",
    season: "Migration seasons",
    soundtrack: "Real birdsong, nothing else",
    coreMemory: "The species you'd never seen before",
    interaction: "Migration countdowns, a spotting log",
    status: "Idea",
    futureIdeas: [
      "Real migration-timing data",
      "A lifetime spotting list, kept simple",
    ],
  },
  {
    id: "fishing-passport",
    emoji: "🎣",
    name: "Fishing Passport",
    whoFor: "Anglers, opener-day regulars",
    emotion: "Patient hope",
    weather: "Overcast, calm water",
    season: "Fishing opener through fall",
    soundtrack: "Water, near silence",
    coreMemory: "The one that almost got away, told for years after",
    interaction: "Opener-day countdown, condition-aware spots",
    status: "Idea",
    futureIdeas: [
      "Real fishing regulations and opener dates by region",
      "A tally of species caught, kept personal",
    ],
  },
  {
    id: "camping-passport",
    emoji: "🏕️",
    name: "Camping Passport",
    whoFor: "Weekend campers and long-trip regulars",
    emotion: "Unplugged ease",
    weather: "Clear nights",
    season: "Camping season",
    soundtrack: "Fire crackling, real synthesized",
    coreMemory: "The story that gets told again at every fire after",
    interaction: "Season-open countdown, campfire ambient mode",
    status: "Idea",
    futureIdeas: [
      "Real site-availability awareness",
      "A shared 'who's bringing what' list",
    ],
  },
  {
    id: "wellness-passport",
    emoji: "🧘",
    name: "Wellness Passport",
    whoFor: "Anyone who needs a reset, not an itinerary",
    emotion: "Calm restoration",
    weather: "Any, especially still mornings",
    season: "Any",
    soundtrack: "Very sparse, mostly silence",
    coreMemory: "The morning that actually slowed down",
    interaction: "Deliberately low-stimulation UI mode",
    status: "Idea",
    futureIdeas: [
      "A 'do less' mode across the whole product",
      "Real quiet-hours-aware suggestions",
    ],
  },
  {
    id: "foodie-passport",
    emoji: "🍽️",
    name: "Foodie Passport",
    whoFor: "People who plan the day around the meal",
    emotion: "Anticipatory delight",
    weather: "Any",
    season: "Any, harvest season especially",
    soundtrack: "Warm, a little jazzy",
    coreMemory: "The dish nobody warned you about",
    interaction: "Local-tip-first recommendations ('order this')",
    status: "Idea",
    futureIdeas: [
      "Real, sourced 'order this' local tips per place",
      "Seasonal-menu awareness",
    ],
  },
  {
    id: "history-passport",
    emoji: "🪦",
    name: "History Passport",
    whoFor: "Anyone who wants the story behind the place",
    emotion: "Grounded wonder",
    weather: "Any",
    season: "Any",
    soundtrack: "Old piano, distant and sparse",
    coreMemory: "The fact that changes how you see a place forever after",
    interaction: "Documented vs. Local Legend labeling",
    status: "Idea",
    futureIdeas: [
      "Full Local Legends dataset feeding real Atlas enrichment",
      "Real citation on every historical claim, always",
    ],
  },
  {
    id: "coffee-passport",
    emoji: "☕",
    name: "Coffee Passport",
    whoFor: "Anyone whose day starts with the right cup",
    emotion: "Grounded, unhurried",
    weather: "Any",
    season: "Any",
    soundtrack: "Coffee shop ambience, real synthesized",
    coreMemory: "The place you now measure every other coffee against",
    interaction: "Morning-first recommendation ordering",
    status: "Idea",
    futureIdeas: [
      "A real 'best coffee within 10 minutes' Atlas answer",
      "A loyalty-free 'you've been here before' note",
    ],
  },
  {
    id: "road-trip-passport",
    emoji: "🚗",
    name: "Road Trip Passport",
    whoFor: "Anyone with more road than plan",
    emotion: "Open possibility",
    weather: "Any",
    season: "Any",
    soundtrack: "Road trip singalongs",
    coreMemory: "The stop nobody planned that became the whole story",
    interaction: "Serendipity-first, not optimized-route-first",
    status: "Idea",
    futureIdeas: [
      "A 'two free hours' nudge built directly into the drive",
      "Real, tagged roadside-worth-stopping-for spots",
    ],
  },
  {
    id: "adventure-passport",
    emoji: "🧗",
    name: "Adventure Passport",
    whoFor: "Anyone chasing adrenaline",
    emotion: "Alert excitement",
    weather: "Clear, stable",
    season: "Any, condition-dependent",
    soundtrack: "Driving, energetic",
    coreMemory: "The moment right before you commit",
    interaction: "Difficulty and condition-aware filtering",
    status: "Idea",
    futureIdeas: [
      "Real difficulty/condition data, not editorial guessing",
      "A 'you're getting braver' arc across a season",
    ],
  },
  {
    id: "stargazing-passport",
    emoji: "🌌",
    name: "Stargazing Passport",
    whoFor: "Anyone who wants to look up",
    emotion: "Small and amazed",
    weather: "Clear, low light pollution",
    season: "Any, best new moon",
    soundtrack: "Near total silence",
    coreMemory: "The first meteor you actually saw, not just heard about",
    interaction: "Moon-phase and meteor-shower countdowns",
    status: "Idea",
    futureIdeas: [
      "Real dark-sky location data",
      "A real meteor shower calendar driving the countdown",
    ],
  },
  {
    id: "movie-night-passport",
    emoji: "🎬",
    name: "Movie Night Passport",
    whoFor: "Anyone pairing a film with a real evening",
    emotion: "Anticipatory cozy",
    weather: "Any",
    season: "Any",
    soundtrack: "Whatever the mood calls for",
    coreMemory: "The night the movie was just the beginning",
    interaction: "Movie mood → real activity pairing",
    status: "Idea",
    futureIdeas: [
      "Real outdoor-theatre and drive-in schedules",
      "Mood-based pairing beyond October's six",
    ],
  },
  {
    id: "family-reunion-passport",
    emoji: "👨‍👩‍👧‍👦",
    name: "Family Reunion Passport",
    whoFor: "A big, mixed-age group, once a year",
    emotion: "Warm chaos",
    weather: "Any",
    season: "Summer, holidays",
    soundtrack: "Whatever the loudest cousin picks",
    coreMemory:
      "The activity that actually worked for everyone from age 6 to 86",
    interaction: "Multi-generation filtering (energy level, mobility)",
    status: "Idea",
    futureIdeas: [
      "Real accessibility-aware filtering by default",
      "A shared family board, one link for everyone",
    ],
  },
  {
    id: "corporate-retreat-passport",
    emoji: "💼",
    name: "Corporate Retreat Passport",
    whoFor: "A team that needs to actually connect, not just meet",
    emotion: "Guarded, then loosening",
    weather: "Any",
    season: "Any",
    soundtrack: "Neutral, professional-but-warm",
    coreMemory: "The moment the team stopped talking about work",
    interaction: "Group-energy-aware pacing",
    status: "Idea",
    futureIdeas: [
      "A facilitator mode, not just a traveler mode",
      "Real venue-capacity-aware suggestions",
    ],
  },
  {
    id: "conference-companion",
    emoji: "🎤",
    name: "Conference Companion",
    whoFor: "Someone in town for three days of sessions",
    emotion: "Efficient curiosity",
    weather: "Any",
    season: "Any",
    soundtrack: "Quick, practical, still warm",
    coreMemory:
      "The two free hours between sessions that became the trip's highlight",
    interaction: "Time-boxed discovery (the Two Hour Passport, specialized)",
    status: "Idea",
    futureIdeas: [
      "Venue-proximity-aware suggestions",
      "A 'walking distance from the conference centre' filter",
    ],
  },
  {
    id: "team-building-passport",
    emoji: "🤝",
    name: "Team Building Passport",
    whoFor: "A team, deliberately doing something together",
    emotion: "Collaborative energy",
    weather: "Any",
    season: "Any",
    soundtrack: "Upbeat, group-friendly",
    coreMemory: "The activity nobody expected to be the best part",
    interaction: "Group-size and skill-level-aware filtering",
    status: "Idea",
    futureIdeas: [
      "Real group-activity capacity data",
      "A post-day 'what worked' reflection prompt",
    ],
  },
  {
    id: "recovery-passport",
    emoji: "🛌",
    name: "Recovery Passport",
    whoFor: "Anyone who did too much yesterday",
    emotion: "Gentle permission to rest",
    weather: "Any",
    season: "Any",
    soundtrack: "Very quiet",
    coreMemory: "The day that was allowed to be nothing",
    interaction: "A deliberately low-ambition suggestion mode",
    status: "Idea",
    futureIdeas: [
      "A real 'do nothing, and that's the plan' framing",
      "Recovery-specific local tips (best nap spot, quietest café)",
    ],
  },
  {
    id: "solo-passport",
    emoji: "🚶",
    name: "Solo Passport",
    whoFor: "One person, no one else to plan around",
    emotion: "Independent calm",
    weather: "Any",
    season: "Any",
    soundtrack: "Whatever they actually want, finally",
    coreMemory: "The table for one that didn't feel like a compromise",
    interaction: "No group-size assumptions anywhere in the flow",
    status: "Idea",
    futureIdeas: [
      "A genuinely solo-friendly framing (not 'bring a friend' everywhere)",
      "Rediscovering wonder alone — see Wonder's own open question",
    ],
  },
  {
    id: "budget-passport",
    emoji: "🪙",
    name: "Budget Passport",
    whoFor: "Anyone who wants a real day without spending much",
    emotion: "Resourceful pride",
    weather: "Any",
    season: "Any",
    soundtrack: "Upbeat, scrappy",
    coreMemory: "The free thing that beat the expensive one",
    interaction: "\"We're Broke\" mode — see HELL YEAH's own version of this",
    status: "Idea",
    futureIdeas: [
      "Real free/cheap Atlas categories, not an afterthought",
      "A cost-transparency norm across every recommendation",
    ],
  },
  {
    id: "two-hour-passport",
    emoji: "⏱️",
    name: "Two Hour Passport",
    whoFor: "Anyone with a real gap and nothing planned for it",
    emotion: "Opportunistic delight",
    weather: "Any",
    season: "Any",
    soundtrack: "Quick, bright",
    coreMemory: "The best two hours of the whole trip, unplanned",
    interaction: "Time-boxed, proximity-first suggestions",
    status: "Idea",
    futureIdeas: [
      "Real duration-aware filtering across all of Atlas",
      "A 'you have exactly this much time' input, taken seriously",
    ],
  },
  {
    id: "last-minute-passport",
    emoji: "⚡",
    name: "Last Minute Passport",
    whoFor: "Anyone deciding right now, today",
    emotion: "Spontaneous urgency",
    weather: "Whatever it actually is right now",
    season: "Whatever it actually is right now",
    soundtrack: "Fast, decisive",
    coreMemory: "The trip that started because someone said 'let's just go'",
    interaction: "Zero-setup, real-time-conditions-first discovery",
    status: "Idea",
    futureIdeas: [
      "Real-time weather/hours awareness, no manual toggles",
      "A single 'surprise me, right now' button",
    ],
  },
  {
    id: "parents-visiting",
    emoji: "👴",
    name: "Parents Visiting",
    whoFor: "Hosting your own parents for a few days",
    emotion: "Proud hospitality",
    weather: "Any",
    season: "Any",
    soundtrack: "Whatever they'd actually enjoy",
    coreMemory: "Showing them the place you now call home",
    interaction: "Host-mode framing, not traveler-mode",
    status: "Idea",
    futureIdeas: [
      "Accessibility-first defaults",
      "A 'show off your city' framing, not a generic itinerary",
    ],
  },
  {
    id: "friends-visiting",
    emoji: "🧑‍🤝‍🧑",
    name: "Friends Visiting",
    whoFor: "Hosting friends who've never been",
    emotion: "Eager hospitality",
    weather: "Any",
    season: "Any",
    soundtrack: "Whatever gets everyone hyped",
    coreMemory: "The spot you'd never tell a stranger about",
    interaction: "Local-insider framing, not tourist-default",
    status: "Idea",
    futureIdeas: [
      "A 'locals only' tone across every suggestion",
      "A shareable host-built itinerary link",
    ],
  },
  {
    id: "date-night",
    emoji: "💕",
    name: "Date Night",
    whoFor: "Two people, one evening",
    emotion: "Nervous excitement",
    weather: "Any, best clear evenings",
    season: "Any",
    soundtrack: "Warm, a little vulnerable",
    coreMemory: "The place that became 'our place'",
    interaction: "Quiet-first, not loudest-rated-first",
    status: "Idea",
    futureIdeas: [
      "A genuine two-person-only framing",
      "A 'first date' vs. 'been together years' tone toggle",
    ],
  },
  {
    id: "sunday-reset",
    emoji: "🌇",
    name: "Sunday Reset",
    whoFor: "Anyone bracing for Monday",
    emotion: "Gentle closure",
    weather: "Any",
    season: "Any",
    soundtrack: "Slow, warm, winding down",
    coreMemory: "The one good thing that made the weekend feel complete",
    interaction: "Short, single-activity suggestions, not a full day",
    status: "Idea",
    futureIdeas: [
      "A deliberately small, single-suggestion mode",
      "A 'this week, next week' gentle look-ahead",
    ],
  },
  {
    id: "local-explorer",
    emoji: "🧭",
    name: "Local Explorer",
    whoFor: "Someone who's lived here for years and wants to see it fresh",
    emotion: "Rediscovery",
    weather: "Any",
    season: "Any",
    soundtrack: "Familiar, but a little different",
    coreMemory: "The thing five minutes away you never once visited",
    interaction: "Proximity-to-home-first, novelty-weighted",
    status: "Idea",
    futureIdeas: [
      "A 'you live here, but have you...' prompt",
      "A real novelty score based on what you haven't done",
    ],
  },
  {
    id: "new-in-town",
    emoji: "📦",
    name: "New In Town",
    whoFor: "Someone who just moved and doesn't know anyone yet",
    emotion: "Hopeful uncertainty",
    weather: "Any",
    season: "Any",
    soundtrack: "Optimistic, a little tentative",
    coreMemory: "The first place that felt like it might become 'yours'",
    interaction: "Orientation-first, essentials-plus-charm framing",
    status: "Idea",
    futureIdeas: [
      "A real 'the basics, done well' starter list",
      "A gentle onramp into Local Explorer over time",
    ],
  },
  {
    id: "dog-adventure",
    emoji: "🐕",
    name: "Dog Adventure",
    whoFor: "You and the dog, obviously",
    emotion: "Uncomplicated joy",
    weather: "Any, mind the heat",
    season: "Any",
    soundtrack: "Upbeat, a little goofy",
    coreMemory: "The beach that became the dog's whole personality",
    interaction: "Dog-friendly-first filtering, always on",
    status: "Idea",
    futureIdeas: [
      "Real, confirmed dog-friendly Atlas tagging",
      "Heat/pavement-safety-aware suggestions in summer",
    ],
  },
  {
    id: "berry-picking",
    emoji: "🍓",
    name: "Berry Picking",
    whoFor: "Anyone chasing the short window when they're ready",
    emotion: "Seasonal urgency, then satisfaction",
    weather: "Clear, dry mornings",
    season: "Short, specific windows",
    soundtrack: "Birdsong, quiet",
    coreMemory: "More berries than you knew what to do with",
    interaction: "A real 'ready now' countdown, not a generic season note",
    status: "Idea",
    futureIdeas: [
      "Real ripeness-window data by region",
      "A 'this year's window' notification, not a static date",
    ],
  },
  {
    id: "wildflower-passport",
    emoji: "🌼",
    name: "Wildflower Passport",
    whoFor: "Anyone chasing a bloom before it's gone",
    emotion: "Fleeting wonder",
    weather: "Clear, mild",
    season: "Spring, short peak windows",
    soundtrack: "Light, bright",
    coreMemory: "The hillside that was completely different a week later",
    interaction: "Bloom-peak countdowns",
    status: "Idea",
    futureIdeas: [
      "Real bloom-tracking data by trail/region",
      "A 'peak this week' urgency framing",
    ],
  },
  {
    id: "garden-passport",
    emoji: "🌱",
    name: "Garden Passport",
    whoFor: "Anyone who wants ideas, not just a view",
    emotion: "Quiet inspiration",
    weather: "Any",
    season: "Growing season",
    soundtrack: "Very quiet, natural",
    coreMemory: "The plant combination you went home and copied",
    interaction: "Season-aware, idea-forward framing",
    status: "Idea",
    futureIdeas: [
      "Real public and botanical garden data",
      "A 'what's blooming there right now' layer",
    ],
  },
  {
    id: "learning-passport",
    emoji: "🎓",
    name: "Learning Passport",
    whoFor: "Anyone who wants the why, not just the what",
    emotion: "Curious focus",
    weather: "Any",
    season: "Any",
    soundtrack: "Focused, unobtrusive",
    coreMemory: "The fact you still bring up in conversation years later",
    interaction: "Documented-fact-forward framing, real citations visible",
    status: "Idea",
    futureIdeas: [
      "A kid-friendly reading-level toggle (see Educational Adventures, ideas wall)",
      "Real sourced 'did you know' content throughout Atlas",
    ],
  },
  {
    id: "seasonal-passport",
    emoji: "🍂",
    name: "Seasonal Passport",
    whoFor: "Anyone who wants Passport itself to feel like the season",
    emotion: "Whatever the season is feeling",
    weather: "Whatever the season brings",
    season: "All of them, one at a time",
    soundtrack: "Changes with the season, always",
    coreMemory:
      "Realizing Passport looked different than it did last time you opened it",
    interaction: "The umbrella idea behind Live Seasons itself",
    status: "Idea",
    futureIdeas: [
      "A real, systemized version of what October Passport prototyped once",
      "Spring/Summer/Winter personalities with their own full builds",
    ],
  },
];

/* ============================================================ */
/* LIFE MOMENTS */
/* ============================================================ */

export const LIFE_MOMENTS: readonly string[] = [
  "Birthday",
  "Proposal",
  "Anniversary",
  "Graduation",
  "Retirement",
  "Bachelor",
  "Bachelorette",
  "Family Reunion",
  "Long Weekend",
  "Christmas",
  "Thanksgiving",
  "Halloween",
  "First Date",
  "Parents Visiting",
  "Friends Visiting",
  "Kids Visiting",
  "Breakup Recovery",
  "New Job",
  "Vacation Starts Tomorrow",
  "Last Weekend Before School",
  "Rainy Weekend",
  "Snow Day",
  "Heat Wave",
  "Staycation",
  "Random Saturday",
];

/* ============================================================ */
/* SEASONS */
/* ============================================================ */

export const SEASONS: readonly string[] = [
  "Spring",
  "Summer",
  "Fall",
  "October",
  "Winter",
  "Christmas",
  "First Snow",
  "Cherry Blossoms",
  "Wildflowers",
  "Peak Fall Colours",
  "Harvest",
  "Camping Season",
  "Patio Season",
  "Bike Season",
  "Ski Season",
  "Fishing Opener",
  "Meteor Showers",
  "Aurora",
  "Salmon Run",
  "Butterfly Migration",
  "Bird Migration",
  "Mushroom Season",
  "Pumpkin Season",
  "Storm Watching",
  "Fireworks",
  "Longest Day",
  "Shortest Day",
  "Berry Season",
  "Fish Spawning",
  "Ski Opening",
  "Mountain Pass Opening",
  "Fire Season",
  "Extreme Heat",
];

/* ============================================================ */
/* ANTICIPATION */
/* ============================================================ */

export interface AnticipationItem {
  readonly emoji: string;
  readonly line: string;
  readonly why: string;
}

export const ANTICIPATION_ITEMS: readonly AnticipationItem[] = [
  {
    emoji: "🌠",
    line: "4 days until the meteor shower",
    why: "A countdown turns a random Tuesday into something worth staying up for.",
  },
  {
    emoji: "🐟",
    line: "Salmon are arriving",
    why: "Most people never know this is even happening nearby. Passport should be the reason they find out in time.",
  },
  {
    emoji: "🦋",
    line: "Butterfly migration begins soon",
    why: "Nature runs on a calendar nobody hands out. Passport can be the one that does.",
  },
  {
    emoji: "🍂",
    line: "Peak colours are coming",
    why: "The window is short. Knowing exactly when turns 'maybe this weekend' into 'this weekend, for sure.'",
  },
  {
    emoji: "🌷",
    line: "Blossoms expected next week",
    why: "Anticipation is half the memory — by the time the blossoms open, you've already been looking forward to them for days.",
  },
  {
    emoji: "🍄",
    line: "Mushroom season begins",
    why: "A quiet, specific kind of excitement most apps never even consider is a season at all.",
  },
  {
    emoji: "🎄",
    line: "Christmas Market opens Friday",
    why: "A real date turns 'someday' into 'Friday' — the single most useful thing anticipation can do.",
  },
  {
    emoji: "🏕️",
    line: "Camping season starts",
    why: "The whole shape of a season change, announced, not just implied by the calendar changing.",
  },
  {
    emoji: "🏍️",
    line: "Mountain passes reopen",
    why: "For a rider, this single fact is bigger news than almost anything else Passport could say all year.",
  },
  {
    emoji: "🚴",
    line: "Bike season begins",
    why: "Marking the actual first real day, not just 'it's technically spring now.'",
  },
  {
    emoji: "🎣",
    line: "Fishing opener",
    why: "A real regulatory date that matters enormously to exactly the people it matters to.",
  },
  {
    emoji: "🎆",
    line: "Fireworks tonight",
    why: "The shortest possible countdown — proof anticipation works at every timescale, not just seasons.",
  },
  {
    emoji: "🌌",
    line: "Aurora possible",
    why: "A maybe is still worth knowing about. Some of the best nights start with 'it might happen tonight.'",
  },
  {
    emoji: "⛳",
    line: "Golf courses opening",
    why: "A real seasonal reopening, not just weather — the kind of specific news a golfer would want texted to them.",
  },
  {
    emoji: "🏔️",
    line: "Mountain passes opening",
    why: "For anyone who's been waiting all winter, this is bigger news than almost anything else Passport could say that week.",
  },
  {
    emoji: "🌼",
    line: "Wildflowers coming",
    why: "The bloom hasn't started yet — the anticipation itself is the whole point of saying something now instead of waiting.",
  },
];

/** The full countdown scale anticipation should be able to speak in, from a season away to right now. */
export const ANTICIPATION_COUNTDOWN_STAGES: readonly string[] = [
  "30 days",
  "14 days",
  "7 days",
  "Tomorrow",
  "Tonight",
  "Right now",
];

export const ANTICIPATION_ENGINE_TAGLINE =
  "A calendar of excitement, not a calendar of reminders.";

/* ============================================================ */
/* WEATHER */
/* ============================================================ */

export const WEATHER_PASSPORTS: readonly string[] = [
  "Rain Passport",
  "Snow Passport",
  "Heat Passport",
  "Extreme Heat Passport",
  "Fog Passport",
  "Wind Passport",
  "Storm Passport",
];

export const PERFECT_CONDITIONS: readonly string[] = [
  "Bluebird Day",
  "Perfect Patio",
  "Perfect Paddleboard",
  "Perfect Reading Day",
  "Perfect Ghost Weather",
  "Perfect Stargazing Night",
  "Perfect Campfire Night",
  "Perfect Photography Light",
  "Perfect Ski Day",
];

/** Weather is both practical (what's possible) and emotional (how it feels) — never only one or the other. */
export const WEATHER_DUALITY_NOTE =
  "Weather is both PRACTICAL and EMOTIONAL. It changes what's possible and how it feels at the same time — Passport should always speak to both halves, never just the forecast.";

/* ============================================================ */
/* INTERACTION LIBRARY */
/* ============================================================ */

export interface InteractionEntry {
  readonly name: string;
  readonly why: string;
  readonly builtIn?: string;
}

export const INTERACTION_LIBRARY: readonly InteractionEntry[] = [
  {
    name: "Hell Yeah Meter",
    why: "Turns a rating into room energy — the whole page reacts, not just one number.",
    builtIn: "HELL YEAH",
  },
  {
    name: "Discovery Swipe",
    why: "Feels like discovering, not filtering. Every swipe teaches Atlas something real.",
    builtIn: "Discovery Swipe",
  },
  {
    name: "Mood Board",
    why: "A visible, growing thing you're proud of — not a hidden saved-items list.",
    builtIn: "Discovery Swipe",
  },
  {
    name: "Adventure Bucket",
    why: "The same idea as the Mood Board, voiced for a rowdier room.",
    builtIn: "HELL YEAH",
  },
  {
    name: "Ghost Cam / Scare Cam",
    why: "A real countdown and a real, honest procedural effect — 'was that there?' earned, not faked.",
    builtIn: "October Passport",
  },
  {
    name: "Ghost Portrait",
    why: "Turns a selfie into a keepsake with real character, entirely on-device.",
    builtIn: "October Passport",
  },
  {
    name: "Flashlight Mode",
    why: "Proves that hiding something can be more compelling than showing everything at once.",
  },
  {
    name: "Voice Discovery",
    why: "Removes the form. Someone just says what they want.",
  },
  {
    name: "Shared Planning",
    why: "Planning is usually social. The product should be too.",
  },
  {
    name: "Countdown Timer",
    why: "The single cheapest way to turn 'someday' into anticipation.",
  },
  {
    name: "Card Talks Back",
    why: "Rare and specific beats constant and generic — surprise only works if it's not expected.",
    builtIn: "Discovery Swipe",
  },
  {
    name: "Crush Detection",
    why: "Pattern recognition that stays about the experience, never the person.",
    builtIn: "Discovery Swipe",
  },
  {
    name: "Weather Reactions",
    why: "Weather as story, not just a filter condition.",
    builtIn: "October Passport",
  },
  {
    name: "Movie Pairing",
    why: "Inspiration from familiar media, without Passport becoming a media app.",
    builtIn: "October Passport",
  },
  {
    name: "Rare Events",
    why: "Tension needs silence most of the time and surprise rarely — never the reverse.",
    builtIn: "October Passport",
  },
  {
    name: "Secret Discoveries",
    why: "Some things should be found, not handed over.",
    builtIn: "October Passport",
  },
  {
    name: "Memory Timeline",
    why: "Passport should help people remember a day, not just plan one.",
  },
  {
    name: "Camera Memories",
    why: "The camera isn't a feature, it's a memory-making device Passport happens to host.",
    builtIn: "October Passport",
  },
  {
    name: "Today's Story",
    why: "A day told as a scene is more exciting than a day told as a schedule.",
  },
  {
    name: "Today's Word",
    why: "A gentle, never-preachy way to give a day a little more intention.",
    builtIn: "Wonder",
  },
  {
    name: "Tunes For The Trip",
    why: "The soundtrack belongs to the memory, not to a separate app.",
    builtIn: "Wonder",
  },
  {
    name: "Mini Missions",
    why: "Noticing, not winning — the opposite of gamification.",
    builtIn: "Wonder",
  },
  {
    name: "Adventure Journal",
    why: "The plan and the memory shouldn't need two separate apps.",
  },
  {
    name: "Hidden Cards",
    why: "The 'look closer' click makes discovery feel earned.",
    builtIn: "October Passport",
  },
  {
    name: "Dynamic Atmosphere",
    why: "A page that visibly reacts is a page that feels alive, not static.",
    builtIn: "HELL YEAH",
  },
  {
    name: "Local Tips",
    why: "'Bring your own mulled wine' — the detail no official source ever lists.",
  },
  {
    name: "Relationship Intelligence",
    why: "Some days are about two people, not one traveler and a list.",
  },
];

/* ============================================================ */
/* CAMERA IDEAS */
/* ============================================================ */

export const CAMERA_IDEAS: readonly string[] = [
  "Memory Mode",
  "Ghost Cam",
  "Group Scare Cam",
  "Ghost Portrait",
  "Bird Spotting Camera",
  "Photography Challenges",
  "Golden Hour Reminder",
  "Family Picture",
  "Romantic Memory",
  "Adventure Selfie",
  "Historical Overlay",
  "Reaction Cam",
  "Before / After",
  "Group Photo",
  "AR Nature Learning",
  "Passport Caught Me",
  "Shared Camera Moments",
];

export const CAMERA_MEMORY_MODE_NOTE =
  "The camera concept belongs beyond October. Every one of these is really one reusable idea — camera as memory-maker — wearing different seasonal clothes. Camera can become Memory Mode.";

/* ============================================================ */
/* SOUND DESIGN */
/* ============================================================ */

export const SOUND_PERSONALITIES: readonly string[] = [
  "Bachelor",
  "Wonder",
  "October",
  "Motorcycle",
  "Rain",
  "Coffee",
  "Birding",
  "Fishing",
  "Camping",
  "Photography",
  "Wellness",
];

export const SOUND_INGREDIENTS: readonly string[] = [
  "Wind",
  "Rain",
  "Leaves",
  "Birds",
  "Water",
  "Coffee Shop",
  "Campfire",
  "Train",
  "Motorcycle",
  "Old Piano",
  "Strings",
  "Silence",
  "Church Bell",
  "Radio Static",
  "Footsteps",
  "Old Floorboards",
  "Fireplace",
  "Piano",
  "Bells",
  "Choir",
  "Jazz",
  "Gravel",
  "Engine",
  "Crowds",
  "Glass Clinks",
  "Creek",
  "Dawn Chorus",
];

export interface SoundByPersonality {
  readonly personality: string;
  readonly ingredients: readonly string[];
}

/** Per-personality sound breakdowns, called out explicitly rather than left implicit in the shared ingredient list above — each combination is its own deliberate mix, not a random draw from the pool. */
export const SOUND_DESIGN_BY_PERSONALITY: readonly SoundByPersonality[] = [
  {
    personality: "HELL YEAH",
    ingredients: ["Water", "Engines", "Crowds", "Glass clinks", "Music"],
  },
  {
    personality: "Wonder",
    ingredients: ["Birds", "Creek", "Laughter", "Soft acoustic", "Nature"],
  },
  {
    personality: "October Passport",
    ingredients: [
      "Wind",
      "Leaves",
      "Old wood",
      "Train",
      "Church bell",
      "Rain",
      "Radio static",
      "Footsteps",
      "Silence",
    ],
  },
  {
    personality: "Christmas Passport",
    ingredients: [
      "Fireplace",
      "Piano",
      "Bells",
      "Snow / wind",
      "Choir",
      "Coffee-shop ambience",
      "Jazz",
    ],
  },
  {
    personality: "Motorcycle Passport",
    ingredients: ["Engine", "Wind", "Gravel"],
  },
  {
    personality: "Bird Passport",
    ingredients: ["Dawn", "Bird calls", "Stream", "Quiet"],
  },
];

export const WHY_SILENCE =
  "Silence isn't the absence of soundtrack — it's the loudest part of one, if it's used right. A page that never goes quiet has nothing left to contrast against, and stops meaning anything. October Passport's whole tension design depends on this.";

/* ============================================================ */
/* MOVIE WALL */
/* ============================================================ */

export interface MovieInspiration {
  readonly title: string;
  readonly feeling: string;
}

export const MOVIE_WALL: readonly MovieInspiration[] = [
  {
    title: "The Lost Boys",
    feeling:
      "Nighttime freedom, neon, a little rebellious — youth energy, not horror.",
  },
  {
    title: "1408",
    feeling:
      "A rational person slowly realizing the room knows something they don't.",
  },
  {
    title: "Stand By Me",
    feeling:
      "A day that becomes a lifelong memory, powered by nothing but friendship and a destination.",
  },
  {
    title: "Into The Wild",
    feeling:
      "The pull of somewhere real, and the cost of chasing it without a plan.",
  },
  {
    title: "Secret Life of Walter Mitty",
    feeling:
      "Ordinary life interrupted by a real adventure, and being brave enough to take it.",
  },
  {
    title: "Chef",
    feeling:
      "Food as a road trip, a reconnection, and a real craft, all at once.",
  },
  {
    title: "The Goonies",
    feeling:
      "A treasure hunt that's really about the friends doing the hunting.",
  },
  {
    title: "National Treasure",
    feeling:
      "History as an active adventure, not a plaque you read and walk past.",
  },
  {
    title: "The Way",
    feeling:
      "A long walk that turns into something closer to grief, then healing.",
  },
  {
    title: "The Motorcycle Diaries",
    feeling: "A road trip that quietly becomes a life-changing one.",
  },
  {
    title: "Twin Peaks",
    feeling: "A small town with something strange underneath its own normalcy.",
  },
  {
    title: "Interstellar",
    feeling: "Wonder at a scale that makes an ordinary night sky feel bigger.",
  },
  {
    title: "Jurassic Park",
    feeling:
      "The exact feeling of seeing something real for the first time and being awestruck.",
  },
  {
    title: "The Shining",
    feeling:
      "Atmosphere only — a beautiful, wrong place, and dread that builds through space, not jump scares.",
  },
  {
    title: "Ghostbusters",
    feeling: "Spooky, but fun — proof scary and delightful aren't opposites.",
  },
  {
    title: "Sleepy Hollow",
    feeling:
      "Gothic, foggy, old-world dread — exactly October Passport's visual register.",
  },
  {
    title: "Hocus Pocus",
    feeling:
      "Family-friendly spooky — proof there's a real PG register for this whole mood.",
  },
  {
    title: "Home Alone",
    feeling:
      "Family chaos, neighborhood Christmas lights, and a kid-sized sense that the whole holiday belongs to you.",
  },
  {
    title: "Christmas Vacation",
    feeling:
      "Loud, imperfect, deeply loved family tradition — the mess is the point.",
  },
  {
    title: "Elf",
    feeling:
      "Unfiltered, contagious Christmas enthusiasm — the opposite of jaded.",
  },
  {
    title: "The Holiday",
    feeling:
      "A slow, snowy, village-and-bookstore romance — quiet instead of loud.",
  },
  {
    title: "Polar Express",
    feeling:
      "A single night turned into a journey — belief treated as a destination, not a plot device.",
  },
];

/** Movies are not recommendations to watch — Passport can translate the feeling of a film into a real day. */
export const MOVIE_DAY_QUESTION = "What kind of movie are we living today?";

export interface MovieToExperience {
  readonly title: string;
  readonly elements: readonly string[];
}

export const MOVIE_TO_EXPERIENCE: readonly MovieToExperience[] = [
  {
    title: "Home Alone",
    elements: ["Pizza", "Neighborhood lights", "Ice cream", "Family chaos"],
  },
  {
    title: "The Holiday",
    elements: ["Bookstore", "Coffee", "Snow", "Village", "Slow romance"],
  },
  {
    title: "The Lost Boys",
    elements: [
      "Nighttime",
      "Neon",
      "Boardwalk",
      "Motorcycles",
      "Music",
      "Freedom",
      "Mystery",
    ],
  },
];

/* ============================================================ */
/* TRAILERS / BEST MOMENTS / CLIPS */
/* ============================================================ */

export const TRAILER_IDEA_OPTIONS: readonly string[] = [
  "Official trailer embeds",
  "Studio-approved previews",
  "Official YouTube clips",
  "Legal short previews",
  "Embedded links to iconic scenes where rights permit",
  'Curated "watch this trailer, then build a day that feels like it"',
];

export const TRAILER_PRINCIPLE =
  "Use media to communicate the feeling quickly. Sometimes thirty seconds of a trailer communicates more than a page of copy.";

export const TRAILER_DISCLAIMER =
  "Do not casually host copyrighted movie scenes. The product idea is the important thing, not any specific implementation of it — every real version of this needs real rights clearance first.";

/* ============================================================ */
/* PRODUCT PRINCIPLES (index — full reasoning lives in brand-principles.md) */
/* ============================================================ */

export const PRODUCT_PRINCIPLES: readonly string[] = [
  "Atlas understands. Passport inspires.",
  "The same Atlas. Infinite personalities.",
  "Never force delight. Offer it.",
  "Meet people where they already are. Surprise them with where you take them next.",
  "Steal principles. Never products.",
  "Build software obvious in hindsight.",
  "Weather is part of Discovery.",
  "Atmosphere is UX.",
  "People know how they want to feel before they know what they want to do.",
  "People are looking for things to do. They need to be told what they're doing.",
  "Passport should never know less than the best public source.",
  "If an experienced local had one hour, what would they tell their friend?",
  "Knowledge creates confidence.",
  "Anticipation creates excitement.",
  "Design for multiple senses whenever practical.",
  "Local knowledge beats generic information.",
  "Every season deserves personality.",
  "Every personality deserves its own emotional world.",
];

/* ============================================================ */
/* QUOTE WALL */
/* ============================================================ */

export const QUOTE_WALL: readonly string[] = [
  "Tomorrow deserves a plan.",
  "Atlas understands. Passport inspires.",
  "People are looking for things to do. They need to be told what they're doing.",
  "Knowledge creates confidence.",
  "Anticipation creates excitement.",
  "Build software obvious in hindsight.",
  "Never force delight. Offer it.",
  "Meet people where they already are. Surprise them with where you take them next.",
  "We build software people remember.",
  "Build → Learn → Save → Continue.",
  "The same Atlas. Infinite personalities.",
  "Weather is part of Discovery.",
  "Atmosphere is UX.",
  "Help people have a hell of a day.",
  "Passport should never know less than the best trusted public sources combined.",
  "If an experienced local had one hour to prepare a friend for tomorrow, what would they tell them?",
  "Facts become stories. Stories never become fake facts.",
  "Learn from culture. Don't clone products.",
  "Passport should earn the right to be closed.",
  "Use technology to find why less technology is so good.",
  "Every page should create momentum.",
  "Every interaction should leave the traveler slightly more excited.",
  "We're not building pages. We're building emotional worlds.",
  "Planning should feel like anticipation, not administration.",
  "People collect possibilities.",
  "Reality is often stranger than anything we could invent.",
  "When Passport chooses an emotional world, commit to the experience.",
  "Consent can increase anticipation.",
  "Use real atmosphere before fake effects.",
  "Steal principles. Never products.",
];

/* ============================================================ */
/* LOCAL KNOWLEDGE */
/* ============================================================ */

export const LOCAL_KNOWLEDGE_EXAMPLES: readonly string[] = [
  "Bring bug spray.",
  "Bring cash.",
  "Best sunset.",
  "Park here.",
  "Order this.",
  "Don't miss this.",
  "Locals usually...",
  "Come before sunset.",
  "Avoid weekends.",
  "Trust me.",
  "Bring your own mulled wine.",
  "Bring sunscreen.",
  "Leave before sunset.",
  "Best beach for dogs.",
  "Best after rain.",
  "Gets windy later.",
  "Stop for coffee first.",
  "Don't miss the second viewpoint.",
];

export const LOCAL_KNOWLEDGE_LINE =
  "Little details create unforgettable experiences. None of these are official facts — they're the kind of thing only someone who's actually been there would think to say.";

/* ============================================================ */
/* FUTURE TECHNOLOGY */
/* ============================================================ */

export const FUTURE_TECHNOLOGY: readonly string[] = [
  "Voice",
  "Camera",
  "AR",
  "Shared Sessions",
  "AI Companion",
  "Memory Timeline",
  "Apple Watch",
  "CarPlay",
  "Vision Pro",
  "Spatial Audio",
  "Live Weather",
  "Mood Detection",
  "Season Engine",
  "Relationship Intelligence",
];

/* ============================================================ */
/* RANDOM IDEAS — deliberately unorganized */
/* ============================================================ */

export const RANDOM_IDEAS: readonly string[] = [
  "Experiences have crushes.",
  "Ghosts appear in photos.",
  "Meteor countdown.",
  "Passport whispers.",
  "Recovery Passport.",
  "Coffee Passport.",
  "Things only happen in rain.",
  "Things only happen at midnight.",
  "Hidden discoveries.",
  "Secret events.",
  "Adventure Journal.",
  "Analog maps.",
  "Passport stamps.",
  "Treasure hunts.",
  "Printed memory books.",
  "Historical overlays.",
  "Butterfly Passport.",
  "Rain soundtrack.",
  "Passport notices hesitation.",
  "Passport celebrates courage.",
  "Cards wink.",
  "Cards talk.",
  "Seasonal easter eggs.",
  "Weather-reactive pages.",
  "Adventure Bucket.",
  "Mood Board grows.",
  "Board heartbeat.",
  "Ghost steals button.",
  "Raven steals cursor.",
  "Sound changes based on mood.",
  "Movie → real adventure.",
  "Trivia hunts.",
  "Daily Advent challenge.",
  "Scary rooms.",
  "Vancouver ghost night.",
  "Local legends.",
  "Printed maps.",
  "Kids learning kit.",
  "Word of day.",
  "Tunes for trip.",
  "Bike season countdown.",
  "Salmon spawning countdown.",
  "Bird migration.",
  "Berry season.",
  "Corporate Brainstorm Passport.",
  "Passport as a story room.",
  "A page that argues with itself.",
  "A card that changes its mind.",
  "The board pulses when it's almost a weekend.",
  "A secret only found in fog.",
  "A message that only appears after midnight.",
  "Cursor becomes a lantern.",
  "Cursor becomes a firefly in summer.",
  "A page that gets quieter the longer you stay.",
  "The map remembers where you've already been.",
  "A soundtrack that fades when you look away from the tab.",
  "A day that argues for itself before you even ask it to.",
];

/* ============================================================ */
/* THINGS TO RESEARCH */
/* ============================================================ */

export const RESEARCH_TOPICS: readonly string[] = [
  "Ghost stories",
  "Bird migration",
  "Meteor showers",
  "Fishing seasons",
  "Wildflowers",
  "Ghost towns",
  "Pumpkin patches",
  "Christmas markets",
  "Local legends",
  "Aurora",
  "Storm watching",
  "Mushrooms",
  "Salmon runs",
  "Hidden viewpoints",
  "Local folklore",
];

/* ============================================================ */
/* EXPERIMENT MAP */
/* ============================================================ */

export type ExperimentStatus =
  "Idea" | "Prototype" | "Paused" | "Merged" | "Killed" | "Shipped";

export interface ExperimentEntry {
  readonly number: string;
  readonly title: string;
  readonly status: ExperimentStatus;
  readonly href?: string;
}

export const EXPERIMENT_MAP: readonly ExperimentEntry[] = [
  {
    number: "01",
    title: "Discovery Space",
    status: "Prototype",
    href: "/about/experiment-01-discovery-space",
  },
  {
    number: "01B",
    title: "HELL YEAH — The Bachelor Party Experiment",
    status: "Prototype",
    href: "/about/experiment-01-bachelor-party",
  },
  {
    number: "02",
    title: "Discovery Swipe",
    status: "Prototype",
    href: "/about/experiment-02-discovery-swipe",
  },
  {
    number: "03",
    title: "October Passport",
    status: "Prototype",
    href: "/about/experiment-03-october-passport",
  },
  {
    number: "04",
    title: "Wonder",
    status: "Prototype",
    href: "/about/experiment-04-wonder",
  },
  {
    number: "05",
    title: "Christmas Passport",
    status: "Prototype",
    href: "/about/experiment-05-christmas",
  },
  {
    number: "06",
    title: "Analog Adventures",
    status: "Prototype",
    href: "/about/experiment-06-analog-adventures",
  },
  {
    number: "06+",
    title: "Every other personality on this wall",
    status: "Idea",
  },
];

/* ============================================================ */
/* DREAMS */
/* ============================================================ */

export const DREAMS: readonly string[] = [
  "What if Passport remembered traditions?",
  "What if Passport made tomorrow exciting?",
  "What if Passport taught curiosity?",
  "What if Passport helped people reconnect?",
  "What if Passport created lifelong memories?",
  "What if Passport made people fall in love with where they live?",
  "What if Passport became seasonal?",
  "What if every personality felt like stepping into a beautifully crafted short film?",
  "What if every year brought something new?",
  "What if people looked forward to October Passport the way they look forward to Christmas movies?",
  "What if Passport became part of family traditions?",
  "What if people planned their lives around moments they never knew existed?",
];

/**
 * ============================================================
 * PHASE 7.17 — THE OVER-CAPTURE PASS
 * ============================================================
 * Added 2026-08-11. A single night produced a very large number of
 * important Passport ideas, and the original Idea Atlas capture was
 * incomplete. This whole block exists so none of it dies in chat.
 * Deliberately over-captures: some ideas below sound similar to ones
 * above, on purpose, because they carry different emotional meaning in
 * different contexts — see the "How To Use This Page" note near the
 * bottom of this file. Nothing above this line was deleted, reordered,
 * or aggressively cleaned up to make room for it.
 */

/* ============================================================ */
/* ELK LABS — THE STUDIO PHILOSOPHY */
/* ============================================================ */

export const ELK_LABS_TAGLINE = "Building software obvious in hindsight.";

export const ELK_LABS_PHILOSOPHY: readonly string[] = [
  "The best product ideas can feel surprising when invented and inevitable once experienced.",
  "We are not trying to copy existing software.",
  "We study excellent interaction patterns from culture and other industries, understand WHY they work, and then reinterpret the principle for ELK.",
];

export const ELK_LABS_QUOTES: readonly string[] = [
  "Meet people where they already are. Surprise them with where you take them next.",
  "Learn from culture. Don't clone products.",
  "If another industry solved the problem better, steal the principle — not the interface.",
];

export const STUDY_EXAMPLES: readonly string[] = [
  "Spotify",
  "TikTok",
  "Tinder",
  "Pinterest",
  "Netflix",
  "Nintendo",
  "LEGO",
  "Disney / Theme Parks",
  "Board Games",
  "Escape Rooms",
  "Movies",
  "Museums",
  "Games",
  "Physical Toys",
  "Music",
  "Storytelling",
];

export const ELK_LABS_AMBITION =
  "Maybe one day other companies copy ELK interaction patterns. That would be a success, not a problem.";

/* ============================================================ */
/* THE FUNDAMENTAL PASSPORT / ATLAS SPLIT */
/* ============================================================ */

export const ATLAS_OWNS: readonly string[] = [
  "Evidence",
  "Sources",
  "Places",
  "Events",
  "Relationships",
  "Distance",
  "Weather",
  "Facts",
  "Advisories",
  "Activities",
  "Facilities",
  "Maps",
  "Knowledge",
  "Confidence",
  "Provenance",
];

export const PASSPORT_OWNS: readonly string[] = [
  "Anticipation",
  "Storytelling",
  "Mood",
  "Pacing",
  "Discovery",
  "Confidence",
  "Recommendations",
  "Personality",
  "Surprise",
  "Delight",
  "Memory",
  "Fun",
];

export const ATLAS_IS_RESEARCHER_LINE =
  "Atlas is the researcher. Passport is the director. Atlas can be boring — that's okay. Atlas does the research so the traveler doesn't have to. Passport transforms that research into useful experiences.";

export const SPLIT_QUOTES: readonly string[] = [
  "Passport should never know less than the best trusted public sources combined.",
  "If an experienced local had one hour to prepare a friend for tomorrow, what would they tell them?",
  "Facts become stories. Stories never become fake facts.",
  "Passport may summarize evidence. Passport may synthesize evidence. Passport may connect evidence. Passport may never invent evidence.",
];

/* ============================================================ */
/* PASSPORT'S REAL PURPOSE */
/* ============================================================ */

export const PURPOSE_STATEMENTS: readonly string[] = [
  "Help people have a hell of a day.",
  "Help people feel more alive.",
  "Help people look forward to tomorrow.",
  "Help people discover possibilities.",
  "Help people turn ideas into memories.",
  "Reduce planning work without removing discovery.",
  "Do the research so the traveler doesn't have to.",
  "Give enough trustworthy information that they don't feel compelled to leave Passport and search elsewhere.",
  "Allow deep research when wanted. Never require deep research.",
  "Useful first. Wonderful when invited. Never force delight. Offer it.",
];

export const LESS_TECHNOLOGY_LINE =
  "Technology should often help people use less technology. Passport can help someone prepare, print what matters, put away the phone, go live the experience, then optionally come back and tell the story.";

export const PURPOSE_QUOTE = "Passport should earn the right to be closed.";

/* ============================================================ */
/* THE BIG DISCOVERY INSIGHT */
/* ============================================================ */

export const POSSIBILITY_ATOMS: readonly string[] = [
  "Campfire",
  "Paddleboard",
  "Coffee",
  "Hidden Beach",
  "Sunrise",
  "Slow Morning",
  "Golf",
  "Ghost Town",
  "Berry Picking",
  "Birding",
  "Steak Dinner",
  "Swimming",
  "Meteor Shower",
];

export const DISCOVERY_INSIGHT_LINE =
  "People are not just collecting places. They are collecting possibilities. These can be emotional atoms before they are actual destinations — Atlas later connects those desires to reality.";

export const PEOPLE_KNOW_HOW_THEY_WANT_TO_FEEL: readonly string[] = [
  "How they want to feel",
  "Who they're with",
  "How much time they have",
  "What kind of energy they have",
  "What constraints they have",
  "Why today matters",
];

export const DISCOVERY_INSIGHT_QUOTE =
  "People rarely know exactly what they want to do. Passport should be able to start from how they want to feel instead.";

/* ============================================================ */
/* WHO ARE YOU TODAY? */
/* ============================================================ */

export const WHO_ARE_YOU_TODAY_PRINCIPLE =
  "Do not permanently typecast users. AI/personalization systems often become annoying because they decide 'you like X, therefore I will show you X forever.' Passport should learn without trapping people.";

export const DIRT_BIKER_EXAMPLE: readonly string[] = [
  "Dirt bikes Friday",
  "Romantic dinner Saturday",
  "Quiet bird walk Sunday",
  "Museum Monday",
];

export const WHO_ARE_YOU_TODAY_QUESTIONS: readonly string[] = [
  "Who are you today?",
  "What kind of day do you need?",
];
export const WHO_ARE_YOU_TODAY_NOT = "Who are you?";

/* ============================================================ */
/* DISCOVERY METHODS — Passport should not force one style */
/* ============================================================ */

export const DISCOVERY_METHODS: readonly string[] = [
  "Classic Grid / List Discovery",
  "Categorized Discovery",
  "Filters",
  "Search",
  "Map Discovery",
  "Mood Board Discovery",
  "Swipe Discovery",
  "Voice Discovery",
  "Close Your Eyes Discovery",
  "Discovery Constellation",
  "Random Discovery",
  "Story Discovery",
  "Mood Discovery",
  "Group Discovery",
  "Seasonal Discovery",
  "Weather Discovery",
  "Event Discovery",
  "Countdown / Anticipation Discovery",
  "Quick Find",
  "Deep Research Mode",
];

export const BORING_DISCOVERY_EXAMPLE = "Coffee. Open now. Directions. Done.";
export const BORING_DISCOVERY_NOTE =
  "The boring version matters too. That experience should also be excellent — not every discovery moment needs to be cinematic.";

/* ============================================================ */
/* THE ORIGINAL MOOD BOARD */
/* ============================================================ */

export const MOOD_BOARD_INTENT: readonly string[] = [
  "Playful",
  "Energetic",
  "Spontaneous",
  "Visual",
  "Low-Pressure",
];

export const MOOD_BOARD_NOTE =
  "Like collecting ideas for a summer, a day, or a weekend. Do not turn this into an itinerary form — the mood board is where people intentionally collect possibilities, and it should remain central.";

/* ============================================================ */
/* THE PUPPY-DOG BOARD */
/* ============================================================ */

export const PUPPY_DOG_BOARD_LINE =
  "The mood board follows the traveler around Passport like a happy puppy. It is persistent.";

export const PUPPY_DOG_BOARD_PAGES: readonly string[] = [
  "Discovery page",
  "Map",
  "Detail peek",
  "Restaurant",
  "Voice mode",
];

export interface BoardGrowthStage {
  readonly count: string;
  readonly label: string;
}

export const BOARD_GROWTH_STAGES: readonly BoardGrowthStage[] = [
  { count: "1 item", label: "A small beginning" },
  { count: "5 items", label: "Something is forming" },
  { count: "10 items", label: "This is becoming a day" },
  { count: "20 items", label: "This is becoming a weekend" },
  { count: "30 items", label: "This might be your summer" },
];

export const BOARD_NOT_SAVED_ITEMS =
  "The board can pulse, grow, visually bloom, become more joyful, create subtle celebrations, and reveal emerging patterns as ideas are added. Do not make it feel like 'Saved Items.'";

/* ============================================================ */
/* DETAILS / QUICK PEEK */
/* ============================================================ */

export const QUICK_PEEK_MODES: readonly string[] = [
  "Expand",
  "Flip",
  "Open Inline",
  "Open Drawer",
  "Quick Peek",
  "Reveal A Little More",
];

export const QUICK_PEEK_MINIMAL_FIELDS: readonly string[] = [
  "Name",
  "Vibe",
  "Hours",
  "Price",
  "Location",
  "Photo",
  "Nearby Options",
];

export const QUICK_PEEK_PRINCIPLE =
  "Detail pages do not always need to require full navigation. Give enough information to decide. Full entity pages still exist for deeper investigation when needed — do not force every entity into identical page depth.";

/* ============================================================ */
/* DISCOVERY MAP */
/* ============================================================ */

export const DISCOVERY_MAP_QUESTION = "What awesome things are around here?";

export const DISCOVERY_MAP_LAYERS: readonly string[] = [
  "Beaches",
  "Swimming",
  "Cliff Jumping",
  "Campgrounds",
  "Coffee",
  "Breweries",
  "Wineries",
  "Viewpoints",
  "Dirt-Bike Areas",
  "Hiking",
  "Fishing",
  "Boat Launches",
  "Picnic Areas",
  "Waterfalls",
  "Dog Friendly",
  "Family",
  "Romantic",
  "Events",
];

export const DISCOVERY_MAP_NOTE =
  "Not simply directions. Relationships become spatially understandable. The persistent mood board remains visible — click or tap something on the map and throw it onto the board.";

/* ============================================================ */
/* CLOSE YOUR EYES / VOICE DISCOVERY */
/* ============================================================ */

export const CLOSE_YOUR_EYES_PROMPT = "What kind of day do you need?";

export const CLOSE_YOUR_EYES_EXAMPLES: readonly string[] = [
  "I'm burnt out.",
  "I want to hear water.",
  "My dog is coming.",
  "I don't want crowds.",
  "I want something easy.",
];

export const CLOSE_YOUR_EYES_REVEAL = "Open your eyes.";

export const CLOSE_YOUR_EYES_NOTE =
  "Minimal interface, possibly a black screen. Passport listens, then reveals a completely different set of possibilities. Could repeat: choose one, close your eyes again, tell Passport what else you want. Planning feels like imagination rather than filling out a questionnaire.";

/* ============================================================ */
/* DISCOVERY SWIPE — gestures and Super Like */
/* ============================================================ */

export interface SwipeGesture {
  readonly gesture: string;
  readonly meaning: string;
}

export const SWIPE_GESTURES: readonly SwipeGesture[] = [
  { gesture: "Swipe Right", meaning: "Interested" },
  { gesture: "Swipe Left", meaning: "Not today" },
  { gesture: "Swipe Down", meaning: "Maybe / different mood / rain check" },
  { gesture: "Swipe Up", meaning: "HELL YEAH / Super Like" },
];

export const SWIPE_FORMAT_NOTE =
  "Phone-first. Full-screen cinematic cards. Video loops. Minimal text.";

export const SUPER_LIKE_NOTE =
  "Super Like can immediately move the idea onto the mood board. Potentially ask: morning, afternoon, or evening? If the choice is strong enough, it begins tentatively occupying time before organization.";

/* ============================================================ */
/* HESITATION AS SIGNAL */
/* ============================================================ */

export const HESITATION_SIGNAL_LINE =
  "Passport can learn from more than binary choices. If someone stares at a card for 12 seconds before swiping away, that means something.";

export const HESITATION_INTERPRETATIONS: readonly string[] = [
  "Curiosity",
  "Beautiful imagery",
  "Wrong day",
  "Wrong companion",
  "Almost interested",
];

export const HESITATION_PROTOTYPE_NOTE =
  "A visible ticking moment — tick, tick, tick. Not creepy. Playful.";

/* ============================================================ */
/* CARDS TALK BACK */
/* ============================================================ */

export interface CardVoice {
  readonly experience: string;
  readonly lines: readonly string[];
}

export const CARD_VOICES: readonly CardVoice[] = [
  {
    experience: "Skydiving",
    lines: [
      "So... we're really doing this?",
      "You looked twice.",
      "I dare you.",
    ],
  },
  { experience: "Wakeboarding", lines: ["I knew you'd like me."] },
  { experience: "Sunrise Paddle", lines: ["Tomorrow?"] },
  { experience: "Patio", lines: ["I saved you a chair."] },
  { experience: "Campfire", lines: ["The fire's already going."] },
  { experience: "Motorcycle", lines: ["Take the long way."] },
  { experience: "Coffee", lines: ["You'll need me tomorrow."] },
  { experience: "Winery", lines: ["You seem like my type."] },
];

export const CARDS_TALK_BACK_NOTE =
  "Not people flirting with the user — possibilities flirt with the traveler. Use rarely enough to surprise.";

/* ============================================================ */
/* THE CRUSH SYSTEM */
/* ============================================================ */

export const CRUSH_SYSTEM_LINES: readonly string[] = [
  "I think lakes have a crush on you.",
  "You've stopped for every waterfall.",
  "Someone clearly likes patios.",
  "I see a mountain trend.",
  "I think coffee keeps finding you.",
  "You've ignored every museum I've shown you.",
];

export const CRUSH_SYSTEM_NOTE =
  "Never creepy. Always about experiences, never the person.";

/* ============================================================ */
/* HELL YEAH / GROUP DISCOVERY */
/* ============================================================ */

export const HELL_YEAH_SHOUTS: readonly string[] = [
  "WAKEBOARDING!",
  "PATIO BEERS!",
  "PEDICURES!",
  "It's sandal season!",
  "BEEF JERKY!",
  "GOLF!",
  "SKYDIVING!",
];

export const HELL_YEAH_ROOM_NOTE =
  "A group of friends, a TV, phones, people shouting possibilities. Passport converts chaos into possibilities. AI acts like hype man. Atlas supplies real options.";

export const HELL_YEAH_ONE_PERSONALITY_NOTE =
  "This is one personality, not Passport's entire tone.";

/* ============================================================ */
/* HELL YEAH METER — room energy, not a rating control */
/* ============================================================ */

export const HELL_YEAH_METER_REACTIONS: readonly string[] = [
  "Meter pulses",
  "Typography grows",
  "Cards react",
  "Crowd reacts",
  "Board grows",
  "Animations celebrate",
  "The room visually becomes more alive",
];

/* ============================================================ */
/* GROUP GAMES / GAMIFICATION */
/* ============================================================ */

export const GROUP_GAMES: readonly string[] = [
  'Beer Bet — "I bet this is the best memory of the weekend."',
  "Loser buys breakfast.",
  "Winner chooses karaoke.",
  "Loser wears the ridiculous shirt.",
  "Winner gets shotgun.",
  "Loser carries the cooler.",
  "Rock-paper-scissors to settle conflicting activities.",
  "Activity tournament brackets.",
  "Adventure showdown.",
  "Fake gold stars.",
];

export const RIDICULOUS_TITLES: readonly string[] = [
  "Jerky King",
  "Patio Professional",
  "Caesar Champion",
  "Campfire Legend",
  "Sandal Season Survivor",
  "Cannonball MVP",
];

export const GROUP_GAMES_NOTE =
  "No need for real money. The goal is social stories — the game exists to create laughter and memories.";

/* ============================================================ */
/* ARGUMENT ENGINE */
/* ============================================================ */

export const ARGUMENT_ENGINE_EXAMPLE = {
  activity: "Skydiving",
  votes: "3 HELL YEAH, 2 NOPE",
  response: "This one's splitting the room.",
};

export const ARGUMENT_ENGINE_SURFACE: readonly string[] = [
  "Video",
  "Price",
  "Distance",
  "Fear level",
  "Alternatives",
];

export const ARGUMENT_ENGINE_NOTE =
  "If group members disagree, Passport does not force consensus. Surface the real information and let humans decide.";

/* ============================================================ */
/* THE HYPE MAN */
/* ============================================================ */

export const HYPE_MAN_LINES: readonly string[] = [
  "You boys have picked four adrenaline activities and zero food.",
  "Hydration appears optional.",
  "I have concerns.",
  "Someone is definitely losing sunglasses.",
  "You have accidentally built a ridiculous Saturday.",
];

export const HYPE_MAN_NOTE =
  "AI's role in rowdy group mode: not planner, hype man. Use humor.";

/* ============================================================ */
/* VIDEOS AS FIRST-CLASS CONTENT */
/* ============================================================ */

export const VIDEO_TYPES: readonly string[] = [
  "Cinematic loops",
  "Drone footage",
  "POV activity clips",
  "AI-generated mood videos where appropriate",
  "Official promotional footage where legally usable",
  "Creator footage with permission",
  "Trailers",
  "Local destination videos",
];

export const VIDEO_EXAMPLES: readonly string[] = [
  "Wakeboarding spray",
  "Skydiving door opening",
  "Motorcycle mountain road",
  "Paddleboard sunrise",
  "Patio golden hour",
  "Campfire sparks",
  "Skiing powder",
  "Bird flight",
  "Waterfall",
  "Ghost-tour streets",
  "Christmas lights",
  "Berry picking",
];

export const VIDEO_PRINCIPLE =
  "The video should let someone feel the possibility before reading. Do not treat video as decoration — it is a big Passport concept, under-captured previously.";

/* ============================================================ */
/* OCTOBER PASSPORT — everything the season is, beyond Halloween */
/* ============================================================ */

export const OCTOBER_ELEMENTS: readonly string[] = [
  "Fog",
  "Rain",
  "Cold Mornings",
  "Ghosts",
  "History",
  "Old Towns",
  "Local Legends",
  "Pumpkin Patches",
  "Campfires",
  "Spooky Movies",
  "Haunted Attractions",
  "Cemeteries",
  "Ghost Towns",
  "Old Mines",
  "Railways",
  "Fall Colors",
  "Coffee",
  "Cabins",
  "Nighttime Exploration",
];

export const OCTOBER_NOT_JUST_HALLOWEEN = "October is not merely Halloween.";

export const OCTOBER_MODES: readonly string[] = [
  "Family October",
  "Classic October",
  "After Dark / Nightmare",
];

/* ============================================================ */
/* FEAR DIAL / CONSENT TO SCARE */
/* ============================================================ */

export const FEAR_DIAL_QUESTION = "How brave are you tonight?";

export const FEAR_DIAL_LEVELS: readonly string[] = [
  "Cozy Autumn",
  "Spooky",
  "Creepy",
  "Nightmare",
];

export const FEAR_DIAL_AFFECTS: readonly string[] = [
  "Soundtrack",
  "Lighting",
  "Copy",
  "Rare events",
  "Visual effects",
  "Scare intensity",
];

export const FEAR_DIAL_PRINCIPLE =
  "This is not merely safety. The selection itself creates anticipation, like standing in line outside a haunted house hearing people scream inside. Consent can increase anticipation.";

/* ============================================================ */
/* OCTOBER INTERACTIONS — the full list */
/* ============================================================ */

export const OCTOBER_INTERACTIONS: readonly string[] = [
  "Flashlight Mode",
  "Hidden Objects",
  "Hidden Ghosts",
  "Old Photographs Changing",
  "Ghost In Camera Background",
  "Victorian Ghost Portrait",
  "Scare Cam",
  "Group Scare Cam",
  "Rare Witch Crossing Moon",
  "Raven",
  "Candle Going Out",
  "Footsteps",
  "Knocks",
  "Squeaking Swing",
  "One-Ear Whisper",
  "Breathing",
  "Radio Static",
  "Train Whistle",
  "Shadow Behind Window",
  "Lightning",
  "Fog",
  "Buttons Misbehaving",
  "Buttons Becoming Ghosts / Flying Away",
  '"Most People Stop Here"',
  '"Only 18% Make It To The End"',
  "Mirror / Reflection Concept",
  "Midnight Mode",
  "Secret Events",
  "Local City Mode",
  "Historical-Photo Overlays",
  "VHS Mode",
  "Hidden Content Triggered By Conditions",
  "Real Local Legends",
  "Local Ghost Tours",
  "Vancouver October Passport",
  "Vernon October Passport",
  "Three Valley Gap Concept",
  "Digital Campfire Stories",
  "Halloween Games",
  "History-vs-Folklore Trivia",
  "Pumpkin Hunt",
  "Haunted Passport Stamps",
];

export const OCTOBER_ATMOSPHERE_PRINCIPLE =
  "Use real atmosphere before fake effects. Rain, fog, smoke, darkness, animals, real history and old architecture already create powerful mood.";

/* ============================================================ */
/* CHRISTMAS PASSPORT */
/* ============================================================ */

export const CHRISTMAS_WORLD: readonly string[] = [
  "Warmth",
  "Tradition",
  "Family",
  "Wonder",
  "Anticipation",
  "Snow",
  "Fire",
  "Music",
  "Crafts",
  "Movies",
  "Church",
  "Festivals",
  "Skiing",
  "Snowmobiling",
  "Skating",
  "Tree Farms",
  "Markets",
  "Christmas Lights",
  "Choirs",
  "Outdoor Theatre",
  "Giving",
  "Family Traditions",
  "Home",
];

export const CHRISTMAS_NOT_SHOPPING = "Not shopping.";

/* ============================================================ */
/* CHRISTMAS CHALLENGES */
/* ============================================================ */

export const CHRISTMAS_CHALLENGES: readonly string[] = [
  "Find the biggest Christmas tree.",
  "Best hot chocolate.",
  "Best gingerbread.",
  "Find funniest inflatable.",
  "Wear ugly sweater.",
  "Buy one gift from local maker.",
  "Make ornament.",
  "Decorate cookies.",
  "Build snowman.",
  "Christmas scavenger hunt.",
  "Watch a Christmas movie.",
  "Find live Christmas music.",
  "Take family Christmas photo.",
  "Donate food.",
  "Donate toy.",
  "Anonymous act of kindness.",
];

/* ============================================================ */
/* CHRISTMAS ADVENT CALENDAR — a daily December return loop */
/* ============================================================ */

export const ADVENT_CALENDAR_NOTE =
  "A daily December return loop, December 1–24. Each day reveals a tiny activity, local activity, craft, kindness, challenge, food, music, movie, outdoor experience, or tradition.";

export const ADVENT_CALENDAR_EXAMPLES: readonly string[] = [
  "Make hot chocolate from scratch.",
  "Visit local coffee shop.",
  "Find city's biggest tree.",
  "Write Christmas card.",
  "Listen to Bing Crosby in the car.",
  "Buy one local gift.",
  "Go see Christmas lights.",
  "Make paper snowflakes.",
  "Call someone.",
  "Donate food.",
];

export const ADVENT_DEC24_TEASE =
  '"Not yet..." — and unlocks later. This gives people a reason to return every day.';

/* ============================================================ */
/* RETURN LOOPS BY PERSONALITY */
/* ============================================================ */

export interface ReturnLoop {
  readonly personality: string;
  readonly loopName: string;
}

export const RETURN_LOOPS: readonly ReturnLoop[] = [
  { personality: "October", loopName: "31 Nights of October" },
  { personality: "Summer", loopName: "100 Days of Summer" },
  { personality: "Birding", loopName: "Species of the Week" },
  { personality: "Rain", loopName: "Rainy Day Challenge" },
  { personality: "Bachelor", loopName: "Weekend Dares" },
  { personality: "Wonder", loopName: "Weekly Wonder Mission" },
];

export const RETURN_LOOPS_NOTE =
  "Not manipulative streaks. They create anticipation and ideas.";

/* ============================================================ */
/* TRIVIA */
/* ============================================================ */

export const TRIVIA_PRINCIPLE =
  "People love trivia. Passport can make trivia destination-specific, seasonal, historical, educational, social, and interactive. Avoid boring quiz-only UX.";

export const TRIVIA_EXAMPLES: readonly string[] = [
  "Which Okanagan ski hill opened first?",
  "Which Christmas movie filmed nearby?",
  "Which ghost town still has original buildings?",
  "Which winery has the oldest vines?",
];

/* ============================================================ */
/* TRIVIA ADVENTURE / TRIVIA HUNT */
/* ============================================================ */

export const TRIVIA_HUNT_MECHANIC =
  "Passport gives a clue. Go to the location. Find something. Answer the question. Unlock the next clue. Learning disguised as adventure.";

export const TRIVIA_HUNT_USE_CASES: readonly string[] = [
  "History",
  "Museums",
  "Halloween",
  "Family Days",
  "Cities",
  "Corporate Teams",
  "Schools",
  "Couples",
  "Reunions",
];

/* ============================================================ */
/* WONDER — extended */
/* ============================================================ */

export const WONDER_WHO_FOR: readonly string[] = [
  "Uncle / Niece",
  "Parents / Children",
  "Grandparents",
  "Mentors",
  "Families",
];

export const WONDER_IDEAS: readonly string[] = [
  "Berry Picking",
  "Swimming",
  "Fishing",
  "Birds",
  "Butterflies",
  "Flowers",
  "Bugs",
  "Wildlife",
  "Healthy Food",
  "Navigation",
  "Gun-Safety Education",
  "Crafts",
  "Drawings",
  "Analog Maps",
  "Outdoor Adventures",
  "Music",
  "Silly Kids Songs",
  "Learning Handbooks",
  "Word Of The Day",
  "Tunes For The Trip",
  "Mini Missions",
  "Printable Journals",
];

export const WONDER_NOT_KIDS_APP_NOTE =
  "This is not a kids app. It is about shared curiosity and connection.";

/* ============================================================ */
/* WORD OF THE DAY */
/* ============================================================ */

export const WORD_OF_DAY_EXAMPLES: readonly string[] = [
  "Curious",
  "Brave",
  "Patient",
  "Observant",
  "Kind",
  "Creative",
];

export const WORD_OF_DAY_NOTE =
  "Reinforce naturally throughout the day. Not preachy.";

/* ============================================================ */
/* MINI MISSIONS */
/* ============================================================ */

export const MINI_MISSIONS: readonly string[] = [
  "Find five butterflies.",
  "Hear three birds.",
  "Spot animal tracks.",
  "Pick berries.",
  "Skip rocks.",
  "Smell lavender.",
  "Find three leaf shapes.",
  "Identify clouds.",
  "Notice things.",
];

export const MINI_MISSIONS_NOTE = "No need to win.";

/* ============================================================ */
/* ANALOG PASSPORT — use technology to enable less technology */
/* ============================================================ */

export const ANALOG_PRINTABLES: readonly string[] = [
  "Adventure Card",
  "Field Guide",
  "Official Map",
  "Trail Map",
  "Packing List",
  "Emergency Info",
  "Checklist",
  "Activities",
  "Notes",
  "Scavenger Hunts",
  "Learning Sheets",
  "Kid Kits",
  "Journals",
];

export const ANALOG_PHILOSOPHY: readonly string[] = [
  "Encourage planning the night before.",
  "Print it. Fold it. Put it in the truck.",
  "Use a real paper map.",
  "Circle things. Write notes.",
  "Go somewhere with no cell service.",
  "Stumble onto something yourself.",
  "Come back later and tell Passport.",
];

/* ============================================================ */
/* ADVENTURE TOGETHER / MEMORY */
/* ============================================================ */

export const TODAY_WE_TEMPLATE: readonly string[] = [
  "Swam",
  "Picked Berries",
  "Heard Birds",
  "Learned A Word",
  "Sang Songs",
  "Laughed",
  "Visited Places",
];

export const MEMORY_OUTPUTS: readonly string[] = [
  "Printable Keepsake",
  "Story",
  "Journal",
  "Memory Page",
  "Photos",
  "Map",
  "Discovered Things",
];

export const MEMORY_BOX_LINE =
  "This could become something someone finds in a box twenty years later.";

/* ============================================================ */
/* PROFESSIONAL / PRACTICAL PASSPORTS */
/* ============================================================ */

export const PROFESSIONAL_PASSPORTS: readonly string[] = [
  "Corporate Retreat",
  "Brainstorm Day",
  "Strategy Retreat",
  "Team Building",
  "Conference Companion",
  "Client Entertainment",
  "Work Trip",
  "Family Reunion",
  "Professional Event",
];

export const CONFERENCE_COMPANION_HELPS: readonly string[] = [
  "Coffee",
  "Breakfast",
  "Networking",
  "Quiet Work Places",
  "After-Hours",
  "Nearby Highlights",
  "Free Two-Hour Windows",
];

export const CORPORATE_RETREAT_INTENTS: readonly string[] = [
  "Reconnect",
  "Brainstorm",
  "Celebrate",
  "Make Decisions",
  "Relax",
  "Build Trust",
];

/* ============================================================ */
/* EVERYDAY UTILITY */
/* ============================================================ */

export const EVERYDAY_UTILITY_QUERIES: readonly string[] = [
  "I've got 2 hours.",
  "It's raining.",
  "Parents are visiting.",
  "Kids are bored.",
  "I have $40.",
  "One free evening.",
  "Dog with me.",
  "Traveling alone.",
  "I'm exhausted.",
  "I'm feeling adventurous.",
  "I'm hungover.",
  "I'm new in town.",
  "I've already done everything.",
];

export const EVERYDAY_UTILITY_NOTE =
  "These practical queries may become some of Passport's most-used experiences.";

/* ============================================================ */
/* PERSONALITY INTENSITY / AUDIENCE MODE */
/* ============================================================ */

export const AUDIENCE_MODES: readonly string[] = [
  "Family",
  "Friends",
  "Couples",
  "Adults",
  "After Dark",
];

export const ADULTS_MODE_EXAMPLES: readonly string[] = [
  "Nightlife",
  "Cocktails",
  "Live Music",
  "Comedy",
  "Burlesque",
  "Luxury Spas",
  "Sexy Restaurants",
  "Late-Night Patios",
];

export const AUDIENCE_MODE_NOTE =
  "Same Atlas knowledge. Different emotional presentation. Classy. Not explicit.";

/* ============================================================ */
/* EVENTS — Passport needs real events, not just places and ideas */
/* ============================================================ */

export const EVENT_TYPES: readonly string[] = [
  "Concerts",
  "Outdoor Movies",
  "Ghost Tours",
  "Festivals",
  "Markets",
  "Christmas Events",
  "Halloween Events",
  "Community Events",
  "Sports",
  "Seasonal Openings",
  "Ski Events",
  "Fireworks",
  "Museum Nights",
  "Candlelight Concerts",
  "Charity Events",
];

export const EVENTS_NOTE = "Events make the product feel alive and current.";

/* ============================================================ */
/* METEOR SHOWER EXPERIENCE — the specific example, preserved */
/* ============================================================ */

export const METEOR_SHOWER_CONDITIONS: readonly string[] = [
  "Tonight.",
  "Clear skies.",
  "Moon low.",
  "Best viewing 10:47 PM.",
];

export const METEOR_SHOWER_BRING: readonly string[] = [
  "Warm jacket",
  "Camp chair",
  "Hot chocolate",
  "Flashlight",
  "Tripod",
];

export const METEOR_SHOWER_INPUTS: readonly string[] = [
  "Meteor event",
  "Weather",
  "Moon",
  "Cloud cover",
  "Viewing time",
  "Dark locations",
  "Nearby coffee / hot chocolate",
  "Parking",
  "What to bring",
];

export const METEOR_SHOWER_CTA = "Build My Night.";

/* ============================================================ */
/* "WHAT ATLAS ALREADY DOES BETTER" */
/* ============================================================ */

export const ATLAS_STRENGTHS: readonly string[] = [
  "Multi-Source Provenance",
  "Corroboration",
  "Relationship Graph",
  "Nearby Context",
  "Structured External IDs",
  "Cross-Source Knowledge",
];

export const ATLAS_STRENGTHS_NOTE =
  'Future analyses should include: "What does Atlas already do better?" — a permanent section for strengths, not just gaps.';

/* ============================================================ */
/* KNOWLEDGE COVERAGE — internal / admin concept */
/* ============================================================ */

export const KNOWLEDGE_COVERAGE_CATEGORIES: readonly string[] = [
  "Planning",
  "Activities",
  "Facilities",
  "Camping",
  "Maps",
  "Safety",
  "Wildlife",
  "Local Knowledge",
  "Media",
  "Seasonality",
  "Transportation",
];

export const KNOWLEDGE_COVERAGE_VIEWS: readonly string[] = [
  "Coverage by place",
  "Coverage by region",
  "Coverage by place type",
  "Coverage by source",
  "Coverage over time",
  "High traffic + low coverage",
  "Bottom X%",
];

export const KNOWLEDGE_COVERAGE_NOTE =
  "The percentage is a compass. Not the goal. Relevant trustworthy information is the goal.";

/* ============================================================ */
/* KNOWLEDGE ACQUISITION LOOP — engineering/product methodology */
/* ============================================================ */

export const KNOWLEDGE_ACQUISITION_STEPS: readonly string[] = [
  "Find knowledge gap.",
  "Does a trusted source already know it?",
  "Do we already ingest that source?",
  "Compare source schema.",
  "Compare loader interface.",
  "Compare extraction.",
  "Compare persistence.",
  "Compare API.",
  "Compare Passport.",
  "Only then add another source.",
];

export const KNOWLEDGE_ACQUISITION_PRINCIPLES: readonly string[] = [
  "Maximize Existing Sources Before Adding New Sources.",
  "Silent Schema Underutilization.",
];

/* ============================================================ */
/* PASSPORT EXPERIENCE RHYTHM */
/* ============================================================ */

export const RHYTHM_BEATS: readonly string[] = [
  "Hook",
  "Decision",
  "Preparation",
  "Adventure",
  "Reveal",
  "Reward",
  "Quiet",
  "Discovery",
  "Details",
  "Continuation",
];

export const RHYTHM_INSTRUMENTS: readonly string[] = [
  "Big Visuals",
  "Small Copy",
  "Video",
  "Cards",
  "Maps",
  "Sound",
  "Lists",
  "Moments Of Silence",
];

export const RHYTHM_QUOTE =
  "Every section should feel like a different instrument in the same song.";

/* ============================================================ */
/* MEDIA / CREATIVE DIRECTION */
/* ============================================================ */

export const CREATIVE_DIRECTION_TYPES: readonly string[] = [
  "Travel Films",
  "Branded Short Films",
  "Music Videos",
  "Drone Footage",
  "Underwater Sequences",
  "Silence → Musical Explosion",
  "POV Adventures",
  "AI Mood Videos",
  "Cinematic Destination Trailers",
];

export const PASSPORT_SOUL_SEQUENCE: readonly string[] = [
  "Truck",
  "Music",
  "Dirt Bike",
  "Friends",
  "Near Beer",
  "Cold Lake",
  "Sunshine",
  "Cliff Jump",
  "Underwater Silence",
  "Drone Shot",
  "Surface",
  "Punk-Rock Energy",
  "Darkening Sky",
  "Cabin",
  "Fire",
  "BBQ Dinner",
];

export const PASSPORT_SOUL_LABEL = "This is Passport Soul.";

/* ============================================================ */
/* BUSINESS / SUCCESS */
/* ============================================================ */

export const BUSINESS_GOALS: readonly string[] = [
  "Usefulness",
  "Learning",
  "Fun",
  "Revenue",
  "Career Opportunity",
  "Recognition",
  "Visibility",
  "Potentially Virality",
  "A Strong Business",
  "Products People Recommend",
  "Products People Talk About",
];

export const BUSINESS_NOTE =
  "Going viral is not the design goal. But if genuinely delightful, shareable experiences spread widely, celebrate that. Recognition is okay. Money is okay. Success is okay. The goal is creating something worthy of those outcomes.";

/* ============================================================ */
/* SHAREABILITY */
/* ============================================================ */

export const SHAREABILITY_IDEAS: readonly string[] = [
  "Passport Caught Me",
  "Ghost Cam Shares",
  "Memory Cards",
  "Weekend Boards",
  "Reactions",
  "Adventure Journals",
  "Funny Group Results",
  "Seasonal Challenges",
];

export const SHAREABILITY_NOTE =
  "People can share because the experience was funny, meaningful, beautiful or memorable — not because we bolted on 'viral mechanics.'";

/* ============================================================ */
/* TRADITIONS */
/* ============================================================ */

export const TRADITIONS_EXAMPLES: readonly string[] = [
  "October Passport every year.",
  "Christmas Passport every year.",
  "Summer Passport.",
  "First Snow.",
  "Meteor Shower.",
  "Salmon Run.",
  "Wildflowers.",
];

export const TRADITIONS_YEARLY_ADDITIONS: readonly string[] = [
  "Something new",
  "Secret story",
  "New challenge",
  "New event",
  "New easter egg",
  "New local discovery",
];

export const TRADITIONS_NOTE =
  "People can look forward to the return of a Passport season like they look forward to annual movies, events or traditions.";

/* ============================================================ */
/* HOW TO USE THIS PAGE */
/* ============================================================ */

export const PAGE_USE_NOTE =
  "This page is allowed to be practical. This isn't one of the cinematic experiments — it's the creative index. Make it readable, make it expandable, make it enjoyable, but prioritize capturing information over artistic cleverness.";

export const DONT_LOSE_IDEAS_NOTE =
  "If something overlaps multiple categories, put it in multiple places, or cross-link it. Do not remove a nuanced idea simply because something similar exists. Tonight's goal is memory. We can curate later.";

/* ============================================================ */
/* FINAL TEST */
/* ============================================================ */

export const FINAL_TEST_QUESTION =
  'When we open /about/idea-atlas six months from now, do we rediscover ideas we\'d completely forgotten and immediately think: "OH YEAH. WE HAVE TO BUILD THAT."';

export const FINAL_TEST_FAILURE_LINE =
  "If the page only captures the polished ideas, it failed. Capture the chaos too.";
