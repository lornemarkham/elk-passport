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
  /**
   * **Where a person would look for it** in the explorer — the first is its
   * home, any others are where it also belongs (swimming is Water, and a
   * family goes swimming). Passport's grouping, like the label; never a claim
   * about any place.
   */
  readonly groups: readonly ActivityGroupKey[];
  /**
   * **The broader activity this is one way of doing.** Kayaking is a way of
   * paddling: the broader one's Atlas words already include every one of
   * this one's, so a kayaking place is always a paddling place too. The row
   * on the page offers the broad one; the explorer and a sentence can name
   * the narrow one.
   */
  readonly within?: ActivityKey;
  /** Different things a person who wants this often also wants. */
  readonly related?: readonly ActivityKey[];
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

/**
 * **The explorer's shelves** (owner's brief, 2026-10-16: *Discovery activity
 * taxonomy and explorer*). Nine human words for where to look, decided by
 * Passport. Atlas has Activity entities and `offers` edges but no grouping
 * above them, so this adds a layer over Atlas's vocabulary rather than a
 * second vocabulary beside it: every activity on a shelf is still evidenced
 * only by Atlas's own words.
 */
export type ActivityGroupKey =
  | "outdoors"
  | "adventure"
  | "water"
  | "winter"
  | "culture"
  | "entertainment"
  | "family"
  | "food"
  | "relaxation";

export interface ActivityGroup {
  readonly key: ActivityGroupKey;
  readonly label: string;
}

export const ACTIVITY_GROUPS: readonly ActivityGroup[] = [
  { key: "outdoors", label: "Outdoors" },
  { key: "adventure", label: "Adventure" },
  { key: "water", label: "Water" },
  { key: "winter", label: "Winter" },
  { key: "culture", label: "Arts & Culture" },
  { key: "entertainment", label: "Entertainment" },
  { key: "family", label: "Family" },
  { key: "food", label: "Food & Drink" },
  { key: "relaxation", label: "Relaxation" },
];

