/**
 * Everything on this page is invented — the six friends, the dialogue,
 * every idea card. This is Experiment 01's second sandbox (the first,
 * `/about/experiment-01-discovery-space`, tested pacing; this one tests
 * joy as a design constraint), and the same disclosed exception applies:
 * a sandbox may use invented content, exactly once per page, as long as
 * it says so — see `docs/content-model/future.md`.
 */

export type IdeaTag =
  "luxury" | "cheap" | "adrenaline" | "food" | "nightlife" | "chill";

export interface IdeaCard {
  readonly id: string;
  readonly title: string;
  readonly emoji: string;
  readonly tag: IdeaTag;
}

export const TAG_LABEL: Record<IdeaTag, string> = {
  luxury: "Luxury",
  cheap: "Cheap Fun",
  adrenaline: "Adrenaline",
  food: "Food",
  nightlife: "Nightlife",
  chill: "Chill",
};

export const IDEA_CARDS: readonly IdeaCard[] = [
  { id: "wakeboard", title: "Wakeboarding", emoji: "🌊", tag: "adrenaline" },
  { id: "skydive", title: "Skydiving", emoji: "🪂", tag: "adrenaline" },
  { id: "mtb", title: "Mountain biking", emoji: "🚵", tag: "adrenaline" },
  {
    id: "moto",
    title: "Motorcycle ride through the canyon",
    emoji: "🏍️",
    tag: "adrenaline",
  },
  { id: "cliff", title: "Cliff jumping", emoji: "🤿", tag: "adrenaline" },
  { id: "boat", title: "Private boat charter", emoji: "🛥️", tag: "luxury" },
  { id: "heli", title: "Helicopter tour", emoji: "🚁", tag: "luxury" },
  {
    id: "finedining",
    title: "Fine dining tasting menu",
    emoji: "🍽️",
    tag: "luxury",
  },
  { id: "vip", title: "VIP nightclub table", emoji: "🥂", tag: "luxury" },
  {
    id: "golf",
    title: "Best golf course in the Okanagan",
    emoji: "⛳",
    tag: "luxury",
  },
  {
    id: "patio",
    title: "Lakefront patio for beers",
    emoji: "🍻",
    tag: "chill",
  },
  { id: "poolnap", title: "Pool nap", emoji: "😴", tag: "chill" },
  {
    id: "pedicure",
    title: "Pedicures — it's sandal season",
    emoji: "💅",
    tag: "chill",
  },
  { id: "jerky", title: "Best beef jerky in town", emoji: "🥩", tag: "food" },
  { id: "foodtruck", title: "Food truck crawl", emoji: "🌮", tag: "cheap" },
  { id: "swimhole", title: "Hidden swimming hole", emoji: "🏞️", tag: "cheap" },
  { id: "discgolf", title: "Disc golf", emoji: "🥏", tag: "cheap" },
  { id: "campfire", title: "Campfire + guitar", emoji: "🔥", tag: "chill" },
  { id: "karaoke", title: "Karaoke night", emoji: "🎤", tag: "nightlife" },
  {
    id: "livemusic",
    title: "Live music on a patio",
    emoji: "🎸",
    tag: "nightlife",
  },
  { id: "paddle", title: "Sunset paddleboard", emoji: "🌅", tag: "chill" },
];

export interface ScriptLine {
  readonly speaker: string;
  readonly line: string;
  readonly yell?: boolean;
}

/** Section 01's scripted opening — the brief's own example lines, used near-verbatim. */
export const OPENING_SCRIPT: readonly ScriptLine[] = [
  { speaker: "Jake", line: "WAKEBOARDING!", yell: true },
  { speaker: "Room", line: "HELL YEAH!", yell: true },
  { speaker: "Marcus", line: "Lakefront patio for beers." },
  { speaker: "Room", line: "OH YEAH.", yell: true },
  { speaker: "Sam", line: "Pedicures." },
  { speaker: "Room", line: "What?" },
  { speaker: "Sam", line: "IT'S SANDAL SEASON, BOYS.", yell: true },
  { speaker: "Chris", line: "...actually, I'm in." },
  { speaker: "Theo", line: "Pool nap." },
  { speaker: "Theo", line: "Best beef jerky in town." },
  { speaker: "Dev", line: "Golf tomorrow?" },
  { speaker: "Chris", line: "Par three?" },
  {
    speaker: "Jake",
    line: "HELL NO. Best course in the Okanagan.",
    yell: true,
  },
  { speaker: "Chris", line: "It's expensive." },
  { speaker: "Marcus", line: "GOLF ON ME, BOYS.", yell: true },
  { speaker: "Jake", line: "Skydiving." },
  { speaker: "Sam", line: "No chance." },
  { speaker: "Jake", line: "You're scared." },
  { speaker: "Sam", line: "Show me the video." },
];

