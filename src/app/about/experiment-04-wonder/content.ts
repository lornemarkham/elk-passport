/**
 * Experiment 04 — "Wonder." Deliberately smaller than the sandboxes
 * before it, on purpose — the brief itself said not to solve everything.
 * Every discovery theme, mission, and keepsake item here is invented for
 * this sketch, disclosed as such, same discipline as the rest of ELK
 * Labs (`docs/content-model/future.md`).
 */

export interface DiscoveryTheme {
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  readonly line: string;
}

export const DISCOVERY_THEMES: readonly DiscoveryTheme[] = [
  {
    id: "butterflies",
    emoji: "🦋",
    title: "Butterflies",
    line: "Stand still long enough and one might land nearby.",
  },
  {
    id: "birds",
    emoji: "🐦",
    title: "Birds",
    line: "Close your eyes first. See how many you can hear.",
  },
  {
    id: "berries",
    emoji: "🍓",
    title: "Berry Picking",
    line: "One for the basket, one for you. That's the rule.",
  },
  {
    id: "forest",
    emoji: "🌲",
    title: "Forest Adventures",
    line: "The path always looks different on the way back.",
  },
  {
    id: "fishing",
    emoji: "🐟",
    title: "Fishing",
    line: "Mostly waiting. All of it worth it.",
  },
  {
    id: "swimming",
    emoji: "🏊",
    title: "Swimming",
    line: "Cold for a second, then not at all.",
  },
  {
    id: "farms",
    emoji: "🚜",
    title: "Farms",
    line: "Everything smells like something out here.",
  },
  {
    id: "wildflowers",
    emoji: "🌼",
    title: "Wildflowers",
    line: "Pick one, name it something ridiculous.",
  },
  {
    id: "night-sky",
    emoji: "🌙",
    title: "Night Sky",
    line: "Wait for your eyes to adjust. Then really wait.",
  },
  {
    id: "campfires",
    emoji: "🔥",
    title: "Campfires",
    line: "Someone always ends up telling the same story again.",
  },
  {
    id: "songs",
    emoji: "🎵",
    title: "Songs",
    line: "Wrong words are more fun than right ones.",
  },
  {
    id: "stories",
    emoji: "📖",
    title: "Stories",
    line: "Ask them to tell you one back. It's always better.",
  },
  {
    id: "navigation",
    emoji: "🧭",
    title: "Navigation",
    line: "Let them lead for a while, even the wrong way.",
  },
  {
    id: "healthy-food",
    emoji: "🍎",
    title: "Healthy Food",
    line: "Somehow it tastes better outside.",
  },
  {
    id: "trains",
    emoji: "🚂",
    title: "Trains",
    line: "Wave. They almost always wave back.",
  },
  {
    id: "wildlife",
    emoji: "🦌",
    title: "Wildlife",
    line: "Whisper. Point. Don't move.",
  },
  {
    id: "bugs",
    emoji: "🪲",
    title: "Bugs",
    line: "The ones that seem the grossest are usually the favourite.",
  },
  {
    id: "rainy-day",
    emoji: "🌧️",
    title: "Rainy Day Discovery",
    line: "Puddles are not an obstacle. Puddles are the plan.",
  },
];

export interface WordOfTheDay {
  readonly word: string;
  readonly line: string;
}

export const WORDS_OF_THE_DAY: readonly WordOfTheDay[] = [
  {
    word: "Curious",
    line: "Today, notice one thing you've never noticed before.",
  },
  { word: "Kind", line: "Today, let someone else choose sometimes." },
  {
    word: "Patient",
    line: "Today, wait for the butterfly instead of chasing it.",
  },
  { word: "Brave", line: "Today, touch the thing that looks a little scary." },
  { word: "Creative", line: "Today, name something ordinary something new." },
  { word: "Observant", line: "Today, find one detail nobody else caught." },
  {
    word: "Playful",
    line: "Today, take the game more seriously than the plan.",
  },
];

export interface TodayWeItem {
  readonly id: string;
  readonly emoji: string;
  readonly label: string;
}

export const TODAY_WE_ITEMS: readonly TodayWeItem[] = [
  { id: "photos", emoji: "📸", label: "Took photos" },
  { id: "butterflies", emoji: "🦋", label: "Found butterflies" },
  { id: "berries", emoji: "🍓", label: "Picked berries" },
  { id: "songs", emoji: "🎵", label: "Sang songs" },
  { id: "swimming", emoji: "🏊", label: "Went swimming" },
  { id: "laughed", emoji: "😂", label: "Laughed" },
  { id: "word", emoji: "📖", label: "Learned a new word" },
];

export interface Mission {
  readonly id: string;
  readonly emoji: string;
  readonly prompt: string;
}

export const LITTLE_MISSIONS: readonly Mission[] = [
  { id: "five-butterflies", emoji: "🦋", prompt: "Find five butterflies?" },
  { id: "three-birds", emoji: "🐦", prompt: "Hear three birds?" },
  { id: "one-hawk", emoji: "🦅", prompt: "Spot one hawk?" },
  { id: "red-leaf", emoji: "🍁", prompt: "Find a red leaf?" },
  { id: "skip-rocks", emoji: "🪨", prompt: "Skip five rocks?" },
  { id: "lavender", emoji: "💜", prompt: "Smell lavender?" },
  { id: "watch-bee", emoji: "🐝", prompt: "Watch a bee?" },
  { id: "new-fruit", emoji: "🍑", prompt: "Eat one new fruit?" },
  { id: "clouds", emoji: "☁️", prompt: "Notice the clouds?" },
];

export const TUNE_IDEAS: readonly string[] = [
  "Mr. Wiggles and friends",
  "Real nature sounds — birdsong, water, wind",
  "Road trip singalongs",
  "A dance break, out of nowhere",
  "Deliberately silly songs — the sillier, the better",
];

/** Real Atlas capabilities this experiment would lean on — most of these don't exist yet, named honestly, not claimed. */
export const ATLAS_INGREDIENTS: readonly string[] = [
  "Swimming nearby",
  "Berry patches",
  "Picnic areas",
  "Educational stops",
  "Butterfly gardens",
  "Nature centres",
  "Ice cream",
  "Healthy food",
  "Playgrounds",
];

/**
 * The deliberately unfinished part — real open questions this sketch
 * raised, not resolved ones. Same spirit as `/about/vision`'s Raw Idea
 * Vault: nothing here is cleaned up or answered, on purpose.
 */
export const OPEN_QUESTIONS: readonly string[] = [
  'Does "Word of the Day" feel gentle, or does it risk feeling like a lesson plan in disguise?',
  "Who chooses the day — the adult or the kid — and does the answer change with age?",
  "Does the keepsake belong to the child, the adult, or both, equally, and does that change how it's built?",
  "Should a Little Mission ever have a graceful way to let go of it, without it reading as failure?",
  "What does this look like for a mentor who sees the kid once a month, versus a parent who sees them every day?",
  "Is there a quieter version of this for a solo adult rediscovering wonder on their own, with nobody else along?",
  "How much of this is actually about the kid, and how much is really about the adult remembering how to notice things?",
  "Does Atlas even have a way to know where a real butterfly garden or berry patch is yet? (Almost certainly not. Named here so nobody has to rediscover that gap later.)",
];
