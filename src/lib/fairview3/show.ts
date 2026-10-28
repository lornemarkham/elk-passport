/**
 * **Fairview 3 — No More Crystal Balls.** The whole show, as data.
 *
 * One presenter walks ~140 phones through these sections in order. Every
 * section id is stable: the live state names the current one, the stage and
 * every phone render it. Content lives here so a wording change is a data
 * change, and so the server can validate a vote against the question it
 * belongs to without trusting the client.
 */

export const SECTION_IDS = [
  "curtain",
  "merlin",
  "spellbook",
  "team-data",
  "team-ai",
  "team-unification",
  "team-care",
  "parallel",
  "know",
  "vote-1",
  "vote-2",
  "vote-3",
  "challenge",
  "hotseat",
  "showdown",
  "finale",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const isSectionId = (s: unknown): s is SectionId =>
  typeof s === "string" && (SECTION_IDS as readonly string[]).includes(s);

export const QUESTION_IDS = ["q1", "q2", "q3", "q4"] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];
export const isQuestionId = (s: unknown): s is QuestionId =>
  typeof s === "string" && (QUESTION_IDS as readonly string[]).includes(s);

/** The musical showdown: three songs, one story, the room picks the sound. */
export const TRACK_IDS = ["metal", "country", "electroswing"] as const;
export type TrackId = (typeof TRACK_IDS)[number];
export const isTrackId = (s: unknown): s is TrackId =>
  typeof s === "string" && (TRACK_IDS as readonly string[]).includes(s);

export interface Track {
  readonly id: TrackId;
  /** The audio slot's name; the file is `<slot>.mp3` unless a URL is set. */
  readonly slot: string;
  /** Its position on the showdown ballot (option index of question q4). */
  readonly option: number;
  readonly label: string;
  readonly blurb: string;
  readonly emoji: string;
  readonly finaleKicker: string;
}

export const TRACKS: readonly Track[] = [
  {
    id: "metal",
    slot: "fairview3-metal",
    option: 0,
    label: "HEAVY METAL",
    blurb: "Loud guitars. No mercy.",
    emoji: "🤘",
    finaleKicker: "Loud guitars. No mercy.",
  },
  {
    id: "country",
    slot: "fairview3-country",
    option: 1,
    label: "OUTLAW COUNTRY",
    blurb: "Boots, grit and questionable decisions.",
    emoji: "🤠",
    finaleKicker: "Boots, grit and questionable decisions.",
  },
  {
    id: "electroswing",
    slot: "fairview3-electroswing",
    option: 2,
    label: "ELECTRO SWING",
    blurb: "Vintage swagger, brass and dance-floor chaos.",
    emoji: "🎺",
    finaleKicker: "Vintage swagger, brass and dance-floor chaos.",
  },
];

export const trackById = (id: TrackId): Track =>
  TRACKS.find((t) => t.id === id)!;

/** Where a slot's file lives when the presenter has not set a URL. */
export const defaultAudioPath = (id: TrackId): string =>
  `/fairview3/audio/${trackById(id).slot}.mp3`;

/**
 * The leader of a tally, or `null` when nobody has voted or two tracks share
 * the top (the presenter then picks; the room's tie is not ours to break).
 */
export function leaderOf(tally: readonly number[]): TrackId | null {
  const top = Math.max(0, ...tally);
  if (top === 0) return null;
  const leaders = TRACKS.filter((t) => (tally[t.option] ?? 0) === top);
  return leaders.length === 1 ? leaders[0]!.id : null;
}

export interface Question {
  readonly id: QuestionId;
  readonly section: SectionId;
  readonly prompt: string;
  readonly options: readonly string[];
  /** What the presenter says after the reveal; shown small on the stage. */
  readonly note?: string;
}

export const QUESTIONS: readonly Question[] = [
  {
    id: "q1",
    section: "vote-1",
    prompt: "What is Fairview 3's greatest strength?",
    options: [
      "Data and evidence",
      "AI and velocity",
      "Unification",
      "Care Management",
      "Bringing everything together",
    ],
  },
  {
    id: "q2",
    section: "vote-2",
    prompt: "What would help us win?",
    options: [
      "Reliable referral measurement",
      "Faster development",
      "Successful PP-to-Pro migration",
      "Better customer feedback",
      "Stronger collaboration",
    ],
  },
  {
    id: "q3",
    section: "vote-3",
    prompt:
      "Can we modernize our platform while delivering business value today?",
    options: ["Absolutely", "Yes, but it will be challenging", "Show me how"],
    note: "Delivering both is our commitment. This was never a popularity vote.",
  },
  {
    id: "q4",
    section: "showdown",
    prompt: "HOW SHOULD FAIRVIEW 3 ROCK THE HOUSE?",
    options: TRACKS.map((t) => t.label),
  },
];

