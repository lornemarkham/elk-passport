/**
 * **Things worth texting.** Date Night has no chat, on purpose: the two of
 * you already have one. Passport makes small, playful things to send through
 * it — a This or That, a challenge, a choice the other person makes, a note
 * that opens at sunset — and the link in the text opens that exact thing.
 *
 * Storage is the adventure core's, unchanged: a play is an ordinary item
 * with no day (its `label` the sentence a person would read, its `note` the
 * play itself, tagged), and an answer is another item pointing at it. Both
 * people may add items and withdraw their own (RLS,
 * `20261021000000_passport_adventures.sql`), which is exactly what playing
 * needs, so there is no new table and nothing to apply in production.
 *
 * A note or secret that hasn't opened yet is taken out of the page before
 * it reaches the other person's browser (`hideUnopened`). The database
 * still holds it for both members, so it is a surprise, not a secret: the
 * page says so.
 *
 * Pure: kinds, the codec, the decks, the words of each text. No React.
 */

export type PlayKind = "pick" | "dare" | "decide" | "note" | "bad-idea";

/** "match": both say theirs. "predict": the sender guesses the other's. */
export type PickMode = "match" | "predict";
export type DareFlavour = "funny" | "romantic" | "adventurous" | "photo";
/** When a note opens: now, or a moment of the day (minutes after midnight). */
export type Opens = "now" | number;

export interface PlayBody {
  readonly k: PlayKind;
  /** The two choices, for pick and decide. */
  readonly a?: string;
  readonly b?: string;
  /** What the sender chose: their own pick, or their guess at the other's. */
  readonly guess?: 0 | 1;
  readonly mode?: PickMode;
  /** The words of a dare, a note, a bad idea. */
  readonly text?: string;
  readonly flavour?: DareFlavour;
  /** For a decide: what each choice does to the plan, e.g. "ending:warm". */
  readonly apply?: readonly [string | null, string | null];
  readonly opens?: Opens;
  /** A note that's a secret part of the plan, not a love note. */
  readonly secret?: true;
  /** When it was made, ms; orders the feed. */
  readonly t: number;
}

export type AnswerState = "on" | "nope" | "done";
export type Reaction = "lol" | "no" | "wait" | "love";

export interface AnswerBody {
  readonly to: string;
  readonly pick?: 0 | 1;
  readonly state?: AnswerState;
  readonly react?: Reaction;
  readonly t: number;
}

const PLAY = "♥play ";
const ANSWER = "♥answer ";

export const isPlayNote = (note: string | null | undefined): boolean =>
  Boolean(note && (note.startsWith(PLAY) || note.startsWith(ANSWER)));

export const encodePlay = (body: PlayBody): string =>
  PLAY + JSON.stringify(body);
export const encodeAnswer = (body: AnswerBody): string =>
  ANSWER + JSON.stringify(body);

const KINDS = new Set<PlayKind>(["pick", "dare", "decide", "note", "bad-idea"]);

