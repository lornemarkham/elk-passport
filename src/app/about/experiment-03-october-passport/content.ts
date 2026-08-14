/**
 * Same disclosed exception as every ELK Labs sandbox this project has
 * built (see `docs/content-model/future.md`): discovery cards, movie
 * moods, and personas are invented for this prototype, not real Atlas
 * inventory. `LOCAL_LEGENDS` is the one deliberate departure — real,
 * sourced local history and real, currently-operating local businesses,
 * because the brief was explicit twice now: "No fake ghosts. Respect
 * history." Every entry not backed by a real source is labeled
 * "Concept / Example," never presented as if it were.
 */

export type Persona =
  | "haunted-history"
  | "fall-colours"
  | "cozy"
  | "photography"
  | "fog-walks"
  | "pumpkin"
  | "ghost-town"
  | "forgotten-stories"
  | "brave-mode"
  | "full-moon";

export interface PersonaDef {
  readonly id: Persona;
  readonly emoji: string;
  readonly label: string;
}

export const PERSONAS: readonly PersonaDef[] = [
  { id: "haunted-history", emoji: "👻", label: "Haunted History" },
  { id: "fall-colours", emoji: "🍂", label: "Fall Colours" },
  { id: "cozy", emoji: "☕", label: "Cozy October" },
  { id: "photography", emoji: "📷", label: "Moody Photography" },
  { id: "fog-walks", emoji: "🌲", label: "Fog Walks" },
  { id: "pumpkin", emoji: "🎃", label: "Pumpkin Adventures" },
  { id: "ghost-town", emoji: "🚂", label: "Ghost Town Explorer" },
  { id: "forgotten-stories", emoji: "🪦", label: "Forgotten Stories" },
  { id: "brave-mode", emoji: "🔦", label: "Brave Mode" },
  { id: "full-moon", emoji: "🌕", label: "Full Moon" },
];

export type Weather = "rain" | "fog" | "clear";

export interface WeatherDef {
  readonly id: Weather;
  readonly label: string;
  readonly note: string;
  /** The line the brief asked for — weather as part of the story, not just a filter. */
  readonly atmosphere: string;
}

export const WEATHER_OPTIONS: readonly WeatherDef[] = [
  {
    id: "rain",
    label: "Rain",
    note: "Bookstores. Coffee. Museums. Ghost tours. Cabins.",
    atmosphere: "Perfect ghost-story weather.",
  },
  {
    id: "fog",
    label: "Fog",
    note: "Photography. Forests. Historic cemeteries.",
    atmosphere: "Some places are better when you can't see everything.",
  },
  {
    id: "clear",
    label: "Clear Skies",
    note: "Full moon walks. Stargazing. Bonfires.",
    atmosphere: "Tonight might be worth staying out.",
  },
];

/**
 * The Fear Dial (Phase 7.16) — four real tiers, chosen once, ceremonially,
 * before the experience even begins (`FearDial.tsx`), and changeable again
 * later from the in-page selector. Renamed from the original three-tier
 * "family / classic / afterDark" scale (Phase 7.10/7.12) to the brief's own
 * words, plus one genuinely new top tier: Nightmare is opt-in, asked for
 * explicitly, and still never gore, never cheap — the ceiling raised, not
 * the floor lowered.
 */
export type Intensity = "cozy" | "spooky" | "creepy" | "nightmare";

export const INTENSITY_ORDER: readonly Intensity[] = [
  "cozy",
  "spooky",
  "creepy",
  "nightmare",
];

export interface IntensityDef {
  readonly id: Intensity;
  readonly emoji: string;
  readonly label: string;
  readonly description: string;
  readonly focus: readonly string[];
}