export const questionById = (id: QuestionId): Question =>
  QUESTIONS.find((q) => q.id === id)!;

export const questionForSection = (section: SectionId): Question | undefined =>
  QUESTIONS.find((q) => q.section === section);

/** The three things we ask people to challenge us on. */
export const FEEDBACK_PROMPTS = [
  { id: "missed", label: "What did we miss?" },
  { id: "better", label: "What is one thing we could do better?" },
  { id: "deliver", label: "What would help our teams deliver?" },
] as const;

export type FeedbackPromptId = (typeof FEEDBACK_PROMPTS)[number]["id"];
export const isFeedbackPromptId = (s: unknown): s is FeedbackPromptId =>
  typeof s === "string" && FEEDBACK_PROMPTS.some((p) => p.id === s);

export const FEEDBACK_MAX_CHARS = 280;

/** Executive Hot Seat: questions from the room, answered live by the team. */
export const QA_MAX_CHARS = 280;
export const QA_NAME_MAX_CHARS = 32;
export const QA_MAX_PER_PARTICIPANT = 5;
export type QaStatus = "visible" | "answered" | "hidden";
export const isQaStatus = (s: unknown): s is QaStatus =>
  s === "visible" || s === "answered" || s === "hidden";
export const FEEDBACK_MAX_PER_PARTICIPANT = 6;

export interface Team {
  readonly id: "data" | "ai" | "unification" | "care";
  readonly section: SectionId;
  readonly number: string;
  readonly name: string;
  readonly epithet: string;
  readonly sigil: string;
  /** Tailwind colour tokens; the hue is the team's identity across the show. */
  readonly hue: string;
  readonly headline: string;
  readonly lines: readonly string[];
  readonly quote: string;
}

export const TEAMS: readonly Team[] = [
  {
    id: "data",
    section: "team-data",
    number: "01",
    name: "Data",
    epithet: "The Truth Seekers",
    sigil: "🔭",
    hue: "cyan",
    headline: "Data-Driven Decisions.",
    lines: [
      "We believe in evidence.",
      "Baselines. Measurement. Attribution. Real results.",
      "Our superpower is separating what we believe from what we can prove.",
    ],
    quote: "We don't need a crystal ball. We need a baseline.",
  },
  {
    id: "ai",
    section: "team-ai",
    number: "02",
    name: "AI",
    epithet: "The Accelerators",
    sigil: "⚡",
    hue: "fuchsia",
    headline: "AI increases engineering velocity and software quality.",
    lines: [
      "We are not experimenting with AI because it is fashionable.",
      "We are using AI to deliver. Better software. Faster development. Higher quality.",
      "The thing on your phone right now was built with AI. That is the proof.",
    ],
    quote: "We are using AI to deliver.",
  },
  {
    id: "unification",
    section: "team-unification",
    number: "03",
    name: "Unification",
    epithet: "The Bridge Builders",
    sigil: "🌉",
    hue: "amber",
    headline: "Private Practice → Pro.",
    lines: [
      "This is not a new product. We are moving existing customers from Private Practice to the Pro platform.",
      "Essential modernization: less fragmentation, a stronger foundation, better customer data, faster future development.",
      "It may not be glamorous. We are going to rock it anyway.",
    ],
    quote: "We are going to rock Unification.",
  },
  {
    id: "care",
    section: "team-care",
    number: "04",
    name: "Care Management",
    epithet: "The Alchemists",
    sigil: "🧪",
    hue: "emerald",
    headline: "Capabilities that matter to our business.",
    lines: [
      "Inbound referrals: clinics need patients. Helping clinics receive referrals creates customer value and keeps customers.",
      "Outbound referrals: Cochlear wants appropriate cochlear implant referrals. We are building the capabilities that support that.",
      "We care about the clinics. We care about their patients. And we care about delivering business results.",
    ],
    quote: "Two referral directions. One team.",
  },
];

export const teamForSection = (section: SectionId): Team | undefined =>
  TEAMS.find((t) => t.section === section);