function parse(note: string, prefix: string): Record<string, unknown> | null {
  if (!note.startsWith(prefix)) return null;
  try {
    const v = JSON.parse(note.slice(prefix.length)) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max
    ? v
    : undefined;
const bit = (v: unknown) => (v === 0 || v === 1 ? v : undefined);

export function decodePlay(note: string | null): PlayBody | null {
  const v = note ? parse(note, PLAY) : null;
  if (!v || !KINDS.has(v.k as PlayKind)) return null;
  const k = v.k as PlayKind;
  const a = str(v.a, 60);
  const b = str(v.b, 60);
  const text = str(v.text, 400);
  if ((k === "pick" || k === "decide") && (!a || !b)) return null;
  if ((k === "dare" || k === "note" || k === "bad-idea") && !text) return null;
  const apply =
    Array.isArray(v.apply) && v.apply.length === 2
      ? ([
          typeof v.apply[0] === "string" ? v.apply[0] : null,
          typeof v.apply[1] === "string" ? v.apply[1] : null,
        ] as const)
      : undefined;
  const opens =
    v.opens === "now" ||
    (typeof v.opens === "number" && v.opens >= 0 && v.opens < 48 * 60)
      ? (v.opens as Opens)
      : undefined;
  const flavour = ["funny", "romantic", "adventurous", "photo"].includes(
    v.flavour as string,
  )
    ? (v.flavour as DareFlavour)
    : undefined;
  const guess = bit(v.guess);
  return {
    k,
    ...(a ? { a } : {}),
    ...(b ? { b } : {}),
    ...(text ? { text } : {}),
    ...(guess !== undefined ? { guess } : {}),
    ...(v.mode === "match" || v.mode === "predict"
      ? { mode: v.mode as PickMode }
      : {}),
    ...(flavour ? { flavour } : {}),
    ...(apply ? { apply } : {}),
    ...(opens !== undefined ? { opens } : {}),
    ...(v.secret === true ? { secret: true as const } : {}),
    t: typeof v.t === "number" ? v.t : 0,
  };
}

export function decodeAnswer(note: string | null): AnswerBody | null {
  const v = note ? parse(note, ANSWER) : null;
  if (!v || typeof v.to !== "string") return null;
  const pick = bit(v.pick);
  const state = ["on", "nope", "done"].includes(v.state as string)
    ? (v.state as AnswerState)
    : undefined;
  const react = ["lol", "no", "wait", "love"].includes(v.react as string)
    ? (v.react as Reaction)
    : undefined;
  return {
    to: v.to,
    ...(pick !== undefined ? { pick } : {}),
    ...(state ? { state } : {}),
    ...(react ? { react } : {}),
    t: typeof v.t === "number" ? v.t : 0,
  };
}

// ------------------------------------------------------------- reading

/** As much of an adventure item as playing needs. */
export interface PlayItem {
  readonly id: string;
  readonly note: string | null;
  readonly mine: boolean;
  /** The member id of whoever added it. */
  readonly addedBy: string | null;
  readonly canChange: boolean;
}

export interface Answer extends AnswerBody {
  readonly id: string;
  readonly mine: boolean;
  readonly by: string | null;
}

export interface PlayView extends PlayBody {
  readonly id: string;
  readonly mine: boolean;
  readonly by: string | null;
  readonly canChange: boolean;
  /** The latest answer from me, and from the other person. */
  readonly yours: Answer | null;
  readonly theirs: Answer | null;
  /** Taken out before it reached this browser (`hideUnopened`). */
  readonly hidden?: true;
}

const latest = (a: Answer | null, b: Answer) => (!a || b.t >= a.t ? b : a);

/** Every play on the adventure, newest first, each with its answers. */
export function playsOf(items: readonly PlayItem[]): PlayView[] {
  const answers = new Map<
    string,
    { yours: Answer | null; theirs: Answer | null }
  >();
  for (const item of items) {
    const body = decodeAnswer(item.note);
    if (!body) continue;
    const answer: Answer = {
      ...body,
      id: item.id,
      mine: item.mine,
      by: item.addedBy,
    };
    const held = answers.get(body.to) ?? { yours: null, theirs: null };
    if (item.mine) held.yours = latest(held.yours, answer);
    else held.theirs = latest(held.theirs, answer);
    answers.set(body.to, held);
  }
  const out: PlayView[] = [];
  for (const item of items) {
    const body = decodePlay(item.note);
    if (!body) continue;
    const hidden = body.k === "note" && body.text === HIDDEN;
    const held = answers.get(item.id);
    out.push({
      ...body,
      id: item.id,
      mine: item.mine,
      by: item.addedBy,
      canChange: item.canChange,
      yours: held?.yours ?? null,
      theirs: held?.theirs ?? null,
      ...(hidden ? { hidden: true as const } : {}),
    });
  }
  return out.sort((x, y) => y.t - x.t);
}

/** Waiting on me: the other person's plays I haven't answered. */
export function waitingOn(plays: readonly PlayView[]): PlayView[] {
  return plays.filter(
    (p) => !p.mine && !p.yours && (p.k !== "note" || !p.hidden),
  );
}

// -------------------------------------------------------- notes, hidden

/** What an unopened note becomes on its way to the other person. */
export const HIDDEN = "♥play-hidden";

/** Whether a note has opened, on the day of the night. */
export function opened(
  opens: Opens | undefined,
  day: string,
  today: string,
  now: number,
): boolean {
  if (opens === undefined || opens === "now") return true;
  if (today !== day) return today > day;
  return now >= opens;
}

/**
 * **Unopened notes never reach the other browser.** The author keeps theirs;
 * for the other person, a note that hasn't opened keeps only when it opens.
 */
export function hideUnopened<T extends PlayItem & { label: string | null }>(
  items: readonly T[],
  day: string,
  today: string,
  now: number,
): T[] {
  return items.map((item) => {
    if (item.mine) return item;
    const body = decodePlay(item.note);
    if (!body || body.k !== "note" || opened(body.opens, day, today, now))
      return item;
    return {
      ...item,
      label: body.secret ? "A secret" : "A note",
      note: `${PLAY}${JSON.stringify({
        k: "note",
        text: HIDDEN,
        opens: body.opens,
        ...(body.secret ? { secret: true } : {}),
        t: body.t,
      })}`,
    };
  });
}

/** A hidden note's words, as the other person's browser receives them. */
export const isHiddenText = (text: string | undefined): boolean =>
  text === HIDDEN;

// ---------------------------------------------------------------- words

/** The sentence a play is stored under: what anyone reading the row sees. */
export function labelOf(body: PlayBody): string {
  const cut = (s: string) => (s.length > 110 ? `${s.slice(0, 107)}…` : s);
  switch (body.k) {
    case "pick":
      return cut(`This or that: ${body.a} or ${body.b}?`);
    case "decide":
      return cut(`You decide: ${body.a} or ${body.b}?`);
    case "dare":
      return cut(`A challenge: ${body.text}`);
    case "note":
      return body.secret ? "A secret" : "A note";
    case "bad-idea":
      return cut(`A bad idea: ${body.text}`);
  }
}

const FLAVOUR: Record<DareFlavour, string> = {
  funny: "😂",
  romantic: "❤️",
  adventurous: "🔥",
  photo: "📸",
};

/**
 * **What the text says.** Short, in the sender's voice, ending where the
 * link goes. `when` says a note's opening time in words ("at sunset").
 */
export function textFor(body: PlayBody, when?: string): string {
  switch (body.k) {
    case "pick":
      return body.mode === "predict"
        ? `This or that? ${body.a} or ${body.b}. I've already guessed yours. 😏`
        : `This or that? ${body.a} or ${body.b}. Pick one, then see mine.`;
    case "decide":
      return `You decide: ${body.a} or ${body.b}? Your call, I'll go with it.`;
    case "dare":
      return body.flavour === "photo"
        ? `Photo dare 📸 ${body.text}`
        : `I dare you ${FLAVOUR[body.flavour ?? "funny"]} ${body.text}`;
    case "note":
      return body.secret
        ? `There's a secret in our plan. It opens ${when ?? "later"}. No peeking. 🤫`
        : body.opens === "now" || body.opens === undefined
          ? "I left you a note in our adventure. ❤️"
          : `I left you a note. It opens ${when ?? "later"}. ❤️`;
    case "bad-idea":
      return `The Bad Ideas Department presents: ${body.text} 🙃`;
  }
}

// ---------------------------------------------------------------- decks

/** What the night is about, so the decks can be about it too. */
export type Theme = "hunt" | "lake" | "swim" | "pools" | "fire" | "dinner";

export const THIS_OR_THAT: readonly (readonly [string, string, Theme?])[] = [
  ["Hot chocolate", "Apple cider"],
  ["Driver picks the music", "Passenger picks the music"],
  ["Marshmallow golden", "Marshmallow on fire"],
  ["One big blanket", "A blanket each"],
  ["Sing in the car", "Talk the whole way"],
  ["Phones away all night", "One photo every hour"],
  ["Sweet", "Savoury"],
  ["Toque", "Hood up"],
  ["Sunset in silence", "Sunset with commentary"],
  ["Back roads", "Fastest way"],
  ["First grouse", "First deer", "hunt"],
  ["Lucky jacket", "Lucky hat", "hunt"],
  ["Skip a stone", "Throw the biggest rock", "lake"],
  ["In to the knees", "All the way under", "swim"],
  ["Hot pool", "Cold plunge first", "pools"],
  ["Hot dog on a stick", "Foil-packet anything", "fire"],
  ["Burger", "Pizza", "dinner"],
  ["Dessert first", "Dessert twice", "dinner"],
];

export const DARES: Readonly<
  Record<DareFlavour, readonly (readonly [string, Theme?])[]>
> = {
  funny: [
    ["Narrate five minutes of the drive like a nature documentary."],
    ["Speak only in questions until the next stop."],
    ["Your best grouse call. I'll rate it out of ten.", "hunt"],
    ["Name the lake something better. Defend it.", "lake"],
    ["Tell the worst joke you know with a completely straight face."],
    ["Do the weather forecast for the rest of the night, news-anchor voice."],
  ],
  romantic: [
    ["Tell me the moment you knew."],
    ["One slow dance by the water. No music required.", "lake"],
    ["Hold hands the whole drive (gear changes excused)."],
    ["Three things you love about today, before we're home."],
    ["Pick a star. Name it after something only we'd get.", "fire"],
    ["Write tonight's best moment on a napkin. Keep it."],
  ],
  adventurous: [
    ["Whoever's first in the water picks dessert.", "swim"],
    ["Cold plunge, then straight back in the hot pool. Twice.", "pools"],
    ["Find the coldest-looking rock and sit on it for 30 seconds.", "lake"],
    ["Lights off for one full minute in the dark. Just listen.", "fire"],
    ["Order something neither of us has ever tried.", "dinner"],
    ["Say yes to the next idea the other one has (within reason)."],
  ],
  photo: [
    ["Both of us, mid-laugh, with the sunset behind."],
    ["The ugliest selfie you can take. Keep it forever."],
    ["Something the other one didn't notice."],
    ["Recreate our first photo together."],
    ["The best thing in the cooler, styled like a magazine cover.", "fire"],
    ["Your feet, the water, the cold.", "swim"],
  ],
};

/** Surprise me: a twist for the night, sent as a dare. */
export const TWISTS: readonly (readonly [string, DareFlavour])[] = [
  ["The passenger picks every song tonight.", "funny"],
  ["Stop at the first viewpoint we pass. Two minutes, no phones.", "romantic"],
  ["Dessert first, whatever dinner is.", "funny"],
  ["Swap jackets for an hour.", "romantic"],
  ["Every time we see a deer, the other one owes a kiss.", "romantic"],
  ["Tonight's toast is in rhyme. Prepare.", "funny"],
  ["Take the photo the other one asks for, no arguing.", "photo"],
  ["One thing you've never told me, before the fire's out.", "romantic"],
];

export const BAD_IDEAS: readonly (readonly [string, Theme?])[] = [
  ["Hunt grouse with a butterfly net and a very confident attitude.", "hunt"],
  ["Re-enact the Titanic door scene in the lake. In November.", "lake"],
  [
    "Drive all the way to the hot pools, forget the swimsuits, sit in the car park holding hands.",
    "pools",
  ],
  [
    "Replace dinner with seven gas-station hot dogs and call it a tasting menu.",
  ],
  [
    "Write a country song about the grouse that got away. Perform it at dinner.",
    "hunt",
  ],
  ["Bring the whole family. And the in-laws. And their dog."],
  ["Plan the whole night by committee. Invite the group chat."],
  ["Skip the fire, gather round a phone playing a fireplace video.", "fire"],
  ["Cold dip, then dry off by running laps of the parking lot.", "swim"],
  ["A candlelit dinner in the truck, engine running for the heater."],
];

const THEMES = new Set<unknown>([
  "hunt",
  "lake",
  "swim",
  "pools",
  "fire",
  "dinner",
]);

/** Draw from a deck: anything general, or about what the night is about. */
export function draw<T extends readonly unknown[]>(
  deck: readonly T[],
  themes: ReadonlySet<Theme>,
  random: () => number = Math.random,
  not?: T,
): T {
  const fits = deck.filter((x) => {
    const last = x[x.length - 1];
    return x !== not && (!THEMES.has(last) || themes.has(last as Theme));
  });
  const pool = fits.length ? fits : deck;
  return pool[Math.floor(random() * pool.length)]!;
}