export const INTENSITY_LEVELS: readonly IntensityDef[] = [
  {
    id: "cozy",
    emoji: "🙂",
    label: "Cozy Autumn",
    description:
      "No scares. Pumpkins, coffee, fog, historic towns, ghost stories told gently, candles, movies, apple cider, fall colours, light music.",
    focus: [
      "Pumpkins",
      "Coffee",
      "Fog",
      "Historic towns",
      "Ghost stories",
      "Candles",
      "Movies",
      "Apple cider",
      "Fall colours",
      "Light music",
    ],
  },
  {
    id: "spooky",
    emoji: "🎃",
    label: "Spooky",
    description:
      "More atmosphere. Wind, owls, church bells, distant whispers, moving shadows, ghost tours, fog, lanterns. Occasional surprises. Still family friendly.",
    focus: [
      "Wind",
      "Owls",
      "Church bells",
      "Distant whispers",
      "Moving shadows",
      "Ghost tours",
      "Fog",
      "Lanterns",
    ],
  },
  {
    id: "creepy",
    emoji: "👻",
    label: "Creepy",
    description:
      "Passport begins playing with you. Buttons hesitate, music changes, small visual glitches, portraits blink, shadows move, things disappear. Psychologically unsettling, never gory.",
    focus: [
      "Hesitating buttons",
      "Shifting music",
      "Visual glitches",
      "Blinking portraits",
      "Moving shadows",
      "Flashlight sections",
    ],
  },
  {
    id: "nightmare",
    emoji: "💀",
    label: "Nightmare",
    description:
      "Opt-in. You asked for this. Passport becomes an interactive haunted attraction — anticipation stronger than payoff, always. Never gore. Never cheap.",
    focus: [
      "Flickering lights",
      "Distorted radio",
      "A heartbeat",
      "Footsteps upstairs",
      "A whisper you can't place",
      "Then, usually, nothing",
    ],
  },
];

export function intensityAtLeast(
  current: Intensity,
  minimum: Intensity | undefined,
): boolean {
  if (!minimum) return true;
  return INTENSITY_ORDER.indexOf(current) >= INTENSITY_ORDER.indexOf(minimum);
}

export interface DiscoveryCard {
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
  readonly personas: readonly Persona[];
  readonly weather: readonly Weather[];
  /** Defaults to "family" — the card shows at every intensity at or above this. */
  readonly minIntensity?: Intensity;
}