export type ActivityKey =
  | "hiking"
  | "swimming"
  | "cycling"
  | "mountain-biking"
  | "paddling"
  | "kayaking"
  | "canoeing"
  | "paddleboarding"
  | "fishing"
  | "boating"
  | "water-parks"
  | "playgrounds"
  | "skating"
  | "skiing"
  | "snowboarding"
  | "snowshoeing"
  | "cross-country-skiing"
  | "sledding"
  | "climbing"
  | "skateboarding"
  | "thrills"
  | "horseback"
  | "wildlife"
  | "birdwatching"
  | "wildlife-watching"
  | "farms"
  | "museums"
  | "art"
  | "classes"
  | "movies"
  | "live"
  | "theatre"
  | "live-music"
  | "comedy"
  | "wine"
  | "wineries"
  | "breweries"
  | "eat"
  | "markets"
  | "spa"
  | "picnics"
  | "gardens"
  | "golf"
  | "games"
  | "bowling"
  | "escape-rooms"
  | "casinos"
  | "sports"
  | "hockey"
  | "viewpoints"
  | "photography"
  | "stargazing"
  | "dogs"
  | "hunting"
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
    subtype: /\b(trail|hiking|walking)\b/,
    not: /\b(dog walking|walking tour|mural|tours?)\b/,
    tags: ["outdoor", "gentle"],
    groups: ["outdoors"],
    related: ["viewpoints", "camping"],
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
    feature: /^(beach|sandy beaches|seaside swimming pool|outdoor pool)$/,
    not: /\b(volleyball|access|dog|masters|lessons|artistic)\b/,
    tags: ["water", "kids"],
    groups: ["water", "family"],
    related: ["water-parks", "paddling"],
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
    groups: ["outdoors"],
    related: ["mountain-biking"],
  },
  {
    key: "mountain-biking",
    label: "Mountain biking",
    words: [
      "mountain bike",
      "mountain biking",
      "mtb",
      "downhill biking",
      "fat biking",
      "bike park",
    ],
    affordance: /\b(mountain bik(e|ing)|fat biking|gravity trails)\b/,
    subtype: /\b(bike park|mountain biking)\b/,
    tags: ["outdoor", "adventure"],
    groups: ["adventure", "outdoors"],
    related: ["cycling"],
  },
  {
    key: "paddling",
    label: "Paddling",
    words: ["paddle", "paddling", "paddle sports", "paddlesports"],
    affordance:
      /\b(canoe(s|ing)?|kayak(s|ing)?|paddl(e|es|ing|eboard|eboards|eboarding|e boarding|e sports|eboard rentals)|sup|stand-up paddleboarding)\b/,
    tags: ["water", "outdoor", "summer"],
    groups: ["water"],
    related: ["boating", "swimming"],
  },
  {
    key: "kayaking",
    label: "Kayaking",
    words: ["kayak", "kayaks", "kayaking", "sea kayaking"],
    affordance: /\bkayak(s|ing)?\b/,
    tags: ["water", "outdoor", "summer"],
    groups: ["water"],
    within: "paddling",
  },
  {
    key: "canoeing",
    label: "Canoeing",
    words: ["canoe", "canoes", "canoeing"],
    affordance: /\bcanoe(s|ing)?\b/,
    tags: ["water", "outdoor", "summer", "gentle"],
    groups: ["water"],
    within: "paddling",
  },
  {
    key: "paddleboarding",
    label: "Paddleboarding",
    words: [
      "paddleboard",
      "paddleboards",
      "paddleboarding",
      "paddle board",
      "paddle boarding",
      "sup",
      "stand-up paddleboarding",
      "stand up paddleboarding",
    ],
    affordance:
      /\b(paddle ?board(s|ing)?|paddleboard rentals|rent paddleboards|sup|stand-up paddleboarding)\b/,
    tags: ["water", "outdoor", "summer"],
    groups: ["water"],
    within: "paddling",
  },
  {
    key: "fishing",
    label: "Fishing",
    words: ["fish", "fishing", "angling", "fly fishing", "ice fishing"],
    affordance: /\b(fishing|ice fishing)\b/,
    not: /\b(touch screen|methods)\b/,
    tags: ["outdoor", "water", "gentle"],
    groups: ["water", "outdoors"],
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
      "water skiing",
      "wakeboard",
      "wakesurf",
      "tubing",
      "jet ski",
      "windsurf",
      "windsurfing",
      "kitesurf",
      "kitesurfing",
      "scuba",
      "diving",
    ],
    affordance:
      /\b(boating|boat rentals|pedal boating|water ?skiing|waterskiing|wakesurfing|tubing|inner tubing|windsurfing|kite ?surf(ing|ers)?|water ?sports?|watersport rentals|scuba diving)\b/,
    subtype: /\b(boating|tubing|water ?skiing)\b/,
    tags: ["water", "outdoor", "summer", "adventure"],
    groups: ["water"],
    related: ["paddling"],
  },
  {
    key: "water-parks",
    label: "Water parks",
    words: [
      "water park",
      "water parks",
      "waterpark",
      "waterparks",
      "water slide",
      "water slides",
      "waterslide",
      "waterslides",
      "wave pool",
    ],
    affordance: /\b(water ?parks?|water ?slides?)\b/,
    subtype: /\b(water ?park|waterslides?)\b/,
    feature: /^(water ?park)$/,
    tags: ["water", "kids", "summer"],
    groups: ["water", "family"],
    related: ["swimming", "playgrounds"],
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
      "splash park",
    ],
    affordance: /\b(playground|play-?park|spray park|skate and water parks)\b/,
    subtype: /\b(playground|play-?park)\b/,
    feature:
      /^(playgrounds?|new playground|spray park|water spray park|splash park|water playground|swing set|play area)$/,
    tags: ["kids", "outdoor"],
    groups: ["family"],
    related: ["water-parks"],
  },
  {
    key: "skating",
    label: "Ice skating",
    words: [
      "skate",
      "skating",
      "ice skating",
      "ice skate",
      "rink",
      "skating rink",
    ],
    affordance: /\b((ice |public |free public |family )?skat(e|ing)|shinny)\b/,
    subtype: /\b(rink|ice (arena|centre|center)|(ice )?skating)\b/,
    not: /\b(skateboard|lessons|club|speed|figure|curling|inline|roller|skate park|skatepark|skate plaza|skate and water parks)\b/,
    tags: ["kids", "winter"],
    groups: ["winter", "family"],
    related: ["hockey"],
  },
  {
    key: "skiing",
    label: "Skiing",
    words: [
      "ski",
      "skis",
      "skiing",
      "downhill skiing",
      "the slopes",
      "ski hill",
      "ski resort",
    ],
    affordance:
      /\b((downhill |night |cat |heli-?)?skiing|ski lessons|ski and snowboard lessons)\b/,
    subtype: /\b(ski (resort|hill|area)|cat skiing|skiing)\b/,
    not: /\b(cross-country|nordic|water)\b/,
    tags: ["winter", "outdoor", "adventure"],
    groups: ["winter", "adventure"],
    related: ["snowboarding", "cross-country-skiing", "snowshoeing"],
  },
  {
    key: "snowboarding",
    label: "Snowboarding",
    words: ["snowboard", "snowboards", "snowboarding"],
    affordance: /\bsnowboard(ing)?\b/,
    subtype: /\bsnowboard/,
    tags: ["winter", "outdoor", "adventure"],
    groups: ["winter", "adventure"],
    related: ["skiing"],
  },
  {
    key: "snowshoeing",
    label: "Snowshoeing",
    words: ["snowshoe", "snowshoes", "snowshoeing", "snow shoeing"],
    affordance: /\bsnow-?shoe(s|ing)?\b/,
    subtype: /\bsnow-?shoe/,
    tags: ["winter", "outdoor"],
    groups: ["winter", "outdoors"],
    related: ["cross-country-skiing", "hiking"],
  },
  {
    key: "cross-country-skiing",
    label: "Cross-country skiing",
    words: [
      "cross-country",
      "cross country",
      "cross-country skiing",
      "cross country skiing",
      "cross-country ski",
      "nordic",
      "nordic skiing",
      "xc skiing",
    ],
    affordance: /\b(cross-?country skiing|nordic skiing)\b/,
    subtype:
      /\b(nordic (centre|center|club)|cross-?country skiing|nordic skiing)\b/,
    tags: ["winter", "outdoor"],
    groups: ["winter", "outdoors"],
    related: ["snowshoeing", "skiing"],
  },
  {
    key: "sledding",
    label: "Sledding & tobogganing",
    words: [
      "sled",
      "sledding",
      "sledging",
      "toboggan",
      "tobogganing",
      "dog sledding",
      "dog sled",
      "sleigh ride",
    ],
    affordance:
      /\b(sledding|sledging|tobogganing|dog sled(s|ding)?|sleigh ride)\b/,
    subtype: /\b(dog sledding|sledding|sledging|tobogganing)\b/,
    tags: ["winter", "outdoor", "kids"],
    groups: ["winter", "family"],
    related: ["skating", "snowshoeing"],
  },
  {
    key: "climbing",
    label: "Climbing",
    words: [
      "climb",
      "climbing",
      "bouldering",
      "rock climbing",
      "climbing gym",
      "ice climbing",
    ],
    affordance: /\b((rock |indoor |ice )?climbing|bouldering)\b/,
    subtype: /\b(climbing|bouldering)\b/,
    tags: ["adventure"],
    groups: ["adventure"],
  },
  {
    key: "skateboarding",
    label: "Skateboarding",
    words: [
      "skateboard",
      "skateboarding",
      "skatepark",
      "skate park",
      "skateparks",
    ],
    affordance: /\bskateboard(ing)?\b/,
    subtype: /\bskate ?park\b/,
    feature: /^(skate ?park|skateboard park)$/,
    tags: ["outdoor", "adventure"],
    groups: ["adventure", "outdoors"],
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
    groups: ["adventure"],
  },
  {
    key: "horseback",
    label: "Horseback riding",
    words: ["horse", "horses", "horseback", "horse riding", "trail ride"],
    affordance: /\b(horseback riding|horse)\b/,
    subtype: /\b(stable|equestrian|riding)\b/,
    tags: ["outdoor", "adventure"],
    groups: ["adventure", "outdoors"],
  },
  {
    key: "wildlife",
    label: "Animals & wildlife",
    words: ["animals", "animal", "wildlife", "zoo", "aquarium", "petting zoo"],
    affordance:
      /\b(wildlife (viewing|watching)|bird ?watching|birding|songbirds|salmon spawning( viewing)?|whale watching|bear viewing|spotting koi|petting zoo)\b/,
    subtype:
      /\b(zoo|aquarium|wildlife|sanctuary|hatchery|nature (centre|center)|bird (observatory|watching|route)|birding|birdwatching|migratory bird|whale watching)\b/,
    tags: ["kids", "gentle"],
    groups: ["outdoors", "family"],
  },
  {
    key: "birdwatching",
    label: "Birdwatching",
    words: [
      "birds",
      "bird observatory",
      "birding",
      "birder",
      "birders",
      "birdwatching",
      "bird watching",
      "bird-watching",
      "songbirds",
    ],
    affordance: /\b(bird ?watching|birding|songbirds)\b/,
    subtype:
      /\b(bird ?watching|birding|bird (sanctuary|observatory|route)|migratory bird)\b/,
    tags: ["outdoor", "gentle"],
    groups: ["outdoors"],
    within: "wildlife",
    related: ["wildlife-watching", "photography", "hiking"],
  },
  {
    key: "wildlife-watching",
    label: "Wildlife watching",
    words: [
      "wildlife watching",
      "wildlife viewing",
      "see wildlife",
      "watch wildlife",
      "salmon",
      "salmon run",
      "salmon spawning",
      "whale watching",
      "whales",
      "bears",
    ],
    affordance:
      /\b(wildlife (viewing|watching)|salmon spawning( viewing)?|whale watching|bear viewing)\b/,
    subtype:
      /\b(wildlife (viewing|refuge|area|management area)|hatchery|whale watching)\b/,
    tags: ["outdoor", "gentle", "kids"],
    groups: ["outdoors"],
    within: "wildlife",
    related: ["birdwatching", "photography"],
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
    subtype:
      /\b(farm|orchard|u-pick|pumpkin|corn maze|fruit picking|apple picking)\b/,
    not: /\b(farm market|farmers market|market)\b/,
    tags: ["kids", "outdoor"],
    groups: ["family", "food"],
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
    not: /\bheritage garden\b/,
    tags: ["indoor", "kids", "gentle"],
    groups: ["culture", "family"],
    related: ["art", "tours"],
  },
  {
    key: "art",
    label: "Art & galleries",
    words: ["art", "gallery", "galleries", "exhibition", "exhibit", "murals"],
    affordance: /\b(art gallery|visual arts|murals pass)\b/,
    subtype: /\b(gallery|art (centre|center|exhibit|festival|event))\b/,
    tags: ["indoor", "date", "gentle"],
    groups: ["culture"],
    related: ["museums", "classes"],
  },
  {
    key: "classes",
    label: "Classes & workshops",
    words: [
      "class",
      "classes",
      "workshop",
      "workshops",
      "cooking class",
      "cooking classes",
      "art class",
      "art classes",
      "pottery",
    ],
    affordance:
      /\b(cooking( classes)?|art classes|workshops?|dance workshop|pottery|painting classes?)\b/,
    subtype:
      /\b(workshop|cooking (class|school)|cooking|pottery|art classes|dance workshop|class)\b/,
    not: /\b(fitness|yoga|aquafit|swim|wellness|certification)\b/,
    tags: ["indoor", "date"],
    groups: ["culture"],
    related: ["art"],
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
    groups: ["entertainment"],
  },
  {
    key: "live",
    label: "Live music & shows",
    words: [
      "a show",
      "the show",
      "live show",
      "shows",
      "performance",
      "performances",
      "live entertainment",
    ],
    affordance:
      /\b(opera|musical performances|broadway shows|music venues|jazz nights|live big band music|community concerts|outdoor performances|live music|theatres?|listening to live music)\b/,
    subtype:
      /\b(concerts?|music|musicvenue|musical|jazz|symphony|orchestra|theatre|theater|theatrical|performance|comedy|improv|burlesque|opera|ballet|magic show|dinner theatre|dance performance|show)\b/,
    not: /\b(car show|trade show|movie|drive-in|music (association|school|store|lessons))\b/,
    tags: ["indoor", "date", "evening"],
    groups: ["culture", "entertainment"],
  },
  {
    key: "theatre",
    label: "Theatre",
    words: [
      "theatre",
      "theater",
      "theatres",
      "a play",
      "plays",
      "musical",
      "musicals",
      "broadway",
      "opera",
      "ballet",
      "dinner theatre",
    ],
    affordance: /\b(opera|broadway shows|theatres?|theaters?)\b/,
    subtype:
      /\b(theatre|theater|theatrical|opera|musical|dinner theatre|ballet|burlesque)\b/,
    not: /\b(movie|cinema|drive-in|film|puppet)\b/,
    tags: ["indoor", "date", "evening"],
    groups: ["culture", "entertainment"],
    within: "live",
    related: ["live-music", "comedy"],
  },
  {
    key: "live-music",
    label: "Live music",
    words: [
      "concert",
      "concerts",
      "gig",
      "gigs",
      "live music",
      "music",
      "a band",
      "jazz",
      "symphony",
      "orchestra",
    ],
    affordance:
      /\b(musical performances|music venues|jazz nights|live big band music|community concerts|concerts?|live music|listening to live music)\b/,
    subtype:
      /\b(concerts?|music (venue|event|performance|festival|concert)|musicvenue|live music|jazz|symphony|orchestra|concert venue)\b/,
    not: /\b(association|school|store|lessons|music band|musical group|music ensemble)\b/,
    tags: ["indoor", "date", "evening"],
    groups: ["culture", "entertainment"],
    within: "live",
    related: ["theatre", "festivals"],
  },
  {
    key: "comedy",
    label: "Comedy",
    words: [
      "comedy",
      "comedy show",
      "stand-up comedy",
      "standup comedy",
      "improv",
      "comedian",
      "a laugh",
    ],
    subtype: /\b(comedy|improv|stand-?up comedy)\b/,
    tags: ["indoor", "date", "evening", "adult"],
    groups: ["entertainment"],
    within: "live",
    related: ["theatre"],
  },
  {
    key: "wine",
    label: "Wine, beer & tasting",
    words: ["tasting", "tastings", "a tasting"],
    affordance:
      /\b(wine tasting|wine tours?|wine touring|guided wine tour|cider tasting|beer tasting|e-bike wine tours|brewery (hopping|tours?))\b/,
    subtype:
      /\b(winery|vineyard|brewery|brew ?pub|brewing company|cidery|cider|distillery|meadery|taproom|tasting room|wine tasting|wine experience|tasting event)\b/,
    tags: ["date", "adult"],
    groups: ["food"],
  },
  {
    key: "wineries",
    label: "Wineries",
    words: [
      "wine",
      "wines",
      "winery",
      "wineries",
      "vineyard",
      "vineyards",
      "wine tasting",
      "wine tour",
    ],
    affordance:
      /\b(wine tasting|wine tours?|wine touring|guided wine tour|e-bike wine tours)\b/,
    subtype: /\b(winery|vineyard|wine tasting|wine experience)\b/,
    tags: ["date", "adult"],
    groups: ["food"],
    within: "wine",
    related: ["breweries"],
  },
  {
    key: "breweries",
    label: "Breweries & cideries",
    words: [
      "beer",
      "beers",
      "brewery",
      "breweries",
      "craft beer",
      "cider",
      "cidery",
      "cideries",
      "distillery",
      "distilleries",
      "mead",
      "meadery",
    ],
    affordance: /\b(cider tasting|brewery (hopping|tours?)|beer tasting)\b/,
    subtype:
      /\b(brewery|brew ?pub|brewing company|cidery|cider|distillery|meadery|taproom)\b/,
    tags: ["date", "adult"],
    groups: ["food"],
    within: "wine",
    related: ["wineries"],
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
    groups: ["food"],
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
    groups: ["food"],
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
    groups: ["relaxation"],
  },
  {
    key: "picnics",
    label: "Picnics",
    words: ["picnic", "picnics", "picnicking", "picnic spot"],
    affordance: /\b(picnic(s|king)?|enjoy the picnic area)\b/,
    feature:
      /^(picnic (areas?|shelters?|sites?)|designated picnic facilities)$/,
    tags: ["outdoor", "gentle", "kids"],
    groups: ["relaxation", "family"],
    related: ["playgrounds", "swimming"],
  },
  {
    key: "gardens",
    label: "Gardens",
    words: [
      "garden",
      "gardens",
      "botanical garden",
      "japanese garden",
      "blossoms",
      "flowers",
    ],
    affordance:
      /\b(visiting historical gardens|blossom viewing|garden tours?)\b/,
    subtype: /\b(gardens?|botanical|arboretum|conservatory)\b/,
    feature:
      /^(gardens|[a-z ]+ (medicine|japanese|heritage) garden|kuno garden)$/,
    not: /\b(beer garden|garden (centre|center|cafe|supply)|kindergarten|community gardens?|olive garden)\b/,
    tags: ["outdoor", "gentle", "date"],
    groups: ["relaxation", "outdoors"],
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
    groups: ["outdoors"],
  },
  {
    key: "games",
    label: "Bowling, games & escape rooms",
    words: [
      "arcade",
      "arcades",
      "laser tag",
      "games",
      "trampoline",
      "go karts",
      "go-karts",
      "axe throwing",
      "billiards",
      "virtual reality",
    ],
    affordance:
      /\b(bowling|escape room|arcade|laser tag|maze game|ping pong)\b/,
    subtype:
      /\b(bowling|escape room|arcade|laser|axe|trampoline|amusement|go-?kart|billiard|entertainment centre|entertainment center|virtual reality|board game)\b/,
    not: /\blawn bowling\b/,
    tags: ["indoor", "kids", "evening"],
    groups: ["entertainment", "family"],
  },
  {
    key: "bowling",
    label: "Bowling",
    words: ["bowling", "ten-pin", "ten pin", "five-pin", "bowling alley"],
    affordance: /\bbowling\b/,
    subtype: /\bbowling\b/,
    not: /\blawn bowling\b/,
    tags: ["indoor", "kids", "evening"],
    groups: ["entertainment", "family"],
    within: "games",
    related: ["escape-rooms"],
  },
  {
    key: "escape-rooms",
    label: "Escape rooms",
    words: ["escape room", "escape rooms", "escape game"],
    affordance: /\bescape rooms?\b/,
    subtype: /\bescape room/,
    tags: ["indoor", "evening"],
    groups: ["entertainment"],
    within: "games",
    related: ["bowling"],
  },
  {
    key: "casinos",
    label: "Casinos",
    words: ["casino", "casinos", "gambling", "slots"],
    subtype: /\bcasino\b/,
    not: /\bonline\b/,
    tags: ["indoor", "evening", "adult"],
    groups: ["entertainment"],
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
    groups: ["outdoors"],
  },
  {
    key: "hockey",
    label: "Hockey",
    words: ["hockey", "a hockey game", "the game"],
    affordance: /\b(hockey|adult hockey)\b/,
    subtype: /\bhockey\b/,
    not: /\b(field|roller) hockey\b/,
    tags: ["indoor", "evening"],
    groups: ["entertainment", "winter"],
    related: ["skating"],
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
      "chairlift",
    ],
    affordance:
      /\b(sightseeing|sight-seeing|scenic walks|sunset walk|blossom viewing|capilano suspension bridge|scenic chairlift rides|chairlift rides)\b/,
    subtype: /\b(viewpoint|lookout|waterfall|falls|canyon|gorge|sightseeing)\b/,
    feature: /^(elevated viewpoints|observation platforms?|lookout)$/,
    tags: ["outdoor", "date", "gentle"],
    groups: ["outdoors"],
    related: ["hiking", "photography"],
  },
  {
    key: "photography",
    label: "Photography",
    words: [
      "photography",
      "photographs",
      "photographing",
      "photo spot",
      "photo spots",
      "photo walk",
      "take photos",
      "take pictures",
    ],
    affordance: /\bphotograph(y|ing|ers?)\b/,
    subtype: /\b(photography|photo (walk|tour|experience|gallery))\b/,
    tags: ["outdoor", "gentle"],
    groups: ["outdoors", "culture"],
    related: ["viewpoints", "birdwatching"],
  },
  {
    key: "stargazing",
    label: "Stargazing",
    words: [
      "stargazing",
      "star gazing",
      "the stars",
      "night sky",
      "meteor shower",
      "astronomy",
      "observatory",
      "planetarium",
      "northern lights",
    ],
    affordance: /\b(star ?gazing|astronomy|night sky)\b/,
    subtype:
      /\b(meteor shower|planetarium|star ?gazing|astronomy|observatory)\b/,
    not: /\bbird observatory\b/,
    tags: ["outdoor", "evening", "date"],
    groups: ["outdoors"],
  },
  {
    key: "dogs",
    label: "Out with the dog",
    words: [
      "dog park",
      "dog parks",
      "off-leash",
      "off leash",
      "with the dog",
      "with my dog",
      "with our dog",
      "dog friendly",
      "dog-friendly",
    ],
    affordance:
      /\b(dog park|off-leash dog|dog off-leash|dog friendly (hike|activities)|golf with your dog)\b/,
    subtype: /\b(dog park|dog friendly activities)\b/,
    feature: /^(dog park \(off leash\)|dog off-leash areas?)$/,
    tags: ["outdoor", "everyday"],
    groups: ["outdoors"],
    related: ["hiking"],
  },
  {
    key: "hunting",
    label: "Hunting",
    words: ["hunting"],
    affordance: /^hunting$/,
    tags: ["outdoor", "adult"],
    groups: ["outdoors"],
  },
  {
    key: "libraries",
    label: "Libraries & story time",
    words: ["library", "libraries", "story time", "storytime", "books"],
    affordance: /\b(story time in the park)\b/,
    subtype: /\b(library|story ?time|storytelling|early literacy)\b/,
    tags: ["indoor", "kids", "gentle"],
    groups: ["family"],
  },
  {
    key: "festivals",
    label: "Festivals & fairs",
    words: ["festival", "festivals", "fair", "fairs", "celebration", "parade"],
    subtype:
      /\b(festival|celebration|fair|pow ?wow|fireworks|holiday lights)\b/,
    not: /\b(film festival|food festival|art festival|music festival)\b/,
    tags: ["kids", "outdoor"],
    groups: ["entertainment", "family"],
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
    groups: ["culture"],
  },
  {
    key: "camping",
    label: "Camping",
    words: ["camp", "camping", "campground", "campgrounds", "tent"],
    affordance: /\bcamping\b/,
    subtype: /\b(campground|camping)\b/,
    tags: ["outdoor", "adventure", "summer"],
    groups: ["outdoors", "adventure"],
    related: ["hiking", "stargazing"],
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
  let byActivity = evidenceFor.get(experience);
  if (!byActivity) {
    byActivity = new Map();
    evidenceFor.set(experience, byActivity);
  }
  const kept = byActivity.get(activity);
  if (kept) return kept;
  const found = readEvidence(experience, activity);
  byActivity.set(activity, found);
  return found;
}

