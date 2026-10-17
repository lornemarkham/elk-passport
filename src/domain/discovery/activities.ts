import type { Experience } from "@/domain/experience/types";

/**
 * **What a person could go and do, in the words they would use for it.**
 *
 * The first row on Discovery used to be Atlas's affordance names, counted and
 * cut at four: *Hiking 60 · Swimming 32 · Fishing 26 · Cycling 17*. The cut was
 * deliberate (see the history in `directions.ts`) — past it, the corpus's
 * near-synonyms arrive, and a page offering `Hiking`, `walking/hiking`, `Hike`
 * and `Walking` reads as broken. But four was never the size of the question.
 * Measured on the committed Atlas fixture (2,979 candidates, 2026-10-11):
 *
 * - **Only 224 candidates state any affordance at all.** The other 2,755 say
 *   what they are instead: 40 museums, 82 wineries, 5 cinemas, 3 escape rooms,
 *   16 rinks and pools, 30 concerts. "Movies" and "a museum" are things people
 *   go and do, and none of them could ever reach a verb row.
 * - **The verbs that do exist are one idea spelled many ways**: `hiking` 69 ·
 *   `walking` 14 · `walking/hiking` 7 · `hike` 3 · `trails` 2 · `short hike`…
 *   and `canoeing` 17 · `kayaking` 14 · `paddleboarding` 3 · `sup` 1 ·
 *   `paddling` 1. Counted apart, each looks small; together they are a day.
 *
 * ## Six different things, kept apart
 *
 * ```
 * activity     what you would go and do          this file
 * place        what a thing is (park, museum)    Atlas's subtype
 * event        a dated thing that is on          Atlas's kind + interval
 * experience   a composed product (October)      its own route
 * intention    why you want to go (unusual, a    `lib/ai/ask/read.ts` lens
 *              date, worth the drive)
 * amenity      what is there (toilets, parking)  never offered as a doing
 * ```
 *
 * An activity here is evidenced by any of three things Atlas states: an
 * **affordance** it lists, a **subtype** that is the activity (a cinema is
 * where you watch a film), or one of a few **features** that are themselves a
 * thing to do (a playground, a spray park). Every other feature — washrooms,
 * drinking water, an ATM — is an amenity and is never read here.
 *
 * ## What is Passport's, and what is Atlas's
 *
 * The **label and the grouping are Passport's**: "Hiking & walks" is a human
 * name for a family of Atlas words, decided here and nowhere else. **Whether a
 * place belongs is always Atlas's**: a place is in a family only because Atlas
 * listed a word the family recognises, and the card says which word
 * (`activityEvidence`). Nothing is placed in a family by guesswork about what
 * a kind of place is "usually" like.
 */
export interface Activity {
  readonly key: ActivityKey;
  /** What a person sees on the chip. */
  readonly label: string;
  /** Words a person might say for it — read by `activityIn`. Lowercase. */
  readonly words: readonly string[];
  /** Atlas affordance names that evidence it. */
  readonly affordance?: RegExp;
  /** Atlas subtypes that are it. */
  readonly subtype?: RegExp;
  /** The few Atlas features that are a thing to do, not an amenity. */
  readonly feature?: RegExp;
  /** Matched affordances or subtypes that are not it after all. */
  readonly not?: RegExp;
  readonly tags: readonly ActivityTag[];
}

/**
 * How an activity tends to sit with a situation — **ordering only**. A tag
 * never says anything on a card and never removes a place: "indoor" moves
 * museums up a rainy page, and a museum's own exposure reading still decides
 * what the card claims.
 */
export type ActivityTag =
  | "indoor"
  | "outdoor"
  | "kids"
  | "date"
  | "adventure"
  | "evening"
  | "gentle"
  | "winter"
  | "summer"
  | "water"
  | "adult"
  | "everyday";