export const DISCOVERY_CARDS: readonly DiscoveryCard[] = [
  {
    id: "cemetery-walk",
    emoji: "🪦",
    title: "Old Cemetery Walk",
    line: "Names worn smooth by a hundred winters.",
    personas: ["forgotten-stories", "haunted-history"],
    weather: ["fog", "clear"],
  },
  {
    id: "pumpkin-patch",
    emoji: "🎃",
    title: "Pumpkin Patch at Dusk",
    line: "Pick one before the light goes.",
    personas: ["pumpkin"],
    weather: ["clear"],
  },
  {
    id: "fog-lake",
    emoji: "🌲",
    title: "Fog Over the Lake",
    line: "The far shore disappears entirely.",
    personas: ["fog-walks", "photography"],
    weather: ["fog"],
  },
  {
    id: "orchard-road",
    emoji: "🍂",
    title: "Old Orchard Road",
    line: "Every tree a different fire.",
    personas: ["fall-colours"],
    weather: ["clear"],
  },
  {
    id: "bookstore-rain",
    emoji: "☕",
    title: "Corner Bookstore, Rain Outside",
    line: "Stay until closing. Nobody will mind.",
    personas: ["cozy"],
    weather: ["rain"],
  },
  {
    id: "rail-spur",
    emoji: "🚂",
    title: "Abandoned Rail Spur",
    line: "The tracks stop for no reason anyone remembers.",
    personas: ["ghost-town"],
    weather: ["fog", "clear"],
    minIntensity: "spooky",
  },
  {
    id: "candlelit-cafe",
    emoji: "🕯️",
    title: "Candlelit Café",
    line: "Order the thing with cinnamon in it.",
    personas: ["cozy"],
    weather: ["rain", "fog"],
  },
  {
    id: "midnight-cemetery",
    emoji: "🔦",
    title: "Heritage Cemetery at Midnight",
    line: "Bring a flashlight. Bring a friend.",
    personas: ["haunted-history", "brave-mode"],
    weather: ["clear", "fog"],
    minIntensity: "creepy",
  },
  {
    id: "moon-ridge",
    emoji: "🌕",
    title: "Full Moon Ridge Walk",
    line: "The trail glows without one.",
    personas: ["full-moon"],
    weather: ["clear"],
    minIntensity: "creepy",
  },
  {
    id: "attic-window",
    emoji: "👻",
    title: "The Locked Attic Window",
    line: "Nobody's opened it in years.",
    personas: ["haunted-history", "brave-mode"],
    weather: ["fog"],
    minIntensity: "creepy",
  },
  {
    id: "cobblestone-rain",
    emoji: "📷",
    title: "Wet Cobblestone Old Town",
    line: "Every puddle is a mirror tonight.",
    personas: ["photography"],
    weather: ["rain"],
  },
  {
    id: "golden-overlook",
    emoji: "🍂",
    title: "Golden Hillside Overlook",
    line: "The whole valley turns orange for about a week.",
    personas: ["fall-colours", "photography"],
    weather: ["clear"],
  },
  {
    id: "quiet-museum",
    emoji: "🪦",
    title: "The Museum Nobody Visits",
    line: "Ask the curator about the second floor. Most people don't.",
    personas: ["forgotten-stories"],
    weather: ["rain"],
    minIntensity: "spooky",
  },
  {
    id: "corn-maze",
    emoji: "🎃",
    title: "Corn Maze at Last Light",
    line: "Easy to get turned around. That's the point.",
    personas: ["pumpkin", "brave-mode"],
    weather: ["clear"],
  },
  {
    id: "bonfire-circle",
    emoji: "🌕",
    title: "Star-and-Moon Bonfire Circle",
    line: "Bring marshmallows. Bring a blanket.",
    personas: ["full-moon", "cozy"],
    weather: ["clear"],
    minIntensity: "spooky",
  },
  {
    id: "ghost-post-office",
    emoji: "🚂",
    title: "The Ghost Town Post Office",
    line: "Still has mail slots. Still has dust. Nobody's collected either in years.",
    personas: ["ghost-town", "forgotten-stories"],
    weather: ["clear", "fog"],
    minIntensity: "spooky",
  },
  {
    id: "misty-trail",
    emoji: "🌲",
    title: "Misty Forest Trail",
    line: "The light barely makes it through.",
    personas: ["fog-walks"],
    weather: ["fog"],
  },
  {
    id: "cider-mill",
    emoji: "🍂",
    title: "Cider Mill Afternoon",
    line: "Warm, spiced, gone in one visit.",
    personas: ["fall-colours", "cozy"],
    weather: ["clear", "rain"],
  },
  {
    id: "the-house-that-waits",
    emoji: "💀",
    title: "The House That Waits",
    line: "Nobody's lived there in decades. The porch light still comes on.",
    personas: ["haunted-history", "brave-mode"],
    weather: ["fog", "clear"],
    minIntensity: "nightmare",
  },
];

export interface MoviePairing {
  readonly emoji: string;
  readonly mood: string;
  readonly line: string;
  readonly then: string;
}

export const MOVIE_PAIRINGS: readonly MoviePairing[] = [
  {
    emoji: "😱",
    mood: "Scary",
    line: "Something that makes you check the locks twice.",
    then: "Then: a ghost walk, while it's still fresh.",
  },
  {
    emoji: "🧛",
    mood: "Vampire Classic",
    line: "The old kind. Fog and candlelight, not CGI.",
    then: "Then: a nighttime walk through the historic district.",
  },
  {
    emoji: "☕",
    mood: "Cozy",
    line: "The one you've rewatched every October since you can remember.",
    then: "Then: coffee, slow, no reason to leave.",
  },
  {
    emoji: "🎃",
    mood: "Family",
    line: "Spooky enough for a costume, safe enough for bedtime after.",
    then: "Then: the pumpkin patch and hot chocolate, before it closes.",
  },
  {
    emoji: "🎞️",
    mood: "Old Horror Classic",
    line: "Black and white. Somehow it still works.",
    then: "Then: an outdoor theatre, blankets required.",
  },
  {
    emoji: "📖",
    mood: "Ghost Story",
    line: "The kind that's better read aloud than watched.",
    then: "Then: a night at a real historic hotel.",
  },
];

