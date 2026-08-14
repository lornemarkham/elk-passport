/**
 * ELK Labs — the ten experiments on the wall. Living data, same discipline
 * as every other `content.ts` in this app: adding an eleventh experiment
 * is a one-line push here, never a component change. This is explicitly
 * NOT the canonical record of product decisions — nothing here is
 * approved, scoped, or scheduled. See `docs/content-model/future.md` and
 * `docs/future/future-passport-experience.md` for where a real idea from
 * this wall gets recorded once it's more than a sketch.
 */

export interface Experiment {
  readonly number: number;
  readonly slug: string;
  readonly title: string;
  /** One punchy line — the thing you'd say to sell it in an elevator. */
  readonly hook: string;
  /** Short phrase, not a sentence — the emotional target, not a description. */
  readonly feeling: string;
  readonly why: string;
  readonly questions: readonly string[];
  readonly crazyIdeas: readonly string[];
  readonly successCriteria: readonly string[];
  readonly imageLabel: string;
  /** Only Experiment 01 has a real sandbox today — others link nowhere yet, honestly. */
  readonly sandboxHref?: string;
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    number: 1,
    slug: "discovery-space",
    title: "Discovery Space",
    hook: "What if finding somewhere to go felt like walking in, not filtering a list?",
    feeling: "Wonder. Wandering. Possibility.",
    why: "Discovery today is a search box and a grid of results — a database query wearing a nice font. Nobody ever fell in love with a place by scrolling a list of cards that all look the same.",
    questions: [
      "Can discovery feel spatial — like moving through somewhere — instead of scrolling a feed?",
      "What's the smallest version of this that's still real, not a tech demo?",
      "Does it work on a phone in one hand, or does it need a big screen to breathe?",
    ],
    crazyIdeas: [
      "Full-bleed, one-place-at-a-time cards you move through like walking down a hallway.",
      "Ambient motion and sound per place, not silent, static photos.",
      'A "take me somewhere" gesture that hands you one place, not a list of forty.',
    ],
    successCriteria: [
      'Someone says "I didn\'t know I wanted to go there" out loud.',
      "Someone keeps going after the third card without being told to.",
    ],
    imageLabel: "Discovery Space — full-bleed sketch",
    sandboxHref: "/about/experiment-01-discovery-space",
  },
  {
    number: 2,
    slug: "close-your-eyes",
    title: "Close Your Eyes",
    hook: "Sound first. Sight second. Let someone imagine it before they see it.",
    feeling: "Anticipation. Curiosity. A held breath.",
    why: "A photo answers the question before you've had a chance to wonder about it. Sound — wind, water, gravel, a distant engine — leaves room to imagine, the same way a great trailer never shows you the whole movie.",
    questions: [
      "Can real, sourced ambient sound (not invented) create real desire to go somewhere?",
      'How long can "eyes closed" hold someone\'s attention before it needs a payoff?',
      "Does this work for every place, or only the ones with something worth hearing?",
    ],
    crazyIdeas: [
      "A ten-second audio-only open before any image loads.",
      "Headphones-required mode for the drive there.",
      'A place\'s "sound signature" shown as a waveform before its photo.',
    ],
    successCriteria: [
      "Someone actually keeps their eyes closed for the whole clip.",
      "Someone reaches for the volume instead of skipping ahead.",
    ],
    imageLabel: "Close Your Eyes — waveform, no image yet",
  },
  {
    number: 3,
    slug: "living-mood-board",
    title: "Living Mood Board",
    hook: "A place shouldn't look the same in January as it does in July.",
    feeling: "Alive. Present. Right now, not last summer.",
    why: "Every place page today is a fixed photo taken once. Real places change by the hour and the season — Atlas increasingly knows this (weather, fire bans, seasonal advisories) and none of it currently touches how a page actually looks.",
    questions: [
      "Can real, current conditions (season, time of day, weather) shift a page's mood honestly, without inventing anything?",
      'Where\'s the line between "alive" and "gimmicky"?',
      "Does this need new Atlas knowledge, or just better use of what a page already has?",
    ],
    crazyIdeas: [
      "A page's palette shifts with the actual season, not a hardcoded theme.",
      "A quiet ambient loop that changes with time of day.",
      'A "right now" strip — today\'s real weather, not a generic hero image.',
    ],
    successCriteria: [
      "Someone visits the same place twice in different seasons and notices the difference unprompted.",
    ],
    imageLabel: "Living Mood Board — same place, four seasons",
  },
  {
    number: 4,
    slug: "discovery-constellation",
    title: "Discovery Constellation",
    hook: "Atlas already knows what's connected. Nobody can see it.",
    feeling: "Exploration. Infinite. Getting pleasantly lost.",
    why: "The relationship graph behind every place — near, connected, worth combining — is real and already built, and today it's a modest list at the bottom of a page called \"Keep Exploring.\" That undersells what's actually there.",
    questions: [
      "Can a graph of real places feel like something worth wandering, not a sitemap?",
      "How many hops before it stops feeling magical and starts feeling like a maze?",
      'Does this replace "Keep Exploring," or live alongside it as a different mode?',
    ],
    crazyIdeas: [
      "A literal star-map you pan and zoom, each star a real place, lines drawn only where Atlas has real relationships.",
      '"Warp" transitions between connected places instead of a page reload.',
      "A trail that remembers your path so you can see the shape of an afternoon of wandering.",
    ],
    successCriteria: [
      "Someone taps through five or more places in one sitting without being told to.",
      "Someone screenshots their own constellation to show a friend.",
    ],
    imageLabel: "Discovery Constellation — star map sketch",
  },
  {
    number: 5,
    slug: "tomorrow",
    title: "Tomorrow",
    hook: "A story, not an itinerary.",
    feeling: "Cinema. Anticipation. The night before.",
    why: 'An itinerary is a spreadsheet with times in it. Nobody has ever gotten excited reading one. "A Perfect Day" already tried this generically — this is the real version, place-specific, still built entirely from evidence.',
    questions: [
      "Can a real, evidence-based plan be told as a story without inventing a single fact?",
      'Second person ("you wake up before the alarm") or something quieter?',
      "What happens when Atlas doesn't know enough to fill a whole story yet?",
    ],
    crazyIdeas: [
      "A one-page treatment for tomorrow, written like a short film, real facts woven in as scenes.",
      "A single voiceover-style paragraph replacing an entire itinerary block.",
      "Chapters instead of a timeline: Arrival. The Thing You Came For. The Thing You Didn't Expect. The Fire.",
    ],
    successCriteria: [
      "Someone reads the whole thing instead of skimming for times.",
      "Someone reads it out loud to another person.",
    ],
    imageLabel: "Tomorrow — treatment page, page one",
  },
  {
    number: 6,
    slug: "soundtrack",
    title: "Soundtrack",
    hook: "Music is already part of the brand. It's never actually played once.",
    feeling: "Emotional scoring. The drive there.",
    why: '"Music is part of the brand language" has been a stated principle since the beginning of this workspace and has never once touched an actual place page. This experiment is about finally operationalizing it, not inventing it.',
    questions: [
      "Can a place earn its own song, or does that always feel arbitrary?",
      "Curated by a real person, or built from real signals (activity type, mood, region)?",
      "Does it live on the place page, or does it belong to the day, not the destination?",
    ],
    crazyIdeas: [
      'A one-song "arrival track" for a place, chosen deliberately, not algorithmically padded to a playlist.',
      'An auto-built "the drive there" playlist matched to real distance and time.',
      "A shareable day soundtrack the whole group can add to before they leave.",
    ],
    successCriteria: [
      "Someone actually presses play before they leave the driveway.",
      "Someone adds their own song to a shared day playlist unprompted.",
    ],
    imageLabel: "Soundtrack — now playing, day one",
  },
  {
    number: 7,
    slug: "analog-adventure",
    title: "Analog Adventure",
    hook: "What if the app's job is to disappear once you get there?",
    feeling: "Presence. Disconnection. Something you can hold.",
    why: "Planning is part of the adventure — but so is putting the phone away. Passport has never asked what happens after someone arrives and doesn't need a screen anymore.",
    questions: [
      "What's the smallest physical or offline object that still feels like Passport?",
      'Does "disappearing" mean printable, or just quieter — fewer notifications, less UI?',
      "Is this a real feature, or a one-off object (a printed card, a paper map)?",
    ],
    crazyIdeas: [
      "A printable, postcard-sized day card — real facts, no screen required.",
      'A "leave your phone in the car" mode that hands you the essentials on paper first.',
      "A hand-annotated-style paper map, generated from real Atlas data, not stock cartography.",
    ],
    successCriteria: [
      "Someone actually prints it.",
      "Someone doesn't open the app again until they're home.",
    ],
    imageLabel: "Analog Adventure — printed day card",
  },
  {
    number: 8,
    slug: "educational-adventures",
    title: "Educational Adventures",
    hook: 'The "why" is usually more interesting than the "what."',
    feeling: "Curiosity. Wonder. A fact worth repeating.",
    why: "The Ellison knowledge-gap work found real, sourced detail — cultural heritage, wildlife, geology — sitting unused in trusted sources Atlas already touches. There's a real audience (families, retirees, the curious) who want the story behind a place, not just a list of what to do there.",
    questions: [
      "Can real, cited facts feel delightful instead of like a museum placard?",
      "Does this need its own section, or does it belong woven into the story everywhere else?",
      "How do we keep this from turning into a wall of trivia nobody reads?",
    ],
    crazyIdeas: [
      '"Did you know" cards that surface one real, sourced fact at a time, not a dump of all of them.',
      "A kid-friendly reading level toggle for the same real facts.",
      "A visible source badge — where this fact came from — as a feature, not fine print.",
    ],
    successCriteria: [
      "A parent reads a fact out loud to a kid in the back seat.",
      "Someone shares a fact with a friend who wasn't even on the trip.",
    ],
    imageLabel: "Educational Adventures — did you know, card one",
  },
  {
    number: 9,
    slug: "the-companion-board",
    title: "The Companion Board",
    hook: "The group chat lights up. Passport isn't in it yet.",
    feeling: "Connection. Shared anticipation. Us, not just me.",
    why: "Planning a real trip is almost never solo — it's a group chat, a shared doc, a dozen scattered links. Passport today plans for one person at a time even though the brand's own opening line is about a group chat lighting up.",
    questions: [
      "What's the smallest shared surface that still feels like planning together, not a shared calendar invite?",
      "Does everyone need an account, or can this work with just a link?",
      "How does this stay fun instead of turning into another group-logistics chore?",
    ],
    crazyIdeas: [
      "A shared board where each friend reacts to a place instead of voting on it.",
      'A "who\'s bringing what" list that writes itself from the plan.',
      "Group soundtrack voting, tied directly to Experiment 06.",
    ],
    successCriteria: [
      'A group chat says "just use the board" instead of pasting five separate links.',
      "Someone who wasn't going to come changes their mind after seeing the board.",
    ],
    imageLabel: "The Companion Board — five friends, one plan",
  },
  {
    number: 10,
    slug: "hell-of-a-day",
    title: "Hell Of A Day",
    hook: "Passport helps you plan a day. It's never once helped you remember one.",
    feeling: "Nostalgia. Warmth. Pride. The fire at the end of the night.",
    why: '"Holy shit, that was one hell of a day" is the whole reason this product exists — and today it only lives in a mood-board sentence, never in the product itself. This experiment closes the loop: the moment after the adventure, not just before it.',
    questions: [
      "What's the smallest, truest way to capture a day that actually happened — not another form to fill out?",
      "Does this need new content, or just a place for what people already have (three photos, one line)?",
      "How does this stay a memory, not a highlight reel performance for other people?",
    ],
    crazyIdeas: [
      "An end-of-day card that writes itself at sunset: where you went, what Atlas confirmed you did, space for the one thing it could never know.",
      'A physical or digital "stamp" for a real, completed day — earned, not gamified.',
      "A campfire mode — read the day back, out loud, with the group.",
    ],
    successCriteria: [
      "Someone opens the recap around an actual fire and the group goes quiet for a second.",
      "Someone saves it instead of closing the tab.",
    ],
    imageLabel: "Hell Of A Day — the recap, unfinished",
  },
];
