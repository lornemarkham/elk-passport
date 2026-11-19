/**
 * **Connect & Play: the words.**
 *
 * Everything a card can say, and for whom. Pure data, no React, no storage.
 *
 * Two independent dials choose a card (the owner's brief: "relationship stage
 * and game mode are independent"): the **mode** picks what kind of card comes
 * next, the **stage** picks how personal it may be. A card carries the span of
 * stages it suits; "What's your idea of a perfect Sunday?" is fine on a first
 * date and a little thin ten years in, and "What do you still want us to try?"
 * is the other way round.
 *
 * Every dare is optional (the card says so; Skip is always there) and nothing
 * here touches anyone, asks for anything private from a stranger, or is
 * sexual. `content.test.ts` holds those lines.
 */

export const STAGES = [
  { id: "matched", label: "Just matched" },
  { id: "first", label: "First date" },
  { id: "newly", label: "Newly dating" },
  { id: "established", label: "Established relationship" },
  { id: "long", label: "Long-term relationship" },
  { id: "married", label: "Married" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map((s) => s.id) as readonly StageId[];
export const isStageId = (v: unknown): v is StageId =>
  typeof v === "string" && (STAGE_IDS as readonly string[]).includes(v);
export const stageIndex = (s: StageId): number => STAGE_IDS.indexOf(s);

export const MODES = [
  {
    id: "know",
    label: "Get to know me",
    line: "Real conversation. No scores, no games.",
  },
  {
    id: "figure",
    label: "Figure me out",
    line: "Playful games. Two truths, would you rather, dares.",
  },
  {
    id: "surprise",
    label: "Surprise me",
    line: "A bit of everything, in a good order.",
  },
] as const;
export type ModeId = (typeof MODES)[number]["id"];
export const MODE_IDS = MODES.map((m) => m.id) as readonly ModeId[];
export const isModeId = (v: unknown): v is ModeId =>
  typeof v === "string" && (MODE_IDS as readonly string[]).includes(v);

/**
 * What both people can lean towards. A would-you-rather option may carry one,
 * and when both pick options with the same one it is a **shared interest**,
 * the only thing Connect & Play ever hands to the rest of Passport.
 */
export const INTERESTS = {
  outdoors: "outdoor",
  food: "food",
  cozy: "cozy",
  adventure: "adventurous",
  arts: "arts and culture",
  music: "live music",
  nightlife: "evening drinks",
  active: "active",
} as const;
export type Interest = keyof typeof INTERESTS;
export const isInterest = (v: unknown): v is Interest =>
  typeof v === "string" && Object.hasOwn(INTERESTS, v);

type Span = readonly [number, number];
const ALL: Span = [0, 5];

export type Topic =
  "starter" | "interests" | "personal" | "dreams" | "memories";
export type Tone = "real" | "fun";

export interface TalkCard {
  readonly kind: "talk";
  readonly id: string;
  readonly text: string;
  readonly topic: Topic;
  readonly tone: Tone;
  readonly stages: Span;
}
export interface WyrCard {
  readonly kind: "wyr";
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly ta?: Interest;
  readonly tb?: Interest;
  readonly tone: Tone;
  readonly stages: Span;
}
export interface LikelyCard {
  readonly kind: "likely";
  readonly id: string;
  /** Finishes "Which of us is most likely to…". */
  readonly text: string;
  readonly stages: Span;
}
export interface GuessCard {
  readonly kind: "guess";
  readonly id: string;
  readonly text: string;
  readonly options: readonly string[];
  readonly stages: Span;
}
export interface TodCard {
  readonly kind: "tod";
  readonly id: string;
  readonly truth: string;
  readonly dare: string;
  readonly stages: Span;
}

export type ContentCard = TalkCard | WyrCard | LikelyCard | GuessCard | TodCard;

const talk = (
  id: string,
  topic: Topic,
  tone: Tone,
  stages: Span,
  text: string,
): TalkCard => ({ kind: "talk", id: `t${id}`, topic, tone, stages, text });

const E: Span = [0, 2]; // early: matched .. newly
const MID: Span = [1, 3];
const SETTLED: Span = [3, 5];
const LATER: Span = [2, 5];

export const TALK: readonly TalkCard[] = [
  // starters
  talk(
    "01",
    "starter",
    "real",
    E,
    "What's the best thing that happened to you this week?",
  ),
  talk("02", "starter", "real", E, "What's something you're quietly proud of?"),
  talk(
    "03",
    "starter",
    "real",
    E,
    "What did you want to be when you were ten?",
  ),
  talk(
    "04",
    "starter",
    "real",
    ALL,
    "What's a small thing that reliably makes your day better?",
  ),
  talk("05", "starter", "fun", E, "What's the most useless talent you have?"),
  talk(
    "06",
    "starter",
    "fun",
    ALL,
    "What's a food opinion you'll defend to the end?",
  ),
  talk(
    "07",
    "starter",
    "fun",
    E,
    "What's the worst haircut or outfit phase you went through?",
  ),
  talk(
    "08",
    "starter",
    "fun",
    ALL,
    "If your life had a theme song right now, what would it be?",
  ),
  talk("09", "starter", "real", [0, 1], "What made you say yes to meeting up?"),
  talk(
    "10",
    "starter",
    "fun",
    MID,
    "What's your most embarrassing autocorrect or voice-note moment?",
  ),
  talk(
    "11",
    "starter",
    "real",
    SETTLED,
    "What's something I do that you've quietly come to love?",
  ),
  talk(
    "12",
    "starter",
    "fun",
    SETTLED,
    "What's the silliest thing we've ever laughed about?",
  ),

  // interests
  talk(
    "13",
    "interests",
    "real",
    ALL,
    "What's something you could talk about for an hour without noticing?",
  ),
  talk(
    "14",
    "interests",
    "real",
    ALL,
    "What's the last thing you got properly obsessed with?",
  ),
  talk(
    "15",
    "interests",
    "real",
    E,
    "What's a place you'd happily go back to again and again?",
  ),
  talk(
    "16",
    "interests",
    "real",
    ALL,
    "What's a song, show or book that feels like you?",
  ),
  talk(
    "17",
    "interests",
    "fun",
    ALL,
    "What's a guilty pleasure you're done feeling guilty about?",
  ),
  talk(
    "18",
    "interests",
    "real",
    ALL,
    "What does your perfect Sunday look like, start to finish?",
  ),
  talk(
    "19",
    "interests",
    "real",
    E,
    "What's something you want to get better at?",
  ),
  talk(
    "20",
    "interests",
    "real",
    MID,
    "What's the best meal you've ever had, and who was it with?",
  ),
  talk(
    "21",
    "interests",
    "real",
    LATER,
    "What's something we've never done that you think we'd both enjoy?",
  ),
  talk(
    "22",
    "interests",
    "fun",
    E,
    "What's a hobby you'd take up if nobody could watch you be bad at it?",
  ),
  talk(
    "23",
    "interests",
    "real",
    SETTLED,
    "What's a hobby of mine you'd actually like to try with me?",
  ),
  talk(
    "24",
    "interests",
    "real",
    ALL,
    "Mountains, ocean, forest or city. What recharges you?",
  ),

  // personal
  talk(
    "25",
    "personal",
    "real",
    E,
    "What's a lesson you learned the hard way?",
  ),
  talk("26", "personal", "real", E, "Who's someone who shaped who you are?"),
  talk(
    "27",
    "personal",
    "real",
    MID,
    "What's something people often get wrong about you at first?",
  ),
  talk(
    "28",
    "personal",
    "real",
    MID,
    "What does a good friend do that you value most?",
  ),
  talk(
    "29",
    "personal",
    "real",
    LATER,
    "How do you like to be cheered up on a bad day: space, company, or distraction?",
  ),
  talk(
    "30",
    "personal",
    "real",
    LATER,
    "What helps you feel really listened to?",
  ),
  talk(
    "31",
    "personal",
    "real",
    [2, 4],
    "What's something you've changed your mind about in the last few years?",
  ),
  talk(
    "32",
    "personal",
    "real",
    SETTLED,
    "When did you last feel really close to me?",
  ),
  talk(
    "33",
    "personal",
    "real",
    SETTLED,
    "What's something you wish we made more time for?",
  ),
  talk(
    "34",
    "personal",
    "real",
    [4, 5],
    "What's a way I've changed you for the better?",
  ),
  talk(
    "35",
    "personal",
    "real",
    [4, 5],
    "What's something you've been meaning to tell me and never found the moment?",
  ),
  talk("36", "personal", "real", MID, "What does home feel like to you?"),
  talk(
    "37",
    "personal",
    "real",
    LATER,
    "How did your family show love when you were growing up?",
  ),

  // dreams
  talk(
    "38",
    "dreams",
    "real",
    ALL,
    "If money and time were no problem, what would you do next year?",
  ),
  talk("39", "dreams", "real", E, "What's something on your someday list?"),
  talk(
    "40",
    "dreams",
    "real",
    ALL,
    "What would you do if you knew you couldn't fail?",
  ),
  talk(
    "41",
    "dreams",
    "real",
    MID,
    "Where do you hope to be living in ten years?",
  ),
  talk(
    "42",
    "dreams",
    "real",
    MID,
    "What kind of work would feel meaningful to you, whatever it pays?",
  ),
  talk(
    "43",
    "dreams",
    "real",
    LATER,
    "What's a trip we should take, and what would we do there?",
  ),
  talk(
    "44",
    "dreams",
    "real",
    SETTLED,
    "What do you want our next five years to feel like?",
  ),
  talk(
    "45",
    "dreams",
    "real",
    SETTLED,
    "What's something you still want us to try together?",
  ),
  talk(
    "46",
    "dreams",
    "real",
    [4, 5],
    "What do you want to look back on when we're old?",
  ),
  talk(
    "47",
    "dreams",
    "fun",
    ALL,
    "If you could master any skill overnight, what would it be?",
  ),
  talk(
    "48",
    "dreams",
    "fun",
    E,
    "Design a perfect, slightly ridiculous day off. Go.",
  ),

  // memories
  talk("49", "memories", "real", E, "What's your favourite childhood memory?"),
  talk(
    "50",
    "memories",
    "real",
    E,
    "What's a trip or an evening you still think about?",
  ),
  talk(
    "51",
    "memories",
    "fun",
    E,
    "What's the funniest thing that ever happened to you at school?",
  ),
  talk("52", "memories", "real", MID, "What's a moment you were really brave?"),
  talk(
    "53",
    "memories",
    "real",
    LATER,
    "What's a small moment between us you remember better than the big ones?",
  ),
  talk(
    "54",
    "memories",
    "real",
    SETTLED,
    "What do you remember about the first time we met?",
  ),
  talk(
    "55",
    "memories",
    "fun",
    SETTLED,
    "What's the worst plan we ever made that turned out great?",
  ),
  talk(
    "56",
    "memories",
    "real",
    [4, 5],
    "What's a tradition of ours you'd never want to lose?",
  ),
  talk(
    "57",
    "memories",
    "real",
    MID,
    "Who did you look up to growing up, and why?",
  ),
  talk(
    "58",
    "memories",
    "fun",
    [0, 3],
    "What's the best (or worst) first date story you've got?",
  ),
];

const wyr = (
  id: string,
  tone: Tone,
  stages: Span,
  a: string,
  b: string,
  ta?: Interest,
  tb?: Interest,
): WyrCard => ({ kind: "wyr", id: `w${id}`, tone, stages, a, b, ta, tb });

export const WYR: readonly WyrCard[] = [
  wyr(
    "01",
    "fun",
    ALL,
    "A cozy night in",
    "A night out exploring",
    "cozy",
    "adventure",
  ),
  wyr("02", "fun", ALL, "Mountains", "Beach", "outdoors", "outdoors"),
  wyr("03", "fun", ALL, "Always know what's coming", "Always be surprised"),
  wyr(
    "04",
    "fun",
    ALL,
    "Cook together at home",
    "Try a new restaurant",
    "cozy",
    "food",
  ),
  wyr(
    "05",
    "fun",
    ALL,
    "Live music in a small room",
    "A big festival",
    "music",
    "music",
  ),
  wyr(
    "06",
    "fun",
    ALL,
    "A road trip with no plan",
    "A weekend trip planned to the minute",
    "adventure",
  ),
  wyr("07", "fun", ALL, "Never eat out again", "Never cook again"),
  wyr(
    "08",
    "fun",
    ALL,
    "A museum afternoon",
    "A hike with a view",
    "arts",
    "outdoors",
  ),
  wyr("09", "fun", ALL, "Speak every language", "Play every instrument"),
  wyr("10", "fun", ALL, "Brunch", "Late-night snacks", "food", "nightlife"),
  wyr(
    "11",
    "fun",
    ALL,
    "Game night with friends",
    "Dinner for two",
    "cozy",
    "food",
  ),
  wyr("12", "fun", ALL, "Be able to fly", "Be able to read minds"),
  wyr("13", "fun", ALL, "A spa day", "A day on the trails", "cozy", "active"),
  wyr(
    "14",
    "fun",
    ALL,
    "Wine and a great view",
    "Beers and a great band",
    "nightlife",
    "music",
  ),
  wyr(
    "15",
    "fun",
    ALL,
    "Paint something badly together",
    "Dance badly together",
    "arts",
    "active",
  ),
  wyr("16", "real", ALL, "A few close friends", "A big, lively crowd"),
  wyr(
    "17",
    "real",
    MID,
    "Spend big on one amazing experience",
    "Spend the same on lots of little ones",
  ),
  wyr(
    "18",
    "real",
    MID,
    "A quiet life in a small town",
    "A busy life in a big city",
  ),
  wyr(
    "19",
    "real",
    LATER,
    "A rule: phones away at dinner",
    "A rule: no rules, just us",
  ),
  wyr(
    "20",
    "real",
    LATER,
    "Always say the hard thing right away",
    "Wait for the right moment",
  ),
  wyr(
    "21",
    "fun",
    ALL,
    "Sunrise coffee on a patio",
    "Sunset drinks on a patio",
    "cozy",
    "nightlife",
  ),
  wyr("22", "fun", ALL, "Learn to surf", "Learn to ski", "active", "active"),
  wyr("23", "fun", ALL, "Escape room", "Food tour", "adventure", "food"),
  wyr(
    "24",
    "fun",
    ALL,
    "Stargazing with a blanket",
    "A midnight swim",
    "outdoors",
    "adventure",
  ),
];

const likely = (id: string, stages: Span, text: string): LikelyCard => ({
  kind: "likely",
  id: `m${id}`,
  stages,
  text,
});

export const LIKELY: readonly LikelyCard[] = [
  likely("01", ALL, "get us lost on the way there"),
  likely("02", ALL, "become a morning person overnight"),
  likely("03", ALL, "talk to a stranger and make a friend"),
  likely("04", ALL, "cry at a movie, a wedding or a dog video"),
  likely("05", ALL, "order dessert first"),
  likely("06", ALL, "be late to their own surprise party"),
  likely("07", ALL, "say yes to an unplanned adventure"),
  likely("08", ALL, "win a staring contest"),
  likely("09", ALL, "adopt a pet on impulse"),
  likely(
    "10",
    ALL,
    "still be telling a story ten minutes after everyone's heard it",
  ),
  likely("11", ALL, "start a new hobby and buy all the gear first"),
  likely("12", MID, "remember every birthday"),
  likely("13", MID, "plan the whole holiday in a spreadsheet"),
  likely("14", LATER, "say sorry first after a silly argument"),
  likely("15", LATER, "fall asleep during the movie"),
  likely("16", SETTLED, "be the one to suggest we try something new"),
];

const guess = (
  id: string,
  stages: Span,
  text: string,
  options: readonly string[],
): GuessCard => ({ kind: "guess", id: `g${id}`, stages, text, options });

export const GUESS: readonly GuessCard[] = [
  guess("01", ALL, "My ideal day off is…", [
    "A long hike",
    "A slow day at home",
    "Exploring somewhere new",
    "Eating my way through town",
  ]),
  guess("02", ALL, "On a trip I'd pick…", [
    "A beach",
    "A mountain town",
    "A big city",
    "A quiet cabin",
  ]),
  guess("03", ALL, "My go-to comfort food is…", [
    "Pizza",
    "Something spicy",
    "Pasta",
    "Something sweet",
  ]),
  guess("04", ALL, "I'm happiest when I'm…", [
    "Moving",
    "Making something",
    "Eating well",
    "Resting",
  ]),
  guess("05", ALL, "I'd rather spend an evening…", [
    "At a gig",
    "At a dinner table",
    "On a couch",
    "On an adventure",
  ]),
  guess("06", ALL, "My secret talent is closest to…", [
    "Singing",
    "Cooking",
    "Making people laugh",
    "Navigating",
  ]),
  guess("07", ALL, "My phone's most-used app is…", [
    "Music",
    "Messages",
    "Maps or photos",
    "A game",
  ]),
  guess("08", ALL, "The movie I'd rewatch is…", [
    "A comedy",
    "A thriller",
    "A romance",
    "An epic",
  ]),
  guess("09", E, "My first thought about a free Saturday is…", [
    "Get outside",
    "Catch up with friends",
    "Sleep in",
    "Try something new",
  ]),
  guess("10", MID, "When I'm stressed I mostly want…", [
    "Space",
    "A walk",
    "A good talk",
    "A snack",
  ]),
  guess("11", MID, "My love language is closest to…", [
    "Words",
    "Time together",
    "Little gifts",
    "Helping out",
  ]),
  guess("12", LATER, "I'd call my biggest strength…", [
    "Loyalty",
    "Curiosity",
    "Humour",
    "Calm",
  ]),
  guess("13", SETTLED, "My perfect anniversary is…", [
    "A big trip",
    "A quiet dinner",
    "Something new",
    "Back where it started",
  ]),
  guess("14", SETTLED, "What I'd secretly love for us to do more of…", [
    "Travel",
    "Cook together",
    "Go out dancing",
    "Do nothing, together",
  ]),
];

const tod = (
  id: string,
  stages: Span,
  truth: string,
  dare: string,
): TodCard => ({ kind: "tod", id: `d${id}`, stages, truth, dare });

export const TOD: readonly TodCard[] = [
  tod(
    "01",
    E,
    "What was your first impression of me?",
    'Give me your most sincere compliment without using the word "nice".',
  ),
  tod(
    "02",
    ALL,
    "What's a small lie you tell all the time?",
    "Do your best impression of me.",
  ),
  tod(
    "03",
    ALL,
    "What's the last thing you searched for on your phone?",
    "Show me the last photo you took, and tell me the story.",
  ),
  tod(
    "04",
    E,
    "What's one thing on your profile you'd quietly change?",
    "Pick the next song. We both have to sing the first line.",
  ),
  tod(
    "05",
    ALL,
    "What's the strangest thing you're afraid of?",
    'Tell a story in exactly three sentences, starting with "So there I was…".',
  ),
  tod(
    "06",
    ALL,
    "What's the most spontaneous thing you've ever done?",
    "Take a selfie of us both pulling the same silly face.",
  ),
  tod(
    "07",
    MID,
    "What's a green flag you look for?",
    "Order for me for the next round. No hints.",
  ),
  tod(
    "08",
    MID,
    "What's something you'd love to be asked more often?",
    "Give me a one-minute tour of your camera roll, your pick.",
  ),
  tod(
    "09",
    ALL,
    "What's the best advice you've ever ignored?",
    "Make up a ridiculous name for a restaurant that would serve our favourite food.",
  ),
  tod(
    "10",
    LATER,
    "What's something I do that makes you feel looked after?",
    "Tell me three things you appreciate about me. Quick, no thinking.",
  ),
  tod(
    "11",
    LATER,
    "What's something you've never told me about your childhood?",
    "Plan our dream weekend in 30 seconds, out loud.",
  ),
  tod(
    "12",
    SETTLED,
    "What's a moment lately you felt proud of us?",
    "Describe our first date in exactly five words.",
  ),
  tod(
    "13",
    SETTLED,
    "What's one thing you'd like us to do differently, kindly?",
    "Tell me something you love about me that I'd never guess.",
  ),
  tod(
    "14",
    ALL,
    "What's the most overrated thing everyone loves?",
    "Teach me a skill in 60 seconds, however silly.",
  ),
  tod(
    "15",
    E,
    "What's your most unpopular opinion that isn't actually that spicy?",
    "Share the story behind your name.",
  ),
  tod(
    "16",
    [4, 5],
    "What do you remember most about the day we decided to be together?",
    "Write a two-line poem about us on a napkin.",
  ),
];

export const ALL_CONTENT: readonly ContentCard[] = [
  ...TALK,
  ...WYR,
  ...LIKELY,
  ...GUESS,
  ...TOD,
];

const byId = new Map<string, ContentCard>(ALL_CONTENT.map((c) => [c.id, c]));
export const contentById = (id: string): ContentCard | null =>
  byId.get(id) ?? null;

/** Does this card suit this stage? */
export const suits = (card: { stages: Span }, stage: StageId): boolean => {
  const i = stageIndex(stage);
  return i >= card.stages[0] && i <= card.stages[1];
};