export interface LocalLegend {
  readonly title: string;
  readonly kind: "Documented" | "Local Legend" | "Concept / Example";
  readonly fact: string;
  readonly source?: string;
  readonly sourceUrl?: string;
}

/**
 * Real, sourced, and checked wherever a real place is named — not
 * invented. "Documented" and "Local Legend" entries are backed by a real
 * citation, checked directly this session. "Concept / Example" entries
 * are exactly what they say: a category this section *would* eventually
 * hold real content for (a cemetery, a mine, a museum), shown as a
 * template rather than invented as if it were a specific real place.
 * Passport never says "this is haunted" — every line here says what's
 * actually true: that people tell stories, that guests report things,
 * that nobody agrees.
 */
export const LOCAL_LEGENDS: readonly LocalLegend[] = [
  {
    title: "Fairview",
    kind: "Documented",
    fact: 'A real gold-rush boomtown near present-day Oliver, in the Okanagan. At its peak in 1898 it had roughly 700 people, hotels, saloons, schools, a bank, and a jail — locals called it "the largest city north of San Francisco." The Fairview Hotel, nicknamed the Big Teepee, burned down in 1902. By 1919 it was a ghost town.',
    source: "Oliver & District Heritage Society",
    sourceUrl: "https://www.oliverheritage.ca/the-fairview-story",
  },
  {
    title: "Mineola",
    kind: "Documented",
    fact: "A former lumber town in the Okanagan hills, northwest of Summerland. Like Fairview, it's a real, documented ghost town — one of several scattered through this region's early industrial history.",
    source: "Wikipedia — List of ghost towns in British Columbia",
    sourceUrl:
      "https://en.wikipedia.org/wiki/List_of_ghost_towns_in_British_Columbia",
  },
  {
    title: "The Towne Cinema, Vernon",
    kind: "Local Legend",
    fact: "A real, still-operating Vernon building. People have told stories about it for years — that it's haunted by a long-dead projectionist, and some call it one of the most haunted locations in Western Canada. Presented here as what it is: a real legend people actually tell, not a verified fact.",
    source: "VernonNow",
    sourceUrl:
      "https://www.vernonnow.com/watercooler/news/news/Okanagan/5_hauntings_in_the_Okanagan_that_will_send_shivers_down_your_spine/",
  },
  {
    title: "Three Valley Gap Heritage Ghost Town",
    kind: "Documented",
    fact: "A real heritage site in Eagle Pass near Revelstoke, built by the Bell family starting in 1956: a hand-collected pioneer village of more than 30 rescued historic buildings, a 19th-century saloon, steam trains, and a 200-room chateau hotel whose original three-story building was dismantled board by board and rebuilt on-site over a decade. Real history, real building, no invented lore needed.",
    source: "Three Valley Lake Chateau",
    sourceUrl: "https://3valley.com/about/",
  },
  {
    title: "Gastown Ghost Walks, Vancouver",
    kind: "Documented",
    fact: "Real, currently-operating walking tours through Vancouver's historic Gastown district — several different companies, all built on documented Vancouver history: the city's founding, its great fire, and the neighbourhood's old back alleys. What they add on top is storytelling, not fabricated history.",
    source: "Forbidden Vancouver — Lost Souls of Gastown",
    sourceUrl:
      "https://forbiddenvancouver.ca/lost-souls-of-gastown-vancouver-tour/",
  },
  {
    title: "The Sylvia Hotel, Vancouver",
    kind: "Local Legend",
    fact: 'A real hotel, built in 1912, still open on English Bay. Guests have reported strange experiences for years — an "invisible presence" often associated with room 604, and a persistent local rumour that actor Errol Flynn haunts it, despite having died elsewhere in the city. Nobody agrees on what\'s actually there.',
    source: "Vancouver Is Awesome",
    sourceUrl:
      "https://www.vancouverisawesome.com/local-news/vancouverites-share-beautiful-snaps-of-the-possibly-haunted-sylvia-hotel-photos-4698567",
  },
  {
    title: "The Cemetery Nobody Talks About",
    kind: "Concept / Example",
    fact: "A placeholder for a real, local cemetery with real, documented history — the kind every region has, and Atlas doesn't know yet. Shown here as a template, not a claim about any specific place.",
  },
  {
    title: "The Mine That Closed Overnight",
    kind: "Concept / Example",
    fact: "A placeholder for a real regional mining history — most regions have one. Not invented as a specific story; shown as the shape a real one would take once sourced.",
  },
  {
    title: "The Museum's Locked Room",
    kind: "Concept / Example",
    fact: "A placeholder for a real small-town museum with a real, undertold story. The specific claim is intentionally absent — this is a template card, not a fact.",
  },
  {
    title: "The Old Pub Nobody Renamed",
    kind: "Concept / Example",
    fact: "A placeholder for a real historic pub — most old towns have one, usually with a real story about who used to drink there. Not invented as a specific place; shown as the shape a real one would take once sourced.",
  },
  {
    title: "The Tragedy the Plaque Doesn't Mention",
    kind: "Concept / Example",
    fact: "A placeholder for real, sourced local history that's often harder to find than a ghost story — a fire, a mining accident, a flood. The kind of history that deserves more care, not less, once a real source is found.",
  },
];