/** The rungs of the serious moment, in the order the presenter climbs them. */
export const KNOW_LADDER = [
  { n: 1, label: "Patients represented in our database" },
  { n: 2, label: "Patients identified as potential candidates" },
  { n: 3, label: "Outbound referrals generated through our work" },
  { n: 4, label: "Verified referral outcomes" },
] as const;

export const KNOW_SPEECH = [
  "I want us to win.",
  "Not look like we're winning. Actually win.",
  "If we're going to say we're generating referrals, I want to know how many we're actually generating.",
  "I want a baseline. I want honest attribution. I want us to know what's working.",
  "Because I don't want to celebrate numbers we can't explain.",
  "I want to build something so good that we don't have to guess.",
  "That's Data-Driven Decisions. And that's how we're going to win.",
] as const;

export const ANTHEM_TITLE = "No More Crystal Balls";
export const ANTHEM_SUBTITLE = "The Fairview 3 Anthem";

/** Original lyrics. The presenter can replace them from the console. */
export const ANTHEM_LYRICS = `[Verse 1]
Merlin had a forecast, he read it in the mist
Said the numbers would go up and right, then he closed his fist
We asked him for a baseline, he gave us smoke and flame
We don't do forecasts anymore. We measure. That's the game.

[Pre-chorus]
Count it. Prove it. Say it to my face.
Every referral has a name, a time, a place.

[Chorus]
NO MORE CRYSTAL BALLS!
We don't need magic, we need to know
NO MORE CRYSTAL BALLS!
Baseline first, then watch it grow
Four teams, one mission, zero make-believe
We don't celebrate what we can't see

[Verse 2]
Private Practice to Pro, we're building the bridge tonight
Care Management's in the lab, turning lead to light
Not one after the other, we are running them as one
Data's got the lantern, AI's got the engine, go

[Chorus]
NO MORE CRYSTAL BALLS!
We don't need magic, we need to know
NO MORE CRYSTAL BALLS!
Baseline first, then watch it grow

[Bridge]
If we win, we'll know we won
If we miss, we'll know we missed
That's the only kind of magic
On a truth seeker's list

[Final chorus]
NO MORE CRYSTAL BALLS!
We want to win and we want to prove it
NO MORE CRYSTAL BALLS!
Fairview 3, now let's move it!`;

export interface SectionMeta {
  readonly id: SectionId;
  /** Short label for the presenter's console. */
  readonly label: string;
  /** One line the presenter sees as a cue. */
  readonly cue: string;
}

export const SECTIONS: readonly SectionMeta[] = [
  { id: "curtain", label: "Curtain", cue: "QR on screen. Let the room fill." },
  {
    id: "merlin",
    label: "Merlin",
    cue: "The old way: forecasts by crystal ball.",
  },
  {
    id: "spellbook",
    label: "Spellbook",
    cue: "We believe in magic. We just don't measure with it.",
  },
  { id: "team-data", label: "Data", cue: "The Truth Seekers." },
  {
    id: "team-ai",
    label: "AI",
    cue: "The Accelerators. This app is the proof.",
  },
  {
    id: "team-unification",
    label: "Unification",
    cue: "The Bridge Builders. PP → Pro. Not a new product.",
  },
  {
    id: "team-care",
    label: "Care Mgmt",
    cue: "The Alchemists. Inbound and outbound referrals.",
  },
  {
    id: "parallel",
    label: "In parallel",
    cue: "Both at once. Not sequential.",
  },
  {
    id: "know",
    label: "We need to know",
    cue: "The jokes stop. Read the speech.",
  },
  { id: "vote-1", label: "Vote 1", cue: "Open voting, then reveal." },
  { id: "vote-2", label: "Vote 2", cue: "Open voting, then reveal." },
  {
    id: "vote-3",
    label: "Vote 3",
    cue: "Open, reveal, then: both is our commitment.",
  },
  {
    id: "challenge",
    label: "Challenge us",
    cue: "Approve feedback as it lands; it shows on the stage.",
  },
  {
    id: "hotseat",
    label: "Hot Seat",
    cue: "Select a question to put it on the stage. Answer it live. Mark it answered.",
  },
  {
    id: "showdown",
    label: "Showdown",
    cue: "Open voting, close, reveal, announce the winner. Then the finale.",
  },
  { id: "finale", label: "Finale", cue: "Start the winning song." },
];

export const sectionIndex = (id: SectionId): number => SECTION_IDS.indexOf(id);