/**
 * What each activity found for one subject, remembered while the subject
 * lives: Discovery asks the same ~3,400 immutable subjects about the same
 * activities on every sentence somebody types (see `memoizeByObject`).
 */
const evidenceFor = new WeakMap<Experience, Map<Activity, readonly string[]>>();

function readEvidence(
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
 * Every phrase that names an activity, compiled once: its words, and its own
 * label — so a chip in the explorer, said as a sentence, is read back as
 * exactly the activity it showed ("Bowling, games & escape rooms" is the
 * family, not Bowling).
 */
const PHRASES = ACTIVITIES.flatMap((activity) =>
  [...new Set([...activity.words, activity.label.toLowerCase()])].map(
    (word) => ({
      activity,
      length: word.length,
      pattern: new RegExp(
        String.raw`[^a-z]${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`,
      ),
    }),
  ),
);

/**
 * **The activity a person named**, from their own words — "biking" is
 * Cycling, "the movies" is Movies, "a kayak" is Kayaking. The longest phrase
 * wins, so "mountain biking" is not read as Cycling, and "ice skating" is
 * Ice skating rather than nothing.
 */
export function activityIn(text: string): Activity | undefined {
  const lower = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  let best: { activity: Activity; length: number } | undefined;
  for (const phrase of PHRASES)
    if (phrase.pattern.test(lower) && (!best || phrase.length > best.length))
      best = phrase;
  return best?.activity;
}

/**
 * **The whole sentence is an activity's name** — "Skiing", "birdwatching",
 * "Live music" — and so it names no place. Atlas holds Activity entities
 * titled exactly that ("Skiing", "Birding in Kelowna"), and a name search
 * would otherwise lead the answer with them instead of with the places that
 * offer it.
 */
export function activityNamedExactly(text: string): Activity | undefined {
  const said = text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?]+$/, "")
    .trim();
  return ACTIVITIES.find(
    (a) => a.label.toLowerCase() === said || a.words.includes(said),
  );
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