/**
 * The 1408 principle: Passport occasionally behaves as though the page
 * knows something the visitor doesn't. Never explains itself. Shown
 * rarely, tied to real signals (time on page, scroll depth) in
 * `useSoundscape`/the main component — never just a random popup.
 */
export const PAGE_KNOWS_LINES: readonly string[] = [
  "...still there?",
  "Most people leave before this part.",
  "This story gets stranger after dark.",
  "Nobody agrees on what happened here.",
];

/** Real behavioural triggers, not random — see the component for exactly what each one is tied to. */
export const PAGE_NOTICES_LINES = {
  idle: "...still there?",
  hoverLingered: "Thinking about it?",
  gettingBrave: "You're getting brave.",
  backingAway: "Daylight mode is always available.",
} as const;

/** Cozy Autumn only draws from this pool — gentle, never a scare. */
export const COZY_SURPRISES: readonly string[] = [
  "A raven lands on the fence, then thinks better of it.",
  "An owl calls, once, from somewhere close.",
  "A leaf spirals down and lands directly in front of you.",
  "Somewhere, a screen door creaks shut.",
];

/** Spooky adds these to the cozy pool. */
/** This exact line gets a real full-screen visual in `AmbientLayer.tsx`, not just a corner caption — compared by reference, not by guessing at its text. */
export const FOG_HIDES_INTERFACE_LINE =
  "Fog briefly hides the page. Then it doesn't.";

/** This exact line gets a real, brief dip in the synthesized soundscape's volume, if it's playing — see `useSoundscape.ts`'s `duck()` and the component that calls it. Compared by reference, same discipline as the fog line above. */
export const SOUNDTRACK_DUCKS_LINE =
  "The soundtrack catches, just for a second — like static over a radio.";

export const SPOOKY_SURPRISES: readonly string[] = [
  "A shadow passes behind a window that should be empty.",
  "Something crosses the moon. Too big for a bird, too slow for a plane.",
  "A distant train sounds, though the tracks nearby haven't run in years.",
  "A floorboard creaks upstairs. Nobody's up there.",
  "Three knocks, evenly spaced, from somewhere that isn't the door.",
  "A church bell, somewhere far off, rings an odd number of times.",
  FOG_HIDES_INTERFACE_LINE,
];