export const CREW = ["Jake", "Marcus", "Sam", "Theo", "Dev", "Chris"] as const;

/** Which fictional friend gets credited when a tag is winning the room — Section "MVP of the Room." */
export const TAG_CHAMPION: Record<IdeaTag, { name: string; line: string }> = {
  adrenaline: {
    name: "Jake",
    line: "is personally responsible for the adrenaline count.",
  },
  luxury: {
    name: "Marcus",
    line: 'keeps saying "I got this" and somehow means it.',
  },
  chill: {
    name: "Sam",
    line: "found every excuse to nap and nobody's mad about it.",
  },
  food: { name: "Theo", line: "has not stopped talking about jerky." },
  nightlife: { name: "Dev", line: "already knows the karaoke song." },
  cheap: {
    name: "Chris",
    line: "found the free stuff nobody else was looking for.",
  },
};

export interface HypeManCondition {
  readonly test: (state: {
    bucketCount: number;
    tagCounts: Record<IdeaTag, number>;
    energy: number;
  }) => boolean;
  readonly line: string;
}

/** Checked in order — first match wins. Falls back to `HYPE_MAN_POOL` below when nothing matches. */
export const HYPE_MAN_RULES: readonly HypeManCondition[] = [
  { test: (s) => s.bucketCount === 0, line: "Room's quiet. That never lasts." },
  {
    test: (s) => s.tagCounts.adrenaline >= 3 && s.tagCounts.food === 0,
    line: "So far you've planned three adrenaline activities and zero food. Hydration appears to be optional.",
  },
  {
    test: (s) => s.bucketCount >= 15,
    line: "You've accidentally built the greatest Saturday ever.",
  },
  {
    test: (s) => s.energy >= 85,
    line: "Somebody's definitely losing sunglasses.",
  },
  {
    test: (s) => s.tagCounts.luxury >= 3 && s.tagCounts.cheap >= 3,
    line: "You can't decide if you're rich or broke. Respect.",
  },
];

export const HYPE_MAN_POOL: readonly string[] = [
  "You boys are absolutely unhinged.",
  "I have concerns.",
  "This is either the best plan I've ever seen or a cry for help.",
  "Nobody's talked about sunscreen once.",
];

export const BEER_BETS: readonly string[] = [
  "🍺 I bet this becomes the best memory.",
  "🍺 Loser buys breakfast.",
  "🍺 Winner chooses karaoke.",
  "🍺 Loser wears the Hawaiian shirt all day.",
  "🍺 Winner gets shotgun.",
  "🍺 Loser carries the cooler.",
];

export const GOLD_STARS: readonly string[] = [
  "Campfire Legend",
  "Jerky King",
  "Patio Professional",
  "Caesar Champion",
  "Sandal Season Survivor",
  "Cannonball MVP",
];

export const HYPE_VIDEOS: readonly {
  title: string;
  beats: readonly string[];
}[] = [
  {
    title: "Wakeboarding",
    beats: ["Rooster tail", "Wipeout", "Redemption run"],
  },
  {
    title: "Skydiving",
    beats: [
      "The door opens",
      "Freefall",
      "Canopy, silence, everyone screaming anyway",
    ],
  },
  {
    title: "Campfire",
    beats: [
      "Sparks up",
      "Someone's guitar",
      "The story that gets better every year",
    ],
  },
  {
    title: "Mountain biking",
    beats: ["Dust trail", "The drop", "Someone eats it, everyone's fine"],
  },
  {
    title: "Patio beers",
    beats: ["Golden hour", "Clinking glasses", "Nobody wants to leave"],
  },
  {
    title: "Motorcycle ride",
    beats: ["Canyon road", "Wind", "Helmets off, no words needed"],
  },
];

export interface MusicMood {
  readonly label: string;
  readonly note: string;
}

/** Purely derived from `energy` tier — no real audio, "prototype the feeling" per the brief. */
export const MUSIC_BY_TIER: readonly [threshold: number, mood: MusicMood][] = [
  [
    0,
    { label: "Acoustic, low and easy", note: "Now scoring: the calm before." },
  ],
  [
    34,
    {
      label: "Classic rock, windows down",
      note: "Now scoring: the drive there.",
    },
  ],
  [67, { label: "Full send. Bass up.", note: "Now scoring: absolute chaos." }],
];