export type ActivityKey =
  | "hiking"
  | "swimming"
  | "cycling"
  | "mountain-biking"
  | "paddling"
  | "fishing"
  | "boating"
  | "playgrounds"
  | "skating"
  | "skiing"
  | "snowshoeing"
  | "climbing"
  | "thrills"
  | "horseback"
  | "wildlife"
  | "farms"
  | "museums"
  | "art"
  | "movies"
  | "live"
  | "wine"
  | "eat"
  | "markets"
  | "spa"
  | "golf"
  | "games"
  | "sports"
  | "hockey"
  | "viewpoints"
  | "libraries"
  | "festivals"
  | "tours"
  | "camping";

export const ACTIVITIES: readonly Activity[] = [
  {
    key: "hiking",
    label: "Hiking & walks",
    words: [
      "hike",
      "hikes",
      "hiking",
      "walk",
      "walks",
      "walking",
      "trail",
      "trails",
      "stroll",
      "trek",
      "trekking",
      "ramble",
      "nature walk",
      "forest",
    ],
    affordance:
      /\b(hik(e|es|ing)|walk(s|ing)?|trails?|stroll|forest bathing|backpacking|nature (excursion|appreciation)|jogging|running)\b/,
    subtype: /\b(trail|hiking)\b/,
    not: /\b(dog walking|walking tour|mural|tours?)\b/,
    tags: ["outdoor", "gentle"],
  },
  {
    key: "swimming",
    label: "Swimming & beaches",
    words: [
      "swim",
      "swims",
      "swimming",
      "beach",
      "beaches",
      "pool",
      "pools",
      "splash",
      "lake swim",
    ],
    affordance:
      /\b(swim(ming)?|beach( time)?|lakefront lounging|relax on the beach|sun and play on the beach)\b/,
    subtype: /\b(beach|pool|aquatic|swimming)\b/,
    feature: /^(beach|sandy beaches|seaside swimming pool)$/,
    not: /\b(volleyball|access|dog|masters|lessons)\b/,
    tags: ["water", "kids"],
  },
  {
    key: "cycling",
    label: "Cycling",
    words: [
      "bike",
      "bikes",
      "biking",
      "cycle",
      "cycling",
      "bicycle",
      "e-bike",
      "ebike",
    ],
    affordance: /\b(cycling|biking|bike|e-biking|biking trails)\b/,
    not: /\b(mountain|fat|shop|rental|wine tours?|salmon)\b/,
    tags: ["outdoor"],
  },
  {
    key: "mountain-biking",
    label: "Mountain biking",
    words: ["mountain bike", "mountain biking", "mtb", "downhill biking"],
    affordance: /\b(mountain bik(e|ing)|fat biking|gravity trails)\b/,
    tags: ["outdoor", "adventure"],
  },
  {
    key: "paddling",
    label: "Paddling",
    words: [
      "paddle",
      "paddling",
      "kayak",
      "kayaks",
      "kayaking",
      "canoe",
      "canoes",
      "canoeing",
      "paddleboard",
      "paddleboarding",
      "paddle board",
      "sup",
    ],
    affordance:
      /\b(canoe(ing)?|kayak(s|ing)?|paddl(e|es|ing|eboard|eboarding|e boarding|e sports|eboard rentals)|sup|stand-up paddleboarding)\b/,
    tags: ["water", "outdoor", "summer"],
  },
  {
    key: "fishing",
    label: "Fishing",
    words: ["fish", "fishing", "angling", "fly fishing"],
    affordance: /\b(fishing|ice fishing)\b/,
    not: /\b(touch screen|methods)\b/,
    tags: ["outdoor", "water", "gentle"],
  },
  {
    key: "boating",
    label: "Boats & water sports",
    words: [
      "boat",
      "boats",
      "boating",
      "water sports",
      "waterski",
      "water ski",
      "wakeboard",
      "wakesurf",
      "tubing",
      "jet ski",
      "windsurf",
      "kitesurf",
      "scuba",
      "diving",
    ],
    affordance:
      /\b(boating|boat rentals|pedal boating|water ?skiing|waterskiing|wakesurfing|tubing|inner tubing|windsurfing|kite ?surf(ing|ers)?|water ?sports?|watersport rentals|scuba diving)\b/,
    tags: ["water", "outdoor", "summer", "adventure"],
  },
  {
    key: "playgrounds",
    label: "Playgrounds",
    words: [
      "playground",
      "playgrounds",
      "play park",
      "swings",
      "spray park",
      "splash pad",
    ],
    affordance: /\b(playground|play-?park|spray park|skate and water parks)\b/,
    feature: /^(playgrounds?|spray park|water spray park)$/,
    tags: ["kids", "outdoor"],
  },
  {
    key: "skating",
    label: "Skating",
    words: [
      "skate",
      "skating",
      "ice skating",
      "ice skate",
      "rink",
      "skating rink",
    ],
    affordance:
      /\b((ice |public |free public |family |inline )?skat(e|ing)|shinny)\b/,
    subtype: /\b(rink|ice (arena|centre|center))\b/,
    not: /\b(skateboard|lessons|club|speed|figure|curling)\b/,
    tags: ["kids", "winter"],
  },
  {
    key: "skiing",
    label: "Skiing & snowboarding",
    words: [
      "ski",
      "skis",
      "skiing",
      "snowboard",
      "snowboarding",
      "the slopes",
      "ski hill",
    ],
    affordance:
      /\b((downhill |night )?skiing|snowboard(ing)?|ski and snowboard lessons|ski lessons|snowboard lessons)\b/,
    subtype: /\b(ski (resort|hill|area))\b/,
    not: /\b(cross-country|nordic|water)\b/,
    tags: ["winter", "outdoor", "adventure"],
  },
  {
    key: "snowshoeing",
    label: "Snowshoeing & cross-country",
    words: [
      "snowshoe",
      "snowshoeing",
      "cross-country",
      "cross country ski",
      "nordic",
      "sledding",
      "tobogganing",
    ],
    affordance:
      /\b(snow-?shoe(ing)?|cross-country skiing|nordic skiing|sledding|tobogganing|dog sledding)\b/,
    tags: ["winter", "outdoor"],
  },
  {
    key: "climbing",
    label: "Climbing",
    words: ["climb", "climbing", "bouldering", "rock climbing", "climbing gym"],
    affordance: /\b((rock |indoor |ice )?climbing)\b/,
    subtype: /\bclimbing\b/,
    tags: ["adventure"],
  },
  {
    key: "thrills",
    label: "Ziplines & thrills",
    words: [
      "zipline",
      "ziplining",
      "zip line",
      "paragliding",
      "skydiving",
      "rafting",
      "bungee",
      "thrill",
      "thrills",
      "adrenaline",
    ],
    affordance:
      /\b(zip ?lin(e|ing)|zipline thrills|paragliding|skydiving|treetops adventure|cliffwalk|suspension bridge|rafting|bungee|high-powered air cannons)\b/,
    subtype: /\b(zipline|adventure park|aerial park|rafting)\b/,
    tags: ["adventure", "outdoor"],
  },
  {
    key: "horseback",
    label: "Horseback riding",
    words: ["horse", "horses", "horseback", "horse riding", "trail ride"],
    affordance: /\b(horseback riding|horse)\b/,
    subtype: /\b(stable|equestrian|riding)\b/,
    tags: ["outdoor", "adventure"],
  },
  {
    key: "wildlife",
    label: "Animals & wildlife",
    words: [
      "animals",
      "animal",
      "wildlife",
      "birds",
      "birding",
      "birdwatching",
      "zoo",
      "aquarium",
      "salmon",
    ],
    affordance:
      /\b(wildlife viewing|bird ?watching|birding|spot songbirds|salmon spawning( viewing)?|spotting koi|petting zoo)\b/,
    subtype:
      /\b(zoo|aquarium|wildlife|sanctuary|hatchery|nature (centre|center))\b/,
    tags: ["kids", "gentle"],
  },
  {
    key: "farms",
    label: "Farms & u-pick",
    words: [
      "farm",
      "farms",
      "u-pick",
      "upick",
      "pumpkin",
      "pumpkins",
      "pumpkin patch",
      "apple picking",
      "orchard",
      "corn maze",
      "hayride",
    ],
    affordance:
      /\b(pick-your-own|pumpkin (patch|picking)|u-pick|orchard tours|corn maze|hayrides?|hedge maze|apple picking)\b/,
    subtype: /\b(farm|orchard|u-pick|pumpkin|corn maze)\b/,
    not: /\b(farm market|farmers market|market)\b/,
    tags: ["kids", "outdoor"],
  },
  {
    key: "museums",
    label: "Museums & history",
    words: [
      "museum",
      "museums",
      "history",
      "historic",
      "heritage",
      "science centre",
      "science center",
    ],
    affordance:
      /\b(tour the museum|interactive exhibits|explore the heritage buildings|mansion tours|tours of the o'keefe mansion)\b/,
    subtype:
      /\b(museum|historic|heritage|science[ _](centre|center|museum)|interpretive centre)\b/,
    tags: ["indoor", "kids", "gentle"],
  },
  {
    key: "art",
    label: "Art & galleries",
    words: ["art", "gallery", "galleries", "exhibition", "exhibit", "murals"],
    affordance: /\b(art gallery|visual arts|art classes|murals pass)\b/,
    subtype: /\b(gallery|art (centre|center|exhibit|festival|event))\b/,
    tags: ["indoor", "date", "gentle"],
  },
  {
    key: "movies",
    label: "Movies",
    words: [
      "movie",
      "movies",
      "cinema",
      "film",
      "films",
      "flick",
      "the pictures",
    ],
    affordance: /\b(movie watching|movies?)\b/,
    subtype: /\b(cinema|movie|film festival|drive-in)\b/,
    not: /\b(production|commission|society|filmmak)/,
    tags: ["indoor", "date", "evening"],
  },
  {
    key: "live",
    label: "Live music & shows",
    words: [
      "concert",
      "concerts",
      "gig",
      "live music",
      "music",
      "a show",
      "the show",
      "live show",
      "theatre",
      "theater",
      "comedy",
      "a play",
      "musical",
      "opera",
    ],
    affordance:
      /\b(opera|musical performances|broadway shows|music venues|jazz nights|live big band music|community concerts|outdoor performances)\b/,
    subtype:
      /\b(concert|music|theatre|theater|theatrical|performance|comedy|burlesque|opera|magic show|dinner theatre|dance performance|show)\b/,
    not: /\b(car show|trade show|movie)\b/,
    tags: ["indoor", "date", "evening"],
  },
  {
    key: "wine",
    label: "Wine, beer & tasting",
    words: [
      "wine",
      "wines",
      "winery",
      "wineries",
      "vineyard",
      "beer",
      "brewery",
      "breweries",
      "cider",
      "cidery",
      "distillery",
      "tasting",
      "tastings",
    ],
    affordance:
      /\b(wine tasting|wine tours?|wine touring|guided wine tour|cider tasting|e-bike wine tours)\b/,
    subtype:
      /\b(winery|vineyard|brewery|cidery|distillery|tasting room|wine tasting|wine experience|tasting event)\b/,
    tags: ["date", "adult"],
  },
  {
    key: "eat",
    label: "Eat & drink",
    words: [
      "eat",
      "food",
      "for lunch",
      "for dinner",
      "dinner out",
      "brunch",
      "for breakfast",
      "coffee",
      "cafe",
      "café",
      "restaurant",
      "restaurants",
      "ice cream",
      "bakery",
      "a bite",
    ],
    subtype:
      /\b(restaurant|caf[eé]|coffee|bakery|bistro|food truck|pub|bar|ice cream|eatery|diner|pizzeria|dining event|food festival)\b/,
    not: /\b(crawl|wine bar)\b/,
    tags: ["everyday", "date"],
  },
  {
    key: "markets",
    label: "Markets",
    words: [
      "market",
      "markets",
      "farmers market",
      "craft fair",
      "artisan",
      "flea market",
    ],
    affordance: /\b(farmers market|artisan market|polson artisan market)\b/,
    subtype: /\bmarket\b/,
    tags: ["everyday", "gentle"],
  },
  {
    key: "spa",
    label: "Spa & wellness",
    words: [
      "spa",
      "massage",
      "wellness",
      "hot spring",
      "hot springs",
      "yoga",
      "pamper",
    ],
    affordance:
      /\b(spa treatments|rejuvenating spa treatments|couples massage|wellness classes)\b/,
    subtype: /\b(spa|wellness|hot springs?|yoga)\b/,
    tags: ["indoor", "date", "gentle"],
  },
  {
    key: "golf",
    label: "Golf & disc golf",
    words: [
      "golf",
      "golfing",
      "disc golf",
      "frisbee golf",
      "mini golf",
      "minigolf",
      "pitch and putt",
    ],
    affordance: /\b(golf(ing)?|disc golf|pitch (&|and) putt)\b/,
    subtype: /\b(golf|mini golf)\b/,
    not: /\bcamps?\b/,
    tags: ["outdoor"],
  },
  {
    key: "games",
    label: "Bowling, games & escape rooms",
    words: [
      "bowling",
      "escape room",
      "escape rooms",
      "arcade",
      "arcades",
      "laser tag",
      "games",
      "trampoline",
      "go karts",
      "go-karts",
      "axe throwing",
    ],
    affordance:
      /\b(bowling|escape room|arcade|laser tag|maze game|ping pong)\b/,
    subtype:
      /\b(bowling|escape room|arcade|laser|axe|trampoline|amusement|go-?kart|billiard|entertainment centre)\b/,
    not: /\blawn bowling\b/,
    tags: ["indoor", "kids", "evening"],
  },
  {
    key: "sports",
    label: "Courts & fields",
    words: [
      "tennis",
      "pickleball",
      "basketball",
      "volleyball",
      "soccer",
      "lawn bowling",
      "a game of",
      "courts",
      "sports",
    ],
    affordance:
      /\b(tennis|pickleball|basketball|(beach )?volleyball|soccer|lawn bowling|padel|spike ball)\b/,
    tags: ["outdoor", "everyday"],
  },
  {
    key: "hockey",
    label: "Hockey",
    words: ["hockey", "a hockey game", "the game"],
    affordance: /\b(hockey|adult hockey)\b/,
    subtype: /\bhockey\b/,
    not: /\bfield hockey\b/,
    tags: ["indoor", "evening"],
  },
  {
    key: "viewpoints",
    label: "Views & waterfalls",
    words: [
      "view",
      "views",
      "viewpoint",
      "lookout",
      "waterfall",
      "waterfalls",
      "scenery",
      "scenic",
      "sunset",
    ],
    affordance:
      /\b(sightseeing|sight-seeing|scenic walks|sunset walk|blossom viewing|capilano suspension bridge)\b/,
    subtype: /\b(viewpoint|lookout|waterfall|falls|canyon|gorge)\b/,
    tags: ["outdoor", "date", "gentle"],
  },
  {
    key: "libraries",
    label: "Libraries & story time",
    words: ["library", "libraries", "story time", "storytime", "books"],
    affordance: /\b(story time in the park)\b/,
    subtype: /\b(library|story ?time|storytelling|early literacy)\b/,
    tags: ["indoor", "kids", "gentle"],
  },
  {
    key: "festivals",
    label: "Festivals & fairs",
    words: ["festival", "festivals", "fair", "fairs", "celebration", "parade"],
    subtype:
      /\b(festival|celebration|fair|pow ?wow|fireworks|holiday lights)\b/,
    not: /\b(film festival|food festival|art festival)\b/,
    tags: ["kids", "outdoor"],
  },
  {
    key: "tours",
    label: "Tours",
    words: ["tour", "tours", "guided tour", "walking tour", "ghost tour"],
    affordance:
      /\b((guided|self-guided|walking|group|private|seasonal|wagon|bee|interpretive guided) tours?|tours of)\b/,
    subtype: /\b(tour|tours|guided tour)\b/,
    not: /\bwine\b/,
    tags: ["gentle"],
  },
  {
    key: "camping",
    label: "Camping",
    words: ["camp", "camping", "campground", "tent"],
    affordance: /\bcamping\b/,
    subtype: /\b(campground|camping)\b/,
    tags: ["outdoor", "adventure", "summer"],
  },
];

const BY_KEY = new Map(ACTIVITIES.map((a) => [a.key, a]));

export function activityByKey(key: string | undefined): Activity | undefined {
  return key ? BY_KEY.get(key as ActivityKey) : undefined;
}

/** Atlas's own words for a subject: affordances, subtype, and play features. */
function wordsOf(experience: Experience) {
  const affordances = (experience.knowledge?.affordances ?? [])
    .map((a) => a.name?.trim())
    .filter((n): n is string => Boolean(n));
  const features = (experience.knowledge?.features ?? []).filter(
    (f): f is string => typeof f === "string",
  );
  return {
    affordances,
    subtype: (experience.subtype ?? "").replace(/[_-]+/g, " ").trim(),
    features,
  };
}

const matches = (
  pattern: RegExp | undefined,
  not: RegExp | undefined,
  text: string,
): boolean => {
  if (!pattern || !text) return false;
  const lower = text.toLowerCase();
  return pattern.test(lower) && !(not && not.test(lower));
};

/**
 * **The Atlas words that put this subject in this activity**, in Atlas's own
 * spelling — `Kayaking`, `museum`, `Playground`. Empty means it is not in it.
 */
export function activityEvidence(
  experience: Experience,
  activity: Activity,
): readonly string[] {
  const { affordances, subtype, features } = wordsOf(experience);
  const out: string[] = [];
  for (const name of affordances)
    if (
      name.split(/\s+/).length <= 5 &&
      matches(activity.affordance, activity.not, name)
    )
      out.push(name);
  if (matches(activity.subtype, activity.not, subtype)) out.push(subtype);
  for (const feature of features)
    if (activity.feature?.test(feature.toLowerCase().trim())) out.push(feature);
  return [...new Map(out.map((w) => [w.toLowerCase(), w])).values()];
}

/** Every activity Atlas's words put this subject in. */
export function activitiesOf(experience: Experience): readonly Activity[] {
  return ACTIVITIES.filter(
    (activity) => activityEvidence(experience, activity).length > 0,
  );
}

/** Whether Atlas's words put this subject in the activity with this key. */
export function doesActivity(experience: Experience, key: string): boolean {
  const activity = activityByKey(key);
  return activity ? activityEvidence(experience, activity).length > 0 : false;
}

/**
 * **The activity a person named**, from their own words — "biking" is
 * Cycling, "the movies" is Movies, "a kayak" is Paddling. The longest phrase
 * wins, so "mountain biking" is not read as Cycling, and "ice skating" is
 * Skating rather than nothing.
 */
export function activityIn(text: string): Activity | undefined {
  const lower = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  let best: { activity: Activity; length: number } | undefined;
  for (const activity of ACTIVITIES) {
    for (const word of activity.words) {
      const pattern = new RegExp(
        String.raw`[^a-z]${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`,
      );
      if (pattern.test(lower) && (!best || word.length > best.length))
        best = { activity, length: word.length };
    }
  }
  return best?.activity;
}

/** Every activity named in a list of a person's words ("no hiking" → hiking). */
export function activitiesNamed(words: readonly string[]): readonly Activity[] {
  const out = new Map<ActivityKey, Activity>();
  for (const word of words) {
    const activity = activityIn(word);
    if (activity) out.set(activity.key, activity);
  }
  return [...out.values()];
}

/**
 * **An old `?doing=` value, still understood.** Discovery used to store
 * Atlas's verb (`Hiking`, `Swimming`); a saved link or a board's way back may
 * still carry one. A key is itself; a verb is the activity it evidences.
 */
export function activityForDoing(
  doing: string | undefined,
): Activity | undefined {
  if (!doing) return undefined;
  const byKey = activityByKey(doing);
  if (byKey) return byKey;
  const lower = doing.toLowerCase().trim();
  return (
    ACTIVITIES.find((a) => a.label.toLowerCase() === lower) ??
    ACTIVITIES.find((a) => matches(a.affordance, a.not, lower)) ??
    activityIn(lower)
  );
}

/** What a situation leans towards, for ordering the offer — never filtering. */
export interface OfferContext {
  /** `YYYY-MM-DD` — the season an activity is offered in comes from this. */
  readonly day?: string;
  readonly shelter?: "indoor" | "outdoor";
  readonly wet?: boolean;
  readonly child?: boolean;
  readonly pair?: boolean;
  readonly adventure?: boolean;
  readonly evening?: boolean;
  readonly gentle?: boolean;
  /** Keys never to offer — what they said no to, and what is already chosen. */
  readonly without?: readonly string[];
}

export interface ActivityOffer {
  readonly activity: Activity;
  /** Every subject in the pool Atlas's words put in it. The evidence. */
  readonly places: readonly Experience[];
}

/**
 * **Is this the time of year for it?** A calendar judgement for the BC
 * interior and coast, used to decide what is *suggested* and nothing more: in
 * October nobody is offered skiing as a first idea, and anyone who types
 * "skiing" still gets every ski hill Atlas holds.
 */
export function inSeason(activity: Activity, day: string | undefined): boolean {
  if (!day) return true;
  const month = Number(day.slice(5, 7));
  if (activity.tags.includes("winter") && activity.key !== "skating")
    return month === 12 || month <= 3;
  if (activity.tags.includes("summer")) return month >= 5 && month <= 9;
  return true;
}

const weightFor = (activity: Activity, context: OfferContext): number => {
  const has = (tag: ActivityTag) => activity.tags.includes(tag);
  let w = 1;
  const stayDry = context.shelter === "indoor" || context.wet;
  if (stayDry) w *= has("indoor") ? 2.4 : has("outdoor") ? 0.35 : 1;
  if (context.shelter === "outdoor") w *= has("outdoor") ? 1.8 : 0.4;
  if (context.child) w *= has("kids") ? 1.8 : has("adult") ? 0.15 : 1;
  if (context.pair) w *= has("date") ? 1.8 : has("kids") ? 0.6 : 1;
  if (context.adventure) w *= has("adventure") ? 2.5 : 0.7;
  if (context.evening) w *= has("evening") ? 2 : has("outdoor") ? 0.6 : 1;
  if (context.gentle) w *= has("gentle") ? 1.6 : has("adventure") ? 0.5 : 1;
  // Water is a summer idea here, before it is a pool.
  const month = context.day ? Number(context.day.slice(5, 7)) : undefined;
  if (has("water") && month !== undefined && (month <= 4 || month >= 10))
    w *= 0.5;
  // Eating is the backdrop to most days, not the idea; 183 restaurants should
  // not make "Eat & drink" the first thing anybody is offered.
  if (has("everyday")) w *= 0.55;
  return w;
};

/**
 * **What there is to do here, now, for these people** — best first.
 *
 * Built over whatever the page is honestly talking about (inside the radius,
 * near the origin, the area), so a person in Vancouver is not offered
 * Okanagan swimming. An activity needs two subjects behind it to be offered —
 * one is a place, not a kind of day (on a small page, one will do) — and
 * must be in season. Ordered by how
 * much Atlas holds for it, leaning with the situation: museums before
 * hiking when it is wet, playgrounds before wineries with a child.
 */
export function activityOffers(
  pool: readonly Experience[],
  context: OfferContext = {},
): readonly ActivityOffer[] {
  const byKey = new Map<ActivityKey, Experience[]>();
  for (const experience of pool) {
    for (const activity of activitiesOf(experience)) {
      const list = byKey.get(activity.key);
      if (list) list.push(experience);
      else byKey.set(activity.key, [experience]);
    }
  }
  const without = new Set(context.without ?? []);
  // On a page of a few dozen places one is enough to be worth naming; on a
  // page of hundreds, one is a place rather than a kind of day.
  const least = pool.length > 40 ? 2 : 1;
  return ACTIVITIES.flatMap((activity) => {
    const places = byKey.get(activity.key) ?? [];
    if (places.length < least || without.has(activity.key)) return [];
    if (!inSeason(activity, context.day)) return [];
    return [
      {
        activity,
        places,
        weight: Math.sqrt(places.length) * weightFor(activity, context),
      },
    ];
  })
    .sort(
      (a, b) =>
        b.weight - a.weight || a.activity.label.localeCompare(b.activity.label),
    )
    .map(({ activity, places }) => ({ activity, places }));
}