/** Creepy adds these on top of cozy and spooky — moodier, never gorier. */
export const CREEPY_SURPRISES: readonly string[] = [
  "A candle blows out, though nothing moved.",
  "Footsteps. Behind you. Gone when you turn.",
  "A whisper, too quiet to make out the words.",
  "A face, briefly, in an old photo. Gone when you look again.",
  "A hotel window lights up. Nobody's supposed to be in that wing.",
  "A shape moves in a doorway that was empty a second ago.",
  "A sound, once, that might have been a scream. Might have been a bird.",
  SOUNDTRACK_DUCKS_LINE,
];

/** These two exact lines get real, rare visual effects (see the main component) — compared by reference, same discipline as the fog and soundtrack lines above. */
export const CROW_CROSSES_SCREEN_LINE =
  "A crow crosses the screen, once, and is gone.";
export const HEARTBEAT_LINE =
  "A heartbeat. Not yours. Keeping pace with the page.";

/**
 * Nightmare — opt-in, asked for explicitly, on top of every pool below it.
 * Anticipation stronger than payoff, always: most of these resolve into
 * nothing, on purpose. Never gore, never a real scream recording (none
 * exists in this project) — every line stays text, ambiguous, or a small,
 * tasteful visual, matching "Disney Haunted Mansion, not a slasher film."
 */
export const NIGHTMARE_SURPRISES: readonly string[] = [
  "The lights flicker. Just once.",
  "Something is breathing. It isn't you.",
  "A scratch, low, from inside the wall.",
  "Footsteps. Upstairs. There is no upstairs.",
  "Metal, scraping, somewhere close.",
  "The static distorts, then clears, like a radio between stations.",
  '"Don\'t look behind you." ...Nothing happens.',
  CROW_CROSSES_SCREEN_LINE,
  HEARTBEAT_LINE,
];

export interface GhostPortraitMode {
  readonly id: "victorian" | "vhs" | "faded";
  readonly label: string;
  readonly description: string;
}

export const GHOST_PORTRAIT_MODES: readonly GhostPortraitMode[] = [
  {
    id: "victorian",
    label: "Victorian",
    description: "Sepia, vignette, film grain — an old formal portrait.",
  },
  {
    id: "vhs",
    label: "1980s VHS",
    description:
      "Scan lines, colour bleed, tracking noise — a horror-movie still.",
  },
  {
    id: "faded",
    label: "Faded Historical",
    description: "Washed out, low contrast — found in a box, decades later.",
  },
];

export const SCARE_CAM_CAPTIONS: readonly string[] = [
  "Who's that?",
  "Was that there before?",
  "Huh. Zoom in.",
];

export const SCARE_CAM_SHARE_LABEL = "Passport caught me.";

/** Explicitly not built — see the component's own note and `docs/content-model/future.md`. */
export const GROUP_SCARE_CAM_CONCEPT =
  "Passport sends everyone in the group the same countdown. Everyone takes a photo, same moment. One image comes back a little different. Nobody knows whose until they all compare.";

/**
 * Three Valley Gap, redesigned (Phase 7.16) as a real scene, not just a
 * line and a question: lightning, rain, a silhouette, one window light
 * that turns off — then a real, three-way branching question. All three
 * responses are real, distinct lines, not just an acknowledgment.
 */
export const THREE_VALLEY_GAP_SCENE = {
  setup:
    "An old hotel. Railway history. A remote highway, mountains, and night.",
  question: "Would you stay here... alone... until sunrise?",
};

export type ThreeValleyAnswer = "yes" | "no" | "absolutelyNot";

export const THREE_VALLEY_RESPONSES: Record<ThreeValleyAnswer, string> = {
  yes: "Brave. Ask the front desk for a room with a lake view — a real, ordinary request, and a real, ordinary hotel underneath all this atmosphere.",
  no: "Fair. There's a real hotel in Revelstoke, ten minutes away, with all the lights on.",
  absolutelyNot: "Also fair. Some questions are better left rhetorical.",
};