/**
 * **When it usually is**, in words — for an activity offered out of season,
 * so the explorer and the answer can say so instead of hiding it. The same
 * calendar judgement as `inSeason`; never a claim about any one place.
 */
export function seasonLine(activity: Activity): string | undefined {
  if (activity.tags.includes("winter") && activity.key !== "skating")
    return "December to March";
  if (activity.tags.includes("summer")) return "May to September";
  return undefined;
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
 * **Which subjects Atlas's words put in each activity**, for one pool. One
 * pass over the pool, shared by the row, the explorer and the related
 * suggestions, so all three count the same places.
 */
export function placesByActivity(
  pool: readonly Experience[],
): ReadonlyMap<ActivityKey, readonly Experience[]> {
  const byKey = new Map<ActivityKey, Experience[]>();
  for (const experience of pool) {
    for (const activity of activitiesOf(experience)) {
      const list = byKey.get(activity.key);
      if (list) list.push(experience);
      else byKey.set(activity.key, [experience]);
    }
  }
  return byKey;
}

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
 *
 * **The broad activity, not its narrower ways** — Paddling, not Paddling and
 * Kayaking and Canoeing side by side, which would be one idea three times.
 * The narrow ones are in the explorer (`activityExplorer`), however few
 * places they have.
 */
export function activityOffers(
  pool: readonly Experience[],
  context: OfferContext = {},
  byKey: ReadonlyMap<ActivityKey, readonly Experience[]> = placesByActivity(
    pool,
  ),
): readonly ActivityOffer[] {
  const without = new Set(context.without ?? []);
  // On a page of a few dozen places one is enough to be worth naming; on a
  // page of hundreds, one is a place rather than a kind of day.
  const least = pool.length > 40 ? 2 : 1;
  return ACTIVITIES.flatMap((activity) => {
    if (activity.within) return [];
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

/**
 * **Everything this one is close to**: the broader activity it is a way of,
 * the other ways of that, its own narrower ways, and what it names as
 * related — in that order, each once.
 */
export function relatedActivities(key: string): readonly Activity[] {
  const activity = activityByKey(key);
  if (!activity) return [];
  const keys: ActivityKey[] = [];
  if (activity.within) keys.push(activity.within);
  for (const other of ACTIVITIES)
    if (
      other.key !== activity.key &&
      ((activity.within && other.within === activity.within) ||
        other.within === activity.key)
    )
      keys.push(other.key);
  keys.push(...(activity.related ?? []));
  return [...new Set(keys)]
    .filter((k) => k !== activity.key)
    .flatMap((k) => activityByKey(k) ?? []);
}

export interface ExplorerEntry {
  readonly activity: Activity;
  /** What Atlas holds for it in the pool the page is talking about. */
  readonly here: readonly Experience[];
  /** How many subjects Atlas holds for it anywhere Passport looks. */
  readonly anywhere: number;
  /** Whether this is the usual time of year for it (`inSeason`). */
  readonly inSeason: boolean;
}

export interface ExplorerGroup extends ActivityGroup {
  readonly entries: readonly ExplorerEntry[];
}

/**
 * **Every activity, on its shelves, with what Atlas holds for each** — the
 * explorer behind the row (owner's brief, 2026-10-16).
 *
 * Nothing is cut for being rare: one birding route is one more than none, and
 * it is listed. Nothing is cut for being out of season either; skiing in
 * October says when it usually is. What separates them is the evidence —
 * `here` (places Atlas's words put in it, in the pool the page talks about)
 * against `anywhere` (the same count over everything) — so the explorer can
 * say which have something nearby, which only elsewhere, and which Atlas
 * holds nothing for yet. Shelves keep the vocabulary's order, which keeps a
 * broad activity beside its narrower ways.
 */
export function activityExplorer(
  here: readonly Experience[],
  anywhere: readonly Experience[],
  options: {
    readonly day?: string;
    readonly hereByKey?: ReadonlyMap<ActivityKey, readonly Experience[]>;
    readonly anywhereByKey?: ReadonlyMap<ActivityKey, readonly Experience[]>;
  } = {},
): readonly ExplorerGroup[] {
  const near = options.hereByKey ?? placesByActivity(here);
  const all =
    options.anywhereByKey ??
    (anywhere === here ? near : placesByActivity(anywhere));
  return ACTIVITY_GROUPS.map((group) => ({
    ...group,
    entries: ACTIVITIES.filter((a) => a.groups.includes(group.key)).map(
      (activity) => ({
        activity,
        here: near.get(activity.key) ?? [],
        anywhere: Math.max(
          all.get(activity.key)?.length ?? 0,
          near.get(activity.key)?.length ?? 0,
        ),
        inSeason: inSeason(activity, options.day),
      }),
    ),
  }));
}

/**
 * **Does this person's word find this activity?** For the explorer's filter:
 * its label, the words it is known by, or the shelf it sits on, so "birds",
 * "kayak" and "winter" all find something.
 */
export function activityMatches(activity: Activity, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/[’']/g, "'");
  if (!q) return true;
  if (activity.label.toLowerCase().includes(q)) return true;
  if (activity.words.some((w) => w.includes(q))) return true;
  if (activityIn(q)?.key === activity.key) return true;
  return ACTIVITY_GROUPS.some(
    (g) => activity.groups.includes(g.key) && g.label.toLowerCase().includes(q),
  );
}