export const VANCOUVER_CONCEPT = {
  words: [
    "Rain",
    "Gastown",
    "Steam",
    "Brick",
    "Old pubs",
    "Ghost tours",
    "Historic hotels",
    "Umbrellas",
    "Street lamps",
    "Fog",
  ],
  line: "Tonight, Vancouver tells stories.",
};

export const LOST_BOYS_WORDS: readonly string[] = [
  "Nighttime freedom",
  "Neon",
  "Boardwalk energy",
  "Motorcycles",
  "Rock music",
  "Fog",
  "Danger",
  "Youth",
  "Mystery",
  "A little bit rebellious",
];

export const LOCAL_TIP_EXAMPLE =
  "Bring your own mulled wine. — the kind of detail no official listing mentions, and the kind that makes a night memorable. The exact tip changes everywhere; the principle doesn't.";

/**
 * The cinematic introduction — Passport inviting the visitor in, not just
 * loading a page. Shown once, gates the real experience behind a real
 * "Enter" click (never autoplay, matching the same discipline every real
 * camera/audio feature on this page already follows).
 */
export interface IntroLine {
  readonly emoji: string;
  readonly line: string;
}

export const CINEMATIC_INTRO_LINES: readonly IntroLine[] = [
  { emoji: "🎧", line: "Best experienced with headphones." },
  { emoji: "🌙", line: "Best experienced after dark." },
  { emoji: "🕯️", line: "Dim the lights." },
  { emoji: "👥", line: "Better with friends." },
];

/**
 * Local City Mode — real, working, and honest about what it isn't: a
 * real city selector changing one atmospheric line, not real geolocation
 * or personal-address awareness. "Simply acknowledge the place," per the
 * brief — never a home, never a precise location.
 */
export interface CityMode {
  readonly id: string;
  readonly label: string;
  readonly line: string;
}

export const CITY_MODES: readonly CityMode[] = [
  {
    id: "vernon",
    label: "Vernon",
    line: "Tonight, Vernon has a few stories to tell.",
  },
  {
    id: "vancouver",
    label: "Vancouver",
    line: "Vancouver keeps some secrets.",
  },
  { id: "elsewhere", label: "Somewhere Else", line: "Every city has stories." },
];

/**
 * Group Mode — real and working as a *local, simulated* shared moment
 * (a real headcount, a real synchronized-feeling countdown, a real
 * "Campfire Mode" visual accent for the rest of the session). Real
 * multi-device sync — friends on separate phones actually seeing the
 * same countdown — is the future idea, not built here; see
 * `docs/content-model/future.md`.
 */
export const GROUP_MODE_PROMPT = "How many of you are here?";
export function groupCountedLine(count: number): string {
  if (count <= 1) return "Just you tonight. That counts too.";
  return `${count} of you, counted in. Lights off. Headphones on.`;
}

export const HISTORY_OR_FOLKLORE_INTRO =
  "Real place, real claim. Documented fact, or local legend? Guess before the answer gives itself away.";

export const RAVEN_FOUND_LINE =
  "Caught one. It won't be in the same place next time.";

/**
 * The ending, as scripted: fire lower, music fading (a real call into
 * `useSoundscape`'s fade-out, if it's playing), fog drifting, one lantern
 * left, one line — then a playful beat, then the final line. The "evil
 * laugh" is represented honestly as an emoji beat, not a fabricated claim
 * of a real audio laugh — no laugh sound asset exists in this project.
 */
export const ENDING_LINES: readonly string[] = [
  "Some stories are better experienced than explained.",
];

export const ENDING_LAUGH_EMOJI = "😈";
export const ENDING_FINAL_LINE = "See you next October...";

/**
 * Flashlight Mode, redesigned (Phase 7.16) as a real find-game, not just a
 * mood demo. Nine fixed, deterministic hiding spots (SSR-safe — no
 * per-render randomness, same discipline as every other rare/positioned
 * element in this file). Discovery first: each item's `fragment` only
 * appears once it's found, and the assembled story only renders once at
 * least one fragment exists — never shown as a paragraph up front.
 */
export interface FlashlightItem {
  readonly id: string;
  readonly emoji: string;
  readonly label: string;
  /** Revealed only once found — the discovery-first, story-second order the brief asked for. */
  readonly fragment: string;
}

export const FLASHLIGHT_ITEMS: readonly FlashlightItem[] = [
  {
    id: "ticket",
    emoji: "🎫",
    label: "an old train ticket",
    fragment: "One-way. Punched, never redeemed.",
  },
  {
    id: "journal",
    emoji: "📓",
    label: "a journal page",
    fragment: '"...left before the storm. Should have left sooner."',
  },
  {
    id: "card",
    emoji: "🂡",
    label: "an old playing card",
    fragment: "The ace of spades. Someone folded a winning hand.",
  },
  {
    id: "lantern",
    emoji: "🏮",
    label: "a lantern",
    fragment: "Still has oil in it. Still warm, somehow.",
  },
  {
    id: "photo",
    emoji: "🖼️",
    label: "a photograph",
    fragment: "Six people. Only five have their eyes open.",
  },
  {
    id: "key",
    emoji: "🗝️",
    label: "an old key",
    fragment: "Too big for any door still standing.",
  },
  {
    id: "map",
    emoji: "🗺️",
    label: "a map",
    fragment: "One route marked in red. It doesn't lead anywhere anymore.",
  },
  {
    id: "ghost",
    emoji: "👻",
    label: "something pale, in the corner",
    fragment: "Gone the moment the light finds it. Every time.",
  },
  {
    id: "raven",
    emoji: "🐦‍⬛",
    label: "a raven",
    fragment: "It was watching before you found it. It's still watching.",
  },
];

export const FLASHLIGHT_INTRO =
  "The room is dark. You're searching. Move the light.";

/**
 * Local Events — "Near You," Vancouver prototype (Phase 7.16). Every card
 * here is a real *category* of event the real cited businesses in
 * `LOCAL_LEGENDS` (Gastown Ghost Walks, the Sylvia Hotel) already belong
 * to — but the specific dates and listings are illustrative examples,
 * clearly labeled, not fabricated real listings for any real date. "Near
 * You" is honest here because it's true of the category (Vancouver has
 * real ghost tours, real pumpkin patches) even where the specific card
 * is a template.
 */
export interface LocalEvent {
  readonly emoji: string;
  readonly title: string;
  readonly note: string;
}

export const LOCAL_EVENTS_VANCOUVER: readonly LocalEvent[] = [
  {
    emoji: "👻",
    title: "Ghost Tours",
    note: "Real, currently operating — see Gastown Ghost Walks in Local Legends, above.",
  },
  {
    emoji: "🏨",
    title: "Haunted Hotels",
    note: "Real local legends attached to real buildings — see the Sylvia Hotel, above.",
  },
  {
    emoji: "🎃",
    title: "Pumpkin Patches",
    note: "Example listing — the kind of seasonal event Atlas would need a real source for.",
  },
  { emoji: "🌽", title: "Corn Mazes", note: "Example listing." },
  { emoji: "🕯️", title: "Halloween Markets", note: "Example listing." },
  {
    emoji: "🪦",
    title: "Historic Cemeteries",
    note: "Example listing — real ones exist; this card isn't naming one specifically.",
  },
  { emoji: "🍺", title: "Haunted Pubs", note: "Example listing." },
  {
    emoji: "🎶",
    title: "Candlelight Concerts",
    note: "Example listing — a real, popular real-world event format, not a specific claim.",
  },
  { emoji: "🎬", title: "Outdoor Horror Movies", note: "Example listing." },
  {
    emoji: "🚂",
    title: "Historic Railway Events",
    note: "Example listing — see Three Valley Gap, a real heritage railway site, above.",
  },
];
